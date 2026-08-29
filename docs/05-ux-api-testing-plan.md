# 05 — UX/UI, API, Testing y Plan de fases

## 1. Pantallas principales

### Home / Dashboard
Accesos directos a: Nuevo remito, Clientes, Cuenta corriente, Productos,
Importar lista, Comparar precios. Indicadores: cuentas corrientes activas,
saldo total a cobrar, remitos pendientes de liquidación, remitos/pagos
recientes, listas de precios cargadas. Alertas: listas desactualizadas,
productos sin precio, productos sin proveedor vinculado, remitos sin firma,
cuentas con saldo elevado (sobre el límite de crédito), variaciones de
precio importantes.

### Nuevo remito (flujo de un vendedor, mínimos clics)
```
Cliente:        [ Buscar... ]
Producto:       [ Buscar código o descripción... ]   Cantidad: [ 1 ] [Agregar]

  Producto            | Código   | Cantidad
  Filtro de aceite     | FIL-123  | 2
  Bomba de agua         | BBA-778  | 1

                                          [ GENERAR REMITO ]
```
Sin precios visibles en ningún momento de esta pantalla. Al confirmar:
número asignado transaccionalmente, PDF original + duplicado generados,
estado `EMITIDO`.

### Ficha de cliente
Datos + pestañas: Cuenta corriente (saldo, movimientos), Remitos, Pagos,
Liquidaciones, Documentos firmados.

### Catálogo de productos / catálogo unificado
Tabla con filtros (código, descripción, marca, categoría, proveedor),
columna por proveedor con su precio y "mejor precio" resaltado. Buscador
tolerante a variantes de escritura.

### Importar lista
Wizard de 4 pantallas: proveedor + archivo → mapeo de columnas
(auto-sugerido, editable) → vista previa con anomalías → resultado final
con descarga de errores.

### Comparador de precios (standalone y embebido en liquidación)
Producto seleccionado → tabla de proveedores con precio, fecha de lista,
variación %, "mejor costo" resaltado.

### Cuenta corriente / Liquidación
Selección de cliente/período → tabla de remitos pendientes → por cada ítem:
producto, remito de origen, fecha de retiro, proveedor, lista usada,
precio, margen/gastos/IVA aplicados, precio final, con botón para abrir el
comparador de precios inline. Bloqueo de confirmación si hay ítems sin
precio. Botón "Ver remito firmado" junto a cada movimiento de origen
`REMITO_PENDIENTE`/`LIQUIDACION`.

### Pagos
Registro rápido: cliente, importe, medio de pago, comprobante, referencia.

### Buscador global
Una sola caja de búsqueda en el header, resultados agrupados por tipo
(cliente / remito / producto / proveedor).

Todas las pantallas: responsive (escritorio/tablet/celular), tablas con
paginación y filtros, confirmación explícita antes de cualquier operación
irreversible (anular, confirmar liquidación, registrar pago).

## 2. API (REST) — recursos principales

| Recurso | Endpoints clave |
|---|---|
| `/auth` | `POST /login`, `POST /refresh`, `POST /logout` |
| `/customers` | CRUD, `GET /:id/account` (saldo + movimientos), `GET /:id/delivery-notes` |
| `/suppliers` | CRUD |
| `/products` | CRUD, `GET /search?q=`, `GET /:id/prices` (comparador) |
| `/product-supplier-references` | `GET`, `POST /:id/match` (vincular a maestro) |
| `/price-lists` | `POST /` (subir archivo), `POST /:id/mapping`, `GET /:id/preview`, `POST /:id/confirm`, `GET /:id/errors` |
| `/import-mappings` | `GET /by-supplier/:supplierId`, `PUT /by-supplier/:supplierId` |
| `/pricing-rules` | `GET`, `POST` (crea nueva versión, cierra la anterior del mismo scope) |
| `/delivery-notes` | `POST /` (emitir), `GET /:id`, `POST /:id/documents` (adjuntar firmado), `POST /:id/void`, `GET /:id/pdf?type=original\|duplicado` |
| `/account-settlements` | `GET /pending?customerId=` (remitos pendientes), `POST /` (borrador), `POST /:id/confirm`, `POST /:id/void` |
| `/payments` | `POST /`, `POST /:id/void` |
| `/reports` | `GET /customers/:id/statement`, `GET /products/price-history/:id`, exportables en PDF/Excel/CSV |
| `/search` | `GET /global?q=` |
| `/audit-logs` | `GET ?entityType=&entityId=` (solo admin) |

Todos los endpoints mutantes validan permisos vía `PermissionsGuard` y
registran auditoría a través de `AuditService` cuando afectan una entidad
sensible (precios, remitos, liquidaciones, pagos, clientes). Se optó por
una llamada explícita del servicio (en la misma transacción que el cambio)
en lugar de un interceptor genérico: solo el servicio de cada entidad sabe
construir un `old_value`/`new_value` preciso.

## 3. Estrategia de testing

