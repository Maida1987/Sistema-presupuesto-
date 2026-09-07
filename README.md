# Sistema de Gestión de Repuestos, Remitos y Cuentas Corrientes

Sistema para reemplazar el proceso actual en papel + Excel de un comercio de
repuestos para camiones, cuyo modelo comercial central es:

> **El remito no fija el precio.** El repuesto se entrega contra un remito sin
> precios (firmado por el cliente), y el precio se determina recién cuando se
> liquida la cuenta corriente, usando la lista de precios y las reglas
> comerciales vigentes **en ese momento**. El sistema debe poder reconstruir,
> para cualquier operación pasada, exactamente qué precio se usó y por qué.

## Estado del proyecto

**Fases 0 (infraestructura + auth/RBAC), 1 (catálogo base), 2 (importación
y precios), 3 (remitos) y 4 (cuenta corriente y liquidación) completas.**

El repositorio contiene el análisis funcional, la arquitectura, el modelo de
datos, el diseño del motor de precios/importación de Excel, las pantallas
principales, la API, la estrategia de auditoría/testing y el plan de fases
(ver `docs/`), y a partir de ese análisis ya está implementado:

- Backend (`backend/`): NestJS + Prisma + PostgreSQL. Login/refresh con JWT,
  RBAC por permisos (`@RequirePermissions`), auditoría transversal
  (`AuditService`), numeración transaccional segura (`DocumentCountersService`
  con `SELECT ... FOR UPDATE`), esquema de base de datos completo (todas las
  tablas de `docs/03-modelo-de-datos.md`), búsqueda tolerante con `pg_trgm`,
  CRUD completo de Clientes, Proveedores y Productos (maestro + referencias
  de proveedor con sugerencia/confirmación de vinculación), e importación
  inteligente de listas de Excel (detección de columnas por sinónimos o modo
  posicional, extracción de metadata, control de calidad, multi-hoja) +
  motor de precios versionado (`pricing_rules`/`price_history`) con
  trazabilidad completa. Todo con tests unitarios, incluyendo una suite de
  integración contra un Excel real de proveedor con 4 hojas heterogéneas
  (`backend/test/fixtures/mercosil-listas-precios.xlsx`). También emisión
  de remitos con numeración transaccional (reservar el número y
  crear el remito son una única transacción atómica), máquina de estados
  completa (EMITIDO → ENTREGADO → FIRMADO, con ANULADO desde cualquiera de
  esos estados salvo LIQUIDADO), generación de PDF **sin precios en ningún
  campo** (original y duplicado, con `pdf-lib`), y adjunto del remito
  firmado (PDF/JPG/PNG) con auditoría e historial de transiciones. Y el
  módulo de cuenta corriente/liquidación (`modules/accounts/`): detecta
  remitos firmados pendientes por cliente, resuelve el precio vigente de
  cada ítem contra todos los proveedores que lo tienen (mostrando el
  origen completo — proveedor, lista, margen/gastos/IVA — para que se
  pueda reconstruir de dónde salió cada precio), genera la liquidación
  como borrador reservando esos ítems (evita que dos liquidaciones
  concurrentes tomen el mismo remito), y al confirmarla impacta la cuenta
  corriente con un movimiento transaccional (`AccountMovementsService`,
  con bloqueo de fila del cliente para que el saldo sea correcto incluso
  con liquidaciones concurrentes — verificado con dos confirmaciones en
  paralelo reales) y marca los remitos como `LIQUIDADO`. Anular una
  liquidación revierte todo: libera los remitos, los devuelve a `FIRMADO`
  y genera el movimiento de ajuste contrario, nunca borra nada.
- Frontend (`frontend/`): React + Vite + Tailwind + TanStack Query. Login,
  ruta protegida, dashboard, pantallas de Clientes/Proveedores/Productos
  (con comparador de precios entre proveedores), wizard de importación de
  listas (analizar → previsualizar → confirmar), administración de reglas
  de precios, el flujo de remitos (alta rápida por cliente + búsqueda de
  producto, detalle con PDF/adjuntar firma/anular, listado), y cuenta
  corriente/liquidación (vista de cuenta con saldo y movimientos, wizard de
  liquidación con la transparencia de precio completa por ítem, detalle de
  liquidación con desglose y anulación).

