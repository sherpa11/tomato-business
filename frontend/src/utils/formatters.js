/**
 * Round monetary value to 2 decimal places safely
 */
export const roundMoney = (amount) => {
  const num = Number(amount) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Currency Formatter for Indian Rupees
 */
export const formatCurrency = (val) => {
  const num = Number(val || 0);
  return `₹${Math.abs(num).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: num % 1 !== 0 ? 2 : 0
  })}`;
};

/**
 * Balance display with explicit Credit / Advance representation
 * Overpayments should NEVER just look like an unlabelled negative number
 */
export const formatBalance = (val) => {
  const num = Number(val || 0);
  if (num > 0) {
    return {
      text: `${formatCurrency(num)} Due`,
      amount: formatCurrency(num),
      type: 'DEBIT',
      color: 'text-amber-700 bg-amber-50 border-amber-200'
    };
  }
  if (num < 0) {
    return {
      text: `${formatCurrency(Math.abs(num))} Advance / Credit`,
      amount: formatCurrency(Math.abs(num)),
      type: 'CREDIT',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    };
  }
  return {
    text: '₹0 (Settled)',
    amount: '₹0',
    type: 'ZERO',
    color: 'text-slate-600 bg-slate-50 border-slate-200'
  };
};

/**
 * Format 'YYYY-MM-DD' to 'DD/MM/YYYY'
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  // Check if it's already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

/**
 * Calculate Big Box equivalent
 * 1 Big Box = 1
 * 1 Small Box = 0.5 Big Box
 */
export const calculateBigEquivalent = (bigBoxes = 0, smallBoxes = 0) => {
  const big = Number(bigBoxes) || 0;
  const small = Number(smallBoxes) || 0;
  return Math.round((big + small / 2 + Number.EPSILON) * 10) / 10;
};

/**
 * User-facing box description
 */
export const formatBoxDescription = (bigBoxes = 0, smallBoxes = 0) => {
  const big = Number(bigBoxes) || 0;
  const small = Number(smallBoxes) || 0;
  const eqv = calculateBigEquivalent(big, small);

  if (big > 0 && small === 0) {
    return `${big} Big ${big === 1 ? 'Box' : 'Boxes'}`;
  }
  if (big === 0 && small > 0) {
    return `${small} Small (${eqv} Big Eqv)`;
  }
  if (big > 0 && small > 0) {
    return `${big} Big + ${small} Small (${eqv} Big Eqv)`;
  }
  return '0 Boxes';
};
