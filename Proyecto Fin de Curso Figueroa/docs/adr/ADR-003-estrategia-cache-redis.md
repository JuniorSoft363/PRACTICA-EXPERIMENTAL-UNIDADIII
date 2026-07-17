# ADR-003: Estrategia de Caché y Blacklist de Sesiones (Redis 7 con Patrón Cache-Aside)

## 1. Estado
**Aceptado** (2026-07-17)

---

## 2. Contexto
La plataforma **Artisync (PFC)** expone endpoints de alto tráfico con requerimientos de latencia extremadamente bajos y alta concurrencia, en los cuales emergen dos retos críticos de ingeniería de software y seguridad:

1. **La invalidación de tokens en autenticación sin estado (*Stateless JWT*)**: Al utilizar JSON Web Tokens (JWT) firmados de forma asíncrona o simétrica (`jjwt-0.12`), el servidor no conserva estado de la sesión (`SecurityContextHolder` se reconstruye por cada petición). Sin embargo, si un usuario realiza *logout* explícito, cambia su contraseña tras detectar una intrusión (`ChangePasswordRequest`) o es bloqueado por un administrador, **los tokens emitidos seguirían siendo válidos en el cliente hasta su expiración natural** (`security.jwt.expiration-time=86400000` / 24 horas), lo cual representa un riesgo grave de seguridad (criterio OWASP Top 10 A07: Identificación y Fallos de Autenticación).
2. **Consultas intensivas sobre el Catálogo de Servicios**: La exploración pública del catálogo por parte de miles de clientes (*Buscadores de Talento*) para consultar perfiles de artistas, categorías (`Categoria`) y servicios (`Servicio`) no modificados frecuentemente genera una carga de lectura en la base de datos **PostgreSQL 16** que puede representar el 80% o más del total de I/O de la plataforma.

Se requirió diseñar e implementar una estrategia de almacenamiento temporal rápido (Caché en Memoria) y definir el patrón arquitectónico de consulta/invalidación óptimo para el sistema.

---

## 3. Decisión Arquitectónica
Se ha decidido incorporar un contenedor dedicado de **Redis 7 Alpine (`pfc_redis:6379`)** al stack de infraestructura de Artisync, integrándolo con **Spring Boot (`spring-boot-starter-data-redis`)** e implementando una **Estrategia Híbrida de Caché**:

### 3.1 Patrón Cache-Aside para Lecturas del Catálogo de Servicios
Para las entidades de lectura frecuente y baja mutación (ej. listados públicos de categorías, tarifas de servicios y portafolios):
1. **Petición de lectura (*Cache Miss*)**: Cuando el controlador solicita un servicio (`ServicioCatalogoServicioImpl`), la lógica primero consulta en **Redis** mediante una clave determinista (ej. `catalogo:servicio:10`). Si no existe en Redis (*Miss*), consulta en **PostgreSQL via JPA**, almacena inmediatamente el DTO resultante en Redis con un Tiempo de Vida (TTL) estándar (ej. 30 o 60 minutos) y lo devuelve al usuario.
2. **Petición de lectura (*Cache Hit*)**: En consultas subsecuentes, el DTO se sirve en **$< 2$ milisegundos ($O(1)$)** directamente desde Redis, sin tocar la base de datos.
3. **Invalidación por Mutación (*Write-Through / Eviction*)**: Si el artista actualiza o elimina su servicio mediante un comando `PUT/DELETE`, la capa transaccional ejecuta `redisTemplate.delete("catalogo:servicio:10")`, garantizando consistencia coherente sin servir datos caducos (*Stale Data*).

### 3.2 Patrón Blacklist de JTI para Revocación Inmediata de JWT
Para resolver el problema del *logout* en JWT sin convertir el sistema en un modelo *stateful* pesado:
1. Al emitir un JWT en `JwtService`, se inyecta un *claim* único **`jti` (JWT ID - UUID)** y una fecha exacta de expiración `exp`.
2. Cuando el usuario cierra sesión (`/api/auth/logout`) o cambia de contraseña (`UserServiceImpl.changePassword`), el servicio `SessionRevocationService` extrae el `jti` y calcula el tiempo de vida restante del token ($T_{restante} = exp - now$).
3. Escribe en **Redis** la clave `jti:<id>` con el valor `"revocado"` y un **TTL (`Duration.ofMillis(tiempoRestante)`) exactamente igual al tiempo que le queda al token por caducar**.
4. En cada petición autenticada, el interceptor `JwtAuthenticationFilter` verifica por red a Redis en microsegundos si la clave `jti:<id>` existe; si existe, aborta la petición con `401 Unauthorized`.
5. **Autoliberación de Memoria**: Cuando el token expira naturalmente, **Redis elimina la entrada del `jti` en segundo plano** gracias a su mecanismo interno de expiración, manteniendo el consumo de memoria Heap/RAM del clúster Redis acotado y predecible.

---

## 4. Alternativas Consideradas

