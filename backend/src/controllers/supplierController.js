import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import { roundMoney, roundBoxes } from '../services/ledgerService.js';

export const getSuppliers = async (req, res, next) => {
  try {
    const { search, active } = req.query;
    let query = {};

    if (active !== undefined) {
      query.active = active === 'true';
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 }).lean();

    // Single aggregation pass across all non-void purchases grouped by supplierId (avoids N+1 queries)
    const purchaseStats = await Purchase.aggregate([
      { $match: { isVoid: false } },
      {
        $group: {
          _id: '$supplierId',
          totalAmount: { $sum: '$totalAmount' },
          totalBigBoxes: { $sum: '$bigBoxes' },
          totalSmallBoxes: { $sum: '$smallBoxes' },
          totalBigEquivalent: { $sum: '$bigEquivalent' },
          lastDate: { $max: '$transactionDate' },
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = new Map();
    purchaseStats.forEach((s) => {
      if (s._id) {
        statsMap.set(String(s._id), s);
      }
    });

    const enrichedSuppliers = suppliers.map((supplier) => {
      const s = statsMap.get(String(supplier._id)) || {
        totalAmount: 0,
        totalBigBoxes: 0,
        totalSmallBoxes: 0,
        totalBigEquivalent: 0,
        lastDate: null,
        count: 0
      };

      return {
        _id: supplier._id,
        name: supplier.name,
        phone: supplier.phone,
        address: supplier.address,
        notes: supplier.notes,
        active: supplier.active,
        totalPurchaseAmount: roundMoney(s.totalAmount),
        totalBigBoxes: s.totalBigBoxes,
        totalSmallBoxes: s.totalSmallBoxes,
        totalBigEquivalent: roundBoxes(s.totalBigEquivalent),
        transactionCount: s.count,
        lastPurchaseDate: s.lastDate,
        createdAt: supplier.createdAt
      };
    });

    res.json({ success: true, count: enrichedSuppliers.length, suppliers: enrichedSuppliers });
  } catch (error) {
    next(error);
  }
};

export const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.json({ success: true, supplier });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req, res, next) => {
  try {
    const { name, phone, address, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const existing = await Supplier.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A supplier with this name already exists' });
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      notes: notes ? notes.trim() : '',
      active: true
    });

    res.status(201).json({ success: true, supplier, message: 'Supplier created successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const { name, phone, address, notes, active } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    if (name && name.trim() !== supplier.name) {
      const duplicate = await Supplier.findOne({ name: name.trim(), _id: { $ne: supplier._id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Another supplier with this name already exists' });
      }
      supplier.name = name.trim();
      await Purchase.updateMany({ supplierId: supplier._id }, { supplierName: supplier.name });
    }

    if (phone !== undefined) supplier.phone = phone.trim();
    if (address !== undefined) supplier.address = address.trim();
    if (notes !== undefined) supplier.notes = notes.trim();
    if (active !== undefined) supplier.active = Boolean(active);

    await supplier.save();
    res.json({ success: true, supplier, message: 'Supplier updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const getSupplierPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({ supplierId: req.params.id })
      .sort({ transactionDate: -1, createdAt: -1 });

    res.json({ success: true, count: purchases.length, purchases });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Remove any associated purchase lots so no orphan data remains
    const purchaseCount = await Purchase.countDocuments({ supplierId: supplier._id });
    if (purchaseCount > 0) {
      await Purchase.deleteMany({ supplierId: supplier._id });
    }

    await Supplier.findByIdAndDelete(supplier._id);

    res.json({
      success: true,
      message: `Supplier '${supplier.name}' ${purchaseCount > 0 ? `and ${purchaseCount} purchase lot(s)` : ''} removed successfully`
    });
  } catch (error) {
    next(error);
  }
};

