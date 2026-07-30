import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Nombre único por usuario (no global)
categorySchema.index({ name: 1, user: 1 }, { unique: true });
categorySchema.index({ user: 1 });

export const Category = mongoose.model('Category', categorySchema);
