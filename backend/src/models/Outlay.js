import mongoose from 'mongoose';

const outlaySchema = new mongoose.Schema(
  {
    transactionDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      enum: ['Supplier Payment', 'Vehicle Rent', 'Salary', 'Other Expenses', 'General Expense'],
      default: 'Other Expenses',
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than zero']
    },
    recipient: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    paymentMode: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other'],
      default: 'Cash'
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
      index: true
    },
    supplierName: {
      type: String,
      trim: true,
      default: ''
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null
    },
    supplierBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplierBill',
      default: null
    },
    linkedRef: {
      type: String,
      trim: true,
      default: ''
    },
    isVoid: {
      type: Boolean,
      default: false,
      index: true
    },
    voidReason: {
      type: String,
      trim: true,
      default: ''
    },
    voidedAt: {
      type: Date,
      default: null
    },
    voidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdByName: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

// Helpful compound indexes
outlaySchema.index({ transactionDate: 1, isVoid: 1 });
outlaySchema.index({ category: 1, transactionDate: 1 });

export default mongoose.model('Outlay', outlaySchema);