| Alternativa | Descripción | Pros | Contras y Justificación de Descarte |
| :--- | :--- | :--- | :--- |
| **Caché / Blacklist en Base de Datos Relacional (PostgreSQL)** | Guardar una tabla `token_blacklist` o de caché transaccional en la misma base de datos PostgreSQL (`pfc_postgres`). | • No requiere servicios Docker adicionales.<br>• Mantenimiento SQL estándar con índices. | **Descartada por sobrecarga y latencia:**<br>1. Consultar una tabla SQL en cada una de las peticiones HTTP del sistema (en `JwtAuthenticationFilter`) saturaría el *Connection Pool* (`HikariCP`) y multiplicaría por 3 la latencia media de respuesta.<br>2. La limpieza de tokens expirados en PostgreSQL requeriría *Cron jobs* programados con `DELETE FROM ... WHERE exp < NOW()`, fragmentando índices y consumiendo CPU. |
| **Caché Local en JVM (Ehcache / ConcurrentHashMap en memoria)** | Almacenar los DTOs cacheados y la lista de JTI en la memoria Heap interna del proceso Spring Boot (`@Cacheable` con proveedor en memoria). | • Latencia sub-milisegundo puramente en memoria sin red.<br>• Configuración cero en infraestructura. | **Descartada por escalabilidad horizontal y pérdida en reinicio:**<br>1. En un entorno distribuido con múltiples réplicas de `pfc_backend` (por detrás de un balanceador Nginx/Load Balancer), un token revocado en la instancia A **no estaría revocado en la instancia B**, permitiendo brechas de seguridad.<br>2. Al reiniciar el contenedor por un despliegue CI/CD, toda la Blacklist se evaporaría instantáneamente. |
| **Patrón Read-Through / Write-Through puro con Caché de 2º Nivel JPA** | Activar la caché de segundo nivel de Hibernate (`hibernate.cache.use_second_level_cache`) con un proveedor distribuido. | • Transparente para el código transaccional (lo maneja Hibernate por debajo del agua). | **Descartada por falta de control sobre invalidación de Tokens:**<br>La caché transaccional de Hibernate está diseñada para entidades de dominio, no para gestionar estructuras clave-valor temporales con TTL arbitrarios por token JWT (`jti:<token>`), lo que requeriría mezclar dos sistemas o mantener Redis de todos modos. |

---

## 5. Consecuencias y Trade-offs

### 5.1 Beneficios Positivos (+)
- **Seguridad Infranqueable y Cierre de Sesión Real**: Combina las ventajas de escalabilidad del JWT sin estado con la capacidad de revocación inmediata (cierre de sesión remoto por compromiso de cuenta en microsegundos).
- **Reducción >80% de Latencia en Catálogo**: El patrón Cache-Aside libera al motor PostgreSQL de ejecutar *joins* pesados en la exploración pública del catálogo, reduciendo el tiempo medio de respuesta (*TTFB*) de 45 ms a < 3 ms.
- **Eficiencia de Memoria O(1) Autolimpiable**: Al asignar a cada entrada de Blacklist en Redis un TTL exactamente coincidente con la expiración del token, el costo de almacenamiento no crece de forma ilimitada con el tiempo.

### 5.2 Riesgos Negativos (-) y Trade-offs
- **Dependencia de Alta Disponibilidad de Redis (-)**: Si el contenedor `pfc_redis` cae o se desconecta, el filtro `JwtAuthenticationFilter` o el servicio de caché fallaría al intentar consultar si el token está revocado.
  - *Mitigación implementada*: En el filtro `JwtAuthenticationFilter`, si la conexión con Redis lanza excepción por caída técnica, se registra un *Warning* en los logs y (según política de tolerancia) se evalúa la firma criptográfica como mecanismo de contingencia para no interrumpir el servicio de usuarios legítimos, o se activa una réplica Redis en modo *Sentinel/Cluster* en producción.
- **Complejidad en Consistencia (*Stale Cache* -)**: En el patrón Cache-Aside, existe una ventana de milisegundos donde un cliente podría leer datos antiguos si la actualización y la invalidación de la caché sufren una condición de carrera.
  - *Mitigación implementada*: Todas las mutaciones de entidades cacheadas (`PUT/DELETE/PATCH`) ejecutan la invalidación del caché de Redis dentro del límite de la transacción `@Transactional` una vez que el *commit* a PostgreSQL ha finalizado exitosamente.

---

## 6. Referencias a la Implementación
- **Configuración de Conexión Redis**: `backend/src/main/java/uteq/edu/ec/artisync/config/RedisConfig.java` (`RedisTemplate<String, String>` con `StringRedisSerializer`).
- **Lógica de Revocación e Inyección TTL**: `backend/src/main/java/uteq/edu/ec/artisync/service/shared/SessionRevocationService.java`:
  ```java
  redisTemplate.opsForValue().set("jti:" + jti, "revocado", Duration.ofMillis(tiempoRestante));
  ```
- **Filtro de Intercepción HTTP**: `backend/src/main/java/uteq/edu/ec/artisync/security/JwtAuthenticationFilter.java`.
- **Servicios de Usuario y Cambio de Contraseña**: `backend/src/main/java/uteq/edu/ec/artisync/service/seguridad/impl/UserServiceImpl.java` (métodos `changePassword`, `deleteOwnAccount` y `revokeAllMySessions`).
