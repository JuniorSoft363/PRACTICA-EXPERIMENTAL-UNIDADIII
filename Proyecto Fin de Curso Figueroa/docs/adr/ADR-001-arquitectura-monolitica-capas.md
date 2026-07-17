# ADR-001: Selección de Patrón de Arquitectura (Monolítica Modular por Capas)

## 1. Estado
**Aceptado** (2026-07-17)

---

## 2. Contexto
El desarrollo de la **Plataforma de Gestión para Artistas y Creadores de Contenido (Artisync / PFC)** requiere construir un sistema robusto con **7 módulos funcionales altamente interconectados**:
1. `seguridad` (autenticación JWT, 2FA, usuarios, RBAC/PBAC)
2. `perfil` (portafolios de artistas, verificación de identidad, valoraciones)
3. `catalogo` (servicios creativos, tarifas, categorías)
4. `pedido` (contratación de pedidos, flujos de trabajo en hitos, revisiones)
5. `legal` (contratos, retención de fondos en garantía *Escrow*, conciliación)
6. `comunicacion` (chat en tiempo real, notificaciones, correos electrónicos)
7. `social` (comunidad creativa, publicaciones, sorteos)

Para cumplir con los Requisitos No Funcionales (RNF) del proyecto, especialmente la **integridad transaccional ACID estricta** (por ejemplo, al contratar un pedido se debe validar el perfil, verificar el catálogo, crear el contrato legal y registrar el pago en garantía en una única transacción atómica), se debió evaluar cuál patrón arquitectónico de alto nivel garantizaba la mejor relación entre **rendimiento, mantenibilidad, latencia, simplicidad de despliegue y alineación con el equipo de desarrollo**.

---

## 3. Decisión Arquitectónica
Se ha adoptado el **Patrón de Arquitectura Monolítica Modular por Capas (N-Tier Modular Monolith)** implementado sobre el ecosistema **Java 25 y Spring Boot 4.0.1**.

### Estructura de Capas Adoptada
El backend se organiza rígidamente en las siguientes capas de separación de responsabilidades:
- **Capa de Controladores (`controller`)**: Maneja el protocolo HTTP/REST, validación declarativa (`@Valid`) y serialización DTO. No contiene lógica transaccional.
- **Capa de Filtros / Seguridad (`security` & `config`)**: Intercepta peticiones, valida tokens JWT y Blacklist en Redis, y aplica control de acceso sin estado (`Stateless`).
- **Capa de Servicios / Lógica de Negocio (`service` & `service.impl`)**: Contiene las transacciones del negocio (`@Transactional`), orquesta validaciones cruzadas entre módulos y coordina notificaciones.
- **Capa de Acceso a Datos / Repositorios (`repository`)**: Abstrae la persistencia mediante interfaces de Spring Data JPA.
- **Capa de Entidades / ORM (`entity`)**: Modelo de dominio JPA/Hibernate mapeado sobre PostgreSQL 16.

Además, dentro de cada capa, el código se encuentra dividido por paquetes o módulos lógicos (`seguridad`, `perfil`, `catalogo`, `pedido`, `legal`, `comunicacion`, `social`), garantizando **alta cohesión modular y bajo acoplamiento**.

---

## 4. Alternativas Consideradas

