import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sold_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  total_amount: {
    type: Number,
    required: true
  },
  payment_method: {
    type: String,
    required: true,
    enum: ['Efectivo', 'Divisas', 'Tarjeta', 'Pago Movil', 'Transferencia', 'Zelle']
  },
  exchange_rate: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed'
  }
}, { timestamps: true });

saleSchema.index({ customer_id: 1, createdAt: -1 });
saleSchema.index({ customer_id: 1, sold_by: 1, createdAt: -1 });

export const Sale = mongoose.model('Sale', saleSchema);