**Limitaciones conocidas** (documentadas, no bloquean el resto del plan):
- El cálculo de `price_history` solo corre para listas en ARS; para listas
  en USD queda pendiente la conversión de moneda (ver pregunta abierta de
  tipo de cambio en `docs/01-analisis-funcional.md §8`) — el precio de lista
  igual se importa y queda trazable.
- El archivo original (listas de precios y remitos firmados) se guarda en
  disco local (`backend/uploads/`, ver `FileStorageService`), no todavía en
  S3/MinIO como propone la arquitectura para producción — la interfaz ya
  está pensada para ese reemplazo sin tocar los servicios que la usan.
- La importación de Excel es síncrona (sin cola/BullMQ); funciona bien para
  los volúmenes probados (cientos de filas) pero no está pensada aún para
  archivos de cientos de miles de filas.
- Durante la implementación de remitos se corrigieron dos bugs reales
  encontrados al probar contra Postgres (ver `docs/05-ux-api-testing-plan.md`):
  un adjunto se guardaba siempre con extensión `.pdf` sin importar el tipo
  real del archivo, y una entidad relacionada inexistente (cliente/producto/
  proveedor) devolvía `500` en vez de un error `400`/`404` claro — este
  segundo patrón se corrigió en los cuatro lugares donde aparecía.

Faltan por implementar (siguientes fases, ver
`docs/05-ux-api-testing-plan.md §5`): Pagos (Fase 5), y el resto del plan.

## Cómo levantar el entorno de desarrollo

Requisitos: Node.js 20+, PostgreSQL 15+ (o Docker).

```bash
# 1. Base de datos (Postgres/Redis/MinIO vía Docker)
docker compose up -d db redis minio

# 2. Backend
cd backend
cp .env.example .env        # ajustar DATABASE_URL si hace falta
npm install
npx prisma migrate deploy   # aplica el esquema + índices de búsqueda
npx prisma db seed          # roles, permisos y usuario admin (ver .env)
npm run start:dev           # http://localhost:3000/api

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxea /api al backend)
```

Usuario de prueba tras el seed: el email/contraseña definidos en
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` del `.env` (por defecto
`admin@example.com` / `ChangeMe123!`).

Tests del backend: `cd backend && npm test`.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/01-analisis-funcional.md`](docs/01-analisis-funcional.md) | Requisitos funcionales/no funcionales, reglas de negocio, actores, casos de uso, flujo de negocio completo, riesgos y **decisiones pendientes de confirmar con el negocio** |
| [`docs/02-arquitectura.md`](docs/02-arquitectura.md) | Stack tecnológico, estructura de carpetas, capas, seguridad, numeración segura, auditoría, backups, preparación para escalabilidad |
| [`docs/03-modelo-de-datos.md`](docs/03-modelo-de-datos.md) | Diagrama entidad-relación, definición de cada tabla, índices, restricciones, máquinas de estado |
| [`docs/04-importacion-y-precios.md`](docs/04-importacion-y-precios.md) | Importación inteligente de listas Excel, control de calidad, catálogo unificado, motor de precios/márgenes, trazabilidad |
| [`docs/05-ux-api-testing-plan.md`](docs/05-ux-api-testing-plan.md) | Pantallas principales, API REST, estrategia de testing (unitario/integración/E2E/concurrencia/regresión), plan de desarrollo por fases |

## Principio rector

Trazabilidad + Historial + Integridad + Simplicidad de uso + Velocidad +
Escalabilidad — en ese orden de prioridad cuando dos objetivos entren en
tensión. Ningún cambio futuro debe implementarse sin antes identificar los
módulos, tablas y procesos que afecta (ver "Regla maestra para cambios
futuros" en `docs/01-analisis-funcional.md`).
