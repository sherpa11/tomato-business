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
    const { type = 'buyer', transaction, purchase, printerName, silent = true, openDialog = false } = req.body;

    if (!transaction && !purchase) {
      return res.status(400).json({ success: false, message: 'Transaction or purchase data required' });
    }

    // Fetch existing settings
    const settingsDoc = await Settings.findOne();
    const settings = settingsDoc ? settingsDoc.toObject() : {};

    const result = await executeDirectPrint({
      type,
      transaction,
      purchase,
      settings,
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
    const { type = 'buyer', transaction, purchase } = req.body;

    const settingsDoc = await Settings.findOne();
    const settings = settingsDoc ? settingsDoc.toObject() : {};

    const result = await generatePdfFile({
      type,
      transaction,
      purchase,
      settings
    });

    generatedPath = result.pdfPath;
    const filename = type === 'buyer' ? 'Buyer_Bill_89x89mm.pdf' : 'Supplier_Bill_A6.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Page-Count', result.pageCount);
    res.setHeader('X-Media-Box', result.mediaBox);

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
