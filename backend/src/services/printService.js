import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getConsolidatedSupplierBill, formatItemBoxDescription } from './supplierBillService.js';
import { getConsolidatedBuyerBill } from './buyerBillService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate Chrome and SumatraPDF binaries
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SUMATRA_PATH = path.resolve(__dirname, '../../node_modules/pdf-to-printer/dist/SumatraPDF-3.4.6-32.exe');

// Cached printers in-memory to prevent slow synchronous PowerShell subshell spawning on every request
let cachedPrinters = null;
let lastPrinterQuery = 0;
const PRINTER_CACHE_TTL = 60 * 1000; // 60 seconds

// Helper to query installed printers via PowerShell
export const getInstalledPrinters = () => {
  const now = Date.now();
  if (cachedPrinters && now - lastPrinterQuery < PRINTER_CACHE_TTL) {
    return cachedPrinters;
  }
  try {
    const cmd = `powershell -Command "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"`;
    const stdout = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
    if (!stdout) return cachedPrinters || [];
    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    cachedPrinters = list.map((p) => ({
      name: p.Name,
      driver: p.DriverName,
      port: p.PortName,
      isCanon: p.Name.toLowerCase().includes('canon') || p.DriverName.toLowerCase().includes('canon'),
      status: p.PrinterStatus === 0 ? 'Normal' : `Status ${p.PrinterStatus}`
    }));
    lastPrinterQuery = now;
    return cachedPrinters;
  } catch (err) {
    console.error('[PrintService] Error querying printers:', err.message);
    return cachedPrinters || [];
  }
};

// Helper to get default printer
export const getDefaultPrinterName = (printers = []) => {
  const canon = printers.find((p) => p.isCanon || p.name.includes('G3030'));
  if (canon) return canon.name;
  return printers[0]?.name || 'Canon G3030 series';
};

// Format transaction date helper
const formatBillDate = (d) => {
  if (!d) return '15/10/2026';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB');
  } catch {
    return '15/10/2026';
  }
};

