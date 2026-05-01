// utils/bydData.js
const logger = require('./logger');

// ========== COMPLETE BYD US MODEL LINEUP (Launch Specials + Federal Credits) ==========
const models = {
  // Hatchbacks & City Cars
  Seagull: { basePrice: 19990, name: 'Seagull', type: 'City EV' },
  Dolphin: { basePrice: 29990, name: 'Dolphin', type: 'Hatch' },

  // Sedans & Sports
  Seal: { basePrice: 39990, name: 'Seal', type: 'Sedan' },
  SealPerformance: { basePrice: 48990, name: 'Seal Performance', type: 'Sports Sedan' },

  // SUVs
  'ATTO 3': { basePrice: 34990, name: 'ATTO 3', type: 'Compact SUV' },
  Tang: { basePrice: 49990, name: 'Tang', type: 'Midsize SUV (3-row)' },
  SongPlus: { basePrice: 42990, name: 'Song Plus', type: 'Family SUV' },
  YuanPlus: { basePrice: 37990, name: 'Yuan Plus', type: 'Crossover SUV' },

  // Luxury
  Han: { basePrice: 59990, name: 'Han', type: 'Luxury Sedan' },
  HanPerformance: { basePrice: 69990, name: 'Han Performance', type: 'Luxury Sport' },
  YangwangU8: { basePrice: 129990, name: 'Yangwang U8', type: 'Ultra-Luxury SUV' },
  YangwangU9: { basePrice: 149990, name: 'Yangwang U9', type: 'Hypercar' },

  // Commercial & Vans
  Commercial: { basePrice: 49990, name: 'Commercial', type: 'Van/Truck' },
  eBus: { basePrice: 129990, name: 'eBus', type: 'Electric Bus' },
};

// Regional incentives (USD values – same as before)
const regionIncentives = {
  California: { evCredit: 7500, freeCharger: true, hovAccess: true },
  Texas: { evCredit: 2500, freeCharger: false },
  'New York': { evCredit: 2000, freeCharger: true, tollDiscount: true },
  Florida: { evCredit: 0, freeCharger: false },
  Colorado: { evCredit: 5000, freeCharger: true, utilityBonus: 1000 },
  'New Jersey': { evCredit: 4000, freeCharger: true, noSalesTax: true },
  Washington: { evCredit: 2500, freeCharger: false, hovAccess: true },
};

// Fixed fees (USD)
const REGISTRATION_FEE = 400;
const DELIVERY_FEE = 800;
const TAX_RATE = 0.04; // 4% estimated sales tax

/**
 * Generate an on-road price quote in USD.
 */
function generateQuote(model, region, variant = 'Premium') {
  logger.debug(`Generating USD quote for ${model} in ${region} (${variant})`);

  const modelData = models[model];
  if (!modelData) {
    logger.warn(`Unknown model: ${model}, using fallback price`);
  }

  const base = modelData?.basePrice || 35000;
  const incentives = regionIncentives[region] || { evCredit: 0, freeCharger: false };

  let tax = base * TAX_RATE;
  // Some states offer no sales tax on EVs (New Jersey example)
  if (incentives.noSalesTax) tax = 0;

  const totalBeforeCredit = base + REGISTRATION_FEE + DELIVERY_FEE + tax;
  const total = totalBeforeCredit - (incentives.evCredit || 0);

  const monthlyFinance = Math.round((total * 0.8) / 60); // 80% financed, 60 months
  const monthlyLease = Math.round(monthlyFinance * 0.88); // attractive lease rate

  logger.debug(`Quote result - Total: $${total.toLocaleString()}, Monthly: $${monthlyFinance.toLocaleString()}`);

  return {
    total: Math.max(total, 0),
    monthlyFinance,
    monthlyLease,
    incentivesSavings: incentives.evCredit || 0,
    breakdown: {
      vehiclePrice: base,
      registration: REGISTRATION_FEE,
      delivery: DELIVERY_FEE,
      tax: tax,
    },
    incentivesList: getIncentivesText(region),
  };
}

function getIncentivesText(region) {
  const inc = regionIncentives[region];
  if (!inc) return 'None currently';
  const parts = [];
  if (inc.evCredit) parts.push(`💰 $${inc.evCredit} federal/state EV tax credit`);
  if (inc.freeCharger) parts.push('🔌 Free Level 2 home charger installation');
  if (inc.hovAccess) parts.push('🛣️ Free HOV lane access');
  if (inc.tollDiscount) parts.push('🛡️ Toll road discounts');
  if (inc.utilityBonus) parts.push(`⚡ Utility rebate: $${inc.utilityBonus}`);
  if (inc.noSalesTax) parts.push('🏷️ 0% sales tax on EVs');
  return parts.length ? parts.join(' • ') : 'None currently';
}

function getQuickPrice(model) {
  const m = models[model];
  if (!m) return 'Contact us for pricing';
  return `Starting from $${m.basePrice.toLocaleString()}`;
}

module.exports = {
  models,
  regionIncentives,
  generateQuote,
  getIncentivesText,
  getQuickPrice,
};