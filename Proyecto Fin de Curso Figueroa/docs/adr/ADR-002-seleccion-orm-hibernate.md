# ADR-002: Selección del ORM y Capa de Persistencia (Hibernate / Spring Data JPA)

## 1. Estado
**Aceptado** (2026-07-17)

---

## 2. Contexto
La plataforma **Artisync (PFC)** gestiona un modelo de datos relacional complejo y fuertemente normalizado en **PostgreSQL 16**, que incluye más de 20 entidades interconectadas (`Usuario`, `Rol`, `Permiso`, `RolePermission`, `SesionUsuario`, `AutenticacionDosFactores`, `Perfil`, `Categoria`, `Servicio`, `Pedido`, `FlujoTrabajo`, `Hito`, `PagoGarantia`, `TicketRevision`, `Mensaje`, `Publicacion`, etc.).

Las consultas transaccionales de la plataforma exigen:
1. **Mapeo declarativo y tipado** de relaciones `OneToMany`, `ManyToOne` y `ManyToMany` con control preciso de carga (*Lazy* vs *Eager*).
2. **Soporte nativo para paginación y ordenamiento dinámico** (`Page<T>`, `Pageable`) en endpoints públicos (exploración de catálogo y portafolios).
3. **Construcción de filtros multicriterio dinámicos** para búsquedas complejas por categoría, rango de tarifas, reputación y país.
4. **Control transaccional ACID transparente** y *Dirty Checking* para evitar llamadas SQL repetitivas al modificar estados de pedidos o saldos en garantía (*Escrow*).

Se evaluaron las principales tecnologías ORM (*Object-Relational Mapping*) del mercado del software empresarial (**Hibernate / JPA**, **Entity Framework Core**, **Doctrine ORM**) para determinar cuál se ajustaba de forma óptima al stack, rendimiento y modelo de desarrollo de Artisync.

---

## 3. Decisión Arquitectónica
Se ha seleccionado **Hibernate ORM 6.x** implementado a través de la abstracción **Spring Data JPA (`org.springframework.boot:spring-boot-starter-data-jpa`)** en **Java 25** sobre el motor relacional **PostgreSQL 16**.

### Pilares de la Decisión:
- **Abstracción `JpaRepository` & `JpaSpecificationExecutor`**: En lugar de escribir sentencias SQL o HQL repetitivas para operaciones CRUD, Spring Data JPA genera automáticamente las implementaciones en tiempo de ejecución. Las búsquedas avanzadas del catálogo se articulan mediante **JPA Specifications (Criteria API)** de forma totalmente tipada.
- **Integración Nativa con Spring (`@Transactional`)**: Mapeo directo con el gestor de transacciones de Spring Boot, permitiendo revertir transacciones en múltiples repositorios sin código de control manual.
- **Auditoría y Versionado de Esquema con Flyway**: Aunque Hibernate tiene la capacidad de autogenerar esquemas (`spring.jpa.hibernate.ddl-auto=validate`), se decidió delegar la evolución y DDL de la base de datos exclusivamente a **Flyway (`db/migration/V1__*.sql`)**, utilizando Hibernate puramente para DML transaccional de alta eficiencia.

---

## 4. Alternativas Consideradas (Comparativa Detallada: Doctrine vs. EF Core vs. Hibernate)

