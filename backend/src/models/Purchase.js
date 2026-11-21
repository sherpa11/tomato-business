import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    bigBoxes: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    smallBoxes: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    bigEquivalent: {
      type: Number,
      required: true,
      min: 0
    },
    ratePerBigBox: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Multi-row purchase lot support (multiple rows with different rates in one purchase)
    items: [
      {
        bigBoxes: { type: Number, default: 0, min: 0 },
        smallBoxes: { type: Number, default: 0, min: 0 },
        bigEquivalent: { type: Number, default: 0, min: 0 },
        ratePerBigBox: { type: Number, default: 0, min: 0 },
        lineAmount: { type: Number, default: 0, min: 0 },
        totalAmount: { type: Number, default: 0, min: 0 },
        notes: { type: String, default: '' }
      }
    ],
    notes: {
      type: String,
      default: ''
    },
    isVoid: {
      type: Boolean,
      default: false
    },
    voidReason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

purchaseSchema.index({ transactionDate: 1, isVoid: 1 });
purchaseSchema.index({ supplierId: 1, transactionDate: 1 });
purchaseSchema.index({ isVoid: 1, supplierId: 1 });

export default mongoose.model('Purchase', purchaseSchema);
