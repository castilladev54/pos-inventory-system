import mongoose from 'mongoose';
import { DecimalConfig } from '../utils/decimalConfig.js';

const saleDetailSchema = new mongoose.Schema({
    sale_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',
        required: true
    },
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: DecimalConfig,
    unit_price: DecimalConfig
}, { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
    id: false
});

// NOTA: El hook pre-save que validaba product.stock fue eliminado.
// El campo stock global de Product no existe más (arquitectura multi-sucursal).
// La validación de disponibilidad y el descuento de stock se realizan dentro
// de la transacción ACID en sale.service.ts, sobre BranchInventory.

saleDetailSchema.index({ sale_id: 1 });

export const SaleDetail = mongoose.model('SaleDetail', saleDetailSchema);