// Load logo as base64
const getLogoBase64 = (color = 'green') => {
  try {
    const logoFile = color === 'green' ? 'lakshmi-green.png' : 'lakshmi-black.png';
    const logoPath = path.resolve(__dirname, `../../../frontend/public/${logoFile}`);
    if (fs.existsSync(logoPath)) {
      return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  } catch (err) {
    console.warn('[PrintService] Could not load logo:', err.message);
  }
  return '';
};

// Generate Buyer Bill HTML (89mm x 89mm)
export const renderBuyerBillHtml = (transaction, settings = {}) => {
  const rawPhone = settings.phone || '';
  const phones = rawPhone.split(/[,/|]+/).map((p) => p.trim()).filter(Boolean);
  const phone1 = phones[0] || '94434 01838';
  const phone2 = phones[1] || '99438 01838';
  const owner = settings.ownerName && settings.ownerName !== 'Bootto' && settings.ownerName !== 'Proprietor'
    ? settings.ownerName
    : 'R. பூட்டோ';
  const address = settings.address && !settings.address.toLowerCase().includes('mandi') && !settings.address.toLowerCase().includes('wholesale')
    ? settings.address
    : 'shop no : 25, Gandhi Market, Dindigul, 624001';

  // Normalize items array for consolidated bill (or single transaction fallback)
  let items = [];
  if (Array.isArray(transaction.items) && transaction.items.length > 0) {
    items = transaction.items;
  } else {
    const bigBoxes = Number(transaction.bigBoxes) || 0;
    const smallBoxes = Number(transaction.smallBoxes) || 0;
    let descLine1 = 'தக்காளி பெரிய பெட்டி';
    let descLine2 = '(Big Box)';
    let qtyText = bigBoxes > 0 ? `${bigBoxes}` : '—';
    let qtyNum = bigBoxes;

    if (bigBoxes > 0 && smallBoxes > 0) {
      descLine1 = 'தக்காளி பெட்டி';
      descLine2 = `(${bigBoxes} Big + ${smallBoxes} Small)`;
      qtyNum = Number(transaction.bigEquivalent) || (bigBoxes + smallBoxes / 2);
      qtyText = `${qtyNum}`;
    } else if (smallBoxes > 0 && bigBoxes === 0) {
      descLine1 = 'தக்காளி சிறிய பெட்டி';
      descLine2 = '(Small Box)';
      qtyNum = smallBoxes;
      qtyText = `${qtyNum}`;
    } else if (transaction.type === 'PAYMENT') {
      descLine1 = 'பணம் செலுத்தியது';
      descLine2 = '(Cash Receipt)';
      qtyText = '—';
      qtyNum = 0;
    }

    const rateNum = Number(transaction.ratePerBigBox) || 0;
    let lineAmt = 0;
    if (transaction.type === 'SALE' || !transaction.type) {
      if (rateNum > 0 && qtyNum > 0) {
        lineAmt = Math.round(rateNum * qtyNum * 100) / 100;
      } else {
        lineAmt = Number(transaction.billAmount) || Number(transaction.todayBill) || 0;
      }
    } else if (transaction.type === 'PAYMENT') {
      lineAmt = Number(transaction.amountPaid) || Number(transaction.paid) || 0;
    }

    items = [
      {
        ratePerBigBox: rateNum,
        bigBoxes,
        smallBoxes,
        bigEquivalent: qtyNum,
        lineAmount: lineAmt,
        billAmount: lineAmt,
        totalAmount: lineAmt,
        descLine1,
        descLine2,
        qtyText
      }
    ];
  }

  // Formula: ரூ. amount = விலை × எண்ணம் (No.)
  let billTotal = 0;
  if (transaction.todayBill !== undefined) {
    billTotal = Number(transaction.todayBill);
  } else if (transaction.billAmount !== undefined && transaction.type !== 'PAYMENT') {
    billTotal = Number(transaction.billAmount);
  } else {
    billTotal = items.reduce((sum, it) => sum + (Number(it.lineAmount !== undefined ? it.lineAmount : it.billAmount) || 0), 0);
  }

  const rupeesPart = Math.floor(billTotal).toLocaleString('en-IN');
  const paisePart = String(Math.round((billTotal % 1) * 100)).padStart(2, '0');

  // Total quantity for subtotal row
  const totalQty = items.reduce((sum, it) => sum + (Number(it.bigEquivalent || it.bigBoxes) || 0), 0);
  const totalQtyText = totalQty > 0 ? (Number.isInteger(totalQty) ? String(totalQty) : totalQty.toFixed(1)) : '—';

  const oldBalNum = Number(transaction.oldBalance) || 0;
  const totalDueNum = Number(transaction.totalDue) !== undefined && !isNaN(Number(transaction.totalDue))
    ? Number(transaction.totalDue)
    : (oldBalNum + billTotal);
  const paidNum = Number(transaction.amountPaid) !== undefined ? Number(transaction.amountPaid) : (Number(transaction.paid) || 0);
  const newBalNum = Number(transaction.newBalance) !== undefined && !isNaN(Number(transaction.newBalance))
    ? Number(transaction.newBalance)
    : (totalDueNum - paidNum);
  const isAdvance = newBalNum < 0;

  const dateStr = formatBillDate(transaction.transactionDate);
  const logoBase64 = getLogoBase64('green');

  // Render item rows
  const itemRowsHtml = items
    .map((item) => {
      const rateNum = Number(item.ratePerBigBox) || 0;
      const rateVal = rateNum > 0 ? rateNum.toLocaleString('en-IN') : (item.ratePerBigBox ? String(item.ratePerBigBox) : '—');
      const lineAmt = Number(item.lineAmount !== undefined ? item.lineAmount : item.billAmount) || 0;
      const lineRupees = Math.floor(lineAmt).toLocaleString('en-IN');
      const linePaise = String(Math.round((lineAmt % 1) * 100)).padStart(2, '0');
      const desc1 = item.descLine1 || 'தக்காளி பெரிய பெட்டி';
      const desc2 = item.descLine2 || '(Big Box)';
      const qty = item.qtyText || (item.bigBoxes > 0 ? `${item.bigBoxes}` : '—');

      return `
        <div class="table-grid" style="font-size: 9.5pt; line-height: 1.15;">
          <div style="border-right: 1px solid #034d28; text-align: center; font-family: monospace; font-style: italic; font-weight: 900; font-size: 11pt; padding: 2px 1px; display: flex; align-items: center; justify-content: center; min-width: 0;">${rateVal}</div>
          <div style="border-right: 1px solid #034d28; padding: 2px 2px; min-width: 0;">
            <div style="font-weight: 900; font-size: 8.6pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15;">${desc1}</div>
            <div style="font-style: italic; font-size: 7pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15;">${desc2}</div>
          </div>
          <div style="border-right: 1px solid #034d28; text-align: center; font-family: monospace; font-style: italic; font-weight: 900; font-size: 11.5pt; display: flex; align-items: center; justify-content: center; min-width: 0;">${qty}</div>
          <div style="border-right: 1px solid #034d28; text-align: right; font-family: monospace; font-style: italic; font-weight: 900; font-size: 11.5pt; padding: 2px 2px; display: flex; align-items: center; justify-content: flex-end; min-width: 0;">${lineRupees}</div>
          <div style="text-align: center; font-family: monospace; font-style: italic; font-weight: 800; font-size: 9.5pt; display: flex; align-items: center; justify-content: center; min-width: 0;">${linePaise}</div>
        </div>`;
    })
    .join('');

  // Subtotal row for multiple sales
  const subtotalHtml = items.length > 1
    ? `
      <div class="table-grid" style="font-size: 9.5pt; line-height: 1.15;">
        <div style="border-right: 1px solid #034d28; min-width: 0;"></div>
        <div style="border-right: 1px solid #034d28; text-align: right; padding-right: 3px; font-weight: 900; font-size: 8pt; display: flex; align-items: center; justify-content: flex-end; min-width: 0;">மொத்த பில் :</div>
        <div style="border-right: 1px solid #034d28; text-align: center; font-family: monospace; font-style: italic; font-weight: 900; font-size: 11pt; display: flex; align-items: center; justify-content: center; min-width: 0;">${totalQtyText}</div>
        <div style="border-right: 1px solid #034d28; text-align: right; font-family: monospace; font-style: italic; font-weight: 900; font-size: 11.5pt; padding: 2px 2px; display: flex; align-items: center; justify-content: flex-end; min-width: 0;">${rupeesPart}</div>
        <div style="text-align: center; font-family: monospace; font-style: italic; font-weight: 800; font-size: 9.5pt; display: flex; align-items: center; justify-content: center; min-width: 0;">${paisePart}</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Buyer_Bill_89x89mm</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700;800;900&display=swap');
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page {
    size: 89mm 89mm;
    margin: 0mm;
  }
  html, body {
    width: 89mm;
    height: 89mm;
    max-height: 89mm;
    overflow: hidden;
    background: #ffffff;
    font-family: 'Mukta Malar', 'Noto Sans Tamil', sans-serif;
    color: #034d28;
    line-height: 1.15;
  }
  .buyer-bill-page {
    width: 89mm;
    height: 89mm;
    max-width: 89mm;
    max-height: 89mm;
    padding: 5.5mm;
    overflow: hidden;
    box-sizing: border-box;
  }
  .outer-border {
    border: 1.5px solid #034d28;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justifyContent: space-between;
    padding: 0.8mm 1.2mm 0.8mm 1.2mm;
    overflow: hidden;
    box-sizing: border-box;
  }
  .table-grid {
    display: grid;
    grid-template-columns: 18% minmax(0, 39%) 11% 20% 12%;
    box-sizing: border-box;
  }
</style>
</head>
<body>
  <div class="buyer-bill-page">
    <div class="outer-border">
      <!-- Top Row: Auspicious symbol 'உ' & Phone numbers -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative;">
        <div style="width: 30px;"></div>
        <div style="text-align: center; position: absolute; left: 0; right: 0; margin: 0 auto; top: -1px;">
          <span style="font-size: 8.5pt; font-weight: 900; border-bottom: 1.5px double hsl(150, 93%, 16%); padding-bottom: 0.5px; display: inline-block;">உ</span>
        </div>
        <div style="text-align: right; font-size: 6.2pt; font-weight: 800; font-family: monospace; line-height: 1.15;">
          <div>செல் : ${phone1}</div>
          <div style="padding-left: 18px;">${phone2}</div>
        </div>
      </div>

      <!-- Business Header with Lakshmi Logo -->
      <div style="display: flex; align-items: center; margin-top: -1.5px;">
        <div style="width: 12mm; height: 15mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height: 100%; max-width: 100%; object-fit: contain;" />` : ''}
        </div>
        <div style="flex: 1; min-width: 0; text-align: center; padding-left: 0.5mm; padding-right: 0.5mm;">
          <div style="font-size: 16.5pt; font-weight: 900; letter-spacing: 0.5px; line-height: 1;">மகாலட்சுமி</div>
          <div style="font-size: 6.4pt; font-weight: 800; margin-top: 1px; white-space: nowrap;">தக்காளி &amp; காய், கனி கமிஷன் மண்டி</div>
          <div style="font-size: 5.4pt; font-weight: 700; margin-top: 0.8px; white-space: nowrap;">${address}</div>
          <div style="font-size: 8pt; font-weight: 900; margin-top: 0.8px;">Prop : ${owner}</div>
        </div>
        <div style="width: 19mm; flex-shrink: 0; text-align: right; align-self: flex-end; margin-bottom: 1px; white-space: nowrap;">
          <div style="font-size: 5.6pt; font-weight: 800;">
            தேதி : <span style="border-bottom: 1px dotted #034d28; padding-bottom: 0.5px; font-family: monospace; font-style: italic; font-weight: 800;">${dateStr}</span>
          </div>
        </div>
      </div>

      <!-- Customer Name Line -->
      <div style="font-size: 9pt; font-weight: 800; display: flex; align-items: baseline; margin-top: 0.8px; margin-bottom: 1px;">
        <span style="white-space: nowrap; margin-right: 4px;">திரு :</span>
        <span style="flex: 1; font-style: italic; font-weight: 900; font-size: 11pt; color: #02381e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${transaction.buyerName || 'வாடிக்கையாளர்'}</span>
      </div>

      <!-- 5-Column Table -->
      <div style="border: 1px solid #034d28; flex: 1; min-height: 0; display: flex; flex-direction: column; box-sizing: border-box;">
        <!-- Table Header (No internal horizontal divider line, No. instead of எண்ணம்) -->
        <div class="table-grid" style="text-align: center; font-size: 7.2pt; font-weight: 900; background: #ffffff;">
          <div style="border-right: 1px solid #034d28; padding: 1px 0; min-width: 0;">விலை</div>
          <div style="border-right: 1px solid #034d28; padding: 1px 0; min-width: 0;">விபரம்</div>
          <div style="border-right: 1px solid #034d28; padding: 1px 0; min-width: 0;">No.</div>
          <div style="border-right: 1px solid #034d28; padding: 1px 0; min-width: 0;">ரூ.</div>
          <div style="padding: 1px 0; min-width: 0;">பை.</div>
        </div>

        <!-- Item Rows (Area 1: Enlarged Item Row Contents, No horizontal divider) -->
        ${itemRowsHtml}

        <!-- Optional Subtotal Row for multiple sales entries -->
        ${subtotalHtml}

        <!-- Lower Accounting Summary Area (Row-by-row aligned grid) -->
        <div style="display: flex; flex-direction: column; flex: 1; min-height: 0; box-sizing: border-box;">
          <!-- Row 1: பற்று removed from Col 1, : (முந்தைய பாக்கி) preserved in Col 2 -->
          <div class="table-grid" style="flex: 1; align-items: center; min-height: 0; box-sizing: border-box;">
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; height: 100%; display: flex; align-items: center; padding: 0 2px; font-size: 6.8pt; font-weight: 800; box-sizing: border-box; min-width: 0; white-space: nowrap; overflow: hidden;">: (முந்தைய பாக்கி)</div>
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; border-bottom: 0.75pt solid #034d28; height: 100%; display: flex; align-items: center; justify-content: flex-end; padding: 0 2px; font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.8pt; box-sizing: border-box; min-width: 0; white-space: nowrap; overflow: hidden;">${oldBalNum.toLocaleString('en-IN')}</div>
            <div style="border-bottom: 0.75pt solid #034d28; height: 100%; display: flex; align-items: center; justify-content: center; font-family: monospace; font-style: italic; font-weight: 700; font-size: 7.5pt; box-sizing: border-box; min-width: 0;">00</div>
          </div>

          <!-- Row 2: மொத்தம் and : (பற்று + பில்) removed -->
          <div class="table-grid" style="flex: 1; align-items: center; min-height: 0; box-sizing: border-box;">
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; height: 100%; display: flex; align-items: center; justify-content: flex-end; padding: 0 2px; font-family: monospace; font-style: italic; font-weight: 900; font-size: 7.8pt; box-sizing: border-box; min-width: 0; white-space: nowrap; overflow: hidden;">${totalDueNum.toLocaleString('en-IN')}</div>
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; font-family: monospace; font-style: italic; font-weight: 700; font-size: 7.5pt; box-sizing: border-box; min-width: 0;">00</div>
          </div>

          <!-- Row 3: செலுத்தியது removed from Col 1, : (வரவு) preserved in Col 2 -->
          <div class="table-grid" style="flex: 1; align-items: center; min-height: 0; box-sizing: border-box;">
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; height: 100%; display: flex; align-items: center; padding: 0 2px; font-size: 6.8pt; font-weight: 800; box-sizing: border-box; min-width: 0; white-space: nowrap; overflow: hidden;">: (வரவு)</div>
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; border-bottom: 0.75pt solid #034d28; height: 100%; display: flex; align-items: center; justify-content: flex-end; padding: 0 2px; font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.8pt; box-sizing: border-box; min-width: 0; white-space: nowrap; overflow: hidden;">${paidNum.toLocaleString('en-IN')}</div>
            <div style="border-bottom: 0.75pt solid #034d28; height: 100%; display: flex; align-items: center; justify-content: center; font-family: monospace; font-style: italic; font-weight: 700; font-size: 7.5pt; box-sizing: border-box; min-width: 0;">00</div>
          </div>

          <!-- Row 4: பாக்கி preserved in Col 1, : (மீதி பாக்கி) removed from Col 2 -->
          <div class="table-grid" style="flex: 1; align-items: center; min-height: 0; box-sizing: border-box;">
            <div style="border-right: 1px solid #034d28; height: 100%; display: flex; align-items: center; padding: 0 2px; font-size: 7.2pt; font-weight: 900; color: #991b1b; box-sizing: border-box; min-width: 0; white-space: nowrap;">${isAdvance ? 'முன்பணம்' : 'பாக்கி'}</div>
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; height: 100%; min-width: 0; box-sizing: border-box;"></div>
            <div style="border-right: 1px solid #034d28; height: 100%; display: flex; align-items: center; justify-content: flex-end; padding: 0 2px; font-family: monospace; font-style: italic; font-weight: 900; font-size: 8.2pt; color: #991b1b; box-sizing: border-box; min-width: 0; white-space: nowrap; overflow: hidden;">${Math.abs(newBalNum).toLocaleString('en-IN')}</div>
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; font-family: monospace; font-style: italic; font-weight: 700; font-size: 7.5pt; box-sizing: border-box; min-width: 0;">00</div>
          </div>
        </div>
      </div>

      <!-- Centered Footer (Preserved exactly as original) -->
      <div style="text-align: center; font-weight: 900; font-size: 7.5pt; letter-spacing: 0.5px; padding-top: 0.6mm; line-height: 1;">
        நன்றி மீண்டும் வருக !
      </div>
    </div>
  </div>
</body>
</html>`;
};

// Generate Supplier Purchase Voucher HTML (105mm x 148mm A6)
export const renderSupplierBillHtml = (purchaseData, settings = {}) => {
  const rawPhone = settings.phone || '';
  const phones = rawPhone.split(/[,/|]+/).map((p) => p.trim()).filter(Boolean);
  const phone1 = phones[0] || '94434 01838';
  const phone2 = phones[1] || '99438 01838';
  const owner = settings.ownerName && settings.ownerName !== 'Bootto' && settings.ownerName !== 'Proprietor'
    ? settings.ownerName
    : 'R. பூட்டோ';
  const address = settings.address && !settings.address.toLowerCase().includes('mandi') && !settings.address.toLowerCase().includes('wholesale')
    ? settings.address
    : 'shop no : 25, Gandhi Market, Dindigul, 624001';

  // Normalize items array for consolidated bill (or single purchase fallback)
  let items = [];
  if (Array.isArray(purchaseData.items) && purchaseData.items.length > 0) {
    items = purchaseData.items;
  } else {
    const big = Number(purchaseData.bigBoxes) || 0;
    const small = Number(purchaseData.smallBoxes) || 0;
    const bigEq = Number(purchaseData.bigEquivalent) || (big + small / 2);
    const rate = Number(purchaseData.ratePerBigBox) || 0;
    const lineAmt = Number(purchaseData.totalAmount) || (bigEq * rate);
    const desc = formatItemBoxDescription(big, small);

    items = [
      {
        ratePerBigBox: rate,
        bigBoxes: big,
        smallBoxes: small,
        bigEquivalent: bigEq,
        lineAmount: lineAmt,
        totalAmount: lineAmt,
        descLine1: desc.line1,
        descLine2: desc.line2,
        qtyText: big > 0 && small === 0 ? `${big}` : `${bigEq}`
      }
    ];
  }

  // Calculate gross total
  const grossTotal = purchaseData.grossTotal !== undefined
    ? Number(purchaseData.grossTotal)
    : items.reduce((sum, item) => sum + (Number(item.lineAmount || item.totalAmount) || 0), 0);

  const grossRupeesPart = Math.floor(grossTotal).toLocaleString('en-IN');
  const grossPaisePart = String(Math.round((grossTotal % 1) * 100)).padStart(2, '0');

  // Deductions
  const deductions = purchaseData.deductions || {};
  const commission = Number(deductions.commission) || 0;
  const gate = Number(deductions.gate) || 0;
  const coolie = Number(deductions.coolie) || 0;
  const rent = Number(deductions.rent) || 0;
  const debit = Number(deductions.debit) || 0;
  const totalDeductions = deductions.totalDeductions !== undefined
    ? Number(deductions.totalDeductions)
    : (commission + gate + coolie + rent + debit);

  // Net total
  const netTotal = purchaseData.netTotal !== undefined
    ? Number(purchaseData.netTotal)
    : (grossTotal - totalDeductions);

  const netRupeesPart = Math.floor(netTotal).toLocaleString('en-IN');
  const netPaisePart = String(Math.round((netTotal % 1) * 100)).padStart(2, '0');

  const lotNum = purchaseData.lotNumber || (purchaseData._id ? String(purchaseData._id).slice(-4) : '001');
  const dateStr = formatBillDate(purchaseData.transactionDate);
  const logoBase64 = getLogoBase64('green');

  // Render purchase item rows
  const itemRowsHtml = items
    .map((item) => {
      const rateVal = item.ratePerBigBox ? Number(item.ratePerBigBox).toLocaleString('en-IN') : '—';
      const lineAmt = Number(item.lineAmount !== undefined ? item.lineAmount : item.totalAmount) || 0;
      const lineRupees = Math.floor(lineAmt).toLocaleString('en-IN');
      const linePaise = String(Math.round((lineAmt % 1) * 100)).padStart(2, '0');
      const desc1 = item.descLine1 || 'தக்காளி பெரிய பெட்டி';
      const desc2 = item.descLine2 || '(Big Box)';
      const qty = item.qtyText || (item.bigBoxes > 0 ? `${item.bigBoxes}` : '—');

      return `
        <div class="table-grid" style="font-size: 8pt; line-height: 1.2; border-bottom: 0.5px solid #034d28;">
          <div style="border-right: 1px solid #034d28; text-align: center; font-family: monospace; font-style: italic; font-weight: 800; padding: 3px 1px; display: flex; align-items: center; justify-content: center; min-width: 0; color: #034d28;">${rateVal}</div>
          <div style="border-right: 1px solid #034d28; padding: 2px 4px; min-width: 0; color: #034d28;">
            <div style="font-weight: 800; font-size: 7.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desc1}</div>
            <div style="font-style: italic; font-size: 7pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desc2}</div>
          </div>
          <div style="border-right: 1px solid #034d28; text-align: center; font-family: monospace; font-style: italic; font-weight: 800; display: flex; align-items: center; justify-content: center; min-width: 0; color: #034d28;">${qty}</div>
          <div style="border-right: 1px solid #034d28; text-align: right; font-family: monospace; font-style: italic; font-weight: 900; padding: 2px 4px; display: flex; align-items: center; justify-content: flex-end; min-width: 0; color: #034d28;">${lineRupees}</div>
          <div style="text-align: center; font-family: monospace; font-style: italic; font-weight: 800; display: flex; align-items: center; justify-content: center; min-width: 0; color: #034d28;">${linePaise}</div>
        </div>`;
    })
    .join('');

  // Gross total subtotal row (only if multiple items)
  const grossSubtotalHtml = items.length > 1
    ? `
      <div class="table-grid" style="font-size: 7.8pt; font-weight: 900; background: #f0fdf4; border-bottom: 1px solid #034d28; color: #034d28;">
        <div style="grid-column: 1 / 4; border-right: 1px solid #034d28; text-align: right; padding-right: 4px; display: flex; align-items: center; justify-content: flex-end;">
          மொத்த பில் (Gross Total)
        </div>
        <div style="border-right: 1px solid #034d28; text-align: right; font-family: monospace; font-style: italic; font-weight: 900; padding: 2px 4px; display: flex; align-items: center; justify-content: flex-end;">
          ${grossRupeesPart}
        </div>
        <div style="text-align: center; font-family: monospace; font-style: italic; font-weight: 800; display: flex; align-items: center; justify-content: center;">
          ${grossPaisePart}
        </div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Supplier_Bill_A6</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700;800;900&display=swap');
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page {
    size: 105mm 148mm;
    margin: 0mm;
  }
  html, body {
    width: 105mm;
    height: 148mm;
    max-height: 148mm;
    overflow: hidden;
    background: #ffffff;
    font-family: 'Mukta Malar', 'Noto Sans Tamil', sans-serif;
    color: #034d28;
    line-height: 1.2;
  }
  .supplier-bill-page {
    width: 105mm;
    height: 148mm;
    max-width: 105mm;
    max-height: 148mm;
    padding: 5.2mm 4.5mm 4.8mm 4.5mm;
    overflow: hidden;
    box-sizing: border-box;
  }
  .outer-border {
    border: 1.5px solid #034d28;
    border-top: 1.5px solid #034d28;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justifyContent: space-between;
    padding: 1.5mm 2mm 1.5mm 2mm;
    overflow: hidden;
    box-sizing: border-box;
  }
  .table-grid {
    display: grid;
    grid-template-columns: 15% minmax(0, 44%) 13% 19% 9%;
    box-sizing: border-box;
  }
</style>
</head>
<body>
  <div class="supplier-bill-page">
    <div class="outer-border">
      <!-- Top Row -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; position: relative;">
        <div style="width: 40px;"></div>
        <div style="text-align: center; position: absolute; left: 0; right: 0; margin: 0 auto; top: -1px;">
          <span style="font-size: 9.5pt; font-weight: 900; border-bottom: 1.5px double #034d28; padding-bottom: 0.5px; display: inline-block; color: #034d28;">உ</span>
        </div>
        <div style="text-align: right; font-size: 7.5pt; font-weight: 800; font-family: monospace; line-height: 1.2; color: #034d28;">
          <div>📱 ${phone1}</div>
          <div style="padding-left: 18px;">${phone2}</div>
        </div>
      </div>

      <!-- Business Header -->
      <div style="display: flex; align-items: center; margin-top: -1px;">
        <div style="width: 20mm; height: 24mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height: 100%; max-width: 100%; object-fit: contain;" />` : ''}
        </div>
        <div style="flex: 1; text-align: center; padding-left: 1.5mm; padding-right: 1.5mm;">
          <div style="font-size: 18pt; font-weight: 900; color: #dc2626; letter-spacing: 0.5px; line-height: 1;">மகாலட்சுமி</div>
          <div style="font-size: 7.5pt; font-weight: 800; color: #034d28; margin-top: 2px; white-space: nowrap;">தக்காளி &amp; காய், கனி கமிஷன் மண்டி</div>
          <div style="font-size: 6.8pt; font-weight: 700; color: #034d28; margin-top: 1.5px; white-space: nowrap;">${address}</div>
          <div style="font-size: 9pt; font-weight: 900; color: #dc2626; margin-top: 1.5px;">Prop : ${owner}</div>
        </div>
      </div>

      <!-- Meta Row -->
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
        <div style="font-size: 8pt; font-weight: 900; color: #dc2626;">
          எண் : <span style="font-family: monospace;">${purchaseData.billNo || purchaseData.billNumber || purchaseData.lotNumber || '25'}</span>
        </div>
        <div style="font-size: 7.5pt; font-weight: 800; color: #034d28;">
          தேதி : <span style="border-bottom: 1px dotted #034d28; padding-bottom: 0.5px; font-family: monospace; font-style: italic; font-weight: 800; color: #034d28;">${dateStr}</span>
        </div>
      </div>

      <!-- Supplier Line -->
      <div style="font-size: 8.5pt; font-weight: 800; display: flex; align-items: baseline; margin-top: 1.5px; margin-bottom: 2mm; color: #034d28;">
        <span style="white-space: nowrap; margin-right: 5px;">திரு :</span>
        <span style="flex: 1; font-style: italic; font-weight: 900; font-size: 9.5pt; color: #034d28;">${purchaseData.supplierName || 'விவசாயி / சப்ளையர்'}</span>
      </div>

      <!-- 5-Column Ruled Table (No internal horizontal divider lines) -->
      <div style="border: 1px solid #034d28; flex: 1; min-height: 0; display: flex; flex-direction: column; box-sizing: border-box;">
        <div class="table-grid" style="text-align: center; font-size: 7.5pt; font-weight: 900; background: #ffffff; color: #034d28; border-bottom: 1px solid #034d28;">
          <div style="border-right: 1px solid #034d28; padding: 1.5px 0; min-width: 0;">விலை</div>
          <div style="border-right: 1px solid #034d28; padding: 1.5px 0; min-width: 0;">விபரம்</div>
          <div style="border-right: 1px solid #034d28; padding: 1.5px 0; min-width: 0;">No.</div>
          <div style="border-right: 1px solid #034d28; padding: 1.5px 0; min-width: 0;">ரூ.</div>
          <div style="padding: 1.5px 0; min-width: 0;">பை.</div>
        </div>

        <!-- Purchase Line Items -->
        ${itemRowsHtml}

        <!-- Optional Gross Subtotal Row -->
        ${grossSubtotalHtml}

        <!-- Middle Space with vertical dividers only -->
        <div class="table-grid" style="flex: 1; min-height: 12mm;">
          <div style="border-right: 1px solid #034d28; min-width: 0;"></div>
          <div style="border-right: 1px solid #034d28; min-width: 0;"></div>
          <div style="border-right: 1px solid #034d28; min-width: 0;"></div>
          <div style="border-right: 1px solid #034d28; min-width: 0;"></div>
          <div style="min-width: 0;"></div>
        </div>

        <!-- Lower Deductions / Charges Area -->
        <div class="table-grid" style="border-top: 1px solid #034d28; min-height: 27mm; box-sizing: border-box; font-size: 7pt; font-weight: 800; color: #034d28;">
          <div style="border-right: 1px solid #034d28; padding: 2px 2px 3.5mm 2px; display: flex; flex-direction: column; justify-content: space-between; line-height: 1.25; min-width: 0; box-sizing: border-box; color: #034d28;">
            <div>கமிஷன்</div>
            <div>கேட்</div>
            <div>கூலி</div>
            <div>வாடகை</div>
            <div>பற்று</div>
            <div>மொத்தம்</div>
          </div>
          <div style="border-right: 1px solid #034d28; padding: 2px 4px 3.5mm 4px; display: flex; flex-direction: column; justify-content: space-between; line-height: 1.25; min-width: 0; box-sizing: border-box; color: #034d28;">
            <div>: &nbsp;<span style="font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.5pt;">${commission > 0 ? commission.toLocaleString('en-IN') : '-'}</span></div>
            <div>: &nbsp;<span style="font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.5pt;">${gate > 0 ? gate.toLocaleString('en-IN') : '-'}</span></div>
            <div>: &nbsp;<span style="font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.5pt;">${coolie > 0 ? coolie.toLocaleString('en-IN') : '-'}</span></div>
            <div>: &nbsp;<span style="font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.5pt;">${rent > 0 ? rent.toLocaleString('en-IN') : '-'}</span></div>
            <div>: &nbsp;<span style="font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.5pt;">${debit > 0 ? debit.toLocaleString('en-IN') : '-'}</span></div>
            <div>: &nbsp;<span style="font-family: monospace; font-style: italic; font-weight: 800; font-size: 7.5pt;">${totalDeductions > 0 ? totalDeductions.toLocaleString('en-IN') : '-'}</span></div>
          </div>
          <div style="border-right: 1px solid #034d28; min-width: 0;"></div>
          <div style="border-right: 1px solid #034d28; min-width: 0;"></div>
          <div style="min-width: 0;"></div>
        </div>

        <!-- Bottom Net Total Row: மொத்தம் -->
        <div class="table-grid" style="border-top: 1px solid #034d28; font-size: 8.5pt; font-weight: 900; height: 6.8mm; color: #034d28; background: #ffffff;">
          <div style="grid-column: 1 / 4; border-right: 1px solid #034d28; text-align: right; padding-right: 6mm; display: flex; align-items: center; justify-content: flex-end; letter-spacing: 0.5px; min-width: 0; color: #034d28;">
            மொத்தம்
          </div>
          <div style="border-right: 1px solid #034d28; text-align: right; font-family: monospace; font-style: italic; font-weight: 900; padding-right: 4px; display: flex; align-items: center; justify-content: flex-end; min-width: 0; color: #034d28;">
            ${netRupeesPart}
          </div>
          <div style="text-align: center; font-family: monospace; font-style: italic; font-weight: 800; display: flex; align-items: center; justify-content: center; min-width: 0; color: #034d28;">
            ${netPaisePart}
          </div>
        </div>
      </div>

      <!-- Centered Footer -->
      <div style="text-align: center; font-weight: 900; font-size: 11pt; color: #dc2626; letter-spacing: 0.5px; padding-top: 2mm; line-height: 1;">
        நன்றி மீண்டும் வருக !
      </div>
    </div>
  </div>
</body>
</html>`;
};

