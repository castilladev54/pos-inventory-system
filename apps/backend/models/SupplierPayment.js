import mongoose from 'mongoose';

const supplierPaymentSchema = new mongoose.Schema({
  purchase_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

supplierPaymentSchema.index({ admin_id: 1, date: -1 });

export const SupplierPayment = mongoose.model('SupplierPayment', supplierPaymentSchema);
