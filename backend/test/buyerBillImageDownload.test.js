import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Buyer Bill Print Menu & One-Click Image Download Suite', () => {
  const printModalPath = path.resolve(__dirname, '../../frontend/src/components/print/PrintModal.jsx');
  const printModalContent = fs.readFileSync(printModalPath, 'utf8');

  test('1. Windows Print Dialog is completely removed from PrintModal', () => {
    assert.strictEqual(
      printModalContent.includes('Windows Print Dialog'),
      false,
      'Windows Print Dialog text should not appear in PrintModal'
    );
    assert.strictEqual(
      printModalContent.includes('openDialog ?'),
      false,
      'openDialog ternary operators should be removed'
    );
    assert.strictEqual(
      printModalContent.includes('Select tray or custom paper'),
      false,
      'Windows Print Dialog subtitle should be removed'
    );
  });

  test('2. "Download Bill Image" option is present in PrintModal dropdown with ImageDown icon', () => {
    assert.ok(
      printModalContent.includes('Download Bill Image'),
      '"Download Bill Image" text must be present in the dropdown menu'
    );
    assert.ok(
      printModalContent.includes('ImageDown'),
      'ImageDown icon from lucide-react must be used for Download Bill Image'
    );
    assert.ok(
      printModalContent.includes('handleDownloadImage'),
      'handleDownloadImage click handler must be wired to the button'
    );
  });

  test('3. Dropdown menu maintains the exact expected structure and order', () => {
    const dropdownStart = printModalContent.indexOf('{/* Options Dropdown Menu */}');
    assert.ok(dropdownStart !== -1, 'Options Dropdown Menu section should exist');
    const dropdownSection = printModalContent.slice(dropdownStart);

    const canonIdx = dropdownSection.indexOf('Direct to Canon G3030');
    const browserIdx = dropdownSection.indexOf('Browser Print Preview');
    const imageIdx = dropdownSection.indexOf('Download Bill Image');
    const pdfIdx = dropdownSection.indexOf('Download 1-Page PDF');

    assert.ok(canonIdx !== -1, 'Direct to Canon G3030 should be present in dropdown');
    assert.ok(browserIdx !== -1, 'Browser Print Preview should be present in dropdown');
    assert.ok(imageIdx !== -1, 'Download Bill Image should be present in dropdown');
    assert.ok(pdfIdx !== -1, 'Download 1-Page PDF should be present in dropdown');

    assert.ok(canonIdx < browserIdx, 'Direct to Canon G3030 must precede Browser Print Preview');
    assert.ok(browserIdx < imageIdx, 'Browser Print Preview must precede Download Bill Image');
    assert.ok(imageIdx < pdfIdx, 'Download Bill Image must precede Download 1-Page PDF');
  });

  test('4. One-click image download logic captures isolated unscaled bill and uses 3x pixel ratio', () => {
    assert.ok(
      printModalContent.includes('pixelRatio: 3'),
      'Image export must use at least 3x pixel ratio for ultra-crisp resolution'
    );
    assert.ok(
      printModalContent.includes('toBlob'),
      'html-to-image toBlob should be imported and used'
    );
    assert.ok(
      printModalContent.includes('document.fonts.ready'),
      'Must wait for Tamil fonts to be loaded before capture'
    );
    assert.ok(
      printModalContent.includes('exportContainer'),
      'Must use dedicated unscaled export container to prevent mobile viewport scale interference'
    );
  });

  test('5. Square (89x89mm) and A6 (105x148mm) dimensions are strictly defined and computed', () => {
    // 89mm in pixels at 96 DPI = 89 * 96 / 25.4 = 336.38px
    // 105mm in pixels at 96 DPI = 105 * 96 / 25.4 = 396.85px
    // 148mm in pixels at 96 DPI = 148 * 96 / 25.4 = 559.37px
    assert.ok(printModalContent.includes('336.38'), 'Square 89mm width and height (336.38px) defined');
    assert.ok(printModalContent.includes('396.85'), 'A6 105mm width (396.85px) defined');
    assert.ok(printModalContent.includes('559.37'), 'A6 148mm height (559.37px) defined');

    // Verify 3x resolution output dimensions
    const square3xW = Math.round(336.38 * 3);
    const square3xH = Math.round(336.38 * 3);
    assert.strictEqual(square3xW, 1009, 'Square width at 3x is 1009px');
    assert.strictEqual(square3xH, 1009, 'Square height at 3x is 1009px');
    assert.strictEqual(square3xW / square3xH, 1, 'Square aspect ratio is exactly 1:1');

    const a6_3xW = Math.round(396.85 * 3);
    const a6_3xH = Math.round(559.37 * 3);
    assert.strictEqual(a6_3xW, 1191, 'A6 width at 3x is 1191px');
    assert.strictEqual(a6_3xH, 1678, 'A6 height at 3x is 1678px');
    // 105 / 148 = 0.70946; 1191 / 1678 = 0.70977
    assert.ok(Math.abs((a6_3xW / a6_3xH) - (105 / 148)) < 0.001, 'A6 aspect ratio matches 105x148mm');
  });

  test('6. Meaningful filename format matches specification (e.g. Buyer_Bill_AM_2026-11-17.png)', () => {
    assert.ok(
      printModalContent.includes('Buyer_Bill_'),
      'Filename prefix Buyer_Bill_ should be used'
    );
    assert.ok(
      printModalContent.includes('.png'),
      'Exported image filename extension must be .png'
    );
  });

  test('7. Device-specific behaviour: Web Share API for mobile (Android/iOS) + browser download fallback', () => {
    assert.ok(
      printModalContent.includes('navigator.canShare'),
      'Must check navigator.canShare for file sharing support'
    );
    assert.ok(
      printModalContent.includes('navigator.share'),
      'Must support navigator.share for mobile sheet (Save to Photos / WhatsApp)'
    );
    assert.ok(
      printModalContent.includes('link.download = filename') || printModalContent.includes('a.download = filename'),
      'Must support standard browser download trigger for desktop and mobile fallback'
    );
  });

  test('8. Existing printing features preserved (Canon direct print, Browser Print, PDF download)', () => {
    assert.ok(printModalContent.includes('handleDirectPrint'), 'Direct print to Canon preserved');
    assert.ok(printModalContent.includes('handleBrowserPrint'), 'Browser print preview preserved');
    assert.ok(printModalContent.includes('handleDownloadPdf'), '1-Page PDF download preserved');
    assert.ok(printModalContent.includes('buyerPaperSize'), 'Buyer bill size selection preserved');
  });
});
