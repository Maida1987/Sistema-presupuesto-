# Sistema de Gestión de Repuestos, Remitos y Cuentas Corrientes

Sistema para reemplazar el proceso actual en papel + Excel de un comercio de
repuestos para camiones, cuyo modelo comercial central es:

> **El remito no fija el precio.** El repuesto se entrega contra un remito sin
> precios (firmado por el cliente), y el precio se determina recién cuando se
> liquida la cuenta corriente, usando la lista de precios y las reglas
> comerciales vigentes **en ese momento**. El sistema debe poder reconstruir,
> para cualquier operación pasada, exactamente qué precio se usó y por qué.

## Estado del proyecto

**Fase 0 (infraestructura + auth/RBAC) completa. Fase 1 (catálogo base) en
curso — módulo de Clientes implementado como slice de referencia.**

El repositorio contiene el análisis funcional, la arquitectura, el modelo de
datos, el diseño del motor de precios/importación de Excel, las pantallas
principales, la API, la estrategia de auditoría/testing y el plan de fases
(ver `docs/`), y a partir de ese análisis ya está implementado:

- Backend (`backend/`): NestJS + Prisma + PostgreSQL. Login/refresh con JWT,
  RBAC por permisos (`@RequirePermissions`), auditoría transversal
  (`AuditService`), numeración transaccional segura (`DocumentCountersService`
  con `SELECT ... FOR UPDATE`), esquema de base de datos completo (todas las
  tablas de `docs/03-modelo-de-datos.md`) y CRUD de Clientes con tests
  unitarios.
- Frontend (`frontend/`): React + Vite + Tailwind + TanStack Query. Login,
  ruta protegida, dashboard y pantalla de Clientes (buscar/listar/crear)
  conectada a la API real.

Faltan por implementar (siguientes fases, ver
`docs/05-ux-api-testing-plan.md §5`): Proveedores/Productos/importación de
Excel (Fase 1-2), Remitos (Fase 3), Cuenta corriente/Liquidación (Fase 4),
Pagos (Fase 5), y el resto del plan.

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
