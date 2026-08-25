# Blindaje de Mutación Atómica de Inventario

## Respuestas Técnicas Fundamentales

### Pregunta 1: Operador atómico de mutación numérica

**`$inc`**. Incrementa o decrementa un valor numérico directamente en el motor de almacenamiento de MongoDB, sin extraer el documento a la memoria de la aplicación. La operación es atómica a nivel de documento: no hay ventana de tiempo entre la lectura y la escritura.

### Pregunta 2: `$inc` con Decimal128

**Funciona de forma nativa.** Desde MongoDB 3.4+, `$inc` opera directamente con valores Decimal128 almacenados en el documento. No requiere pipeline de agregación `[{$set: {field: {$add: [...]}}}]`. Basta con pasar el valor como `mongoose.Types.Decimal128`:

```typescript
{ $inc: { stock: mongoose.Types.Decimal128.fromString('-5.5') } }
```

MongoDB realiza la aritmética server-side con precisión Decimal128 completa.

### Pregunta 3: Filtro atómico de stock suficiente

Se integra la condición matemática `stock >= cantidad` directamente en el **filtro** del `findOneAndUpdate`, usando el operador de consulta `$gte`:

```typescript
const result = await BranchInventory.findOneAndUpdate(
  {
    branch_id: branchId,
    product_id: item.product_id,
    owner_id: businessOwnerId,
    // GUARDIA ATÓMICA: solo matchea si el stock actual soporta la deducción
    stock: { $gte: mongoose.Types.Decimal128.fromString(item.quantity) }
  },
  { $inc: { stock: mongoose.Types.Decimal128.fromString(Big(item.quantity).times(-1).toString()) } },
  { session, new: true }
);

// Si no matcheó, el stock era insuficiente → excepción inmediata
if (!result) {
  throw new InsufficientStockError(productName);
}
```

La verificación y la escritura ocurren en un solo viaje al motor. No existe ventana de concurrencia entre "leer el stock" y "decrementar el stock" porque son la misma operación.

---

## Diagnóstico del Código Actual: Vulnerabilidades Concretas

### Vulnerabilidad 1 — `createSaleProcess` ([sale.service.ts:L90-L114](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/services/sale.service.ts#L90-L114))

**Anti-patrón: Lectura-Modificación-Escritura (Read-Modify-Write)**

```typescript
// LECTURA (L90-94): extrae el stock a memoria Node.js
const currentInv = await BranchInventory.findOne({...}).session(session);
const currentStock = currentInv ? currentInv.stock.toString() : '0';

// MODIFICACIÓN en Node.js (L102): decisión basada en dato potencialmente obsoleto
if (Big(currentStock).minus(Big(item.quantity)).lt(Big(limit))) { throw ... }

// ESCRITURA (L106-114): el stock real pudo haber cambiado entre L90 y L106
await BranchInventory.findOneAndUpdate({...}, { $inc: { stock: ... } }, ...);
```

> [!CAUTION]
> Entre la lectura (L90) y la escritura (L106), otra petición concurrente puede ejecutar su propia venta sobre el mismo producto en la misma sucursal. Ambas leen el mismo stock, ambas validan que "hay suficiente", y ambas decrementan. **Resultado: sobreventa y stock corrupto.**
>
> Aunque la transacción de MongoDB protege contra escrituras parciales (rollback), **no protege contra lecturas obsoletas dentro de la misma transacción** a menos que se use `snapshot` read concern (que no está configurado aquí).

**Problema adicional en L112:** Se pasa un `string` al operador `$inc`:
```typescript
{ $inc: { stock: Big(item.quantity).times(-1).toString() } }
// ↑ Esto envía "-5.5" (string), no Decimal128
```
MongoDB interpreta strings en `$inc` de forma impredecible. Se debe pasar `Decimal128`.

---

### Vulnerabilidad 2 — `updateSaleProcess` ([sale.service.ts:L255-L292](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/services/sale.service.ts#L255-L292))

**Mismos problemas de concurrencia + regresión a aritmética `Number`:**

```typescript
// L255-259: Aritmética con Number nativo — viola la política de big.js
let newTotal = 0;
newTotal += item.quantity * item.unit_price;  // Number * Number

// L274-280: Lectura-Modificación-Escritura + Number nativo
const currentStock = currentInv ? currentInv.stock : 0;
if ((currentStock - item.quantity) < limit) { ... }

// L290: $inc con Number nativo en lugar de Decimal128
{ $inc: { stock: -item.quantity } }
```

> [!WARNING]
> `updateSaleProcess` tiene **triple vulnerabilidad**: race condition, aritmética de punto flotante, y tipos incompatibles con Decimal128.

---

### Vulnerabilidad 3 — `createAdjustmentProcess` ([adjustment.service.ts:L60-L83](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/services/adjustment.service.ts#L60-L83))

**Lectura obsoleta para el Kardex:**

```typescript
// L60-64: Lee el stock actual
const inventoryItem = await BranchInventory.findOne({...}).session(session);
const previous_stock = inventoryItem?.stock ?? 0;

// L79-83: Escribe el nuevo stock con $set
await BranchInventory.findOneAndUpdate({...}, { $set: { stock: new_stock } }, ...);
```