| Criterio / ORM | Hibernate / Spring Data JPA (Java 25) — **SELECCIONADO** | Entity Framework Core (.NET 8 C#) | Doctrine ORM 3.x (PHP 8 / Symfony) |
| :--- | :--- | :--- | :--- |
| **Alineación con el Stack del Proyecto** | **Nativa 100% (Spring Boot 4.0.1):** Es el estándar *de facto* en el ecosistema Java enterprise y se integra de forma inmediata en el contenedor IOC de Spring sin dependencias ni adaptadores de terceros. | **Baja (Ecosistema Microsoft .NET):** Habría requerido migrar todo el backend desde Java 25 a C# / ASP.NET Core, invalidando el código, componentes y experiencia del equipo en Spring Security / jjwt. | **Nula (Ecosistema PHP):** Habría requerido reescribir la plataforma en PHP/Symfony o Laravel, perdiendo las capacidades de tipado estricto y concurrencia multihilo de Java 25. |
| **Patrón ORM Principal** | **Data Mapper & Active Record Híbrido (JPA):** Separa las entidades de dominio puro del código SQL, pero permite conveniencia declarativa mediante anotaciones JPA (`@Entity`). | **Data Mapper + LINQ:** Excelente integración con el lenguaje LINQ de C#, pero con alta dependencia del `DbContext`. | **Data Mapper Puro:** Excelente separación conceptual, pero con menor velocidad de ejecución interpretada en PHP frente a bytecode compilado JIT en JVM. |
| **Rendimiento y Control de Caché** | **Alto:** Soporta Caché de Primer Nivel (por `EntityManager`), Caché de Segundo Nivel e interceptores. Optimiza *batch inserts/updates* hacia PostgreSQL (`hibernate.jdbc.batch_size`). | **Alto:** Muy optimizado en EF Core 8 con *Compiled Queries* y *AsNoTracking*. | **Moderado:** Al ejecutarse en ciclo de vida *request-response* de PHP (FastCGI), el `EntityManager` se destruye y reconstruye en cada petición HTTP, limitando cachés persistentes en memoria del servidor. |
| **Soporte de Consultas Dinámicas multicriterio** | **Excelente:** `JpaSpecificationExecutor<T>` permite combinar predicados dinámicamente (`Specification<Servicio>`) según los filtros elegidos por el usuario sin riesgo de inyección SQL. | **Excelente:** A través de expresiones `IQueryable<T>` encadenadas con LINQ en C#. | **Bueno:** Mediante `QueryBuilder` (DQL), pero menos expresivo y propenso a verbosidad al combinar 6 o 7 criterios opcionales. |
| **Curva de Aprendizaje y Madurez** | **Muy Madura y Estabilizada (Estándar JPA/JSR 338):** Solución comprobada durante más de 15 años en banca y transacciones financieras críticas. | **Estabilizada en el mundo .NET:** Gran evolución, pero no aplicable en nuestro entorno Java. | **Madura en PHP:** Muy potente para Symfony, pero sin ventajas de rendimiento para un core API REST intensivo. |

---

## 5. Consecuencias y Trade-offs

### 5.1 Consecuencias Positivas (+)
- **Productividad Excepcional del Equipo**: La eliminación del código boilerplate JDBC/SQL al declarar repositorios (`public interface UsuarioRepository extends JpaRepository<Usuario, Long>`) aceleró la construcción de los 7 módulos funcionales en más de un 60%.
- **Seguridad contra Inyección SQL**: Todas las consultas de JPA/Hibernate utilizan *Prepared Statements* parametrizados por defecto, bloqueando vectores de ataque de inyección en endpoints de filtrado.
- **Mapeo de Relaciones Complejas**: Relaciones como los roles y permisos granulares (`RolePermission`) o los hitos dentro de un flujo de trabajo (`FlujoTrabajo -> Hitos`) se resuelven de forma automática respetando la integridad referencial.

### 5.2 Riesgos Negativos (-) y Mitigaciones
- **El Problema de las Consultas `N+1` (Lazy Loading Problem -)**: Si se itera sobre una lista de entidades con colecciones `@OneToMany(fetch = FetchType.LAZY)` fuera del contexto transaccional, o dentro de un bucle, Hibernate dispara `N+1` consultas SQL separadas, degradando drásticamente el rendimiento de la base de datos PostgreSQL.
  - *Mitigación implementada 1*: Se prohíbe el anti-patrón `Open-In-View` configurando estrictamente `spring.jpa.open-in-view=false` en `application.properties`.
  - *Mitigación implementada 2*: Para consultas que requieren colecciones relacionadas (ej. cargar un `Usuario` con sus `Roles`), se utilizan consultas explícitas con **`@EntityGraph` o `JOIN FETCH`** en el `JpaRepository`.
- **Consumo de Memoria de la JVM por `EntityManager` (-)**: Cargar miles de entidades en una sola transacción para reportes puede agotar la memoria Heap de Java por el seguimiento de estado (*Dirty Checking*).
  - *Mitigación implementada*: Para operaciones masivas o de solo lectura de catálogos, se aplica la anotación `@Transactional(readOnly = true)` o proyecciones DTO específicas, liberando a Hibernate de mantener instantáneas de los objetos.

---

## 6. Referencias al Código y Configuración
- **Configuración en `application.properties`**:
  ```properties
  spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
  spring.jpa.hibernate.ddl-auto=validate # O create en entornos locales controlados
  spring.jpa.show-sql=false
  spring.jpa.open-in-view=false
  ```
- **Entidades Mapeadas**: `backend/src/main/java/uteq/edu/ec/artisync/entity/**` (Anomalías relacionales resueltas mediante anotaciones `@Entity`, `@Id`, `@GeneratedValue(strategy = GenerationType.IDENTITY)`).
- **Repositorios**: `backend/src/main/java/uteq/edu/ec/artisync/repository/**` (`UsuarioRepository`, `PagoGarantiaRepository`, `PedidoRepository`).
