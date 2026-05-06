// utils/bydData.js
const logger = require('./logger');

// ============================================
// COMPLETE BYD 2026 US MODEL LINEUP
// ============================================
const models = {
  // Hatchbacks & City Cars
  Seagull: { 
    basePrice: 19990, 
    name: 'Seagull', 
    type: 'City EV',
    range: '250 miles',
    battery: '38 kWh Blade Battery',
    charging: '10-80% in 30 min (DC fast)',
    warranty: '8 years / 120,000 miles',
    colors: ['Coral Pink', 'Arctic White', 'Electric Blue', 'Lime Green'],
    features: ['LED Lights', '10.1" Touchscreen', 'Backup Camera', 'Keyless Entry'],
    image: '/images/models/seagull.png',
    category: 'city',
  },
  Dolphin: { 
    basePrice: 29990, 
    name: 'Dolphin', 
    type: 'Hatchback',
    range: '310 miles',
    battery: '45 kWh Blade Battery',
    charging: '10-80% in 28 min (DC fast)',
    warranty: '8 years / 120,000 miles',
    colors: ['Ocean Blue', 'Pearl White', 'Coral Red', 'Graphite Black'],
    features: ['Wireless Charging', 'Sunroof', 'Heated Seats', '360° Camera'],
    image: '/images/models/dolphin.png',
    category: 'city',
  },
  SeagullPlus: {
    basePrice: 23990,
    name: 'Seagull Plus',
    type: 'City EV (Extended)',
    range: '310 miles',
    battery: '48 kWh Blade Battery',
    charging: '10-80% in 32 min (DC fast)',
    warranty: '8 years / 120,000 miles',
    colors: ['Sunset Orange', 'Arctic White', 'Electric Blue'],
    features: ['LED Lights', '12.8" Touchscreen', 'Wireless Charging', 'Sunroof'],
    image: '/images/models/seagull-plus.png',
    category: 'city',
  },

  // Sedans & Sports
  Seal: { 
    basePrice: 39990, 
    name: 'Seal', 
    type: 'Sedan',
    range: '420 miles',
    battery: '82 kWh Blade Battery',
    charging: '10-80% in 26 min (150kW DC)',
    zeroToSixty: '3.8 seconds',
    warranty: '8 years / 150,000 miles',
    colors: ['Ocean X Blue', 'Aurora White', 'Phantom Black', 'Storm Grey'],
    features: ['Panoramic Glass Roof', '14.6" Rotating Screen', 'Dynaudio Sound', 'HUD'],
    image: '/images/models/seal.png',
    category: 'sedan',
  },
  SealPerformance: { 
    basePrice: 48990, 
    name: 'Seal Performance', 
    type: 'Sports Sedan',
    range: '380 miles',
    battery: '82 kWh Blade Battery (Performance Tuned)',
    charging: '10-80% in 26 min (150kW DC)',
    zeroToSixty: '3.4 seconds',
    topSpeed: '165 mph',
    horsepower: '530 hp (dual motor)',
    warranty: '8 years / 150,000 miles',
    colors: ['Racing Red', 'Phantom Black', 'Thunder Blue', 'Storm Grey'],
    features: ['Sport Suspension', 'Carbon Fiber Trim', 'Performance Brakes', 'Launch Control'],
    image: '/images/models/seal-performance.png',
    category: 'performance',
  },

  // SUVs & Crossovers
  'ATTO 3': { 
    basePrice: 34990, 
    name: 'ATTO 3', 
    type: 'Compact SUV',
    range: '380 miles',
    battery: '60 kWh Blade Battery',
    charging: '10-80% in 29 min (DC fast)',
    seats: 5,
    cargo: '15.7 cu ft',
    warranty: '8 years / 120,000 miles',
    colors: ['Forest Green', 'Sky Blue', 'Pearl White', 'Titanium Grey'],
    features: ['Gym Interior Design', 'Heated Steering Wheel', 'V2L Capability', 'Power Tailgate'],
    image: '/images/models/atto3.png',
    category: 'suv',
  },
  YuanPlus: { 
    basePrice: 37990, 
    name: 'Yuan Plus', 
    type: 'Crossover SUV',
    range: '360 miles',
    battery: '60 kWh Blade Battery',
    charging: '10-80% in 29 min (DC fast)',
    seats: 5,
    cargo: '17.2 cu ft',
    warranty: '8 years / 120,000 miles',
    colors: ['Adventure Orange', 'Arctic White', 'Midnight Black'],
    features: ['Panoramic Roof', 'Wireless Charging', 'Ambient Lighting', 'V2L'],
    image: '/images/models/yuan-plus.png',
    category: 'suv',
  },
  SongPlus: { 
    basePrice: 42990, 
    name: 'Song Plus', 
    type: 'Family SUV',
    range: '400 miles',
    battery: '72 kWh Blade Battery',
    charging: '10-80% in 25 min (150kW DC)',
    seats: 5,
    cargo: '22.5 cu ft',
    warranty: '8 years / 150,000 miles',
    colors: ['Sapphire Blue', 'Diamond White', 'Onyx Black', 'Ruby Red'],
    features: ['Ventilated Seats', 'Three-Zone Climate', 'Rear Sunshades', 'Premium Sound'],
    image: '/images/models/song-plus.png',
    category: 'suv',
  },
  Tang: { 
    basePrice: 49990, 
    name: 'Tang', 
    type: 'Midsize SUV (7-Seater)',
    range: '390 miles',
    battery: '86 kWh Blade Battery',
    charging: '10-80% in 24 min (180kW DC)',
    zeroToSixty: '4.3 seconds',
    seats: 7,
    cargo: '12.5 cu ft (all seats) / 72.8 cu ft (folded)',
    warranty: '8 years / 150,000 miles',
    colors: ['Imperial Red', 'Glacier White', 'Obsidian Black', 'Silver Mist'],
    features: ['Captain Chairs (2nd row)', 'Rear Entertainment', 'Massage Front Seats', 'Air Suspension'],
    image: '/images/models/tang.png',
    category: 'suv',
  },
  TangL: {
    basePrice: 56990,
    name: 'Tang L',
    type: 'Full-Size SUV (7-Seater)',
    range: '410 miles',
    battery: '95 kWh Blade Battery',
    charging: '10-80% in 22 min (200kW DC)',
    seats: 7,
    cargo: '18.5 cu ft (all seats) / 85.2 cu ft (folded)',
    warranty: '8 years / 150,000 miles',
    colors: ['Imperial Red', 'Glacier White', 'Obsidian Black'],
    features: ['Executive Lounge Seats', 'Refrigerator', '22" Wheels', 'Night Vision Assist'],
    image: '/images/models/tang-l.png',
    category: 'suv',
  },

  // Luxury Line
  Han: { 
    basePrice: 59990, 
    name: 'Han', 
    type: 'Luxury Sedan',
    range: '450 miles',
    battery: '85 kWh Blade Battery',
    charging: '10-80% in 25 min (150kW DC)',
    zeroToSixty: '3.9 seconds',
    warranty: '8 years / 150,000 miles',
    features: ['Dynaudio Premium Sound', 'Nappa Leather', 'Massage Seats', 'HUD', 'Air Purification'],
    colors: ['Imperial Jade', 'Onyx Black', 'Champagne Gold', 'Arctic White'],
    image: '/images/models/han.png',
    category: 'luxury',
  },
  HanPerformance: { 
    basePrice: 69990, 
    name: 'Han Performance', 
    type: 'Luxury Sport Sedan',
    range: '400 miles',
    battery: '85 kWh Blade Battery (Performance)',
    charging: '10-80% in 25 min (150kW DC)',
    zeroToSixty: '3.4 seconds',
    topSpeed: '175 mph',
    horsepower: '670 hp (triple motor)',
    warranty: '8 years / 150,000 miles',
    colors: ['Carbon Black', 'Racing Red', 'Matte Grey', 'Pearl White'],
    features: ['Carbon Ceramic Brakes', 'Active Suspension', 'Sport Exhaust Sound', 'Track Mode'],
    image: '/images/models/han-performance.png',
    category: 'luxury',
  },

  // Ultra-Luxury (Yangwang Brand)
  YangwangU8: { 
    basePrice: 129990, 
    name: 'Yangwang U8', 
    type: 'Ultra-Luxury SUV',
    range: '450 miles',
    battery: '100 kWh Blade Battery',
    charging: '10-80% in 20 min (250kW DC)',
    zeroToSixty: '3.6 seconds',
    seats: 5,
    features: ['Hydraulic Suspension', 'Tank Turn', 'Water Wading 1.4m', 'Drone Launch', 'Bulletproof Glass Option'],
    warranty: '10 years / 200,000 miles',
    colors: ['Midnight Blue', 'Royal Black', 'Arctic White', 'Desert Sand'],
    image: '/images/models/yangwang-u8.png',
    category: 'ultra-luxury',
  },
  YangwangU9: { 
    basePrice: 149990, 
    name: 'Yangwang U9', 
    type: 'Hypercar',
    range: '380 miles',
    battery: '100 kWh Blade Battery (Track Tuned)',
    charging: '10-80% in 18 min (350kW DC)',
    zeroToSixty: '2.0 seconds',
    topSpeed: '220 mph',
    horsepower: '1,100 hp (4 motors)',
    warranty: '10 years / 200,000 miles',
    colors: ['Carbon Fiber', 'Liquid Silver', 'Sunset Gold', 'Racing Green'],
    features: ['Active Aero', 'Gullwing Doors', 'Racing Bucket Seats', 'Telemetry Recording'],
    image: '/images/models/yangwang-u9.png',
    category: 'ultra-luxury',
  },

  // Commercial
  Commercial: { 
    basePrice: 49990, 
    name: 'Commercial Van', 
    type: 'Electric Van',
    range: '280 miles',
    battery: '75 kWh Blade Battery',
    payload: '3,500 lbs',
    cargo: '487 cu ft',
    warranty: '8 years / 200,000 miles',
    colors: ['Fleet White', 'Commercial Blue', 'Silver'],
    image: '/images/models/commercial.png',
    category: 'commercial',
  },
  eBus: { 
    basePrice: 129990, 
    name: 'eBus', 
    type: 'Electric Bus',
    range: '250 miles',
    battery: '250 kWh Blade Battery',
    capacity: '40 passengers',
    warranty: '12 years / 500,000 miles',
    colors: ['School Bus Yellow', 'City Transit Blue', 'Eco Green'],
    image: '/images/models/ebus.png',
    category: 'commercial',
  },
  eTruck: {
    basePrice: 69990,
    name: 'Electric Truck',
    type: 'Commercial Truck',
    range: '310 miles',
    battery: '120 kWh Blade Battery',
    payload: '8,000 lbs',
    towing: '15,000 lbs',
    warranty: '8 years / 250,000 miles',
    colors: ['Fleet White', 'Commercial Blue', 'Graphite Black'],
    image: '/images/models/etruck.png',
    category: 'commercial',
  },
};

