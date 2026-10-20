import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
      index: true
    },
    buyerName: {
      type: String,
      required: true,
      trim: true
    },
    transactionDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['SALE', 'PAYMENT']
    },
    // For SALE:
    bigBoxes: {
      type: Number,
      default: 0,
      min: 0
    },
    smallBoxes: {
      type: Number,
      default: 0,
      min: 0
    },
    bigEquivalent: {
      type: Number,
      default: 0,
      min: 0
    },
    ratePerBigBox: {
      type: Number,
      default: 0,
      min: 0
    },
    billAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    // Payment amount (applies to SALE and PAYMENT):
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    // Running ledger snapshot (always recalculated & maintained by backend):
    oldBalance: {
      type: Number,
      required: true
    },
    totalDue: {
      type: Number,
      required: true
    },
    newBalance: {
      type: Number,
      required: true
    },
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

// Indexes for fast chronological ledger lookup and date queries
transactionSchema.index({ buyerId: 1, transactionDate: 1, createdAt: 1 });
transactionSchema.index({ transactionDate: 1, isVoid: 1 });

export default mongoose.model('Transaction', transactionSchema);
