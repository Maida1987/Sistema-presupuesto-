# Sistema de Gestión de Repuestos, Remitos y Cuentas Corrientes

Sistema para reemplazar el proceso actual en papel + Excel de un comercio de
repuestos para camiones, cuyo modelo comercial central es:

> **El remito no fija el precio.** El repuesto se entrega contra un remito sin
> precios (firmado por el cliente), y el precio se determina recién cuando se
> liquida la cuenta corriente, usando la lista de precios y las reglas
> comerciales vigentes **en ese momento**. El sistema debe poder reconstruir,
> para cualquier operación pasada, exactamente qué precio se usó y por qué.

## Estado del proyecto

**Etapa actual: ANÁLISIS (pre-implementación).**

Antes de escribir código de producción, este repositorio contiene el análisis
funcional, la arquitectura, el modelo de datos, el diseño del motor de
precios/importación de Excel, las pantallas principales, la API, la
estrategia de auditoría/testing y el plan de fases, tal como lo requiere el
brief del proyecto. La implementación arranca por fases una vez validado este
análisis (ver `docs/05-ux-api-testing-plan.md`, sección "Plan de fases").

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