// ============================================
// REGIONAL INCENTIVES (2026 Updated)
// ============================================
const regionIncentives = {
  California: { 
    evCredit: 7500, 
    stateCredit: 2500,
    freeCharger: true, 
    hovAccess: true,
    utilityRebate: 1500,
    name: 'California',
    salesTax: 0.0725,
  },
  Texas: { 
    evCredit: 2500, 
    stateCredit: 0,
    freeCharger: false,
    utilityRebate: 500,
    name: 'Texas',
    salesTax: 0.0625,
  },
  'New York': { 
    evCredit: 2000, 
    stateCredit: 2000,
    freeCharger: true, 
    tollDiscount: true,
    utilityRebate: 1000,
    name: 'New York',
    salesTax: 0.04,
  },
  Florida: { 
    evCredit: 0, 
    stateCredit: 0,
    freeCharger: false,
    utilityRebate: 200,
    name: 'Florida',
    salesTax: 0.06,
  },
  Colorado: { 
    evCredit: 5000, 
    stateCredit: 2500,
    freeCharger: true, 
    utilityBonus: 1000,
    utilityRebate: 1500,
    name: 'Colorado',
    salesTax: 0.029,
  },
  'New Jersey': { 
    evCredit: 4000, 
    stateCredit: 1500,
    freeCharger: true, 
    noSalesTax: true,
    utilityRebate: 1000,
    name: 'New Jersey',
    salesTax: 0,
  },
  Washington: { 
    evCredit: 2500, 
    stateCredit: 1000,
    freeCharger: false, 
    hovAccess: true,
    utilityRebate: 750,
    name: 'Washington',
    salesTax: 0.065,
  },
  Oregon: {
    evCredit: 2500,
    stateCredit: 2500,
    freeCharger: true,
    utilityRebate: 2500,
    name: 'Oregon',
    salesTax: 0,
  },
  Massachusetts: {
    evCredit: 3500,
    stateCredit: 1500,
    freeCharger: true,
    utilityRebate: 1000,
    name: 'Massachusetts',
    salesTax: 0.0625,
  },
  Illinois: {
    evCredit: 4000,
    stateCredit: 1000,
    freeCharger: false,
    utilityRebate: 500,
    name: 'Illinois',
    salesTax: 0.0625,
  },
  Arizona: {
    evCredit: 1000,
    stateCredit: 0,
    freeCharger: false,
    utilityRebate: 300,
    name: 'Arizona',
    salesTax: 0.056,
  },
  Nevada: {
    evCredit: 2000,
    stateCredit: 0,
    freeCharger: false,
    utilityRebate: 400,
    name: 'Nevada',
    salesTax: 0.0685,
  },
  Georgia: {
    evCredit: 2500,
    stateCredit: 0,
    freeCharger: false,
    utilityRebate: 250,
    name: 'Georgia',
    salesTax: 0.04,
  },
  Michigan: {
    evCredit: 3000,
    stateCredit: 0,
    freeCharger: true,
    utilityRebate: 1000,
    name: 'Michigan',
    salesTax: 0.06,
  },
  Virginia: {
    evCredit: 2500,
    stateCredit: 0,
    freeCharger: false,
    utilityRebate: 500,
    name: 'Virginia',
    salesTax: 0.043,
  },
  Maryland: {
    evCredit: 3000,
    stateCredit: 1000,
    freeCharger: true,
    utilityRebate: 800,
    name: 'Maryland',
    salesTax: 0.06,
  },
};