| Nivel | Foco |
|---|---|
| **Unitarios** | Cálculo de precio (motor de reglas: margen/gastos/IVA/redondeo), resolución de la regla vigente por fecha, detección/mapeo de columnas Excel, matching por similitud de texto, máquinas de estado (transiciones válidas/inválidas) |
| **Integración** | cliente→remito, remito→cuenta corriente, lista→producto (import completo), producto→precio (price_history), liquidación→cuenta corriente, pago→saldo |
| **End-to-end (Playwright)** | Flujo completo: crear cliente → importar lista → crear producto/vincular referencia → emitir remito → generar original/duplicado → adjuntar firma → segundo remito → actualizar lista de precios → solicitar cuenta corriente → liquidar → verificar precios y trazabilidad → registrar pago → verificar saldo → consultar remito firmado desde la cuenta corriente → reconstruir la operación histórica completa |
| **Concurrencia** | 2 vendedores emitiendo remitos en simultáneo (sin colisión de numeración), 2 usuarios editando el mismo cliente, importación de lista mientras se consulta el catálogo, 2 usuarios intentando liquidar la misma cuenta, 2 pagos simultáneos sobre el mismo cliente |
| **Regresión** | Suite que corre en cada cambio y verifica que clientes, productos, listas, remitos, cuentas, pagos y auditoría siguen funcionando igual; obligatoria antes de cerrar cualquier fase |

Ninguna funcionalidad se da por terminada solo porque "compila y se ve en
pantalla" (ver criterio de terminado, §4).

## 4. Criterio de "terminado" (checklist reutilizable por funcionalidad)

- [ ] Funciona en el caso normal y en los casos borde relevantes.
- [ ] Integrada de punta a punta con los módulos que la usan/la consumen.
- [ ] Validaciones y manejo de errores explícitos (nunca falla en silencio).
- [ ] Permisos (RBAC) aplicados donde corresponde.
- [ ] Auditoría registrada si la operación es sensible.
- [ ] Pruebas unitarias/integración (y E2E si es un flujo de negocio central).
- [ ] Suite de regresión ejecutada y en verde.
- [ ] Documentación (`docs/`) actualizada si cambió una regla de negocio, tabla o endpoint.

## 5. Plan de desarrollo por fases

| Fase | Alcance | Depende de | Criterio de cierre |
|---|---|---|---|
| **0 — Base** ✅ | Infra (Docker Compose), auth + RBAC, esqueleto de módulos backend/frontend, `document_counters`, `audit_logs`, esquema completo de base de datos | — | Login funcional, roles aplicados, tests corriendo |
| **1 — Catálogo base** ✅ | Clientes, Proveedores, Productos maestro + referencias de proveedor, búsqueda tolerante | Fase 0 | Alta/consulta de las tres entidades con tests de integración |
| **2 — Importación y precios** | Import de Excel (mapeo, preview, calidad de datos), `price_lists`/`price_list_items`, `pricing_rules` y `price_history` con la fórmula documentada en `04-importacion-y-precios.md` (⚠️ requiere confirmación de negocio antes de cerrar esta fase) | Fase 1 | Importación E2E de un Excel real de cada formato de ejemplo, comparador de precios funcionando |
| **3 — Remitos** | Emisión, numeración transaccional, PDF original/duplicado sin precios, estados, adjunto de remito firmado | Fase 1 | Un vendedor emite un remito en < 1 minuto; estado y documento firmado consultables |
| **4 — Cuenta corriente y liquidación** | `account_movements`, `account_settlements`, pantalla de liquidación con trazabilidad y comparador inline | Fases 2 y 3 | Liquidación de un cliente con remitos de fechas distintas, precios correctos y trazables, bloqueo si falta precio |
| **5 — Pagos** | Registro de pagos, impacto en cuenta corriente, anulación con reverso | Fase 4 | Pago registrado actualiza saldo de forma transaccional y auditable |
| **6 — Auditoría, dashboard y buscador global** | Interceptor de auditoría en todos los módulos sensibles, dashboard con indicadores/alertas, buscador global | Fases 1–5 | Alertas reales sobre datos de prueba, auditoría consultable por entidad |
| **7 — Reportes y exportaciones** | Reportes de clientes/productos/remitos/cuentas, export PDF/Excel/CSV | Fase 6 | Exportaciones verificadas contra los datos de origen |
| **8 — Hardening** | Seguridad (revisión completa), backups + prueba de restauración, performance con catálogo grande, batería E2E y de concurrencia completa, documentación final | Todas | Auditoría de seguridad sin hallazgos críticos, backups restaurados exitosamente, suite completa en verde |

Cada fase se cierra únicamente cumpliendo el checklist de §4, y solo
entonces arranca la siguiente (ítem 52 del brief: nunca cambios aislados
que generen inconsistencias en otro módulo).

## 6. Próximo paso

Con este análisis aprobado, la Fase 0 puede comenzar de inmediato
(infraestructura + auth + RBAC), en paralelo a resolver con el negocio las
preguntas abiertas de `01-analisis-funcional.md §8`, que condicionan el
cierre de la Fase 2 (motor de precios) pero no bloquean el arranque del
proyecto.
