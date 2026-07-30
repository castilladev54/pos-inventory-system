import mongoose from 'mongoose';

const inventoryAdjustmentSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  previous_stock: {
    type: Number,
    required: true
  },
  new_stock: {
    type: Number,
    required: true,
    min: 0
  },
  difference: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    enum: ['initial_count', 'damaged', 'stolen', 'expired', 'correction', 'other'],
    required: true
  },
  notes: {
    type: String,
    trim: true,
    default: ""
  }
}, { timestamps: true });

// Índice para agilizar las búsquedas por usuario
inventoryAdjustmentSchema.index({ user_id: 1, createdAt: -1 });

export const InventoryAdjustment = mongoose.model('InventoryAdjustment', inventoryAdjustmentSchema);
