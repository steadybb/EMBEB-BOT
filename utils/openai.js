// utils/openai.js
const axios = require('axios');
const logger = require('./logger');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const BOT_URL = process.env.BOT_URL || 'https://your-bot-url.com';
const BOT_NAME = process.env.BOT_NAME || 'BYD BladeBot Auto Poster';

// Base URL for static images (update this to match your server/hosting)
const STATIC_BASE_URL = process.env.STATIC_BASE_URL || 'http://localhost:3000/static';

// Configuration
const CONFIG = {
  maxRetries: 2, // Increased for better reliability
  retryDelay: 2000, // Base delay in ms
  maxTokens: 500,
  temperature: 0.8,
  defaultModel: 'openai/gpt-3.5-turbo',
  fallbackModels: [
    'google/gemini-flash-1.5',
    'anthropic/claude-instant-1.2',
    'meta-llama/llama-3.2-3b-instruct',
  ],
  timeout: 15000, // 15 seconds
  maxResponseLength: 4000, // Discord embed limit buffer
  useLocalFallback: true, // Enable local fallback content when API fails
  enableImageValidation: process.env.ENABLE_IMAGE_VALIDATION !== 'false', // Validate image URLs
};

// System prompt for consistent BYD content
const SYSTEM_PROMPT = `You are a helpful assistant that writes engaging, informative content about BYD electric vehicles. 
Guidelines:
- Keep responses concise (max 300 words)
- Suitable for a Discord community
- Use emojis and line breaks for readability
- Use simple formatting that Discord supports (no markdown tables, use bullet points with • or -)
- Be accurate about BYD specifications and features
- Maintain a positive, enthusiastic tone
- Include 2-3 relevant emojis per paragraph
- End with a brief, engaging call-to-action (question or fun fact)`;

// Track API usage
const apiStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retriedRequests: 0,
  fallbackUsed: 0,
  averageResponseTime: 0,
  lastError: null,
  lastErrorTime: null,
  modelUsage: {},
};

// ============================================
// IMAGE HELPER FUNCTIONS
// ============================================

/**
 * Get the full image URL for a static asset
 * @param {string} filename - Image filename in static folder
 * @returns {string} - Full URL to the image
 */
function getImageUrl(filename) {
  if (!filename) return null;
  
  // If STATIC_BASE_URL is localhost or not set, return relative path
  if (STATIC_BASE_URL === 'http://localhost:3000/static' || !STATIC_BASE_URL) {
    logger.warn(`STATIC_BASE_URL not configured properly. Images may not display. Using: ${STATIC_BASE_URL}`);
  }
  
  return `${STATIC_BASE_URL}/${filename}`;
}

