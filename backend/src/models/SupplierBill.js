import mongoose from 'mongoose';

const supplierBillSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true
    },
    supplierName: {
      type: String,
      required: true,
      trim: true
    },
    transactionDate: {
      type: String, // 'YYYY-MM-DD'
      required: true
    },
    commission: {
      type: Number,
      default: 0,
      min: 0
    },
    gate: {
      type: Number,
      default: 0,
      min: 0
    },
    coolie: {
      type: Number,
      default: 0,
      min: 0
    },
    rent: {
      type: Number,
      default: 0,
      min: 0
    },
    debit: {
      type: Number,
      default: 0,
      min: 0
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// One consolidated bill settlement record per supplier per operational date
supplierBillSchema.index({ supplierId: 1, transactionDate: 1 }, { unique: true });

export default mongoose.model('SupplierBill', supplierBillSchema);
