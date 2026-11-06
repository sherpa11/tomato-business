import fs from 'fs';
import {
  getInstalledPrinters,
  getDefaultPrinterName,
  executeDirectPrint,
  generatePdfFile
} from '../services/printService.js';
import Settings from '../models/Settings.js';

// Get available Windows printers and status
export const getPrinterStatus = async (req, res, next) => {
  try {
    const printers = getInstalledPrinters();
    const defaultPrinter = getDefaultPrinterName(printers);
    const hasCanon = printers.some((p) => p.isCanon || p.name.includes('G3030'));

    res.json({
      success: true,
      hasCanon,
      defaultPrinter,
      printers
    });
  } catch (error) {
    next(error);
  }
};

// Direct print to Canon G3030
export const directPrintBill = async (req, res, next) => {
  try {
    const { type = 'buyer', transaction, purchase, paperSize = 'square', printerName, silent = true, openDialog = false } = req.body;

    // Strict RBAC: Accountants cannot print supplier bills
    if (req.user?.role === 'ACCOUNTANT' && (type?.toLowerCase() === 'supplier' || purchase)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Accountants are not authorized to print supplier vouchers.'
      });
    }

    if (!transaction && !purchase) {
      return res.status(400).json({ success: false, message: 'Transaction or purchase data required' });
    }

    // Validate paperSize against supported values
    const validSizes = ['square', 'a6'];
    const normalizedSize = String(paperSize || 'square').toLowerCase().trim();
    if (!validSizes.includes(normalizedSize)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paperSize '${paperSize}'. Supported sizes are: ${validSizes.join(', ')}`
      });
    }

    // Fetch existing settings
    const settingsDoc = await Settings.findOne();
    const settings = settingsDoc ? settingsDoc.toObject() : {};

    const result = await executeDirectPrint({
      type,
      transaction,
      purchase,
      settings,
      paperSize: normalizedSize,
      printerName,
      silent,
      openDialog
    });

    res.json(result);
  } catch (error) {
    console.error('[PrintController] Direct print failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Direct print failed',
      fallbackRequired: true
    });
  }
};

// Stream generated 1-page PDF
export const streamBillPdf = async (req, res, next) => {
  let generatedPath = null;
  try {
    const { type = 'buyer', transaction, purchase, paperSize = 'square' } = req.body;

    // Strict RBAC: Accountants cannot stream supplier PDFs
    if (req.user?.role === 'ACCOUNTANT' && (type?.toLowerCase() === 'supplier' || purchase)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Accountants are not authorized to access supplier vouchers.'
      });
    }

    // Validate paperSize against supported values
    const validSizes = ['square', 'a6'];
    const normalizedSize = String(paperSize || 'square').toLowerCase().trim();
    if (!validSizes.includes(normalizedSize)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paperSize '${paperSize}'. Supported sizes are: ${validSizes.join(', ')}`
      });
    }

    const settingsDoc = await Settings.findOne();
    const settings = settingsDoc ? settingsDoc.toObject() : {};

    const result = await generatePdfFile({
      type,
      transaction,
      purchase,
      settings,
      paperSize: normalizedSize
    });

    generatedPath = result.pdfPath;
    const filename = type === 'buyer'
      ? (normalizedSize === 'a6' ? 'Buyer_Bill_A6.pdf' : 'Buyer_Bill_Square.pdf')
      : 'Supplier_Bill_A6.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Page-Count', result.pageCount);
    res.setHeader('X-Media-Box', result.mediaBox);
    res.setHeader('X-Paper-Size', normalizedSize);

    const stream = fs.createReadStream(generatedPath);
    stream.pipe(res);

    stream.on('end', () => {
      try {
        if (fs.existsSync(generatedPath)) fs.unlinkSync(generatedPath);
      } catch {}
    });
  } catch (error) {
    if (generatedPath) {
      try {
        if (fs.existsSync(generatedPath)) fs.unlinkSync(generatedPath);
      } catch {}
    }
    next(error);
  }
};