/**
 * Validate image URL before using
 * @param {string} url - Image URL to validate
 * @returns {boolean} - Whether URL is valid
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Check if URL is from allowed domains or has valid extensions
  const isValidProtocol = url.startsWith('https://') || url.startsWith('http://');
  const isValidDiscordCDN = url.includes('cdn.discordapp.com');
  const isValidImgur = url.includes('imgur.com');
  const isValidLocal = url.includes('localhost') || url.includes('127.0.0.1');
  
  // Check for valid image extensions
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasValidExtension = validExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  return isValidProtocol && (isValidDiscordCDN || isValidImgur || isValidLocal || hasValidExtension);
}

// ============================================
// FALLBACK CONTENT POOL (15 Posts with Images)
// ============================================

const fallbackPosts = [
  // 1. Model Spotlight - BYD Seal
  {
    id: 'seal_spotlight',
    content: `🚗 **BYD Seal - The Game Changer** ⚡

The BYD Seal is redefining the electric sedan market with its stunning design and impressive specs!

**Key Features:**
• 🏎️ 0-100 km/h in just 3.8 seconds
• 🔋 Up to 700km range (CLTC)
• 🛡️ Revolutionary CTB (Cell-to-Body) technology
• 💰 Starting from ~$35,000 USD

**Why It Matters:** The Seal isn't just fast—it's BYD's direct competitor to the Tesla Model 3, and it's winning hearts globally with its premium feel at a mid-range price!

**Fun Fact:** 🎯 The Seal's drag coefficient of just 0.219 makes it one of the most aerodynamic production cars in the world!

*Have you experienced the BYD Seal yet? What feature impresses you most?*`,
    type: 'model_spotlight',
    model: 'Seal',
    image: getImageUrl('byd-seal.jpg'),
  },

  // 2. Battery Technology
  {
    id: 'blade_battery',
    content: `🔋 **BYD Blade Battery: Safety Revolution** 🛡️

Did you know BYD's Blade Battery passed the most extreme safety test in the industry?

**The Nail Penetration Test:**
• 🔨 When punctured, the Blade Battery didn't catch fire or explode
• 🌡️ Surface temperature stayed below 60°C (140°F)
• ✅ Other batteries reached over 500°C and caught fire

**Why It's Special:**
• 📏 Ultra-thin design maximizes space utilization
• 🔒 LFP chemistry provides inherent safety
• ♻️ Cobalt-free = more environmentally friendly
• 🔄 Over 5,000 charge cycles with minimal degradation

BYD supplies these batteries to Tesla, Toyota, and other major automakers. Your BYD's battery is literally world-class technology!`,
    type: 'ev_fact',
    image: getImageUrl('blade-battery.jpg'),
  },

  // 3. BYD News & Achievements
  {
    id: 'byd_achievements',
    content: `📰 **BYD Milestones & Achievements** 🏆

BYD continues to break records in the EV industry!

**Recent Highlights:**
• 🌍 Became the world's #1 NEV (New Energy Vehicle) seller
• 🚢 Launched their own cargo ships for efficient global delivery
• 🏭 Opened new factories in Thailand, Brazil, and Hungary
• 🤝 Partnership with major brands like Toyota and Mercedes-Benz

**By The Numbers:**
• 📊 Over 3 million NEVs sold in 2023
• 🌐 Present in 70+ countries
• 👷 600,000+ employees worldwide

**Innovation Spotlight:** BYD's vertically integrated model means they make their own batteries, chips, and motors—keeping quality high and costs low!

*Which BYD achievement surprises you most?*`,
    type: 'byd_news',
    image: getImageUrl('byd-factory.jpg'),
  },

  // 4. EV Lifestyle Tip
  {
    id: 'ev_tips_1',
    content: `💡 **EV Owner Tip: Maximize Your Range** 🚗

Getting the most out of your BYD's battery is easier than you think!

**Top Tips:**
• 🌡️ Pre-condition your battery while plugged in during cold weather
• 🛞 Keep tires properly inflated—low pressure increases rolling resistance
• 🌬️ Use ECO mode for daily driving, save SPORT mode for fun weekends
• 🗺️ Plan routes with regenerative braking opportunities in mind

**BYD Specific:** Your BYD's heat pump system (available on most models) is 3x more efficient than traditional heating—use it wisely!

**Pro Tip:** 💰 Schedule charging during off-peak hours to save up to 50% on electricity costs. Most BYDs have built-in scheduling features!

*What's your best range-saving tip? Share with the community!*`,
    type: 'ev_tip',
    image: getImageUrl('ev-charging.jpg'),
  },

  // 5. Model Spotlight - ATTO 3
  {
    id: 'atto3_spotlight',
    content: `🚙 **BYD ATTO 3 - The People's Champion** 👑

The ATTO 3 (Yuan Plus in China) has become BYD's global bestseller for good reason!

**Impressive Specs:**
• 📏 Compact SUV with spacious interior
• 🔋 420-480km range (WLTP)
• 🎸 Unique gym-inspired interior design
• 💰 Starting from ~$30,000 USD

**Award Winner:**
• 🏆 2023 New Zealand Car of the Year
• ⭐ 5-star Euro NCAP safety rating
• 🌟 Best-selling EV in multiple countries

**Fun Fact:** 🎵 The door handles and air vents are designed to look like guitar strings and dumbbell plates—making every drive feel like a workout!

*Would you take the ATTO 3 on a road trip? Where would you go?*`,
    type: 'model_spotlight',
    model: 'ATTO 3',
    image: getImageUrl('byd-atto3.jpg'),
  },

  // 6. Industry Innovation
  {
    id: 'ev_innovation',
    content: `⚡ **EV Technology: BYD's Secret Weapons** 🚀

Ever wonder what makes BYD EVs so special? Let's dive into their game-changing tech!

**DM-i Super Hybrid:**
• 🔄 Combines electric and petrol power seamlessly
• ⛽ Achieves 1,200km+ total range
• 🌱 As low as 3.8L/100km fuel consumption

**e-Platform 3.0:**
• 🏗️ Dedicated EV platform (not converted from gas)
• 🎯 800V architecture for ultra-fast charging
• ❄️ Heat pump extends winter range by 20%

**Vehicle-to-Load (V2L):**
• 🔌 Your BYD can power external devices
• 🏕️ Perfect for camping or emergency backup
• 💡 Power a home for days during outages

BYD isn't just making EVs—they're building an entire ecosystem!`,
    type: 'ev_fact',
    image: getImageUrl('byd-platform.jpg'),
  },

  // 7. Model Spotlight - Dolphin
  {
    id: 'dolphin_spotlight',
    content: `🐬 **BYD Dolphin - Small Car, Big Impact** 🌊

Don't let its compact size fool you—the BYD Dolphin is packed with value!

**Why Everyone's Talking About It:**
• 💰 Incredibly affordable (starting under $25,000)
• 🔋 340-427km range depending on battery
• 🚗 Surprisingly spacious for a hatchback
• 🎨 Fun, youthful design inside and out

**Tech Highlights:**
• 📱 Rotating 12.8" touchscreen
• 🎯 360° camera system
• 🛡️ Full ADAS safety suite

**Fun Fact:** 🐬 The Dolphin's interior is inspired by ocean waves, with flowing lines and aquatic-themed details throughout!

*Perfect first EV or city runabout? What do you think?*`,
    type: 'model_spotlight',
    model: 'Dolphin',
    image: getImageUrl('byd-dolphin.jpg'),
  },

  // 8. Charging Tips
  {
    id: 'charging_tips',
    content: `🔌 **Smart Charging Habits for BYD Owners** ⚡

Charge smarter, not harder! Here's how to keep your BYD battery healthy:

**Best Practices:**
• 📊 Keep battery between 20-80% for daily use
• 🔋 100% charge is fine for long trips—just don't leave it at 100% for days
• 🌡️ Avoid charging in extreme heat when possible

**Charging Speeds Explained:**
• 🏠 Home AC (7kW): Full charge overnight
• 🏪 Public AC (22kW): 4-6 hours
• ⚡ DC Fast (150kW): 30-80% in 30 minutes!

**BYD Advantage:** LFP batteries can handle more 100% charges than other types—but moderate charging still extends lifespan!

*What's your charging setup at home?*`,
    type: 'ev_tip',
    image: getImageUrl('ev-charging-2.jpg'),
  },

  // 9. Environmental Impact
  {
    id: 'environmental_impact',
    content: `🌍 **Your BYD's Environmental Impact** 🌱

Ever calculated how much CO2 you're saving with your BYD?

**Real Numbers:**
• 🌳 Average EV saves 4.6 metric tons of CO2 annually
• 🔌 Even with grid electricity, EVs produce 50-70% less emissions
• ☀️ Paired with solar = nearly zero emissions driving!

**BYD's Green Commitment:**
• ♻️ World's largest EV manufacturer—and getting greener
• 🏭 Factories run on renewable energy
• 🔋 Battery recycling program in development
• 🌳 1 million+ trees planted through BYD initiatives

**Your Impact:** Over 5 years, one BYD can save the equivalent CO2 of:
• 🌲 200 trees growing for a decade
• ✈️ 5 round-trip flights NYC to London

*Every kilometer in your BYD makes a difference!*`,
    type: 'ev_fact',
    image: getImageUrl('environment-impact.jpg'),
  },

  // 10. Community Discussion
  {
    id: 'community_discussion',
    content: `💬 **BYD Community Spotlight** 🌟

You're part of one of the fastest-growing EV communities in the world!

**Did You Know?**
• 🌐 BYD owners groups span 70+ countries
• 📸 Over 1 million BYD-related social media posts monthly
• 🤝 Active modification and customization communities
• 🏆 Regular BYD owner meetups worldwide

**Join the Conversation:**
• 🎯 Share your BYD ownership experience
• 📸 Post your best BYD photos
• 🛠️ Discuss modifications and accessories
• 🗺️ Plan local meetups

**Question of the Day:** What made you choose BYD over other EV brands? Was it price, technology, design, or something else?

*Share your BYD story below! Every owner has a unique journey.*`,
    type: 'ev_tip',
    image: getImageUrl('byd-community.jpg'),
  },

  // 11. Model Spotlight - BYD Han
  {
    id: 'han_spotlight',
    content: `🏎️ **BYD Han - Luxury Meets Performance** 👑

The BYD Han is the flagship sedan that proves Chinese luxury EVs are world-class!

**Stunning Specs:**
• ⚡ 0-100 km/h in just 3.9 seconds
• 🔋 Up to 605km range (NEDC)
• 🎨 Premium interior with real wood and leather
• 🛡️ 5-star C-NCAP safety rating

**Tech Features:**
• 📱 15.6" rotating touchscreen
• 🎵 Dynaudio premium sound system
• 🅿️ Intelligent parking assist
• 🌐 5G connectivity

**Fun Fact:** 👑 The "Han" name honors China's Han Dynasty, known for innovation and prosperity—fitting for BYD's technological flagship!

*Would you choose the Han over a Mercedes EQE or BMW i5?*`,
    type: 'model_spotlight',
    model: 'Han',
    image: getImageUrl('byd-han.jpg'),
  },

  // 12. BYD vs Competition
  {
    id: 'byd_vs_competition',
    content: `⚔️ **Why BYD Is Winning the EV Race** 🏁

Here's what sets BYD apart from traditional automakers:

**Cost Advantage:**
• 💰 30-40% cheaper than comparable Tesla models
• 🔋 Own battery production eliminates middlemen
• 🏭 Vertically integrated manufacturing

**Technology Edge:**
• 🛡️ Blade Battery - Safest in the industry
• ⚡ 800V platform for ultra-fast charging
• 🔄 DM-i hybrid tech for range anxiety elimination

**Global Expansion:**
• 🌍 Sold in 70+ countries
• 🏭 30+ production bases worldwide
• 🚢 Own shipping fleet for efficient delivery

**The Numbers Don't Lie:**
• 📊 #1 NEV seller globally
• 📈 62% sales growth year-over-year
• 🎯 Targeting 4 million sales in 2024

*Do you think traditional automakers can catch up to BYD?*`,
    type: 'byd_news',
    image: getImageUrl('byd-comparison.jpg'),
  },

  // 13. EV Maintenance Tips
  {
    id: 'ev_maintenance',
    content: `🔧 **EV Maintenance: Easier Than You Think!** 🛠️

One of the best things about owning a BYD? Minimal maintenance!

**What You DON'T Need:**
• ❌ Oil changes
• ❌ Spark plugs
• ❌ Fuel filters
• ❌ Timing belts
• ❌ Exhaust system repairs

**What You DO Need:**
• 🛞 Tire rotations every 10,000 km
• 🧊 Cabin air filter every 20,000 km
• 🧪 Brake fluid every 2 years
• 💨 AC service every 4 years
• 🔋 Battery health check annually

**BYD Specific Tips:**
• 📊 Use the BYD app to monitor battery health
• 🔌 Keep software updated for optimal performance
• 🧼 Wash regularly—aerodynamic dirt reduces range!

**Cost Savings:** 💰 Average EV saves $1,000+/year on maintenance vs gas cars!

*What maintenance surprise did you discover after switching to EV?*`,
    type: 'ev_tip',
    image: getImageUrl('ev-maintenance.jpg'),
  },

  // 14. BYD Seagull - Affordable EV
  {
    id: 'seagull_spotlight',
    content: `🕊️ **BYD Seagull - The Most Affordable EV Revolution** 💰

Meet the BYD Seagull—the EV that's making electric mobility accessible to everyone!

**Unbelievable Value:**
• 💰 Starting from just ~$11,000 USD
• 🔋 305-405km range
• 🚗 Compact city car perfect for urban driving
• 🛡️ Amazing safety for its price point

**Why It Matters:**
• 🌍 Making EVs accessible to developing markets
• 🏙️ Perfect second car for families
• 💡 Proves EVs can be affordable AND good
• 📈 Already a bestseller in China

**Fun Features:**
• 📱 10.1" touchscreen (in this price range!)
• 🔑 Keyless entry and start
• 📊 Digital instrument cluster

**Fun Fact:** 🕊️ The Seagull weighs just 1,080kg—lighter than a Honda Civic—making it incredibly efficient!

*Could the Seagull be your perfect city car?*`,
    type: 'model_spotlight',
    model: 'Seagull',
    image: getImageUrl('byd-seagull.jpg'),
  },

  // 15. Future of BYD
  {
    id: 'future_byd',
    content: `🔮 **The Future of BYD: What's Coming Next?** 🚀

BYD isn't slowing down—here's what's on the horizon:

**Upcoming Models (Rumored & Confirmed):**
• 🛻 BYD Pickup Truck - Competing with Rivian and Ford Lightning
• 🏎️ Yangwang U9 Supercar - 0-100 in 2 seconds!
• 🚐 Electric Van - For commercial and family use
• 🛵 Electric Motorcycles - Expanding beyond cars

**Technology Roadmap:**
• 🔋 Solid-state batteries by 2027
• 🤖 Level 4 autonomous driving
• 🌐 Vehicle-to-Grid (V2G) technology
• 🛰️ Satellite-connected vehicles

**Market Predictions:**
• 🎯 Targeting 6 million annual sales by 2026
• 🌍 Expanding to 100+ countries
• 🏭 50+ global production sites

**Industry Impact:** BYD is expected to become the world's largest automaker by 2030!

*Which upcoming BYD are you most excited about?*`,
    type: 'byd_news',
    image: getImageUrl('byd-future.jpg'),
  },
];

// ============================================
// FALLBACK POST MANAGEMENT
// ============================================

let lastFallbackIndex = -1;

/**
 * Get the next fallback post in rotation
 * @param {string} type - Optional content type to match
 * @returns {Object} - Fallback post object
 */
