# Sistema de Gestión de Repuestos, Remitos y Cuentas Corrientes

Sistema para reemplazar el proceso actual en papel + Excel de un comercio de
repuestos para camiones, cuyo modelo comercial central es:

> **El remito no fija el precio.** El repuesto se entrega contra un remito sin
> precios (firmado por el cliente), y el precio se determina recién cuando se
> liquida la cuenta corriente, usando la lista de precios y las reglas
> comerciales vigentes **en ese momento**. El sistema debe poder reconstruir,
> para cualquier operación pasada, exactamente qué precio se usó y por qué.

## Estado del proyecto

**El flujo de negocio central está completo: Fases 0 a 6 del plan
implementadas** (infraestructura/auth, catálogo, importación de precios,
remitos, cuenta corriente/liquidación, pagos, auditoría consultable +
dashboard + buscador global). El ciclo completo
`cliente → remito → firma → liquidación → pago` funciona de punta a punta,
validado contra PostgreSQL real y en el navegador.

| Módulo | Backend (`backend/src/modules/`) | Frontend (`frontend/src/features/`) |
|---|---|---|
| Auth / RBAC | `auth/` — JWT access+refresh, permisos (`@RequirePermissions`) | login, ruta protegida |
| Auditoría | `common/interceptors/audit.service.ts` (registro, invocado por cada servicio de dominio) + `audit/audit.controller.ts` (consulta, `GET /audit-logs` con filtros) | `audit/` — tabla con filtros por módulo/entidad |
| Clientes / Proveedores | `customers/`, `suppliers/` — CRUD, búsqueda tolerante (`pg_trgm`) | `customers/`, `suppliers/` |
| Productos | `products/` — maestro + referencias de proveedor, matching por similitud (individual y masivo), comparador de precios | `products/` — catálogo + `/productos/matching` (matching masivo) |
| Importación de listas | `price-lists/` — detección de columnas (sinónimos o posicional), metadata, control de calidad, multi-hoja | `price-lists/` — wizard analizar→previsualizar→confirmar |
| Motor de precios | `pricing-rules/` — reglas versionadas por scope, `price_history` | `pricing-rules/` |
| Remitos | `delivery-notes/` — numeración transaccional, estados, PDF sin precios (`pdf-lib`), adjunto de firma | `delivery-notes/` |
| Cuenta corriente / Liquidación | `accounts/` — detección de pendientes, resolución de precio con trazabilidad completa, confirmación transaccional, anulación con reverso | `accounts/` |
| Pagos | `payments/` — registro/anulación, reutiliza el mismo libro de movimientos que Liquidación | `payments/` |
| Dashboard | `dashboard/` — indicadores (saldo total, cuentas activas, remitos por liquidar) y alertas (listas desactualizadas, productos sin precio, remitos sin firmar, clientes con saldo elevado, variaciones de precio significativas) calculados sobre datos reales | `dashboard/` |
| Buscador global | `search/` — búsqueda combinada en clientes, proveedores, productos y remitos | `search/` — `GlobalSearch` en el header, con debounce |
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
- La importación de Excel sigue siendo síncrona (sin cola/BullMQ), pero ya
  no es el cuello de botella que era: se encontraron y corrigieron dos
  bugs reales de performance probando contra el archivo real de 30.066
  filas (`PreciosBULON.xlsx`) — (1) `exceljs` expone `worksheet.
  columnCount` como un getter que recorre toda la hoja en cada llamada (no
  un campo cacheado); se estaba llamando una vez por fila adentro del
  parseo, haciéndolo O(filas²), y (2) `importSheet` hacía 2-3 round-trips
  a la base **por fila** (findUnique + create + create), unos 90.000 para
  ese archivo. Con ambos corregidos (columnCount cacheado una sola vez por
  hoja + `createMany` en lote), el mismo archivo pasó de ~70s de
  previsualización / ~3 min de confirmación — bloqueando el único proceso
  Node todo ese tiempo — a **~2s / ~6s**, con el servidor respondiendo con
  normalidad a otras requests durante el import. No hay evidencia todavía
  de que haga falta un worker asincrónico para los volúmenes reales
  vistos hasta ahora; si algún proveedor trae listas de cientos de miles
  de filas convendría medir de nuevo antes de asumirlo.
- El *matching* de una referencia de proveedor recién importada con el
  catálogo maestro de productos sigue siendo un paso manual (nunca
  automático y silencioso, por diseño — ver `04-importacion-y-precios.md`
  §5), pero ahora hay una pantalla de matching masivo
  (`/productos/matching`, permiso `products.write`) en vez de tener que
  hacerlo de a una: lista paginada de referencias `UNMATCHED`/`MATCHED`/
  `IGNORED` con filtro por proveedor, sugerencia de producto candidato por
  similitud de texto (`pg_trgm`, una sola consulta con `LATERAL JOIN` para
  toda la página en vez de N consultas — mismo cuidado que en la
  importación), selección automática solo de las sugerencias de alta
  confianza (≥50% similitud, el usuario decide el resto), override manual
  por referencia, alta de producto nuevo directamente desde una referencia
  sin candidato razonable, y confirmar/ignorar en lote. Probado con los
  76.680 `UNMATCHED` reales que dejaron las importaciones de esta fase.
  Corregido de paso un bug de permisos real: el rol `Administración` (el
  que importa las listas) no tenía `products.write` y no podía completar
  el matching después de importar.
- La liquidación elige automáticamente el proveedor de mejor costo; el
  resto de los candidatos queda visible para comparar, pero todavía no hay
  una UI para elegir manualmente otro proveedor por ítem.
- Varios bugs reales se encontraron y corrigieron probando contra Postgres
  real y contra archivos de proveedores reales (ver el historial de
  commits): un adjunto de remito se guardaba siempre con extensión `.pdf`
  sin importar el archivo real subido, una celda de Excel con hipervínculo
  anidado se guardaba como `"[object Object]"`, una entidad relacionada
  inexistente (cliente/producto/proveedor) devolvía `500` en vez de un
  error `400`/`404` claro, una columna cuyo encabezado se parecía por
  distancia de edición a "precio" pero no lo era (`"U. Precio"`, la unidad
  de referencia) se elegía sin validar contra los datos y dejaba una hoja
  entera de 30 mil filas con 0 ítems válidos, y un archivo `.xls` binario
  (Excel 97-2003, no soportado por `exceljs`) tiraba un error interno de
  librería en vez de un mensaje claro.

- El dashboard y el buscador global recorren la base completa en cada
  consulta (sin caché ni paginación más allá de los `take`/límites fijos
  por sección); funciona bien con el volumen de datos actual pero conviene
  revisitarlo en la Fase 8 (hardening/performance) si el catálogo crece
  mucho.

Faltan por implementar (siguientes fases, ver
`docs/05-ux-api-testing-plan.md §5`): reportes y exportaciones (Fase 7), y
hardening de producción (Fase 8: backups, seguridad, performance a escala,
S3/MinIO real).

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
