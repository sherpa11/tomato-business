import React from 'react';
import { formatDate } from '../../utils/formatters';

export default function SupplierVoucherTemplate({ purchase, settings }) {
  if (!purchase) return null;

  // Split phone numbers if available, or fallback to reference defaults
  const rawPhone = settings?.phone || '';
  const phones = rawPhone.split(/[,/|]+/).map((p) => p.trim()).filter(Boolean);
  const phone1 = phones[0] || '94434 01838';
  const phone2 = phones[1] || '99438 01838';

  const owner = settings?.ownerName && settings.ownerName !== 'Bootto' && settings.ownerName !== 'Proprietor'
    ? settings.ownerName
    : 'R. பூட்டோ';

  const address = settings?.address && !settings.address.toLowerCase().includes('mandi') && !settings.address.toLowerCase().includes('wholesale')
    ? settings.address
    : '25 A, காந்தி மார்க்கெட், திண்டுக்கல்-1';

  // Normalize items array for consolidated bill (or single purchase fallback)
  let items = [];
  if (Array.isArray(purchase.items) && purchase.items.length > 0) {
    items = purchase.items;
  } else {
    const big = Number(purchase.bigBoxes) || 0;
    const small = Number(purchase.smallBoxes) || 0;
    const bigEq = Number(purchase.bigEquivalent) || (big + small / 2);
    const rate = Number(purchase.ratePerBigBox) || 0;
    const lineAmt = Number(purchase.totalAmount) || (bigEq * rate);

    let descLine1 = 'தக்காளி பெரிய பெட்டி';
    let descLine2 = '(Big Box)';
    let qtyText = big > 0 ? `${big}` : '—';

    if (big > 0 && small > 0) {
      descLine1 = 'தக்காளி பெட்டி';
      descLine2 = `(${big} Big + ${small} Small)`;
      qtyText = `${bigEq}`;
    } else if (small > 0 && big === 0) {
      descLine1 = 'தக்காளி சிறிய பெட்டி';
      descLine2 = '(Small Box)';
      qtyText = `${small}`;
    }

    items = [
      {
        ratePerBigBox: rate,
        bigBoxes: big,
        smallBoxes: small,
        bigEquivalent: bigEq,
        lineAmount: lineAmt,
        totalAmount: lineAmt,
        descLine1,
        descLine2,
        qtyText
      }
    ];
  }

  // Gross total calculation
  const grossTotal = purchase.grossTotal !== undefined
    ? Number(purchase.grossTotal)
    : items.reduce((sum, it) => sum + (Number(it.lineAmount || it.totalAmount) || 0), 0);

  const grossRupeesPart = Math.floor(grossTotal).toLocaleString('en-IN');
  const grossPaisePart = String(Math.round((grossTotal % 1) * 100)).padStart(2, '0');

  // Deductions
  const deductions = purchase.deductions || {};
  const commission = Number(deductions.commission) || 0;
  const gate = Number(deductions.gate) || 0;
  const coolie = Number(deductions.coolie) || 0;
  const rent = Number(deductions.rent) || 0;
  const debit = Number(deductions.debit) || 0;
  const totalDeductions = deductions.totalDeductions !== undefined
    ? Number(deductions.totalDeductions)
    : (commission + gate + coolie + rent + debit);

  // Net total calculation
  const netTotal = purchase.netTotal !== undefined
    ? Number(purchase.netTotal)
    : (grossTotal - totalDeductions);

  const netRupeesPart = Math.floor(netTotal).toLocaleString('en-IN');
  const netPaisePart = String(Math.round((netTotal % 1) * 100)).padStart(2, '0');

  // Lot/Voucher Number
  const lotNum = purchase.lotNumber || (purchase._id ? String(purchase._id).slice(-4) : '0123');

  return (
    <>
      {/* Scoped Dynamic Print Page Style for strict 105mm x 148mm (A6) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700;800;900&display=swap');
        @media print {
          @page {
            size: 105mm 148mm;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 105mm !important;
            height: 148mm !important;
            max-height: 148mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      <div
        className="supplier-bill-page bg-white font-tamil select-none"
        style={{
          width: '105mm',
          height: '148mm',
          maxWidth: '105mm',
          maxHeight: '148mm',
          padding: '4.0mm 4.5mm 6.0mm 4.5mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          lineHeight: 1.2,
          color: '#034d28',
          fontFamily: "'Mukta Malar', 'Noto Sans Tamil', sans-serif"
        }}
      >
        {/* Outer Green Border */}
        <div
          style={{
            border: '1.5px solid #034d28',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.5mm 2mm 1.5mm 2mm'
          }}
        >
          {/* Top Row: Auspicious symbol 'உ' & Phone with Mobile Icon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <div style={{ width: '40px' }} />
            <div style={{ textAlign: 'center', position: 'absolute', left: 0, right: 0, margin: '0 auto', top: '-1px' }}>
              <span
                style={{
                  fontSize: '9.5pt',
                  fontWeight: 900,
                  borderBottom: '1.5px double #034d28',
                  paddingBottom: '0.5px',
                  display: 'inline-block',
                  color: '#034d28'
                }}
              >
                உ
              </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '7.5pt', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.2, color: '#034d28' }}>
              <div>📱 {phone1}</div>
              <div style={{ paddingLeft: '18px' }}>{phone2}</div>
            </div>
          </div>

          {/* Business Header with Green Lakshmi Logo */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '-1px' }}>
            {/* Logo */}
            <div style={{ width: '20mm', height: '24mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/lakshmi-green.png"
                alt="Lakshmi Logo"
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* Business Titles */}
            <div style={{ flex: 1, textAlign: 'center', paddingLeft: '1.5mm', paddingRight: '1.5mm' }}>
              <div
                style={{
                  fontSize: '18pt',
                  fontWeight: 900,
                  color: '#dc2626',
                  letterSpacing: '0.5px',
                  lineHeight: 1
                }}
              >
                மகாலட்சுமி
              </div>
              <div style={{ fontSize: '7.5pt', fontWeight: 800, color: '#034d28', marginTop: '2px', whiteSpace: 'nowrap' }}>
                தக்காளி &amp; காய், கனி கமிஷன் மண்டி
              </div>
              <div style={{ fontSize: '6.8pt', fontWeight: 700, color: '#034d28', marginTop: '1.5px', whiteSpace: 'nowrap' }}>
                {address}
              </div>
              <div style={{ fontSize: '9pt', fontWeight: 900, color: '#dc2626', marginTop: '1.5px' }}>
                Prop : {owner}
              </div>
            </div>
          </div>

          {/* Meta Row: எண் (Lot No) & தேதி (Date) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '2px' }}>
            <div style={{ fontSize: '8pt', fontWeight: 900, color: '#dc2626' }}>
              எண் : <span style={{ fontFamily: 'monospace' }}>{lotNum}</span>
            </div>
            <div style={{ fontSize: '7.5pt', fontWeight: 800, color: '#034d28' }}>
              தேதி :{' '}
              <span
                style={{
                  borderBottom: '1px dotted #034d28',
                  paddingBottom: '0.5px',
                  fontFamily: 'monospace',
                  fontStyle: 'italic',
                  fontWeight: 800,
                  color: '#034d28'
                }}
              >
                {formatDate(purchase.transactionDate)}
              </span>
            </div>
          </div>

          {/* Supplier Name Line */}
          <div
            style={{
              fontSize: '8.5pt',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'baseline',
              marginTop: '1.5px',
              marginBottom: '2mm',
              color: '#034d28'
            }}
          >
            <span style={{ whiteSpace: 'nowrap', marginRight: '5px' }}>திரு :</span>
            <span
              style={{
                flex: 1,
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: '9.5pt',
                color: '#034d28'
              }}
            >
              {purchase.supplierName}
            </span>
          </div>

          {/* 5-Column Ruled Table */}
          <div
            style={{
              border: '1px solid #034d28',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '15% minmax(0, 44%) 13% 19% 9%',
                textAlign: 'center',
                fontSize: '7.5pt',
                fontWeight: 900,
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                color: '#034d28',
                borderBottom: '1px solid #034d28'
              }}
            >
              <div style={{ borderRight: '1px solid #034d28', padding: '1.5px 0', minWidth: 0, boxSizing: 'border-box' }}>விலை</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '1.5px 0', minWidth: 0, boxSizing: 'border-box' }}>விபரம்</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '1.5px 0', minWidth: 0, boxSizing: 'border-box' }}>No.</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '1.5px 0', minWidth: 0, boxSizing: 'border-box' }}>ரூ.</div>
              <div style={{ padding: '1.5px 0', minWidth: 0, boxSizing: 'border-box' }}>பை.</div>
            </div>

            {/* Purchase Item Rows */}
            {items.map((item, idx) => {
              const rateVal = item.ratePerBigBox ? Number(item.ratePerBigBox).toLocaleString('en-IN') : '—';
              const lineAmt = Number(item.lineAmount !== undefined ? item.lineAmount : item.totalAmount) || 0;
              const lineRupees = Math.floor(lineAmt).toLocaleString('en-IN');
              const linePaise = String(Math.round((lineAmt % 1) * 100)).padStart(2, '0');
              const desc1 = item.descLine1 || 'தக்காளி பெரிய பெட்டி';
              const desc2 = item.descLine2 || '(Big Box)';
              const qty = item.qtyText || (item.bigBoxes > 0 ? `${item.bigBoxes}` : '—');

              return (
                <div
                  key={item._id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '15% minmax(0, 44%) 13% 19% 9%',
                    fontSize: '8pt',
                    lineHeight: 1.2,
                    boxSizing: 'border-box',
                    borderBottom: '0.5px solid #034d28'
                  }}
                >
                  <div
                    style={{
                      borderRight: '1px solid #034d28',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 800,
                      padding: '3px 1px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      color: '#034d28'
                    }}
                  >
                    {rateVal}
                  </div>
                  <div style={{ borderRight: '1px solid #034d28', padding: '2px 4px', minWidth: 0, boxSizing: 'border-box', color: '#034d28' }}>
                    <div style={{ fontWeight: 800, fontSize: '7.5pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc1}</div>
                    <div style={{ fontStyle: 'italic', fontSize: '7pt', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc2}</div>
                  </div>
                  <div
                    style={{
                      borderRight: '1px solid #034d28',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      color: '#034d28'
                    }}
                  >
                    {qty}
                  </div>
                  <div
                    style={{
                      borderRight: '1px solid #034d28',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 900,
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      color: '#034d28'
                    }}
                  >
                    {lineRupees}
                  </div>
                  <div
                    style={{
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      color: '#034d28'
                    }}
                  >
                    {linePaise}
                  </div>
                </div>
              );
            })}

            {/* Optional Gross Subtotal Row when multiple lots */}
            {items.length > 1 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '15% minmax(0, 44%) 13% 19% 9%',
                  fontSize: '7.8pt',
                  fontWeight: 900,
                  backgroundColor: '#f0fdf4',
                  boxSizing: 'border-box',
                  color: '#034d28',
                  borderBottom: '1px solid #034d28'
                }}
              >
                <div
                  style={{
                    gridColumn: '1 / 4',
                    borderRight: '1px solid #034d28',
                    textAlign: 'right',
                    paddingRight: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    boxSizing: 'border-box'
                  }}
                >
                  மொத்த பில் (Gross Total)
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    boxSizing: 'border-box'
                  }}
                >
                  {grossRupeesPart}
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box'
                  }}
                >
                  {grossPaisePart}
                </div>
              </div>
            )}

            {/* Middle Space with vertical dividers only */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '15% minmax(0, 44%) 13% 19% 9%',
                flex: 1,
                minHeight: '12mm',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ minWidth: 0 }} />
            </div>

            {/* Lower Deductions Area */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '15% minmax(0, 44%) 13% 19% 9%',
                borderTop: '1px solid #034d28',
                minHeight: '27mm',
                boxSizing: 'border-box',
                color: '#034d28'
              }}
            >
              {/* Col 1: Tamil Deduction Labels in Green */}
              <div
                style={{
                  borderRight: '1px solid #034d28',
                  fontSize: '7pt',
                  fontWeight: 800,
                  color: '#034d28',
                  padding: '2px 2px 3.5mm 2px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  lineHeight: 1.25,
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}
              >
                <div>கமிஷன்</div>
                <div>கேட்</div>
                <div>கூலி</div>
                <div>வாடகை</div>
                <div>பற்று</div>
                <div>மொத்தம்</div>
              </div>

              {/* Col 2: Separator ':' & Values in Green */}
              <div
                style={{
                  borderRight: '1px solid #034d28',
                  fontSize: '7pt',
                  fontWeight: 800,
                  padding: '2px 4px 3.5mm 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  lineHeight: 1.25,
                  minWidth: 0,
                  boxSizing: 'border-box',
                  color: '#034d28'
                }}
              >
                <div>: &nbsp;<span style={{ fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 800, fontSize: '7.5pt' }}>{commission > 0 ? commission.toLocaleString('en-IN') : '-'}</span></div>
                <div>: &nbsp;<span style={{ fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 800, fontSize: '7.5pt' }}>{gate > 0 ? gate.toLocaleString('en-IN') : '-'}</span></div>
                <div>: &nbsp;<span style={{ fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 800, fontSize: '7.5pt' }}>{coolie > 0 ? coolie.toLocaleString('en-IN') : '-'}</span></div>
                <div>: &nbsp;<span style={{ fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 800, fontSize: '7.5pt' }}>{rent > 0 ? rent.toLocaleString('en-IN') : '-'}</span></div>
                <div>: &nbsp;<span style={{ fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 800, fontSize: '7.5pt' }}>{debit > 0 ? debit.toLocaleString('en-IN') : '-'}</span></div>
                <div>: &nbsp;<span style={{ fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 800, fontSize: '7.5pt' }}>{totalDeductions > 0 ? totalDeductions.toLocaleString('en-IN') : '-'}</span></div>
              </div>

              {/* Col 3: Blank ruled vertical line */}
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />

              {/* Col 4: Blank ruled vertical line */}
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />

              {/* Col 5: Blank ruled vertical line */}
              <div style={{ minWidth: 0 }} />
            </div>

            {/* Bottom Net Total Row: மொத்தம் */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '15% minmax(0, 44%) 13% 19% 9%',
                borderTop: '1px solid #034d28',
                fontSize: '8.5pt',
                fontWeight: 900,
                height: '6.8mm',
                boxSizing: 'border-box',
                color: '#034d28',
                backgroundColor: '#ffffff'
              }}
            >
              <div
                style={{
                  gridColumn: '1 / 4',
                  borderRight: '1px solid #034d28',
                  textAlign: 'right',
                  paddingRight: '6mm',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  letterSpacing: '0.5px',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  color: '#034d28'
                }}
              >
                மொத்தம்
              </div>
              <div
                style={{
                  borderRight: '1px solid #034d28',
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontStyle: 'italic',
                  fontWeight: 900,
                  paddingRight: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  color: '#034d28'
                }}
              >
                {netRupeesPart}
              </div>
              <div
                style={{
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontStyle: 'italic',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  color: '#034d28'
                }}
              >
                {netPaisePart}
              </div>
            </div>
          </div>

          {/* Centered Footer */}
          <div
            style={{
              textAlign: 'center',
              fontWeight: 900,
              fontSize: '11pt',
              color: '#dc2626',
              letterSpacing: '0.5px',
              paddingTop: '2mm',
              lineHeight: 1
            }}
          >
            நன்றி மீண்டும் வருக !
          </div>
        </div>
      </div>
    </>
  );
}