// ============================================
// PRICING CALCULATIONS
// ============================================
const REGISTRATION_FEE = 450;
const DELIVERY_FEE = 895;
const DOC_FEE = 299;
const TAX_RATE = 0.0425; // 4.25% estimated average sales tax
const FINANCE_TERM = 60; // months
const FINANCE_RATE = 0.0399; // 3.99% APR
const LEASE_TERM = 36; // months
const LEASE_RESIDUAL = 0.55; // 55% residual value
const DOWN_PAYMENT_PERCENT = 0.20; // 20% down payment
const COMPARISON_LIMIT = 5;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get model color for embeds
 */
function getModelColor(model) {
  const colors = {
    'Seal': 0x0066CC,
    'SealPerformance': 0xCC0000,
    'ATTO 3': 0x00CC66,
    'Dolphin': 0x00CCCC,
    'Han': 0xCC0000,
    'HanPerformance': 0xFF3333,
    'Tang': 0x9933CC,
    'TangL': 0x663399,
    'SongPlus': 0x6666CC,
    'YuanPlus': 0x339933,
    'Seagull': 0xFF6600,
    'SeagullPlus': 0xFF9933,
    'YangwangU8': 0x1A1A1A,
    'YangwangU9': 0xFFD700,
    'Commercial': 0x3399FF,
    'eBus': 0x33CC99,
    'eTruck': 0x3399FF,
  };
  return colors[model] || 0x00BFFF;
}