function getFallbackPost(type = null) {
  let availablePosts = fallbackPosts;
  
  // Filter by type if specified
  if (type) {
    availablePosts = fallbackPosts.filter(post => post.type === type);
    if (availablePosts.length === 0) {
      logger.warn(`No fallback posts found for type: ${type}, using all posts`);
      availablePosts = fallbackPosts;
    }
  }
  
  // Rotate through posts
  lastFallbackIndex = (lastFallbackIndex + 1) % availablePosts.length;
  const selectedPost = { ...availablePosts[lastFallbackIndex] }; // Clone to prevent mutation
  
  // Validate image if validation is enabled
  if (CONFIG.enableImageValidation && selectedPost.image && !isValidImageUrl(selectedPost.image)) {
    logger.warn(`Invalid image URL for fallback post ${selectedPost.id}, removing image`);
    delete selectedPost.image;
  }
  
  apiStats.fallbackUsed++;
  logger.info(`📦 Using fallback post: ${selectedPost.id} (${selectedPost.type})${selectedPost.image ? ' 🖼️ with image' : ''}`);
  
  return selectedPost;
}

/**
 * Get multiple random fallback posts
 * @param {number} count - Number of posts to get
 * @returns {Array} - Array of fallback posts
 */
function getRandomFallbackPosts(count = 1) {
  const shuffled = [...fallbackPosts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Add custom fallback posts to the pool
 * @param {Array} posts - Array of post objects with { content, type, id, image }
 */
function addFallbackPosts(posts) {
  if (Array.isArray(posts)) {
    // Validate posts before adding
    const validPosts = posts.filter(post => 
      post.content && post.type && post.id
    );
    
    if (validPosts.length !== posts.length) {
      logger.warn(`Skipped ${posts.length - validPosts.length} invalid fallback posts`);
    }
    
    fallbackPosts.push(...validPosts);
    logger.info(`Added ${validPosts.length} custom fallback posts. Total: ${fallbackPosts.length}`);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate and sanitize the generated content
 * @param {string} content - The generated text
 * @returns {string} - Sanitized content
 */
function sanitizeContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  let sanitized = content.trim();
  
  // Remove Discord-unsupported markdown
  sanitized = sanitized
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*\*(.+?)\*\*\*/g, '**$1**')
    .replace(/__(.+?)__/g, '**$1**')
    .replace(/_(.+?)_/g, '*$1*')
    .replace(/^(#{1,6})\s/gm, '**')
    .replace(/\|.*\|/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n');

  // Convert markdown lists to Discord-friendly format
  sanitized = sanitized.replace(/^(-|\*)\s/gm, '• ');
  
  // Add spaces around emojis for better rendering
  sanitized = sanitized.replace(/(\S)([🎉🚗🔋⚡🌟💡🎯🛡️🌍🔌🐬🏎️🔨📏🔒♻️🔄📰🏆🚢🏭🤝📊🌐👷🏗️❄️🏕️💡⛽🌱🏠🏪⚡🛞🌬️🗺️💰🎸🎵🏆⭐🌟🕊️🔮🛻🏍️🤖🛰️])/g, '$1 $2');
  sanitized = sanitized.replace(/([🎉🚗🔋⚡🌟💡🎯🛡️🌍🔌🐬🏎️🔨📏🔒♻️🔄📰🏆🚢🏭🤝📊🌐👷🏗️❄️🏕️💡⛽🌱🏠🏪⚡🛞🌬️🗺️💰🎸🎵🏆⭐🌟🕊️🔮🛻🏍️🤖🛰️])(\S)/g, '$1 $2');
  
  return sanitized;
}

/**
 * Check if content is appropriate for posting
 * @param {string} content - The generated text
 * @returns {boolean} - Whether content is valid
 */
function validateContent(content) {
  if (!content || content.length < 10) {
    logger.warn('Generated content too short');
    return false;
  }

  const blockedTerms = [
    'as an AI',
    'I cannot',
    'I apologize',
    'I am not able',
    'I am unable',
    'I do not have',
    'I don\'t have access',
    'my knowledge cutoff',
    'I\'m sorry',
    'I can\'t',
  ];

  const lowerContent = content.toLowerCase();
  for (const term of blockedTerms) {
    if (lowerContent.includes(term.toLowerCase())) {
      logger.warn(`Blocked term found in content: "${term}"`);
      return false;
    }
  }

  return true;
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (1-based)
 * @param {number} baseDelay - Base delay in ms
 * @returns {number} - Delay in ms
 */
function getBackoffDelay(attempt, baseDelay = CONFIG.retryDelay) {
  return baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
}

/**
 * Track API statistics
 * @param {string} model - Model used
 * @param {number} responseTime - Response time in ms
 * @param {boolean} success - Whether request was successful
 */
function trackApiUsage(model, responseTime, success) {
  apiStats.totalRequests++;
  
  if (success) {
    apiStats.successfulRequests++;
  } else {
    apiStats.failedRequests++;
  }
  
  if (!apiStats.modelUsage[model]) {
    apiStats.modelUsage[model] = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalTime: 0,
    };
  }
  apiStats.modelUsage[model].requests++;
  apiStats.modelUsage[model][success ? 'successes' : 'failures']++;
  apiStats.modelUsage[model].totalTime += responseTime;
  
  const totalTime = apiStats.averageResponseTime * (apiStats.totalRequests - 1) + responseTime;
  apiStats.averageResponseTime = totalTime / apiStats.totalRequests;
}

/**
 * Get API statistics
 * @returns {Object} - API usage statistics
 */
function getApiStats() {
  return {
    ...apiStats,
    fallbackPostsAvailable: fallbackPosts.length,
    fallbackPostsWithImages: fallbackPosts.filter(p => p.image && isValidImageUrl(p.image)).length,
    successRate: apiStats.totalRequests > 0
      ? `${((apiStats.successfulRequests / apiStats.totalRequests) * 100).toFixed(1)}%`
      : 'N/A',
    models: Object.entries(apiStats.modelUsage).map(([model, stats]) => ({
      model,
      ...stats,
      averageTime: `${(stats.totalTime / stats.requests).toFixed(0)}ms`,
    })),
  };
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

/**
 * Generate text using OpenRouter with retry logic and fallback models
 * Falls back to local pre-written content if all API attempts fail
 * @param {string} prompt - The prompt to send
 * @param {string} preferredModel - Preferred model name
 * @param {string} contentType - Optional content type for fallback matching
 * @returns {Promise<Object>} - { content, source, image, ... }
 */
async function generateContent(prompt, preferredModel = CONFIG.defaultModel, contentType = null) {
  // If no API key and fallback is enabled, use local content immediately
  if (!OPENROUTER_API_KEY && CONFIG.useLocalFallback) {
    logger.warn('No API key set, using local fallback content');
    const fallbackPost = getFallbackPost(contentType);
    return {
      content: fallbackPost.content,
      source: 'fallback',
      postId: fallbackPost.id,
      type: fallbackPost.type,
      model: fallbackPost.model || null,
      image: fallbackPost.image || null,
    };
  }

  if (!OPENROUTER_API_KEY) {
    logger.error('OPENROUTER_API_KEY is not set. Cannot generate content.');
    return null;
  }

  if (!prompt || typeof prompt !== 'string') {
    logger.error('Invalid prompt provided to generateContent');
    
    if (CONFIG.useLocalFallback) {
      const fallbackPost = getFallbackPost(contentType);
      return {
        content: fallbackPost.content,
        source: 'fallback',
        postId: fallbackPost.id,
        type: fallbackPost.type,
        model: fallbackPost.model || null,
        image: fallbackPost.image || null,
      };
    }
    return null;
  }

  const modelsToTry = [preferredModel, ...CONFIG.fallbackModels.filter(m => m !== preferredModel)];
  
  for (const model of modelsToTry) {
    logger.debug(`Attempting generation with model: ${model}`);
    
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        const response = await axios.post(
          OPENROUTER_URL,
          {
            model: model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: prompt },
            ],
            max_tokens: CONFIG.maxTokens,
            temperature: CONFIG.temperature,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0.3,
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': BOT_URL,
              'X-Title': BOT_NAME,
            },
            timeout: CONFIG.timeout,
          }
        );

        const responseTime = Date.now() - startTime;
        trackApiUsage(model, responseTime, true);

        if (!response.data?.choices?.[0]?.message?.content) {
          logger.error(`Empty response from OpenRouter API (${model})`);
          trackApiUsage(model, responseTime, false);
          
          if (attempt < CONFIG.maxRetries) {
            const delay = getBackoffDelay(attempt);
            logger.warn(`Retrying with ${model} in ${delay}ms (attempt ${attempt}/${CONFIG.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          break;
        }

        let content = response.data.choices[0].message.content.trim();
        
        if (response.data.usage) {
          logger.debug(`Token usage - Prompt: ${response.data.usage.prompt_tokens}, Completion: ${response.data.usage.completion_tokens}, Model: ${model}`);
        }

        content = sanitizeContent(content);
        
        if (!validateContent(content)) {
          logger.warn(`Content validation failed for ${model}, attempt ${attempt}`);
          
          if (attempt < CONFIG.maxRetries) {
            const delay = getBackoffDelay(attempt);
            logger.warn(`Retrying with adjusted prompt in ${delay}ms`);
            prompt = prompt + ' (provide different specific details this time)';
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          break;
        }

        if (content.length > CONFIG.maxResponseLength) {
          logger.warn(`Generated content too long (${content.length} chars), truncating`);
          content = content.substring(0, CONFIG.maxResponseLength - 3) + '...';
        }

        logger.info(`✅ Content generated successfully with ${model} (${responseTime}ms, ${content.length} chars)`);
        logger.debug(`Generated content preview: ${content.substring(0, 100)}...`);
        
        return {
          content: content,
          source: 'api',
          model: model,
          responseTime: responseTime,
          image: null, // API generated content doesn't include images
        };

      } catch (error) {
        const responseTime = Date.now() - startTime;
        trackApiUsage(model, responseTime, false);
        
        apiStats.lastError = error.message;
        apiStats.lastErrorTime = new Date().toISOString();
        
        // Sanitize error messages to avoid leaking sensitive info
        const sanitizedError = error.message?.replace(/sk-[a-zA-Z0-9]{32,}/g, 'REDACTED') || error.message;
        
        if (error.code === 'ECONNABORTED') {
          logger.error(`Timeout error with ${model} (attempt ${attempt}/${CONFIG.maxRetries})`);
        } else if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 5;
          logger.warn(`Rate limited with ${model}. Retry after ${retryAfter}s`);
          if (attempt < CONFIG.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          logger.error(`🔑 Authentication error with ${model} - API key invalid or no credits`);
          break;
        } else if (error.response?.status === 402) {
          logger.error(`💰 Payment required - Account has insufficient funds`);
          break;
        } else if (error.response?.status >= 500) {
          logger.error(`Server error with ${model} (${error.response.status})`);
          if (attempt < CONFIG.maxRetries) {
            const delay = getBackoffDelay(attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          logger.error(`OpenRouter API error with ${model}:`, sanitizedError);
        }
        
        if (attempt === CONFIG.maxRetries) {
          logger.warn(`All retries exhausted for ${model}, ${modelsToTry.indexOf(model) < modelsToTry.length - 1 ? 'trying next model...' : 'all models failed'}`);
        }
      }
    }
  }

  // All models and retries exhausted - use fallback content
  if (CONFIG.useLocalFallback) {
    logger.info('🔄 All API attempts failed, switching to local fallback content');
    const fallbackPost = getFallbackPost(contentType);
    
    return {
      content: fallbackPost.content,
      source: 'fallback',
      postId: fallbackPost.id,
      type: fallbackPost.type,
      model: fallbackPost.model || null,
      image: fallbackPost.image || null,
    };
  }

  logger.error('All generation attempts failed and fallback is disabled.');
  return null;
}

/**
 * Simple content generation for quick tests
 * @param {string} prompt - The prompt
 * @returns {Promise<Object>}
 */
async function quickGenerate(prompt) {
  return generateContent(prompt, CONFIG.defaultModel);
}

/**
 * Generate content with specific style/tone
 * @param {string} prompt - Base prompt
 * @param {string} style - Content style ('excited', 'professional', 'casual', 'educational')
 * @returns {Promise<Object>}
 */
async function generateStyledContent(prompt, style = 'excited') {
  const stylePrompts = {
    excited: 'Write this in an energetic, enthusiastic tone with lots of emojis and exclamation points.',
    professional: 'Write this in a professional, authoritative tone suitable for industry news.',
    casual: 'Write this in a friendly, conversational tone as if talking to a friend.',
    educational: 'Write this in a clear, educational tone with interesting facts and explanations.',
  };

  const styledPrompt = `${prompt}\n\nStyle instruction: ${stylePrompts[style] || stylePrompts.excited}`;
  return generateContent(styledPrompt);
}

module.exports = {
  generateContent,
  quickGenerate,
  generateStyledContent,
  getApiStats,
  getFallbackPost,
  getRandomFallbackPosts,
  addFallbackPosts,
  getImageUrl,
  isValidImageUrl,
  SYSTEM_PROMPT,
  STATIC_BASE_URL,
};