import Buyer from '../models/Buyer.js';
import Transaction from '../models/Transaction.js';
import { recalculateBuyerLedger, roundMoney } from '../services/ledgerService.js';

export const getBuyers = async (req, res, next) => {
  try {
    const { search, active, dropdown } = req.query;
    let query = {};

    if (active !== undefined) {
      query.active = active === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const buyers = await Buyer.find(query).sort({ name: 1 }).lean();

    // Fast path for modal dropdowns: returns buyer name & current balance instantly without heavy collection-wide aggregation
    if (dropdown === 'true') {
      const dropdownBuyers = buyers.map((b) => ({
        _id: b._id,
        name: b.name,
        phone: b.phone,
        address: b.address,
        notes: b.notes || '',
        initialBalance: roundMoney(b.initialBalance),
        currentBalance: roundMoney(b.currentBalance),
        active: b.active
      }));
      return res.json({ success: true, count: dropdownBuyers.length, buyers: dropdownBuyers });
    }

    // Single aggregation pass across all non-void transactions grouped by buyerId (avoids N+1 queries)
    const txStats = await Transaction.aggregate([
      { $match: { isVoid: false } },
      {
        $group: {
          _id: '$buyerId',
          totalPurchases: { $sum: '$billAmount' },
          totalPayments: { $sum: '$amountPaid' },
          lastTxDate: { $max: '$transactionDate' },
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = new Map();
    txStats.forEach((s) => {
      if (s._id) {
        statsMap.set(String(s._id), s);
      }
    });

    const enrichedBuyers = buyers.map((buyer) => {
      const stats = statsMap.get(String(buyer._id)) || {
        totalPurchases: 0,
        totalPayments: 0,
        lastTxDate: null,
        count: 0
      };

      return {
        _id: buyer._id,
        name: buyer.name,
        phone: buyer.phone,
        address: buyer.address,
        notes: buyer.notes || '',
        initialBalance: roundMoney(buyer.initialBalance),
        currentBalance: roundMoney(buyer.currentBalance),
        active: buyer.active,
        totalPurchases: roundMoney(stats.totalPurchases),
        totalPayments: roundMoney(stats.totalPayments),
        lastTransactionDate: stats.lastTxDate,
        transactionCount: stats.count,
        createdAt: buyer.createdAt
      };
    });

    res.json({ success: true, count: enrichedBuyers.length, buyers: enrichedBuyers });
  } catch (error) {
    next(error);
  }
};

export const getBuyerById = async (req, res, next) => {
  try {
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }
    res.json({ success: true, buyer });
  } catch (error) {
    next(error);
  }
};

export const createBuyer = async (req, res, next) => {
  try {
    const { name, phone, address, notes, initialBalance } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Buyer name is required' });
    }

    const existing = await Buyer.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A buyer with this name already exists' });
    }

    const initBal = roundMoney(Number(initialBalance) || 0);
    const buyer = await Buyer.create({
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      notes: notes ? notes.trim() : '',
      initialBalance: initBal,
      currentBalance: initBal,
      active: true
    });

    res.status(201).json({ success: true, buyer, message: 'Buyer created successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateBuyer = async (req, res, next) => {
  try {
    const { name, phone, address, notes, initialBalance, active } = req.body;
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    if (name && name.trim() !== buyer.name) {
      const duplicate = await Buyer.findOne({ name: name.trim(), _id: { $ne: buyer._id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Another buyer with this name already exists' });
      }
      buyer.name = name.trim();
      await Transaction.updateMany({ buyerId: buyer._id }, { buyerName: buyer.name });
    }

    if (phone !== undefined) buyer.phone = phone.trim();
    if (address !== undefined) buyer.address = address.trim();
    if (notes !== undefined) buyer.notes = notes.trim();
    if (active !== undefined) buyer.active = Boolean(active);

    let needsRecalculation = false;
    if (initialBalance !== undefined && roundMoney(initialBalance) !== buyer.initialBalance) {
      buyer.initialBalance = roundMoney(initialBalance);
      needsRecalculation = true;
    }

    await buyer.save();

    if (needsRecalculation) {
      await recalculateBuyerLedger(buyer._id);
    }

    const updated = await Buyer.findById(buyer._id);
    res.json({ success: true, buyer: updated, message: 'Buyer updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const getBuyerLedger = async (req, res, next) => {
  try {
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    // Include all transactions (with isVoid clearly marked for audit)
    const transactions = await Transaction.find({ buyerId: buyer._id })
      .sort({ transactionDate: 1, createdAt: 1, _id: 1 });

    const ledgerEntries = [];

    // Opening balance row if initialBalance != 0 or if there are transactions
    ledgerEntries.push({
      id: 'opening',
      date: buyer.createdAt ? buyer.createdAt.toISOString().split('T')[0] : 'Opening',
      description: 'Opening Balance',
      type: 'OPENING',
      debit: buyer.initialBalance > 0 ? buyer.initialBalance : 0,
      credit: buyer.initialBalance < 0 ? Math.abs(buyer.initialBalance) : 0,
      balance: buyer.initialBalance,
      isVoid: false
    });

    for (const tx of transactions) {
      if (tx.type === 'SALE') {
        let boxDesc = `${tx.bigBoxes} Big`;
        if (tx.smallBoxes > 0) {
          boxDesc += ` + ${tx.smallBoxes} Small`;
        }
        const description = `${boxDesc} Boxes @ ₹${tx.ratePerBigBox.toLocaleString('en-IN')}`;

        ledgerEntries.push({
          id: tx._id,
          transactionId: tx._id,
          date: tx.transactionDate,
          description: tx.isVoid ? `[VOIDED] ${description}` : description,
          type: 'SALE',
          bigBoxes: tx.bigBoxes,
          smallBoxes: tx.smallBoxes,
          bigEquivalent: tx.bigEquivalent,
          ratePerBigBox: tx.ratePerBigBox,
          debit: tx.billAmount,
          credit: tx.amountPaid,
          oldBalance: tx.oldBalance,
          totalDue: tx.totalDue,
          amountPaid: tx.amountPaid,
          balance: tx.newBalance,
          notes: tx.notes,
          isVoid: tx.isVoid,
          voidReason: tx.voidReason,
          createdAt: tx.createdAt
        });
      } else {
        // PAYMENT
        const description = `Payment Received${tx.notes ? ` - ${tx.notes}` : ''}`;
        ledgerEntries.push({
          id: tx._id,
          transactionId: tx._id,
          date: tx.transactionDate,
          description: tx.isVoid ? `[VOIDED] ${description}` : description,
          type: 'PAYMENT',
          debit: 0,
          credit: tx.amountPaid,
          oldBalance: tx.oldBalance,
          totalDue: tx.totalDue,
          amountPaid: tx.amountPaid,
          balance: tx.newBalance,
          notes: tx.notes,
          isVoid: tx.isVoid,
          voidReason: tx.voidReason,
          createdAt: tx.createdAt
        });
      }
    }

    res.json({
      success: true,
      buyer: {
        _id: buyer._id,
        name: buyer.name,
        phone: buyer.phone,
        address: buyer.address,
        initialBalance: buyer.initialBalance,
        currentBalance: buyer.currentBalance
      },
      ledgerEntries
    });
  } catch (error) {
    next(error);
  }
};

export const recalculateBuyer = async (req, res, next) => {
  try {
    const result = await recalculateBuyerLedger(req.params.id);
    res.json({ success: true, message: 'Ledger successfully audited and recalculated', result });
  } catch (error) {
    next(error);
  }
};

export const deleteBuyer = async (req, res, next) => {
  try {
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    // Remove any associated transactions so no orphan data remains
    const txCount = await Transaction.countDocuments({ buyerId: buyer._id });
    if (txCount > 0) {
      await Transaction.deleteMany({ buyerId: buyer._id });
    }

    await Buyer.findByIdAndDelete(buyer._id);

    res.json({
      success: true,
      message: `Buyer '${buyer.name}' ${txCount > 0 ? `and ${txCount} transaction(s)` : ''} removed successfully`
    });
  } catch (error) {
    next(error);
  }
};
