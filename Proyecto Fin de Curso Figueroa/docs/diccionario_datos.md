# Diccionario de Datos del Sistema Artisync (PFC)

Este documento constituye el **Diccionario de Datos Oficial y Completo** de la **Plataforma de Gestión para Artistas y Creadores de Contenido (Artisync)**. Se encuentra **100% sincronizado** con las migraciones transaccionales de **Flyway** (`backend/src/main/resources/db/migration/V1__*.sql`, `V2__*.sql`, `V3__*.sql`) e implementado sobre **PostgreSQL 16** con mapeo ORM en **Java 25 / Hibernate 6 JPA (`uteq.edu.ec.artisync.entity.*`)**.

La arquitectura relacional consta de **48 tablas normalizadas**, organizadas en los **7 módulos funcionales** que sustentan el modelo transaccional ACID del proyecto.

---

## Índice de Módulos
1. [Módulo 1: Seguridad y Control de Acceso (RBAC / PBAC & 2FA)](#1-módulo-1-seguridad-y-control-de-acceso) (10 tablas)
2. [Módulo 2: Perfiles, Verificación IA y Portafolio](#2-módulo-2-perfiles-verificación-ia-y-portafolio) (7 tablas)
3. [Módulo 3: Catálogo Dinámico de Servicios](#3-módulo-3-catálogo-dinámico-de-servicios) (7 tablas)
4. [Módulo 4: Motor de Flujos de Trabajo y Pedidos](#4-módulo-4-motor-de-flujos-de-trabajo-y-pedidos) (7 tablas)
5. [Módulo 5: Legal, Entregables y Finanzas (Escrow / Garantía)](#5-módulo-5-legal-entregables-y-finanzas-escrow--garantía) (5 tablas)
6. [Módulo 6: Comunicación, Salas de Chat y Notificaciones](#6-módulo-6-comunicación-salas-de-chat-y-notificaciones) (6 tablas)
7. [Módulo 7: Social, Comunidad, Reseñas y Sorteos](#7-módulo-7-social-comunidad-reseñas-y-sorteos) (6 tablas)

---

## 1. Módulo 1: Seguridad y Control de Acceso

### 1.1 Tabla: `roles`
Almacena la jerarquía de roles operativos y administrativos de la plataforma (`ADMIN`, `MODERADOR`, `SOPORTE`, `AUDITOR_FINANCIERO`, `CREADOR`, `CLIENTE`).

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_rol` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del rol del sistema. |
| `nombre_rol` | `VARCHAR(50)` (UNIQUE) | NO | — | Nombre en mayúsculas del rol (ej. `CREADOR`, `ADMIN`). |
| `descripcion_rol` | `TEXT` | SÍ | `NULL` | Explicación detallada de las facultades operativas de este rol. |

---

### 1.2 Tabla: `permisos`
Catálogo de permisos granulares (PBAC) del sistema evaluados mediante `@PreAuthorize`.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_permiso` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del permiso granular. |
| `nombre_permiso` | `VARCHAR(100)` (UNIQUE) | NO | — | Código del permiso (ej. `USUARIO_CREAR`, `FONDOS_LIBERAR`). |
| `modulo_aplicacion` | `VARCHAR(50)` | SÍ | `NULL` | Módulo arquitectónico al que pertenece (`SEGURIDAD`, `FINANZAS`, etc.). |

---

### 1.3 Tabla: `rol_permisos`
Tabla asociativa $N:M$ entre roles y permisos (RBAC dinámico).

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_rol_permiso` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la asignación. |
| `id_rol` | `BIGINT` (FK) | NO | — | Llave foránea hacia `roles(id_rol)` con `ON DELETE CASCADE`. |
| `id_permiso` | `BIGINT` (FK) | NO | — | Llave foránea hacia `permisos(id_permiso)` con `ON DELETE CASCADE`. |

---

### 1.4 Tabla: `pais`
Catálogo de países para la localización de usuarios e indexación geográfica de creadores.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_pais` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del país. |
| `nombre_pais` | `VARCHAR(100)` (UNIQUE) | NO | — | Nombre oficial o código ISO del país de residencia. |

---

### 1.5 Tabla: `usuarios`
Entidad central que almacena las credenciales, datos generales y ciclo de vida de cada cuenta registrada.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_usuario` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del usuario (`CustomUserDetails`). |
| `nombres` | `VARCHAR(100)` | NO | — | Nombres de pila del usuario. |
| `apellidos` | `VARCHAR(100)` | NO | — | Apellidos del usuario. |
| `correo` | `VARCHAR(150)` (UNIQUE) | NO | — | Correo electrónico, utilizado como identificador principal (`username`) para login. |
| `contrasena_hash` | `VARCHAR(255)` | NO | — | Hash seguro generado con algoritmo `BCryptPasswordEncoder` (costo 12). |
| `id_pais` | `BIGINT` (FK) | SÍ | `NULL` | Llave foránea hacia `pais(id_pais)`. |
| `fecha_registro` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Timestamp UTC de creación de la cuenta. |
| `estado_cuenta` | `BOOLEAN` | NO | `TRUE` | `TRUE` = cuenta activa; `FALSE` = cuenta suspendida o bloqueada (`Soft Delete`). |
| `fecha_nacimiento` | `DATE` | SÍ | `NULL` | Fecha de nacimiento para verificación de mayoría de edad. |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V2)* Última modificación, autogestionado por trigger `set_actualizado_en()`. |

---

### 1.6 Tabla: `usuario_roles`
Asigna los roles operativos asignados a cada cuenta de usuario ($N:M$).

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_usuario_rol` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la relación. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` con `ON DELETE CASCADE`. |
| `id_rol` | `BIGINT` (FK) | NO | — | Llave foránea hacia `roles(id_rol)` con `ON DELETE CASCADE`. |

---

### 1.7 Tabla: `sesiones_usuario`
Auditoría y control de sesiones activas e historial de autenticaciones con tokens JWT.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_sesion` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del registro de sesión. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` con `ON DELETE CASCADE`. |
| `token_jwt` | `TEXT` | NO | — | Cadena o firma del token Bearer emitido (su `jti` se gestiona en Redis). |
| `direccion_ip` | `VARCHAR(45)` | SÍ | `NULL` | Dirección IPv4 o IPv6 desde la cual se originó el inicio de sesión. |
| `fecha_creacion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha y hora exacta en que se inició la sesión. |
| `fecha_expiracion` | `TIMESTAMP` | NO | — | Fecha y hora programada en que el token expira naturalmente. |

---

### 1.8 Tabla: `tokens_recuperacion`
Almacena tokens transitorios con vencimiento para el restablecimiento seguro de contraseñas.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_token` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la solicitud de recuperación. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` con `ON DELETE CASCADE`. |
| `hash_token` | `VARCHAR(255)` | NO | — | Hash SHA-256 / UUID del token enviado por correo electrónico (`EmailService`). |
| `fecha_generacion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de emisión del token. |
| `usado` | `BOOLEAN` | NO | `FALSE` | `TRUE` si el token ya fue utilizado para cambiar la contraseña exitosamente. |

---

### 1.9 Tabla: `autenticacion_dos_factores`
Almacena el secreto criptográfico TOTP (Time-based One-Time Password) para autenticación 2FA.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_2fa` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador de la configuración 2FA. |
| `id_usuario` | `BIGINT` (FK/UNIQUE)| NO | — | Relación $1:1$ estricta hacia `usuarios(id_usuario)`. |
| `llave_secreta` | `VARCHAR(255)` | NO | — | Secreto en base32 para apps como Google Authenticator o Authy. |
| `esta_habilitado` | `BOOLEAN` | NO | `FALSE` | `TRUE` tras verificar el primer código TOTP con éxito. |

---

### 1.10 Tabla: `codigos_respaldo_2fa`
Códigos de emergencia de un solo uso para recuperar el acceso ante pérdida del dispositivo 2FA.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_codigo` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del código de respaldo. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` con `ON DELETE CASCADE`. |
| `codigo_hash` | `VARCHAR(255)` | NO | — | Hash BCrypt del código de respaldo de 8 o 10 dígitos. |
| `usado` | `BOOLEAN` | NO | `FALSE` | `TRUE` tras su consumo en una autenticación de emergencia. |

---

## 2. Módulo 2: Perfiles, Verificación IA y Portafolio

### 2.1 Tabla: `perfiles_creadores`
Almacena la identidad pública del artista, su biografía e información comercial complementaria.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_perfil` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del perfil del creador. |
| `id_usuario` | `BIGINT` (FK/UNIQUE)| NO | — | Relación $1:1$ hacia `usuarios(id_usuario)` con `ON DELETE CASCADE`. |
| `biografia` | `TEXT` | SÍ | `NULL` | Descripción profesional, trayectoria artística y estilo. |
| `url_red_social` | `VARCHAR(255)` | SÍ | `NULL` | Enlace externo a portafolio web personal, Instagram, ArtStation o Behance. |

---

### 2.2 Tabla: `estados_verificacion`
Catálogo de estados del proceso de auditoría y verificación de identidad/autenticidad artística.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_estado_verificacion` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador del estado (`Pendiente`, `Verificado`, `Rechazado IA`). |
| `nombre_estado` | `VARCHAR(50)` (UNIQUE) | NO | — | Nombre corto del estado de revisión de autenticidad. |

---

### 2.3 Tabla: `certificados_ia`
Registro de documentos y análisis automático mediante inteligencia artificial sobre autoría de obras.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_certificado` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del certificado emitido por revisión. |
| `id_perfil` | `BIGINT` (FK) | NO | — | Llave foránea hacia `perfiles_creadores(id_perfil)`. |
| `id_estado_verificacion` | `BIGINT` (FK) | NO | — | Llave foránea hacia `estados_verificacion(id_estado_verificacion)`. |
| `url_documento_s3` | `VARCHAR(255)` | NO | — | URL segura (CDN / AWS S3) donde se almacena el reporte o certificado PDF. |
| `puntaje_confianza_ia` | `DECIMAL(5,2)` | SÍ | `NULL` | Porcentaje de autenticidad estimado por motor IA (de `0.00` a `100.00`). |
| `fecha_analisis` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha exacta en que finalizó el análisis IA o la revisión moderada. |

---

### 2.4 Tabla: `habilidades`
Catálogo estandarizado de disciplinas artísticas y técnicas creativas.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_habilidad` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la habilidad técnica. |
| `nombre_habilidad` | `VARCHAR(100)` (UNIQUE)| NO | — | Nombre de la habilidad (ej. `Ilustración 2D`, `Modelado 3D Blender`, `Rigging`). |

---

### 2.5 Tabla: `creador_habilidades`
Asociación $N:M$ con nivel de maestría técnica entre el perfil del creador y el catálogo de habilidades.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_creador_habilidad` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la asignación de habilidad. |
| `id_perfil` | `BIGINT` (FK) | NO | — | Llave foránea hacia `perfiles_creadores(id_perfil)` con `ON DELETE CASCADE`. |
| `id_habilidad` | `BIGINT` (FK) | NO | — | Llave foránea hacia `habilidades(id_habilidad)` con `ON DELETE CASCADE`. |
| `nivel_dominio` | `VARCHAR(50)` | SÍ | `NULL` | Nivel declarado (ej. `Junior`, `Intermedio`, `Senior`, `Experto / Maestro`). |

---

### 2.6 Tabla: `portafolios`
Contenedor principal de la galería de muestras y trabajos destacados del artista.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_portafolio` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la galería o portafolio. |
| `id_perfil` | `BIGINT` (FK/UNIQUE)| NO | — | Relación $1:1$ hacia `perfiles_creadores(id_perfil)` con `ON DELETE CASCADE`. |
| `fecha_creacion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de creación de la galería. |
| `total_visitas_acumuladas`| `INT` | NO | `0` | Contador estadístico de visualizaciones públicas del portafolio. |
| `es_publico` | `BOOLEAN` | NO | `TRUE` | `TRUE` si el portafolio es visible en la exploración pública del catálogo. |
| `color_plantilla` | `VARCHAR(20)` | NO | `'#FFFFFF'` | Código hexadecimal para personalización estética del portafolio en Angular. |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V2)* Auditoría de modificación del portafolio. |

---

### 2.7 Tabla: `portafolio_items`
Obra u elemento multimedia concreto exhibido dentro de la galería del artista.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_item_portafolio` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del ítem o pieza de arte. |
| `id_portafolio` | `BIGINT` (FK) | NO | — | Llave foránea hacia `portafolios(id_portafolio)` con `ON DELETE CASCADE`. |
| `titulo_obra` | `VARCHAR(150)` | NO | — | Título del trabajo expuesto. |
| `descripcion_obra` | `TEXT` | SÍ | `NULL` | Contexto de creación, herramientas utilizadas o historia detrás de la obra. |
| `url_archivo_multimedia` | `VARCHAR(255)` | NO | — | URL del archivo en almacenamiento en la nube (imagen, video, modelo 3D). |
| `fecha_subida` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha y hora en que se publicó el ítem en la galería. |

---

## 3. Módulo 3: Catálogo Dinámico de Servicios

### 3.1 Tabla: `categorias`
Macrocategorías principales que estructuran la exploración de servicios en la plataforma.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_categoria` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la categoría. |
| `nombre_categoria` | `VARCHAR(100)` (UNIQUE)| NO | — | Nombre (ej. `Arte Digital 2D`, `Modelado y Animación 3D`, `Música y Audio`). |
| `estado_activa` | `BOOLEAN` | NO | `TRUE` | `TRUE` = categoría disponible para publicar servicios. |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V3)* Auditoría de cambios sobre la categoría por el admin. |

---

### 3.2 Tabla: `subcategorias`
Clasificación secundaria especializada dentro de cada categoría del catálogo.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_subcategoria` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la subcategoría. |
| `id_categoria` | `BIGINT` (FK) | NO | — | Llave foránea hacia `categorias(id_categoria)` con `ON DELETE CASCADE`. |
| `nombre_subcategoria` | `VARCHAR(100)` | NO | — | Nombre especializado (ej. `VTubers Rigging`, `Pixel Art`, `SFX Videojuegos`). |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V3)* Auditoría de cambios sobre la subcategoría. |

---

### 3.3 Tabla: `servicios`
Entidad transaccional clave que representa una oferta o servicio creativo publicitado con precio base.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_servicio` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del servicio publicitado en el catálogo. |
| `id_perfil` | `BIGINT` (FK) | NO | — | Llave foránea hacia `perfiles_creadores(id_perfil)` (Autoría del servicio). |
| `id_subcategoria` | `BIGINT` (FK) | NO | — | Llave foránea hacia `subcategorias(id_subcategoria)`. |
| `titulo_servicio` | `VARCHAR(150)` | NO | — | Título descriptivo (ej. *"Diseño de Personaje Anime Full Body con Fondo"*). |
| `descripcion_detallada` | `TEXT` | NO | — | Términos, alcances técnicos, formatos de entrega (`PNG`, `PSD`) y plazos. |
| `precio_base` | `DECIMAL(10,2)` | NO | — | Monto monetario base en USD para la contratación en garantía. |
| `url_miniatura` | `VARCHAR(255)` | SÍ | `NULL` | Imagen de portada o *thumbnail* mostrada en las tarjetas del explorador. |
| `tipo_item` | `VARCHAR(20)` | NO | `'SERVICIO'` | *(Migración V3)* Clasificación transaccional del ítem ofrecido. |
| `estado_publicacion` | `VARCHAR(20)` | NO | `'ACTIVO'` | *(Migración V3)* `ACTIVO`, `PAUSADO` o `BORRADOR`. |
| `cargo_revision_adicional`| `DECIMAL(10,2)` | SÍ | `0.00` | *(Migración V3)* Costo unitario en USD por revisiones extra fuera de contrato. |
| `limite_revisiones_base` | `INT` | SÍ | `0` | *(Migración V3)* Número de revisiones gratuitas incluidas de base. |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V3)* Fecha y hora en que el artista actualizó tarifas o alcance. |

---

### 3.4 Tabla: `atributos_dinamicos`
Definición de campos dinámicos extensibles según la tipología del servicio.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_atributo` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la definición del atributo. |
| `nombre_atributo` | `VARCHAR(100)` (UNIQUE)| NO | — | Nombre (ej. `Resolución Máxima DPI`, `Licencia Comercial Incluida`, `Polígonos`). |
| `tipo_dato` | `VARCHAR(50)` | NO | — | Tipo de dato esperado para validación (`NUMERO`, `BOOLEANO`, `TEXTO`). |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V3)* Auditoría de modificación de atributos. |

---

### 3.5 Tabla: `servicio_atributos`
Valores concretos asignados a los atributos dinámicos para un servicio específico ($N:M$).

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_servicio_atributo` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del valor de atributo por servicio. |
| `id_servicio` | `BIGINT` (FK) | NO | — | Llave foránea hacia `servicios(id_servicio)` con `ON DELETE CASCADE`. |
| `id_atributo` | `BIGINT` (FK) | NO | — | Llave foránea hacia `atributos_dinamicos(id_atributo)`. |
| `valor_asignado` | `VARCHAR(255)` | NO | — | Valor asignado (ej. `4000x4000px`, `SI`, `< 50k Tris`). |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V3)* Auditoría de cambios sobre la especificación técnica. |

---

### 3.6 Tabla: `etiquetas`
Palabras clave (*tags*) para indexación y búsqueda fonética/multicriterio.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_etiqueta` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del tag. |
| `nombre_etiqueta` | `VARCHAR(50)` (UNIQUE) | NO | — | Palabra clave (ej. `Cyberpunk`, `Chibi`, `Lofi`, `Unreal Engine 5`). |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V3)* Auditoría de administración de tags. |

---

### 3.7 Tabla: `servicio_etiquetas`
Asociación entre servicios y etiquetas ($N:M$) para potenciar las búsquedas con `Specification<Servicio>`.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_servicio_etiqueta` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la etiqueta en el servicio. |
| `id_servicio` | `BIGINT` (FK) | NO | — | Llave foránea hacia `servicios(id_servicio)` con `ON DELETE CASCADE`. |
| `id_etiqueta` | `BIGINT` (FK) | NO | — | Llave foránea hacia `etiquetas(id_etiqueta)` con `ON DELETE CASCADE`. |
| `actualizado_en` | `TIMESTAMPTZ` | NO | `CURRENT_TIMESTAMP` | *(Migración V3)* Auditoría de etiquetado. |

---

## 4. Módulo 4: Motor de Flujos de Trabajo y Pedidos

### 4.1 Tabla: `flujos_trabajo`
Definición de plantillas de flujos y metodologías de entrega en hitos.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_flujo` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador del flujo de trabajo transaccional. |
| `nombre_flujo` | `VARCHAR(100)` | NO | — | Nombre (ej. *Flujo Estándar Ilustración 3 Hitos: Boceto -> Lineart -> Color*). |
| `descripcion_flujo` | `TEXT` | SÍ | `NULL` | Explicación del ciclo de entregas intermedias del trabajo creativo. |

---

### 4.2 Tabla: `etapas_flujo`
Catálogo de etapas o hitos individuales en el ciclo de vida de una orden.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_etapa` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador de la etapa. |
| `nombre_etapa` | `VARCHAR(100)` (UNIQUE)| NO | — | Nombre descriptivo del hito (`Boceto / Concepto Inicial`, `Revision de Lineart`, `Color y Shading`, `Entrega Final Liberada`). |

---

### 4.3 Tabla: `flujo_etapas_config`
Configura la secuencia cronológica y ordenada de etapas pertenecientes a cada flujo de trabajo.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_flujo_etapa` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador de la configuración de etapa dentro del flujo. |
| `id_flujo` | `BIGINT` (FK) | NO | — | Llave foránea hacia `flujos_trabajo(id_flujo)` con `ON DELETE CASCADE`. |
| `id_etapa` | `BIGINT` (FK) | NO | — | Llave foránea hacia `etapas_flujo(id_etapa)` con `ON DELETE CASCADE`. |
| `numero_orden` | `INT` | NO | — | Secuencia del hito en la ejecución de la orden (`1`, `2`, `3`...). |
| `es_etapa_final` | `BOOLEAN` | NO | `FALSE` | `TRUE` si esta etapa representa la culminación técnica y formal del pedido. |

---

### 4.4 Tabla: `pedidos`
Entidad transaccional principal que formaliza la relación comercial en curso entre un cliente y un artista.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_pedido` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del encargo o pedido de trabajo. |
| `id_usuario_cliente`| `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` (Comprador/Cliente que encarga). |
| `id_servicio` | `BIGINT` (FK) | NO | — | Llave foránea hacia `servicios(id_servicio)` contratado en el catálogo. |
| `id_flujo` | `BIGINT` (FK) | NO | — | Llave foránea hacia `flujos_trabajo(id_flujo)` que guiará los hitos de entrega. |
| `fecha_inicio` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha formal en la que se constituyó el pedido (al verificar pago en garantía). |
| `fecha_entrega_estimada`| `TIMESTAMP` | SÍ | `NULL` | Fecha límite acordada contractualmente para la entrega del trabajo final. |
| `precio_pactado` | `DECIMAL(10,2)` | NO | — | Monto en USD inmutable cerrado en el momento de la contratación. |

---

### 4.5 Tabla: `historial_estados_pedido`
Traza inmutable del avance y transiciones de etapa por las que ha progresado cada pedido.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_historial_estado`| `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del registro de auditoría de estado. |
| `id_pedido` | `BIGINT` (FK) | NO | — | Llave foránea hacia `pedidos(id_pedido)` con `ON DELETE CASCADE`. |
| `id_etapa` | `BIGINT` (FK) | NO | — | Llave foránea hacia `etapas_flujo(id_etapa)` que se alcanzó. |
| `fecha_transicion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha y hora exacta de aprobación o cambio de etapa. |
| `observacion` | `TEXT` | SÍ | `NULL` | Comentarios del cliente al aprobar un hito o del artista al entregar avance. |

---

### 4.6 Tabla: `motivos_rechazo`
Catálogo estandarizado de causales por las cuales un cliente puede solicitar una revisión o rechazar un hito.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_motivo` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del motivo. |
| `descripcion_motivo` | `VARCHAR(150)` (UNIQUE)| NO | — | Razón (ej. *Incumplimiento de paleta de color*, *Falta de detalles acordados*). |

---

### 4.7 Tabla: `tickets_revision`
Gestión formal de solicitudes de corrección o cambio por parte del cliente al recibir un entregable de hito.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_ticket` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador del ticket de revisión en un pedido. |
| `id_pedido` | `BIGINT` (FK) | NO | — | Llave foránea hacia `pedidos(id_pedido)` con `ON DELETE CASCADE`. |
| `id_motivo` | `BIGINT` (FK) | NO | — | Llave foránea hacia `motivos_rechazo(id_motivo)`. |
| `descripcion_cliente`| `TEXT` | NO | — | Detalle técnico exhaustivo con las correcciones requeridas por el comprador. |
| `costo_adicional_generado`| `DECIMAL(10,2)` | SÍ | `0.00` | Si el ticket excede las revisiones gratuitas, acumula el costo extra en USD. |
| `estado_ticket` | `VARCHAR(50)` | SÍ | `'Abierto'` | Estado (`Abierto`, `En Proceso de Correccion`, `Resuelto / Aprobado`). |

---

## 5. Módulo 5: Legal, Entregables y Finanzas (Escrow / Garantía)

### 5.1 Tabla: `plantillas_contrato`
Almacena el articulado legal y cláusulas estandarizadas (HTML) que rigen la propiedad intelectual e hitos.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_plantilla` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la plantilla jurídica. |
| `version_legal` | `VARCHAR(50)` (UNIQUE) | NO | — | Versión de las cláusulas (`v1.0-2026-PFC`, `v2.0-Commercial-Rights`). |
| `cuerpo_html_plantilla`| `TEXT` | NO | — | Contenido HTML con variables dinámicas (`{{CLIENTE}}`, `{{MONTO}}`, `{{FECHA}}`). |

---

### 5.2 Tabla: `contratos`
Contrato bilateral formalizado con firmas criptográficas inviolables entre cliente y creador para un pedido.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_contrato` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del documento legal formalizado. |
| `id_pedido` | `BIGINT` (FK/UNIQUE)| NO | — | Relación $1:1$ estricta hacia `pedidos(id_pedido)` con `ON DELETE CASCADE`. |
| `id_plantilla` | `BIGINT` (FK) | NO | — | Llave foránea hacia `plantillas_contrato(id_plantilla)` utilizada. |
| `hash_firma_cliente` | `VARCHAR(255)` | SÍ | `NULL` | Hash criptográfico digital de aceptación voluntaria por el comprador. |
| `hash_firma_creador` | `VARCHAR(255)` | SÍ | `NULL` | Hash criptográfico digital de formalización de servicio por parte del artista. |
| `limite_revisiones` | `INT` | SÍ | `0` | Límite máximo de revisiones gratuitas formalizadas en este contrato. |
| `fecha_formalizacion`| `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de aceptación mutua en la que el contrato adquiere validez jurídica. |
| `url_documento_pdf` | `VARCHAR(255)` | SÍ | `NULL` | URL hacia la versión PDF final sellada y archivada en almacenamiento en nube. |

---

### 5.3 Tabla: `entregables_finales`
Control de archivos de entrega artística con protección de propiedad mediante marca de agua.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_entregable` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador del paquete de archivos entregados. |
| `id_pedido` | `BIGINT` (FK) | NO | — | Llave foránea hacia `pedidos(id_pedido)` con `ON DELETE CASCADE`. |
| `url_version_marca_agua`| `VARCHAR(255)` | SÍ | `NULL` | URL pública con marca de agua protectora para revisión y aprobación previa. |
| `url_version_limpia` | `VARCHAR(255)` | SÍ | `NULL` | URL del archivo original en alta resolución sin marca, bloqueada hasta liberación. |
| `esta_liberado` | `BOOLEAN` | NO | `FALSE` | `TRUE` al confirmar la liberación de los fondos en garantía hacia el artista. |

---

### 5.4 Tabla: `pagos_garantia`
Registro transaccional central de custodia de fondos en depósito en garantía (*Escrow*) vía PayPal API v2.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_pago` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del depósito en garantía Escrow. |
| `id_contrato` | `BIGINT` (FK/UNIQUE)| NO | — | Relación $1:1$ hacia `contratos(id_contrato)` con `ON DELETE CASCADE`. |
| `id_orden_paypal` | `VARCHAR(100)` | SÍ | `NULL` | ID transaccional emitido por PayPal Orders API v2 al autorizar el cargo. |
| `monto_retenido` | `DECIMAL(10,2)` | NO | — | Importe exacto en custodia intocable por el artista ni por el cliente. |
| `estado_fondos` | `VARCHAR(50)` | SÍ | `'Retenido'` | Estado en Escrow (`Retenido / En Garantia`, `Liberado a Creador`, `Reembolsado`). |

---

### 5.5 Tabla: `transacciones_pago`
Libro mayor contable inmutable que registra cada flujo de entrada, retención o desembolso financiero.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_transaccion` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del movimiento contable. |
| `id_pago` | `BIGINT` (FK) | NO | — | Llave foránea hacia `pagos_garantia(id_pago)` con `ON DELETE CASCADE`. |
| `tipo_transaccion` | `VARCHAR(50)` | NO | — | Tipo (`DEPÓSITO INICIAL ESCROW`, `DESEMBOLSO HITO 1`, `REEMBOLSO DISPUTA`). |
| `monto` | `DECIMAL(10,2)` | NO | — | Valor monetario del movimiento individual en USD. |
| `fecha_ejecucion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Timestamp del webhook bancario o confirmación transaccional. |

---

## 6. Módulo 6: Comunicación, Salas de Chat y Notificaciones

### 6.1 Tabla: `salas_chat`
Canales de comunicación privados y cifrados entre cliente y creador, atados biunívocamente a un pedido.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_sala` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la sala de chat. |
| `id_pedido` | `BIGINT` (FK/UNIQUE)| NO | — | Relación $1:1$ hacia `pedidos(id_pedido)` para mantener historial contextual. |
| `fecha_apertura` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha y hora en que se habilitó el canal tras confirmar el pedido. |
| `sala_activa` | `BOOLEAN` | NO | `TRUE` | `TRUE` mientras el pedido no haya sido archivado, cerrado o cancelado. |

---

### 6.2 Tabla: `mensajes`
Mensajes instantáneos transmitidos dentro de una sala de chat del pedido.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_mensaje` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del mensaje en la base de datos. |
| `id_sala` | `BIGINT` (FK) | NO | — | Llave foránea hacia `salas_chat(id_sala)` con `ON DELETE CASCADE`. |
| `id_remitente` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` del autor del mensaje. |
| `cuerpo_mensaje` | `TEXT` | SÍ | `NULL` | Contenido en texto del mensaje (auditable ante disputas legales o infracciones). |
| `fecha_hora_envio` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Timestamp exacto del envío. |
| `leido` | `BOOLEAN` | NO | `FALSE` | `TRUE` cuando la contraparte abre el chat e invoca el endpoint de confirmación. |

---

### 6.3 Tabla: `documentos_adjuntos`
Archivos, referencias, bocetos en baja o audios compartidos dentro del flujo del chat.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_adjunto` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del archivo adjunto al mensaje. |
| `id_mensaje` | `BIGINT` (FK) | NO | — | Llave foránea hacia `mensajes(id_mensaje)` con `ON DELETE CASCADE`. |
| `url_archivo` | `VARCHAR(255)` | NO | — | Enlace seguro en almacenamiento de archivos (S3/CDN). |
| `tipo_mime` | `VARCHAR(50)` | SÍ | `NULL` | Tipo de contenido (`image/png`, `application/pdf`, `audio/wav`). |
| `peso_bytes` | `INT` | SÍ | `NULL` | Tamaño en bytes del archivo para auditoría de cuotas de almacenamiento. |

---

### 6.4 Tabla: `tipos_notificacion`
Catálogo parametrizable de plantillas de eventos que disparan alertas en la plataforma y correos.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_tipo_notificacion`| `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del tipo de notificación. |
| `nombre_evento` | `VARCHAR(100)` (UNIQUE)| NO | — | Código del evento (`PAGO_RECIBIDO`, `HITO_APROBADO`, `NUEVO_MENSAJE`). |
| `formato_mensaje` | `TEXT` | SÍ | `NULL` | Plantilla de texto con comodines para renderizar la alerta en la campana de UI. |

---

### 6.5 Tabla: `notificaciones_sistema`
Alertas en tiempo real emitidas hacia la bandeja personal de notificaciones (campana en Angular) del usuario.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_notificacion` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la notificación enviada. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` destinatario de la alerta. |
| `id_tipo_notificacion`| `BIGINT` (FK) | NO | — | Llave foránea hacia `tipos_notificacion(id_tipo_notificacion)`. |
| `fecha_emision` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha y hora en la que se disparó la notificación. |
| `esta_leida` | `BOOLEAN` | NO | `FALSE` | `TRUE` si el usuario hizo clic sobre la notificación en el panel frontal. |

---

### 6.6 Tabla: `infracciones_mensaje`
Registro de violaciones a términos de servicio dentro del chat (ej. intentos de evadir comisión pagando fuera).

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_infraccion` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador del reporte de infracción detectado. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` presunto infractor. |
| `id_pedido` | `BIGINT` (FK) | NO | — | Llave foránea hacia `pedidos(id_pedido)` donde ocurrió la falta. |
| `fecha_infraccion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha de detección para revisión por el rol `MODERADOR`. |

---

## 7. Módulo 7: Social, Comunidad, Reseñas y Sorteos

### 7.1 Tabla: `seguidores`
Relación social $N:M$ entre usuarios que siguen y se suscriben a portafolios de creadores de contenido.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_seguimiento` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del seguimiento. |
| `id_usuario_seguidor` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` que realiza el *Follow*. |
| `id_perfil_creador` | `BIGINT` (FK) | NO | — | Llave foránea hacia `perfiles_creadores(id_perfil)` que recibe el seguidor. |
| `fecha_seguimiento` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha y hora en que se inició el seguimiento social. |
| `notificaciones_activas`| `BOOLEAN` | NO | `TRUE` | `TRUE` para recibir alertas cada vez que este artista publica nuevos ítems o sorteos. |
| *(Constraint)* | `UNIQUE` | — | — | `UNIQUE (id_usuario_seguidor, id_perfil_creador)` evita duplicidad de *follows*. |

---

### 7.2 Tabla: `comentarios_portafolio`
Retroalimentación pública y comentarios de la comunidad sobre piezas artísticas en las galerías.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_comentario` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del comentario. |
| `id_item_portafolio` | `BIGINT` (FK) | NO | — | Llave foránea hacia `portafolio_items(id_item_portafolio)` comentado. |
| `id_usuario_autor` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` que redactó el comentario. |
| `texto_comentario` | `TEXT` | NO | — | Contenido de la retroalimentación o elogio artístico. |
| `fecha_publicacion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha en la que se publicó el comentario. |
| `estado_moderacion` | `VARCHAR(50)` | SÍ | `'Activo'` | Estado (`Activo`, `Oculto por Moderación`, `Reportado por Spam`). |

---

### 7.3 Tabla: `likes_portafolio`
Registro de me gustas (*Likes*) de la comunidad hacia ítems individuales de portafolios.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_like` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del like otorgado. |
| `id_item_portafolio` | `BIGINT` (FK) | NO | — | Llave foránea hacia `portafolio_items(id_item_portafolio)`. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` que dio me gusta. |
| `fecha_like` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Timestamp exacto en el que el usuario marcó el me gusta. |
| *(Constraint)* | `UNIQUE` | — | — | `UNIQUE (id_item_portafolio, id_usuario)` garantiza un solo like por persona por obra. |

---

### 7.4 Tabla: `resenas_servicios`
Calificaciones y testimonios formales de clientes sobre un pedido concretado y liberado en Escrow.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_resena` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la valoración final. |
| `id_pedido` | `BIGINT` (FK/UNIQUE)| NO | — | Relación $1:1$ hacia `pedidos(id_pedido)` con `ON DELETE CASCADE`. Solo se califica un pedido completado una vez. |
| `calificacion_estrellas`| `INT` | SÍ | `NULL` | Puntuación numérica en estrellas de 1 a 5 (`CHECK (calificacion BETWEEN 1 AND 5)`). |
| `texto_resena` | `TEXT` | SÍ | `NULL` | Testimonio cualitativo sobre puntualidad, comunicación y calidad técnica de la obra. |
| `fecha_resena` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Fecha en la que el cliente emitió su valoración final. |

---

### 7.5 Tabla: `sorteos`
Campañas comunitarias y sorteos de *Giveaways* organizados por los creadores para fidelizar seguidores.

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_sorteo` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único del sorteo o campaña de fidelización. |
| `id_perfil_creador` | `BIGINT` (FK) | NO | — | Llave foránea hacia `perfiles_creadores(id_perfil)` que organiza la campaña. |
| `titulo_sorteo` | `VARCHAR(150)` | NO | — | Título del concurso (ej. *"Sorteo de 3 Ilustraciones Chibi Navideñas"*). |
| `descripcion_premios` | `TEXT` | NO | — | Detalle de los premios, bases y condiciones de participación. |
| `cantidad_ganadores` | `INT` | NO | `1` | Número de plazas ganadoras a sortear al finalizar el plazo. |
| `fecha_inicio` | `TIMESTAMP` | NO | — | Fecha y hora en la que se abren las inscripciones al sorteo. |
| `fecha_cierre` | `TIMESTAMP` | NO | — | Fecha y hora de cierre y selección automática o manual de ganadores. |
| `estado_sorteo` | `VARCHAR(50)` | SÍ | `'Activo'` | Estado transaccional (`Activo`, `Cerrado / Finalizado`, `Cancelado`). |

---

### 7.6 Tabla: `participantes_sorteo`
Inscripción y auditoría del resultado de participantes en los sorteos comunitarios ($N:M$).

| Columna | Tipo PostgreSQL 16 | Nulo | Default | Descripción de negocio |
| :--- | :--- | :--- | :--- | :--- |
| `id_participacion` | `BIGSERIAL` (PK) | NO | `autoincrement` | Identificador único de la inscripción en el sorteo. |
| `id_sorteo` | `BIGINT` (FK) | NO | — | Llave foránea hacia `sorteos(id_sorteo)` con `ON DELETE CASCADE`. |
| `id_usuario` | `BIGINT` (FK) | NO | — | Llave foránea hacia `usuarios(id_usuario)` que se inscribe para participar. |
| `fecha_inscripcion` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Timestamp en el que el usuario se registró en la campaña. |
| `es_ganador` | `BOOLEAN` | NO | `FALSE` | `TRUE` si el usuario fue seleccionado como ganador tras la fecha de cierre. |
| `fecha_notificacion_premio`| `TIMESTAMP` | SÍ | `NULL` | Fecha y hora en que se envió la notificación o correo oficial de premio al ganador. |
| *(Constraint)* | `UNIQUE` | — | — | `UNIQUE (id_sorteo, id_usuario)` impide que un usuario se inscriba varias veces en el mismo sorteo. |
