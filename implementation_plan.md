# Plan: Tests de Integración y Concurrencia — Freno de Deuda en Ventas

## Contexto y Problema

El servicio `createSaleProcess` en [sale.service.ts](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/services/sale.service.ts#L38-L149) implementa un sistema de **venta forzada con saldo negativo** controlado por un freno de emergencia (`max_debt_limit`). La jerarquía de límites es:

```
Producto.max_debt_limit  →  Categoría.max_debt_limit  →  Branch.max_debt_limit (default: -20)
```

**Ningún test existente valida este sistema.** Los tests actuales en [sale.test.js](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/tests/sale.test.js) y [sale.extended.test.js](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/tests/sale.extended.test.js) solo cubren el camino feliz (stock positivo) y un test **obsoleto** que espera `"Stock insuficiente"` cuando el servicio ahora lanza `"Freno de emergencia"`.

### Vulnerabilidad de Concurrencia Identificada

El servicio ejecuta un patrón **read-then-write** dentro de la transacción:

```typescript
// Línea 88-92: LECTURA del stock actual
const currentInv = await BranchInventory.findOne({ ... }).session(session);
const currentStock = currentInv ? currentInv.stock : 0;

// Línea 100: DECISIÓN basada en lectura
if ((currentStock - item.quantity) < limit) { throw ... }

// Línea 104-112: ESCRITURA con $inc
await BranchInventory.findOneAndUpdate({ ... }, { $inc: { stock: -qty } }, { session });
```

MongoDB con transacciones en ReplicaSet proporciona **snapshot isolation**: si dos transacciones modifican el mismo documento, la segunda recibe un `WriteConflict` y aborta. Los tests deben demostrar que esto realmente protege la integridad del inventario.

---

## User Review Required

> [!IMPORTANT]
> **Test obsoleto detectado**: [sale.test.js línea 178-196](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/tests/sale.test.js#L178-L197) espera el mensaje `"Stock insuficiente"` y verifica que vender más de 20 unidades (stock=20, qty=50.2) falla. Pero el servicio actual lanza `"Freno de emergencia"` y con `max_debt_limit=-20`, vender 50.2 desde stock=20 resultaría en stock=-30.2, que **sí** excede el límite de -20. El test pasa por la razón correcta (se bloquea), pero con el **mensaje equivocado**. Debo corregirlo para que espere `"Freno de emergencia"`.

---

## Proposed Changes

### Componente 1: Nuevo archivo de tests

#### [NEW] [sale.debt-concurrency.test.ts](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/tests/sale.debt-concurrency.test.ts)

Archivo `.ts` para mantener consistencia con la dirección del proyecto. Estructura:

**Grupo 1 — Límite de Deuda (Integración)**

| Test | Setup | Acción | Verificación |
|------|-------|--------|-------------|
| Venta a stock negativo dentro del límite | stock=5, branch limit=-20 | Vender qty=10 | ✅ Éxito. Stock final = -5 |
| Freno de emergencia bloquea exceso | stock=0, branch limit=-5 | Vender qty=6 | ❌ Error "Freno de emergencia". Stock = 0 |
| Override a nivel de producto | stock=0, product limit=-50, branch limit=-5 | Vender qty=30 | ✅ Éxito. El producto permite -50, ignora branch |
| Fallback a categoría | stock=0, category limit=-10, branch limit=-5, sin product override | Vender qty=8 | ✅ Éxito. Categoría permite -10 |
| Upsert: sin BranchInventory previo | Sin registro de inventario, branch limit=-20 | Vender qty=15 | ✅ Éxito. Stock final = -15 (creado por upsert) |
| Límite exacto (boundary) | stock=0, branch limit=-20 | Vender qty=20 | ✅ Éxito. Stock = -20 (exactamente en el borde) |
| Límite exacto +1 (boundary) | stock=0, branch limit=-20 | Vender qty=21 | ❌ Error. -21 < -20 |

**Grupo 2 — Concurrencia (Múltiples Cajas Simultáneas)**

| Test | Setup | Acción | Verificación |
|------|-------|--------|-------------|
| N ventas paralelas dentro del headroom | stock=100, limit=-20, N=5 cajas vendiendo qty=10 | `Promise.allSettled([...5 createSaleProcess])` | Todas fulfilled. Stock = 50 |
| Race condition: ventas que individualmente pasan pero colectivamente exceden | stock=5, limit=-10, 3 cajas vendiendo qty=5 cada una | `Promise.allSettled([...3])` | Max 3 exitosas (5-15=-10 es el límite). Si MongoDB aborta por WriteConflict, verificar que stock final ≥ limit |
| Integridad post-concurrencia | Cualquier escenario de N ventas | Conteo de fulfilled vs rejected | `stock_final = stock_inicial - (sum qty de ventas exitosas)`. **Invariante absoluta.** |

**Implementación de concurrencia**: Invocamos `createSaleProcess` directamente (nivel servicio, no HTTP) con `Promise.allSettled` para maximizar la probabilidad de colisión temporal. No usamos supertest aquí porque la serialización HTTP reduce la ventana de race condition.

---

### Componente 2: Corrección del test obsoleto

#### [MODIFY] [sale.test.js](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/tests/sale.test.js#L178-L197)

- Cambiar el mensaje esperado de `'Stock insuficiente'` a `'Freno de emergencia'`.
- Ajustar el nombre del test para reflejar la semántica real del sistema.

---

### Componente 3: Actualización del setup de Redis mock

#### [MODIFY] [setup.js](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/tests/setup.js)

- Agregar mock para `bumpBranchCacheVersion` que `sale.service.ts` invoca en línea 141 y que **no está mockeado** en el setup global. Actualmente solo está mockeado en los archivos individuales.

---

## Verification Plan

### Automated Tests

```bash
# Ejecutar solo el nuevo archivo de tests
npx vitest run tests/sale.debt-concurrency.test.ts

# Ejecutar el test corregido para confirmar que no se rompió
npx vitest run tests/sale.test.js

# Suite completa
npx vitest run
```

### Criterios de Éxito

1. **0 tests rojos** en la suite completa
2. El test de concurrencia demuestra que `stock_final = stock_inicial - Σ(qty_exitosas)` **siempre**
3. El freno de emergencia bloquea consistentemente las ventas que exceden `max_debt_limit`
4. La jerarquía de prioridad producto > categoría > sucursal se respeta
