import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      default: 'Tomato Wholesale Market',
      trim: true
    },
    ownerName: {
      type: String,
      default: 'Proprietor',
      trim: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    },
    address: {
      type: String,
      default: 'Main Wholesale Vegetable Market',
      trim: true
    },
    defaultSellingRate: {
      type: Number,
      default: 1100,
      min: 0
    },
    defaultPurchaseRate: {
      type: Number,
      default: 1000,
      min: 0
    },
    currencySymbol: {
      type: String,
      default: '₹'
    },
    thermalPrintWidth: {
      type: String,
      default: '80mm',
      enum: ['80mm', '58mm']
    }
  },
  { timestamps: true }
);

export default mongoose.model('Settings', settingsSchema);
