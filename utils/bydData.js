// utils/bydData.js

// Base prices (in Brazilian Reais, as used in your examples)
const models = {
  Dolphin: { basePrice: 189000, name: 'Dolphin', type: 'Hatch' },
  Seal: { basePrice: 239000, name: 'Seal', type: 'Sedan' },
  'ATTO 3': { basePrice: 219000, name: 'ATTO 3', type: 'SUV' },
  Han: { basePrice: 349000, name: 'Han', type: 'Luxury Sedan' },
  Commercial: { basePrice: 299000, name: 'Commercial', type: 'Van/Truck' },
};

// Regional incentives (expand as needed)
const regionIncentives = {
  'São Paulo': { ipvaExempt: true, savings: 9560, freeCharger: true },
  'Rio de Janeiro': { ipvaExempt: false, savings: 0, freeCharger: false },
  'Dubai': { vatExempt: true, savings: 15000, freeCharger: true },
  'Abu Dhabi': { vatExempt: true, savings: 15000, freeCharger: false },
  'Bangkok': { evSubsidy: true, savings: 8000, freeCharger: true },
};

// Fixed fees (can be dynamic)
const REGISTRATION_FEE = 4800;
const DELIVERY_FEE = 3200;
const TAX_RATE = 0.04; // 4% estimated tax

/**
 * Generate an on-road price quote.
 * @param {string} model - one of the keys in `models`
 * @param {string} region - one of the keys in `regionIncentives`
 * @param {string} variant - optional trim level (default 'Premium')
 * @returns {object} { total, monthlyFinance, incentivesSavings, breakdown }
 */
function generateQuote(model, region, variant = 'Premium') {
  const base = models[model]?.basePrice || 200000;
  const incentives = regionIncentives[region] || { savings: 0 };
  const tax = base * TAX_RATE;
  const total = base + REGISTRATION_FEE + DELIVERY_FEE + tax;
  const monthlyFinance = Math.round((total * 0.8) / 60); // 80% financed over 60 months
  const monthlyLease = Math.round(monthlyFinance * 0.91); // ~9% lower for lease

  return {
    total,
    monthlyFinance,
    monthlyLease,
    incentivesSavings: incentives.savings,
    breakdown: {
      vehiclePrice: base,
      registration: REGISTRATION_FEE,
      delivery: DELIVERY_FEE,
      tax: tax,
    },
    incentivesList: getIncentivesText(region),
  };
}

/**
 * Return a human-readable string of incentives for a region.
 * @param {string} region
 * @returns {string}
 */
function getIncentivesText(region) {
  const inc = regionIncentives[region];
  if (!inc) return 'None currently';
  const parts = [];
  if (inc.ipvaExempt) parts.push('IPVA exemption (saves R$9,560/yr)');
  if (inc.vatExempt) parts.push('VAT exemption');
  if (inc.evSubsidy) parts.push(`EV subsidy of R$${inc.savings}`);
  if (inc.freeCharger) parts.push('Free home charger installation');
  return parts.length ? parts.join(', ') : 'None currently';
}

/**
 * Get a simple price estimate for a model (for quick replies).
 * @param {string} model
 * @returns {string}
 */
function getQuickPrice(model) {
  const m = models[model];
  if (!m) return 'Contact us for pricing';
  return `Starting from R$ ${m.basePrice.toLocaleString()}`;
}

module.exports = {
  models,
  regionIncentives,
  generateQuote,
  getIncentivesText,
  getQuickPrice,
};