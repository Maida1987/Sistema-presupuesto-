# Sistema de Gestión de Repuestos, Remitos y Cuentas Corrientes

Sistema para reemplazar el proceso actual en papel + Excel de un comercio de
repuestos para camiones, cuyo modelo comercial central es:

> **El remito no fija el precio.** El repuesto se entrega contra un remito sin
> precios (firmado por el cliente), y el precio se determina recién cuando se
> liquida la cuenta corriente, usando la lista de precios y las reglas
> comerciales vigentes **en ese momento**. El sistema debe poder reconstruir,
> para cualquier operación pasada, exactamente qué precio se usó y por qué.

## Estado del proyecto

**El flujo de negocio central está completo: Fases 0 a 5 del plan
implementadas** (infraestructura/auth, catálogo, importación de precios,
remitos, cuenta corriente/liquidación, pagos). El ciclo completo
`cliente → remito → firma → liquidación → pago` funciona de punta a punta,
validado contra PostgreSQL real y en el navegador.

| Módulo | Backend (`backend/src/modules/`) | Frontend (`frontend/src/features/`) |
|---|---|---|
| Auth / RBAC | `auth/` — JWT access+refresh, permisos (`@RequirePermissions`) | login, ruta protegida |
| Auditoría | `common/interceptors/audit.service.ts` — invocado por cada servicio de dominio | — |
| Clientes / Proveedores | `customers/`, `suppliers/` — CRUD, búsqueda tolerante (`pg_trgm`) | `customers/`, `suppliers/` |
| Productos | `products/` — maestro + referencias de proveedor, matching por similitud, comparador de precios | `products/` |
| Importación de listas | `price-lists/` — detección de columnas (sinónimos o posicional), metadata, control de calidad, multi-hoja | `price-lists/` — wizard analizar→previsualizar→confirmar |
| Motor de precios | `pricing-rules/` — reglas versionadas por scope, `price_history` | `pricing-rules/` |
| Remitos | `delivery-notes/` — numeración transaccional, estados, PDF sin precios (`pdf-lib`), adjunto de firma | `delivery-notes/` |
| Cuenta corriente / Liquidación | `accounts/` — detección de pendientes, resolución de precio con trazabilidad completa, confirmación transaccional, anulación con reverso | `accounts/` |
| Pagos | `payments/` — registro/anulación, reutiliza el mismo libro de movimientos que Liquidación | `payments/` |
| Numeración segura | `document-counters/` — `SELECT ... FOR UPDATE`, reutilizable dentro de una transacción del llamador | — |

68 tests unitarios (incluyendo una suite de integración contra un Excel
real de proveedor con 4 hojas heterogéneas,
`backend/test/fixtures/mercosil-listas-precios.xlsx`), todos en verde.
Detalle completo de cada fase en `docs/05-ux-api-testing-plan.md §5` y en
las notas de "Estado: implementado" dentro de `docs/03-modelo-de-datos.md`.

**Limitaciones conocidas** (documentadas, no bloquean el resto del plan):
- El cálculo de `price_history` solo corre para listas en ARS; para listas
  en USD queda pendiente la conversión de moneda (ver pregunta abierta de
  tipo de cambio en `docs/01-analisis-funcional.md §8`) — el precio de lista
  igual se importa y queda trazable.
- Los archivos (listas de precios, remitos firmados) se guardan en disco
  local (`backend/uploads/`, ver `FileStorageService`), no todavía en
  S3/MinIO como propone la arquitectura para producción — la interfaz ya
  está pensada para ese reemplazo sin tocar los servicios que la usan.
- La importación de Excel es síncrona (sin cola/BullMQ); funciona bien para
  los volúmenes probados (cientos de filas) pero no está pensada aún para
  archivos de cientos de miles de filas.
- La liquidación elige automáticamente el proveedor de mejor costo; el
  resto de los candidatos queda visible para comparar, pero todavía no hay
  una UI para elegir manualmente otro proveedor por ítem.
- Varios bugs reales se encontraron y corrigieron probando contra Postgres
  real (ver el historial de commits): un adjunto de remito se guardaba
  siempre con extensión `.pdf` sin importar el archivo real subido, una
  celda de Excel con hipervínculo anidado se guardaba como `"[object
  Object]"`, y una entidad relacionada inexistente (cliente/producto/
  proveedor) devolvía `500` en vez de un error `400`/`404` claro.

Faltan por implementar (siguientes fases, ver
`docs/05-ux-api-testing-plan.md §5`): auditoría/dashboard/buscador global
(Fase 6), reportes y exportaciones (Fase 7), y hardening de producción
(Fase 8: backups, seguridad, performance a escala, S3/MinIO real).

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