| Alternativa | Descripción | Pros | Contras y Justificación de Descarte |
| :--- | :--- | :--- | :--- |
| **Arquitectura de Microservicios Independientes** | Descomponer los 7 módulos de Artisync en 7 microservicios autónomos con sus propias bases de datos aisladas y comunicación por colas de mensajería (Kafka/RabbitMQ) o gRPC. | • Escalabilidad independiente por módulo.<br>• Despliegues independientes sin afectar otros servicios. | **Descartada por sobrecarga operacional y latencia:**<br>1. **Transacciones distribuidas complejas:** Un pedido con pago en garantía (*Escrow*) y contrato requeriría implementar el **Patrón Saga** o *Two-Phase Commit (2PC)*, introduciendo alta complejidad de manejo de fallos y compensaciones.<br>2. **Latencia de red inter-servicio:** La comunicación interna por HTTP/gRPC degradaría los tiempos de respuesta en consultas que combinan usuario, portafolio, servicios y valoraciones.<br>3. **Sobrecarga de infraestructura:** Requeriría orquestadores pesados (Kubernetes), Service Mesh y 7 instancias de base de datos para un equipo de tamaño medio. |
| **Arquitectura Hexagonal / Puertos y Adaptadores pura** | Aislar totalmente el núcleo de dominio de los frameworks subyacentes mediante interfaces estrictas de puertos de entrada y salida para repositorios y controladores. | • Aislamiento absoluto de librerías y ORMs.<br>• Facilidad para cambiar de motor de base de datos o framework de UI. | **Descartada por verbosidad excesiva:**<br>Para un proyecto transaccional ágil donde **Spring Boot** y **Hibernate JPA** son estándares maduros, crear interfaces duplicadas y mappers manuales para cada repositorio introducía una sobrecarga del >40% en el volumen de código sin beneficios prácticos medibles (dado que la probabilidad de abandonar PostgreSQL + Spring Boot en el ciclo de vida del PFC es nula). |
| **Arquitectura Serverless / FaaS (Cloud Functions / AWS Lambda)** | Implementar cada endpoint como una función sin servidor disparada por eventos HTTP o triggers de base de datos. | • Costo cero en inactividad.<br>• Escalado automático instantáneo por petición. | **Descartada por *Cold Starts* y persistencia de conexiones:**<br>El arranque en frío (*Cold Start*) de la JVM con Spring o frameworks pesados provocaría latencias inaceptables (>2-3s) en las primeras solicitudes. Además, gestionar el pool de conexiones hacia PostgreSQL (`pg_postgres`) desde miles de lambdas efímeras causaría agotamiento del *max_connections*. |

---

## 5. Consecuencias y Trade-offs

### 5.1 Beneficios Positivos (+)
- **Transaccionalidad ACID Garantizada y Simplicidad (`@Transactional`)**: Las operaciones complejas (ej. aprobación de un hito en `PedidoServicioImpl` + liberación transaccional en `PagoServicioImpl` + notificación `@Async`) se ejecutan dentro del mismo hilo transaccional y contexto de base de datos (`EntityManager`), garantizando reversión automática (*Rollback*) si falla cualquier paso.
- **Latencia Cero entre Módulos**: Al estar todos los servicios en el mismo espacio de memoria de la JVM, la invocación de un servicio desde otro (ej. `UserService` invocando `SessionRevocationService`) es una llamada a método Java en microsegundos, sin serialización ni I/O de red.
- **Despliegue y CI/CD Simplificado**: Un único artefacto construible (`./mvnw package -> target/artisync.jar`) contenido en una sola imagen de Docker (`Dockerfile` de `backend`), gestionado eficientemente mediante un simple `docker-compose.yml`.
- **Tipado Fuerte y Refactorización Segura**: La división por capas con DTOs de entrada/salida y Mappers (`UsuarioMapper`) permite refactorizar reglas de negocio con verificación instantánea en tiempo de compilación por el compilador Java 25.

### 5.2 Riesgos Negativos (-) y Mitigaciones
- **Riesgo de Acoplamiento Espagueti entre Capas (-)**: En un monolito mal controlado, un controlador podría acceder directamente a un repositorio saltándose las validaciones del servicio, o los módulos podrían cruzarse sin control.
  - *Mitigación implementada*: Reglas estrictas de arquitectura donde las interfaces de servicio (`UserService`, `IPagoServicio`, `IPedidoServicio`) actúan como fronteras del módulo, y los repositorios solo son inyectados en su propia capa de servicio.
- **Escalabilidad Global vs. Granular (-)**: Si el módulo `catalogo` experimenta picos masivos de tráfico por exploraciones públicas, no es posible escalar solo ese módulo; se debe escalar la instancia completa de `pfc_backend`.
  - *Mitigación implementada*: Se desacopló la consulta de catálogos y verificación de tokens implementando el **Caché en Memoria con Redis 7 (`pfc_redis`)**, absorbiendo >80% de la carga de lectura sin necesidad de replicar la JVM.

---

## 6. Referencias a la Implementación en el Proyecto
- **Estructura por Capas**: Mapeada en `backend/src/main/java/uteq/edu/ec/artisync/` con los directorios exactos: `controller`, `service`, `repository`, `entity`, `dto`, `config`, `security`.
- **Configuración de Transacciones y Caché**: `application.properties` y `docker-compose.yml` (servicio `backend` en puerto 8080 enlazado a `postgres` y `redis`).