/**
 * Get model category
 */
function getModelCategory(model) {
  const categoryMap = {
    'Seagull': 'city',
    'SeagullPlus': 'city',
    'Dolphin': 'city',
    'Seal': 'sedan',
    'SealPerformance': 'performance',
    'ATTO 3': 'suv',
    'YuanPlus': 'suv',
    'SongPlus': 'suv',
    'Tang': 'suv',
    'TangL': 'suv',
    'Han': 'luxury',
    'HanPerformance': 'luxury',
    'YangwangU8': 'ultra-luxury',
    'YangwangU9': 'ultra-luxury',
    'Commercial': 'commercial',
    'eBus': 'commercial',
    'eTruck': 'commercial',
  };
  return categoryMap[model] || 'other';
}

/**
 * Generate an on-road price quote in USD.
 */
function generateQuote(model, region, variant = 'Premium', color = 'Aurora White') {
  if (!model) {
    logger.error('generateQuote called without model');
    return null;
  }

  logger.debug(`Generating quote for ${model} in ${region} (${variant}, ${color})`);

  const modelData = models[model];
  if (!modelData) {
    logger.warn(`Unknown model: ${model}, using average pricing`);
  }

  const base = modelData?.basePrice || 35000;
  const incentives = regionIncentives[region] || { 
    evCredit: 0, 
    stateCredit: 0,
    freeCharger: false,
    utilityRebate: 0,
    name: region || 'Unknown',
    salesTax: TAX_RATE,
  };

  // Calculate tax using region-specific rate
  const taxRate = incentives.noSalesTax ? 0 : (incentives.salesTax || TAX_RATE);
  let tax = Math.round(base * taxRate);
  if (incentives.noSalesTax) tax = 0;

  // Calculate total before incentives
  const subtotal = base + REGISTRATION_FEE + DELIVERY_FEE + DOC_FEE + tax;
  
  // Total incentives
  const totalIncentives = (incentives.evCredit || 0) + 
                          (incentives.stateCredit || 0) + 
                          (incentives.utilityRebate || 0) +
                          (incentives.utilityBonus || 0);
  
  // Final total (never below 0)
  const total = Math.max(0, subtotal - totalIncentives);

  // Down payment
  const downPayment = Math.round(total * DOWN_PAYMENT_PERCENT);

  // Finance calculation
  const amountFinanced = total - downPayment;
  const monthlyRate = FINANCE_RATE / 12;
  let monthlyFinance = 0;
  
  if (amountFinanced > 0 && FINANCE_TERM > 0) {
    const factor = Math.pow(1 + monthlyRate, FINANCE_TERM);
    monthlyFinance = Math.round(
      (amountFinanced * monthlyRate * factor) / (factor - 1)
    );
  }

  // Lease calculation
  const residualValue = Math.round(base * LEASE_RESIDUAL);
  const depreciation = total - residualValue;
  const monthlyLease = depreciation > 0 ? Math.round(depreciation / LEASE_TERM * 1.08) : 0;

  // Calculate cost per mile (based on 15k miles/year, 5 years)
  const totalMiles = 75000;
  const costPerMile = total > 0 ? (total / totalMiles).toFixed(2) : 0;

  logger.debug(`Quote for ${model}: $${total.toLocaleString()} total, $${monthlyFinance}/mo finance`);

  // Determine estimated delivery time
  const estimatedDelivery = getEstimatedDelivery(model);

  return {
    model: modelData?.name || model,
    variant,
    color,
    region: incentives.name,
    total,
    downPayment,
    monthlyFinance,
    monthlyLease,
    incentivesSavings: totalIncentives,
    estimatedDelivery,
    costPerMile,
    breakdown: {
      vehiclePrice: base,
      registration: REGISTRATION_FEE,
      delivery: DELIVERY_FEE,
      docFee: DOC_FEE,
      tax: tax,
      taxRate: `${(taxRate * 100).toFixed(1)}%`,
      subtotal: subtotal,
    },
    incentives: {
      federalCredit: incentives.evCredit || 0,
      stateCredit: incentives.stateCredit || 0,
      utilityRebate: (incentives.utilityRebate || 0) + (incentives.utilityBonus || 0),
      freeCharger: incentives.freeCharger || false,
      hovAccess: incentives.hovAccess || false,
      tollDiscount: incentives.tollDiscount || false,
      noSalesTax: incentives.noSalesTax || false,
    },
    incentivesList: getIncentivesText(region),
    modelSpecs: modelData ? {
      range: modelData.range,
      battery: modelData.battery,
      charging: modelData.charging,
      warranty: modelData.warranty,
      zeroToSixty: modelData.zeroToSixty,
      seats: modelData.seats,
      cargo: modelData.cargo,
      topSpeed: modelData.topSpeed,
      horsepower: modelData.horsepower,
    } : null,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get estimated delivery time based on model.
 */
function getEstimatedDelivery(model) {
  const premiumModels = ['YangwangU8', 'YangwangU9', 'HanPerformance', 'SealPerformance'];
  const commercialModels = ['Commercial', 'eBus', 'eTruck'];
  
  if (premiumModels.includes(model)) return '6-8 weeks';
  if (commercialModels.includes(model)) return '10-12 weeks';
  return '2-4 weeks';
}

/**
 * Get formatted incentives text for display.
 */
function getIncentivesText(region) {
  const inc = regionIncentives[region];
  if (!inc) return 'Check your state for available EV incentives';
  
  const parts = [];
  if (inc.evCredit) parts.push(`💰 $${inc.evCredit.toLocaleString()} federal EV tax credit`);
  if (inc.stateCredit) parts.push(`🏛️ $${inc.stateCredit.toLocaleString()} state EV rebate`);
  if (inc.utilityRebate || inc.utilityBonus) {
    const total = (inc.utilityRebate || 0) + (inc.utilityBonus || 0);
    parts.push(`⚡ $${total.toLocaleString()} utility company rebate`);
  }
  if (inc.freeCharger) parts.push('🔌 Free Level 2 home charger installation');
  if (inc.hovAccess) parts.push('🛣️ HOV/carpool lane access');
  if (inc.tollDiscount) parts.push('🛡️ Toll road discounts');
  if (inc.noSalesTax) parts.push('🏷️ 0% sales tax on EV purchases');
  
  return parts.length ? parts.join(' • ') : 'No state-specific incentives found';
}

/**
 * Get quick price summary for a model.
 */
function getQuickPrice(model) {
  const m = models[model];
  if (!m) return 'Contact us for pricing';
  return `Starting from $${m.basePrice.toLocaleString()}${m.range ? ` • ${m.range} range` : ''}`;
}

/**
 * Get all available models for a specific type.
 */
function getModelsByType(type) {
  return Object.entries(models)
    .filter(([_, data]) => data.type && data.type.toLowerCase().includes(type.toLowerCase()))
    .map(([key, data]) => ({
      key,
      ...data,
      quickPrice: getQuickPrice(key),
    }));
}

/**
 * Get models by category.
 */
function getModelsByCategory(category) {
  return Object.entries(models)
    .filter(([_, data]) => data.category === category)
    .map(([key, data]) => ({
      key,
      ...data,
      quickPrice: getQuickPrice(key),
    }));
}

/**
 * Get all model categories.
 */
function getAllCategories() {
  const categories = new Set();
  Object.values(models).forEach(model => {
    if (model.category) categories.add(model.category);
  });
  return Array.from(categories).sort();
}

/**
 * Get all model types (unique).
 */
function getAllModelTypes() {
  const types = new Set();
  Object.values(models).forEach(model => {
    if (model.type) types.add(model.type);
  });
  return Array.from(types).sort();
}

/**
 * Get comparable models for comparison.
 */
function getComparableModels(model, count = 3) {
  const modelData = models[model];
  if (!modelData) return [];
  
  const category = modelData.category || 'other';
  const sameCategory = getModelsByCategory(category);
  
  return sameCategory
    .filter(m => m.key !== model)
    .slice(0, Math.min(count, COMPARISON_LIMIT))
    .map(m => ({
      key: m.key,
      name: m.name,
      price: m.basePrice,
      type: m.type,
      range: m.range,
      zeroToSixty: m.zeroToSixty,
    }));
}

/**
 * Search models by keyword.
 */
function searchModels(query) {
  if (!query || typeof query !== 'string') return [];
  
  const q = query.toLowerCase();
  return Object.entries(models)
    .filter(([key, data]) => 
      key.toLowerCase().includes(q) ||
      (data.name && data.name.toLowerCase().includes(q)) ||
      (data.type && data.type.toLowerCase().includes(q)) ||
      (data.category && data.category.toLowerCase().includes(q))
    )
    .map(([key, data]) => ({
      key,
      ...data,
      quickPrice: getQuickPrice(key),
    }));
}

/**
 * Get all available regions.
 */
function getRegions() {
  return Object.keys(regionIncentives).sort();
}

/**
 * Get region details by name.
 */
function getRegionDetails(region) {
  return regionIncentives[region] || null;
}

/**
 * Compare two models side by side with advantages.
 */
function compareModels(model1, model2) {
  const m1 = models[model1];
  const m2 = models[model2];
  if (!m1 || !m2) return null;

  const priceDiff = m1.basePrice - m2.basePrice;
  const priceDiffFormatted = priceDiff !== 0 
    ? `$${Math.abs(priceDiff).toLocaleString()} ${priceDiff > 0 ? 'more' : 'less'}`
    : 'Same price';

  // Calculate advantages
  const advantages = [];
  if (m1.range && m2.range) {
    const range1 = parseInt(m1.range);
    const range2 = parseInt(m2.range);
    if (range1 > range2) advantages.push(`${m1.name} has better range (+${range1 - range2} miles)`);
    else if (range2 > range1) advantages.push(`${m2.name} has better range (+${range2 - range1} miles)`);
  }
  
  if (m1.zeroToSixty && m2.zeroToSixty) {
    const time1 = parseFloat(m1.zeroToSixty);
    const time2 = parseFloat(m2.zeroToSixty);
    if (time1 < time2) advantages.push(`${m1.name} is faster (${m1.zeroToSixty} vs ${m2.zeroToSixty})`);
    else if (time2 < time1) advantages.push(`${m2.name} is faster (${m2.zeroToSixty} vs ${m1.zeroToSixty})`);
  }

  if (m1.basePrice && m2.basePrice) {
    if (m1.basePrice < m2.basePrice) advantages.push(`${m1.name} is more affordable ($${m1.basePrice.toLocaleString()} vs $${m2.basePrice.toLocaleString()})`);
    else if (m2.basePrice < m1.basePrice) advantages.push(`${m2.name} is more affordable ($${m2.basePrice.toLocaleString()} vs $${m1.basePrice.toLocaleString()})`);
  }

  return {
    model1: { key: model1, ...m1 },
    model2: { key: model2, ...m2 },
    priceDiff,
    priceDiffFormatted,
    advantages,
    comparisons: {
      price: { model1: m1.basePrice, model2: m2.basePrice, diff: priceDiffFormatted },
      range: { model1: m1.range, model2: m2.range },
      zeroToSixty: { model1: m1.zeroToSixty, model2: m2.zeroToSixty },
      battery: { model1: m1.battery, model2: m2.battery },
    },
  };
}

/**
 * Get model details by name/key.
 */
function getModel(modelKey) {
  const model = models[modelKey];
  if (!model) return null;
  
  return {
    key: modelKey,
    ...model,
    quickPrice: getQuickPrice(modelKey),
    color: getModelColor(modelKey),
    category: getModelCategory(modelKey),
  };
}

/**
 * Get all models with optional filtering.
 */
function getAllModels(filter = null) {
  let results = Object.entries(models).map(([key, data]) => ({
    key,
    ...data,
    quickPrice: getQuickPrice(key),
  }));
  
  const filters = {
    affordable: (m) => m.basePrice <= 40000,
    luxury: (m) => m.basePrice >= 60000,
    suv: (m) => m.type && m.type.toLowerCase().includes('suv'),
    performance: (m) => m.zeroToSixty && parseFloat(m.zeroToSixty) < 4,
    city: (m) => m.category === 'city',
    commercial: (m) => m.category === 'commercial',
  };
  
  if (filters[filter]) {
    results = results.filter(filters[filter]);
  }
  
  return results;
}

/**
 * Calculate total cost including all fees and taxes.
 */
function calculateTotalCost(model, region) {
  const quote = generateQuote(model, region);
  if (!quote) return null;
  
  return {
    basePrice: quote.breakdown.vehiclePrice,
    fees: quote.breakdown.registration + quote.breakdown.delivery + quote.breakdown.docFee,
    tax: quote.breakdown.tax,
    taxRate: quote.breakdown.taxRate,
    incentives: quote.incentivesSavings,
    total: quote.total,
    monthlyFinance: quote.monthlyFinance,
    monthlyLease: quote.monthlyLease,
    costPerMile: quote.costPerMile,
    estimatedDelivery: quote.estimatedDelivery,
  };
}

/**
 * Get featured models (top picks by category).
 */
function getFeaturedModels() {
  return {
    bestValue: getModel('Seagull'),
    bestRange: getModel('Han'),
    fastest: getModel('YangwangU9'),
    familyFavorite: getModel('Tang'),
    luxuryPick: getModel('YangwangU8'),
    bestSUV: getModel('ATTO 3'),
  };
}

/**
 * Validate if a model exists.
 */
function isValidModel(modelKey) {
  return !!models[modelKey];
}

/**
 * Get model price range for a category.
 */
function getPriceRange(category = null) {
  let filteredModels = Object.values(models);
  if (category) {
    filteredModels = filteredModels.filter(m => 
      m.category === category || (m.type && m.type.toLowerCase().includes(category.toLowerCase()))
    );
  }
  
  const prices = filteredModels.map(m => m.basePrice);
  if (prices.length === 0) return null;
  
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    minModel: filteredModels.find(m => m.basePrice === Math.min(...prices))?.name,
    maxModel: filteredModels.find(m => m.basePrice === Math.max(...prices))?.name,
  };
}

/**
 * Get total EV savings estimate (5-year ownership).
 */
function getTotalSavings(model, region, annualMiles = 15000) {
  const quote = generateQuote(model, region);
  if (!quote) return null;
  
  // Estimated gas savings (compared to 25 MPG car at $3.50/gallon)
  const gasCostPerYear = (annualMiles / 25) * 3.50;
  const electricCostPerYear = (annualMiles / 3.5) * 0.14; // 3.5 mi/kWh, $0.14/kWh
  const annualFuelSavings = gasCostPerYear - electricCostPerYear;
  
  // Maintenance savings (EVs cost ~50% less to maintain)
  const annualMaintenanceSavings = 500;
  
  const fiveYearSavings = (annualFuelSavings + annualMaintenanceSavings) * 5;
  
  return {
    annualFuelSavings: Math.round(annualFuelSavings),
    annualMaintenanceSavings: annualMaintenanceSavings,
    fiveYearFuelSavings: Math.round(annualFuelSavings * 5),
    fiveYearMaintenanceSavings: annualMaintenanceSavings * 5,
    totalFiveYearSavings: Math.round(fiveYearSavings),
    incentivesSavings: quote.incentivesSavings,
    totalWithIncentives: Math.round(fiveYearSavings + quote.incentivesSavings),
  };
}

module.exports = {
  // Data exports
  models,
  regionIncentives,
  
  // Quote generation
  generateQuote,
  getIncentivesText,
  getQuickPrice,
  calculateTotalCost,
  getEstimatedDelivery,
  getTotalSavings,
  
  // Model queries
  getModel,
  getAllModels,
  getModelsByType,
  getModelsByCategory,
  getAllModelTypes,
  getAllCategories,
  getComparableModels,
  searchModels,
  compareModels,
  isValidModel,
  getFeaturedModels,
  getPriceRange,
  getModelColor,
  getModelCategory,
  
  // Region queries
  getRegions,
  getRegionDetails,
  
  // Constants
  FINANCE_TERM,
  LEASE_TERM,
  TAX_RATE,
  COMPARISON_LIMIT,
};