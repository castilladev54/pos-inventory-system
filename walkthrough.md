# Recolector de Deuda Operativa - Walkthrough

¡Misión Cumplida! Hemos cerrado el ciclo contable para permitir ventas en negativo sin perder el control sobre el inventario.

## Resumen de la Implementación

### 1. Freno de Emergencia (Backend)
- Se añadió el campo `max_debt_limit` a nivel de **Sucursal** (`Branch`), **Producto** (`Product`) y **Categoría** (`Category`). 
- Por defecto, la sucursal tiene un límite de **-20** unidades de deuda permitida.
- El servicio transaccional de ventas (`sale.service.ts`) ahora implementa **Herencia de Límite (O(1))**:
  - `limit = producto ?? categoría ?? sucursal`
  - Lee el inventario real en medio de la transacción. Si `(stock_actual - cantidad_solicitada)` rompe este límite, se aborta la venta lanzando el error: `"Freno de emergencia: la venta supera el límite de deuda permitida"`.

### 2. Visibilidad en el Dashboard (Frontend)
- El gestor de productos ahora tiene un botón **🚨 Ver Deuda Operativa** junto a la barra de búsqueda.
- Al presionarlo, le solicita al backend (`hasDebt=true`) una agregación específica.
- El backend inyecta un `$match: { stock: { $lt: 0 } }` en el pipeline, devolviendo *únicamente* los productos que están en números rojos.

### 3. Reconciliación 
- Las compras (`purchase.service.ts`) siguen operando con `$inc`, lo que significa que el sistema se cobrará la deuda automáticamente (ej: stock en -2, entran 10 latas, el stock queda en 8).

> [!TIP]
> Prueba hacer una venta de un producto que no tenga stock en tu POS para llevarlo a números negativos. Luego, ve a "Gestión de Productos" y usa el nuevo botón "Ver Deuda Operativa" para auditar el descuadre. Intenta forzar otra venta para que sobrepase el `-20` y verás el Freno de Emergencia del Backend en acción.