// Generate 1-page PDF using Chrome Headless
export const generatePdfFile = async ({ type, transaction, purchase, settings, targetPdfPath }) => {
  const isBuyer = type === 'buyer' || Boolean(transaction);
  let htmlContent;

  if (isBuyer) {
    // If transaction doesn't already have consolidated items, resolve from database
    let billData = transaction;
    if (billData && !billData.items && (billData._id || (billData.buyerId && billData.transactionDate))) {
      try {
        billData = await getConsolidatedBuyerBill({
          transactionId: billData._id,
          buyerId: billData.buyerId,
          transactionDate: billData.transactionDate
        });
      } catch (err) {
        console.warn('[PrintService] Failed to load consolidated buyer bill, falling back to raw transaction:', err.message);
        billData = transaction;
      }
    }
    htmlContent = renderBuyerBillHtml(billData, settings);
  } else {
    // If purchase doesn't already have consolidated items, resolve from database
    let billData = purchase;
    if (billData && !billData.items && (billData._id || (billData.supplierId && billData.transactionDate))) {
      try {
        billData = await getConsolidatedSupplierBill({
          purchaseId: billData._id,
          supplierId: billData.supplierId,
          transactionDate: billData.transactionDate
        });
      } catch (err) {
        console.warn('[PrintService] Failed to load consolidated bill, falling back to raw purchase:', err.message);
        billData = purchase;
      }
    }
    htmlContent = renderSupplierBillHtml(billData, settings);
  }

  const tmpId = crypto.randomUUID();
  const tmpHtmlPath = path.join(os.tmpdir(), `bill-${tmpId}.html`);
  const finalPdfPath = targetPdfPath ? path.resolve(targetPdfPath) : path.join(os.tmpdir(), `bill-${tmpId}.pdf`);

  fs.writeFileSync(tmpHtmlPath, htmlContent, 'utf8');


  try {
    const fileUrl = 'file:///' + tmpHtmlPath.replace(/\\/g, '/');
    const tmpProfileDir = path.join(os.tmpdir(), `chrome-headless-${tmpId}`);
    const chromeArgs = [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--user-data-dir=${tmpProfileDir}`,
      `--print-to-pdf=${finalPdfPath}`,
      fileUrl
    ];

    await new Promise((resolve, reject) => {
      execFile(CHROME_PATH, chromeArgs, { windowsHide: true }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Verify generated PDF
    if (!fs.existsSync(finalPdfPath)) {
      throw new Error('Failed to generate PDF');
    }

    const pdfBuffer = fs.readFileSync(finalPdfPath);
    const pdfStr = pdfBuffer.toString('latin1');
    const pages = pdfStr.match(/\/Type\s*\/Page\b/g) || [];
    const mediaBoxes = pdfStr.match(/\/MediaBox\s*\[\s*([\d\.\s]+)\s*\]/g) || [];

    console.log(`[PrintService] PDF Generated: ${pages.length} page(s), MediaBox: ${mediaBoxes[0]}`);

    return {
      pdfPath: finalPdfPath,
      pageCount: pages.length,
      mediaBox: mediaBoxes[0] || '',
      sizeBytes: pdfBuffer.length
    };
  } finally {
    // Clean up temporary HTML and Chrome profile
    try {
      if (fs.existsSync(tmpHtmlPath)) fs.unlinkSync(tmpHtmlPath);
    } catch {}
    try {
      if (fs.existsSync(tmpProfileDir)) fs.rmSync(tmpProfileDir, { recursive: true, force: true });
    } catch {}
  }
};

// Direct Windows Print Job using SumatraPDF
export const executeDirectPrint = async ({ type, transaction, purchase, settings, printerName, silent = true, openDialog = false }) => {
  const isBuyer = type === 'buyer' || Boolean(transaction);
  const targetPrinter = printerName || 'Canon G3030 series';

  // 1. Generate 1-page PDF
  const { pdfPath, pageCount } = await generatePdfFile({ type, transaction, purchase, settings });

  try {
    // 2. Prepare SumatraPDF Arguments
    const sumatraArgs = [];

    if (openDialog) {
      // Opens the native Windows print dialog pre-targeted for Canon G3030
      sumatraArgs.push('-print-dialog');
    } else {
      // Direct silent print to Canon G3030 series
      sumatraArgs.push('-print-to', targetPrinter);
      if (silent) sumatraArgs.push('-silent');

      // Target exact physical paper size for Canon G3030 series at 100% scale:
      // - Buyer bill: 89x89 mm Square (Canon driver Form ID: paperkind=138)
      // - Supplier bill: 105x148 mm A6 Portrait (Canon driver Form ID: paperkind=70, paper=A6)
      const settingsList = ['noscale'];
      if (isBuyer) {
        settingsList.push('paperkind=138');
      } else {
        settingsList.push('paper=A6');
        settingsList.push('paperkind=70');
      }
      sumatraArgs.push('-print-settings', settingsList.join(','));
    }

    sumatraArgs.push(pdfPath);


    console.log(`[PrintService] Sending to printer '${targetPrinter}' with args:`, sumatraArgs);

    await new Promise((resolve, reject) => {
      execFile(SUMATRA_PATH, sumatraArgs, { windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          console.error('[PrintService] Sumatra error:', err, stderr);
          return reject(err);
        }
        resolve({ stdout, stderr });
      });
    });

    return {
      success: true,
      printer: targetPrinter,
      format: isBuyer ? '89x89mm (Square)' : '105x148mm (A6)',
      pageCount,
      message: openDialog
        ? 'Opened Windows Print Dialog'
        : `Sent directly to ${targetPrinter}`
    };
  } finally {
    // Delay temporary PDF cleanup slightly so Windows print spooler can lock and buffer the file
    setTimeout(() => {
      try {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      } catch {}
    }, 10000);
  }
};
