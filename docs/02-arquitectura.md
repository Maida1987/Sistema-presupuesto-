# 02 — Arquitectura

## 1. Stack propuesto

| Capa | Tecnología | Motivo |
|---|---|---|
| Backend | Node.js 20 + TypeScript + NestJS | Estructura por módulos con DI, guards de RBAC, pipes de validación e interceptores de auditoría nativos; encaja con el requisito de separar presentación/negocio/datos |
| Base de datos | PostgreSQL 15+ | Transaccional, `SELECT ... FOR UPDATE`, `pg_trgm`/`unaccent` para búsqueda tolerante, JSONB para snapshots de trazabilidad, particionamiento futuro para tablas de alto volumen (`price_list_items`, `audit_logs`) |
| ORM / migraciones | Prisma | Esquema como código, migraciones versionadas, tipado end-to-end |
| Cola de trabajos | BullMQ + Redis | Procesamiento asíncrono de importaciones Excel grandes sin bloquear la API |
| Almacenamiento de documentos | S3-compatible (MinIO on-prem o AWS S3) | Remitos, adjuntos firmados, comprobantes, Excel originales; versionado y ciclo de vida independientes de la base de datos |
| Generación de PDF | Puppeteer o pdf-lib sobre plantilla HTML | Remito original/duplicado con el mismo layout, control fino del "sin precios" |
| Frontend | React 18 + TypeScript + Vite | SPA responsive, ecosistema maduro |
| Datos/estado en frontend | TanStack Query + TanStack Table | Cache de servidor, tablas con filtros/paginación para catálogos grandes |
| Formularios | React Hook Form + Zod | Validación consistente con los DTOs del backend |
| UI | Tailwind CSS + shadcn/ui | Interfaz limpia, componentes accesibles, responsive por defecto |
| Autenticación | JWT de acceso corto + refresh token rotativo (httpOnly cookie) | Standard, revocable, compatible con RBAC por permisos |
| Testing backend | Jest (unitario/integración) + Supertest | Cobertura de reglas de negocio y endpoints |
| Testing frontend | Vitest + Testing Library | Componentes y flujos de UI |
| E2E | Playwright | Flujo completo cliente→remito→liquidación→pago |
| Contenedores | Docker Compose (api, web, db, redis, minio) | Entorno reproducible, base para CI/CD |

Todo el stack es open-source y auto-hospedable, sin atarse a un proveedor
cloud específico, para no condicionar el crecimiento futuro (multi-sucursal,
ARCA, etc.).

## 2. Estructura de carpetas (propuesta)

```
/backend
  /src
    /modules
      /auth
      /users            (users, roles, permissions)
      /customers
      /suppliers
      /products          (products, categories, supplier references)
      /price-lists       (import, mapping, price_list_items, import_errors)
      /pricing           (pricing_rules, price_history, cálculo de precio)
      /delivery-notes    (remitos, items, documentos, estados)
      /accounts          (account_movements, settlements)
      /payments
      /audit
      /reports
      /search            (buscador global)
    /common
      /guards            (JwtAuthGuard, RolesGuard, PermissionsGuard)
      /interceptors      (AuditService — invocado explícitamente por cada servicio)
      /pipes             (ValidationPipe compartido)
      /filters           (excepciones -> respuestas HTTP consistentes)
    /infra
      /storage           (adapter S3/MinIO)
      /pdf               (generación de remitos)
      /queue             (BullMQ processors)
    main.ts
  /prisma
    schema.prisma
    /migrations
  /test
    /unit
    /integration
    /e2e-helpers

/frontend
  /src
    /pages               (Dashboard, Clientes, Productos, Remitos, CuentaCorriente, ImportarLista, ComparadorPrecios)
    /components
    /features            (lógica de cada módulo: hooks, api-clients)
    /shared              (UI kit, utilidades)
  /tests

/docs                    (este análisis y su evolución)
/docker-compose.yml
```

Cada módulo backend expone: `*.controller.ts` (presentación/DTOs),
`*.service.ts` (reglas de negocio), `*.repository.ts` o acceso vía Prisma
inyectado (datos), y sus propios guards/validators cuando aplica —
respetando la separación exigida en el ítem 5 del brief.

## 3. Seguridad

- **Autenticación**: contraseñas con `argon2`/`bcrypt`, JWT de acceso de
  vida corta (15 min) + refresh token rotativo almacenado como httpOnly +
  `SameSite=Strict`, revocación por lista negra en Redis.
- **Autorización**: `RolesGuard` + `PermissionsGuard` por endpoint, RBAC
  ampliable (roles y permisos son datos, no código).
- **Validación de entradas**: DTOs con `class-validator` en cada endpoint;
  nunca confiar en datos del cliente para precios/cantidades sensibles.
