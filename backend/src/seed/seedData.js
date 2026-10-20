import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Supplier from '../models/Supplier.js';
import Buyer from '../models/Buyer.js';
import Purchase from '../models/Purchase.js';
import Transaction from '../models/Transaction.js';
import { recalculateBuyerLedger } from '../services/ledgerService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tomato_billing';

export const seedDatabase = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ [Security Alert] Demo seeding is strictly disabled in production!');
    return;
  }

  const allowSeed = process.env.ALLOW_DEMO_SEED === 'true';
  if (!allowSeed) {
    console.log('[Seed] Manual demo seeding requires ALLOW_DEMO_SEED="true". Skipping.');
    return;
  }

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    console.log('[Seed] Connected to development MongoDB for demo seeding.');

    // 1. Ensure Default Settings if completely empty
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        businessName: 'Shree Tomato Wholesale Mandi',
        ownerName: 'Mandi Trader',
        phone: '9876543210',
        address: 'Wholesale Vegetable Market, Shop #14',
        defaultSellingRate: 1100,
        defaultPurchaseRate: 1000,
        currencySymbol: '₹',
        thermalPrintWidth: '80mm'
      });
      console.log('[Seed] Default settings created.');
    }

    console.log('[Seed] ALLOW_DEMO_SEED is enabled in non-production. Seeding isolated demo data...');

    // Clear existing demo records
    await Purchase.deleteMany({});
    await Transaction.deleteMany({});
    await Buyer.deleteMany({});
    await Supplier.deleteMany({});

    // Supplier A1
    const supplierA1 = await Supplier.create({
      name: 'A1',
      phone: '9811122233',
      address: 'Tomato Farm Direct, Yard 4',
      notes: 'Primary morning supplier'
    });

    // Purchase from A1 on 2026-10-03: 250 Big Boxes @ ₹1,000 = ₹2,50,000
    await Purchase.create({
      supplierId: supplierA1._id,
      supplierName: supplierA1.name,
      transactionDate: '2026-10-03',
      bigBoxes: 250,
      smallBoxes: 0,
      bigEquivalent: 250,
      ratePerBigBox: 1000,
      totalAmount: 250000,
      notes: 'Morning fresh tomato truck 250 Big'
    });

    // Buyer Seed Definitions
    const demoBuyers = [
      {
        name: 'B1',
        phone: '9899001122',
        address: 'Retail Stall 12',
        initialBalance: 2500,
        tx: {
          type: 'SALE',
          bigBoxes: 10,
          smallBoxes: 0,
          rate: 1100,
          paid: 12500,
          notes: 'Standard 10 Big boxes'
        }
      },
      {
        name: 'B2',
        phone: '9899001133',
        address: 'Local Vegetable Vendor',
        initialBalance: 1000,
        tx: {
          type: 'SALE',
          bigBoxes: 5,
          smallBoxes: 0,
          rate: 1100,
          paid: 6000,
          notes: '5 Big boxes daily supply'
        }
      },
      {
        name: 'B3',
        phone: '9899001144',
        address: 'Subzi Mandi Shop 7',
        initialBalance: 0,
        tx: {
          type: 'SALE',
          bigBoxes: 8,
          smallBoxes: 0,
          rate: 1100,
          paid: 4000,
          notes: 'Partial payment case'
        }
      },
      {
        name: 'B4',
        phone: '9899001155',
        address: 'Hotel Sagar Line',
        initialBalance: 1500,
        tx: {
          type: 'SALE',
          bigBoxes: 4,
          smallBoxes: 0,
          rate: 1100,
          paid: 0,
          notes: 'Zero payment case'
        }
      },
      {
        name: 'B5',
        phone: '9899001166',
        address: 'Corner Market',
        initialBalance: 3000,
        tx: {
          type: 'PAYMENT',
          bigBoxes: 0,
          smallBoxes: 0,
          rate: 0,
          paid: 3000,
          notes: 'Cleared old balance without buying'
        }
      },
      {
        name: 'B6',
        phone: '9899001177',
        address: 'Small Carts Union',
        initialBalance: 0,
        tx: {
          type: 'SALE',
          bigBoxes: 0,
          smallBoxes: 4, // 4 small = 2 big eqv => 2 * 1100 = 2200
          rate: 1100,
          paid: 2200,
          notes: 'Small boxes only test'
        }
      },
      {
        name: 'B7',
        phone: '9899001188',
        address: 'City Supermarket',
        initialBalance: 0,
        tx: {
          type: 'SALE',
          bigBoxes: 8,
          smallBoxes: 2, // 8 big + 2 small = 9 big eqv => 9 * 1100 = 9900
          rate: 1100,
          paid: 9900,
          notes: 'Big + Small mixed boxes test'
        }
      },
      {
        name: 'B8',
        phone: '9899001199',
        address: 'Catering Service',
        initialBalance: 1000,
        tx: {
          type: 'SALE',
          bigBoxes: 2,
          smallBoxes: 0, // 2 big @ 1100 = 2200. Total due = 3200. Paid = 4000. Credit = 800
          rate: 1100,
          paid: 4000,
          notes: 'Overpayment / Advance credit test'
        }
      }
    ];

    for (const item of demoBuyers) {
      const buyer = await Buyer.create({
        name: item.name,
        phone: item.phone,
        address: item.address,
        initialBalance: item.initialBalance,
        currentBalance: item.initialBalance,
        active: true
      });

      if (item.tx.type === 'SALE') {
        const bigEq = item.tx.bigBoxes + item.tx.smallBoxes / 2;
        const bill = bigEq * item.tx.rate;
        await Transaction.create({
          buyerId: buyer._id,
          buyerName: buyer.name,
          transactionDate: '2026-10-03',
          type: 'SALE',
          bigBoxes: item.tx.bigBoxes,
          smallBoxes: item.tx.smallBoxes,
          bigEquivalent: bigEq,
          ratePerBigBox: item.tx.rate,
          billAmount: bill,
          amountPaid: item.tx.paid,
          oldBalance: 0,
          totalDue: bill,
          newBalance: bill - item.tx.paid,
          notes: item.tx.notes
        });
      } else {
        // PAYMENT
        await Transaction.create({
          buyerId: buyer._id,
          buyerName: buyer.name,
          transactionDate: '2026-10-03',
          type: 'PAYMENT',
          bigBoxes: 0,
          smallBoxes: 0,
          bigEquivalent: 0,
          ratePerBigBox: 0,
          billAmount: 0,
          amountPaid: item.tx.paid,
          oldBalance: 0,
          totalDue: 0,
          newBalance: -item.tx.paid,
          notes: item.tx.notes
        });
      }

      // Recalculate ledger for accurate chronological balances
      await recalculateBuyerLedger(buyer._id);
    }

    console.log('[Seed] Demo data seeding completed successfully!');
  } catch (error) {
    console.error('[Seed Error]', error);
  }
};

// Allow direct execution: node src/seed/seedData.js
if (process.argv[1] && process.argv[1].endsWith('seedData.js')) {
  seedDatabase().then(() => {
    mongoose.disconnect();
    process.exit(0);
  });
}