El `$set` es aceptable para ajustes (se establece un valor absoluto, no relativo). Pero el `previous_stock` leído en L69 puede ser obsoleto si otra operación concurrente mutó el inventario entre L60 y L79. Esto corrompe los campos `previous_stock` y `difference` del documento de auditoría (Kardex), haciéndolos mentirosos.

**Solución:** Usar `findOneAndUpdate` con `returnDocument: 'before'` para obtener atómicamente el valor anterior en la misma operación de escritura.

---

## Propuesta de Cambios

### [NEW] [`errors/InsufficientStockError.ts`](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/errors/InsufficientStockError.ts)

Excepción de dominio tipada que extiende `AppError` con `status: 409` (Conflict). Incluye `productName` y `productId` para diagnóstico. El controlador la puede capturar con `instanceof` para diferenciarla de errores genéricos.

---

### [MODIFY] [`services/sale.service.ts`](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/services/sale.service.ts)

#### `createSaleProcess` (L87-115)

**Eliminar:** El `findOne` previo (L90-94) y la validación en Node.js (L102).

**Reemplazar por:** `findOneAndUpdate` atómico con filtro `stock: { $gte: Decimal128 }` + `$inc` con `Decimal128` negativo. Si retorna `null`, lanzar `InsufficientStockError`.

> [!IMPORTANT]
> **Decisión de diseño sobre `upsert: true`**: El código actual usa upsert para crear inventario inexistente con stock negativo ("venta forzada hasta límite de deuda"). Esto es incompatible con el filtro `$gte`, porque un documento inexistente no puede matchear `stock >= cantidad`. La solución es separar en dos caminos:
> 1. **Producto con inventario existente**: `findOneAndUpdate` con filtro `$gte` (atómico, sin upsert).
> 2. **Producto sin inventario**: Evaluar si la política de negocio permite crear el documento con stock negativo. Si sí, usar un `findOneAndUpdate` con upsert y `$setOnInsert` para el caso de creación, aplicando el límite de deuda en el filtro.
>
> **¿Cómo quieres manejar la venta de productos sin registro previo de inventario?** ¿Prohibirla (forzar que primero exista un registro en BranchInventory) o mantener la creación con deuda?

#### `updateSaleProcess` (L255-292)

1. Reemplazar aritmética `Number` (L255-259) por `Big`.
2. Eliminar `findOne` previo (L268-272) y reemplazar por el mismo patrón atómico de `createSaleProcess`.
3. Pasar `Decimal128` a `$inc` en lugar de `Number` nativo.

---

### [MODIFY] [`services/adjustment.service.ts`](file:///c:/Users/Carlos/Documents/PostVentasCw/apps/backend/services/adjustment.service.ts)

#### `createAdjustmentProcess` (L59-83)

**Eliminar:** El `findOne` previo (L60-64) para leer `previous_stock`.

**Reemplazar por:** Un solo `findOneAndUpdate` con `$set: { stock: new_stock }` y opción `returnDocument: 'before'` (equivale a `new: false`). El documento retornado **es** el estado anterior, leído atómicamente en el mismo instante de la escritura. Extraer `previous_stock` y `difference` del resultado.

```typescript
const previousDoc = await BranchInventory.findOneAndUpdate(
  { product_id, branch_id: branchId, owner_id: businessOwnerId },
  { $set: { stock: mongoose.Types.Decimal128.fromString(new_stock) } },
  { upsert: true, new: false, session, runValidators: true }
);

const previous_stock = previousDoc?.stock?.toString() ?? '0';
const difference = Big(new_stock).minus(Big(previous_stock)).toString();
```

---

## Verificación

### Tests Automatizados

1. **Test de race condition en ventas:** Ejecutar dos `createSaleProcess` concurrentes sobre el mismo producto con stock limitado. Verificar que exactamente una falla con `InsufficientStockError` y la otra decrementa correctamente.

2. **Test de auditoría en ajustes:** Ejecutar un ajuste y verificar que `previous_stock` y `difference` coinciden con el estado real de BranchInventory antes y después de la operación.

3. **Tests existentes:** Ejecutar `pnpm run test` para verificar que los tests de compra, venta y ajuste siguen pasando.

### Manual
- Verificar en MongoDB Compass que los campos `stock` en `branchinventories` siguen siendo de tipo `Decimal128` después de las operaciones `$inc`.

## Open Questions

> [!IMPORTANT]
> **Política de venta sin inventario previo (deuda):** El código actual permite vender productos que no tienen registro en `BranchInventory` (creando el documento con stock negativo vía upsert). El filtro atómico `$gte` no es compatible con upsert en ese escenario. ¿Deseas:
> - **A)** Prohibir ventas sin inventario previo (el producto debe tener un registro en BranchInventory antes de poder venderse), o
> - **B)** Mantener la política de deuda, separando la lógica en dos caminos (inventario existente vs. creación con stock negativo)?