- **Uploads (Excel/PDF/imágenes)**: validación de extensión + MIME real
  (`file-type`, no solo la extensión), límite de tamaño, escaneo de
  contenido antes de mover a almacenamiento permanente, nombres de archivo
  generados por el sistema (nunca el nombre original del usuario en el path).
- **SQL injection**: mitigado por uso exclusivo de Prisma (queries
  parametrizadas); prohibido concatenar SQL crudo salvo casos justificados,
  siempre parametrizados.
- **XSS**: sanitización de campos libres (observaciones, motivos) y
  `Content-Security-Policy` en el frontend; React escapa por defecto.
- **CSRF**: mitigado porque la API es stateless con JWT en `Authorization`
  header para operaciones mutantes (no cookies simples de sesión); si se
  usa cookie para refresh, `SameSite=Strict` + verificación de origen.
- **Rate limiting** en login y en endpoints de importación/liquidación.
- **Logs y auditoría**: `AuditService`, invocado explícitamente por cada
  servicio de dominio en la misma transacción que el cambio, registra
  usuario/fecha/hora/módulo/entidad/valor anterior/valor nuevo/IP para las
  operaciones marcadas como sensibles (ver `03-modelo-de-datos.md
  #audit_logs`).

## 4. Numeración segura de documentos

Se descarta `SELECT MAX(numero)+1`. Se implementa una tabla
`document_counters (doc_type, series, year, last_number)` y la obtención del
siguiente número ocurre dentro de una transacción con
`SELECT ... FOR UPDATE` sobre la fila del contador, incrementando y
confirmando en la misma transacción que crea el remito/liquidación/pago.
Esto es portable, auditable y permite reiniciar por año/serie sin tocar
lógica de negocio.

## 5. Concurrencia

- Emisión de remitos: transacción única (reservar número + insertar remito +
  ítems).
- Liquidación: bloqueo pesimista sobre los remitos pendientes seleccionados
  (`FOR UPDATE SKIP LOCKED` al leer candidatos, y verificación de estado
  dentro de la transacción de confirmación) para impedir que dos operadores
  liquiden el mismo remito dos veces.
- Pagos: cada pago genera su propio movimiento de cuenta corriente en una
  transacción; el saldo se recalcula a partir de la suma de movimientos (no
  se confía en un campo `balance` mutable sin control de concurrencia) o, si
  se cachea, se actualiza dentro de la misma transacción con bloqueo de fila
  del cliente.
- Importación de listas: procesada en cola (BullMQ) para no competir con
  lecturas del catálogo; cada importación es un lote inmutable
  (`price_list_id`), no hay updates concurrentes sobre los mismos registros.

## 6. Auditoría e historial (estrategia general)

- **Nunca `UPDATE` sobre valores históricos de precio o regla comercial**:
  toda modificación crea una fila nueva con `valid_from`/`valid_to` (o
  `effective_from/to`), cerrando la anterior.
- **Estados en vez de borrados**: remitos, liquidaciones, pagos y listas
  usan máquinas de estado (ver `03-modelo-de-datos.md`), con anulación
  explícita (usuario, fecha, motivo).
- **Auditoría transversal**: `audit_logs` capturado por `AuditService` en
  operaciones de escritura sobre entidades sensibles, además de los campos
  de auditoría propios de cada tabla (`created_by`, `voided_by`, etc.).

## 7. Backups

- Backup automático diario de PostgreSQL (`pg_dump` lógico + WAL archiving
  para point-in-time recovery), con retención configurable (p. ej. 30 días
  diarios + 12 meses mensuales).
- Backup independiente del bucket de documentos (versionado en el propio
  storage S3-compatible + replicación/lifecycle a almacenamiento frío).
- Prueba periódica de restauración (no solo generar el backup, validar que
  se puede restaurar).

## 8. Preparación para escalabilidad futura

| Futuro módulo | Cómo lo prepara esta arquitectura |
|---|---|
| Stock | `delivery_note_items` ya referencia una tabla `stock_movements` (nullable, sin lógica bloqueante todavía) — ver `03-modelo-de-datos.md` |
| Compras / órdenes de compra | `price_lists`/`suppliers` ya modelan el lado proveedor; una orden de compra reutiliza `product_supplier_references` |
| Facturación / ARCA | `account_settlements` es el punto natural para colgar comprobantes fiscales sin rediseñar la cuenta corriente |
| Multi-sucursal / multi-depósito | Tablas clave (`delivery_notes`, `document_counters`, futura `stock_movements`) diseñadas con `branch_id`/`warehouse_id` opcional desde el día uno (nullable hasta que se active el módulo) |
| WhatsApp / Mercado Pago | Se integran como adaptadores en `/infra`, sin tocar el dominio (notificación de remito, conciliación de pago) |
| Códigos de barra / app móvil | La API REST ya es el contrato; un cliente móvil o un lector de código es simplemente otro consumidor de la misma API |

No se implementan estos módulos ahora (fuera de alcance actual), pero
ninguna decisión de esta arquitectura los bloquea.
