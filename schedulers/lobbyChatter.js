// schedulers/lobbyChatter.js
const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');
const { getGuildConfig } = require('../utils/database');
const { defaultPersonas } = require('../utils/lobbyChatter');
const { getRandomItem } = require('../utils/helpers');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  schedule: process.env.LOBBY_CHATTER_SCHEDULE || '*/2 * * * *',
  minDelay: 30000,
  maxDelay: 120000,
  maxContextMessages: 50,
  maxRetries: 3,
};

// ============================================
// CONVERSATION TOPICS
// ============================================
const conversationTopics = [
  {
    category: 'ev_tech',
    topics: [
      'Blade Battery safety',
      'Fast charging speeds',
      'Battery range in winter',
      'Regenerative braking efficiency',
      'BYD e-Platform 3.0',
      'Cell-to-Body technology',
      'Heat pump efficiency',
      '800V architecture benefits',
    ],
    keywords: ['battery', 'charge', 'range', 'tech', 'platform', 'efficiency'],
  },
  {
    category: 'model_discussion',
    topics: [
      'Seal vs Tesla Model 3 comparison',
      'ATTO 3 interior design',
      'Dolphin affordability',
      'Han luxury features',
      'Seagull city driving',
      'Tang family space',
      'Yangwang performance',
    ],
    keywords: ['model', 'compare', 'design', 'price', 'features', 'space'],
  },
  {
    category: 'ownership',
    topics: [
      'Home charging setup',
      'Maintenance costs',
      'Insurance rates for EVs',
      'Road trip experiences',
      'Cold weather performance',
      'Software updates',
      'Community meetups',
    ],
    keywords: ['home', 'cost', 'insurance', 'trip', 'weather', 'update', 'community'],
  },
  {
    category: 'buying_advice',
    topics: [
      'EV tax credits 2026',
      'Financing vs leasing',
      'Trade-in values',
      'First-time EV buyer tips',
      'Charging infrastructure',
      'Total cost of ownership',
      'Best time to buy',
    ],
    keywords: ['tax', 'finance', 'lease', 'trade', 'buy', 'cost', 'infrastructure'],
  },
];

// ============================================
// CONVERSATION MEMORY
// ============================================
const conversationMemory = new Map();

function getGuildMemory(guildId) {
  if (!conversationMemory.has(guildId)) {
    conversationMemory.set(guildId, {
      messages: [],
      currentTopic: null,
      lastSpeaker: null,
      topicStartTime: null,
      messageCount: 0,
    });
  }
  return conversationMemory.get(guildId);
}

function updateGuildMemory(guildId, persona, message) {
  const memory = getGuildMemory(guildId);
  memory.messages.push({
    persona: persona.name,
    message: message,
    timestamp: Date.now(),
  });
  memory.lastSpeaker = persona.name;
  memory.messageCount++;
  
  if (memory.messages.length > CONFIG.maxContextMessages) {
    memory.messages = memory.messages.slice(-CONFIG.maxContextMessages);
  }
  
  if (memory.messageCount >= 8 + Math.floor(Math.random() * 5)) {
    memory.currentTopic = null;
    memory.messageCount = 0;
  }
}

// ============================================
// ENHANCED PERSONAS WITH REALISTIC NAMES & AVATARS
// Using UI Avatars API for consistent, working avatar URLs
// ============================================
const enhancedDefaultPersonas = [
  {
    name: 'Tesla2BYD',
    avatar: 'https://ui-avatars.com/api/?name=Tesla+2+BYD&background=00BFFF&color=fff&size=256&bold=true',
    role: 'EV Expert',
    personality: 'technical, helpful, detail-oriented',
    interests: ['battery tech', 'charging speeds', 'efficiency'],
  },
  {
    name: 'Seal_Driver',
    avatar: 'https://ui-avatars.com/api/?name=Seal+Driver&background=0066CC&color=fff&size=256&bold=true',
    role: 'Seal Owner',
    personality: 'enthusiastic, sporty, proud owner',
    interests: ['performance', 'design', 'driving experience'],
  },
  {
    name: 'EcoMom',
    avatar: 'https://ui-avatars.com/api/?name=Eco+Mom&background=FF69B4&color=fff&size=256&bold=true',
    role: 'Family Driver',
    personality: 'practical, safety-conscious, budget-aware',
    interests: ['safety', 'space', 'affordability', 'family'],
  },
  {
    name: 'VoltGeek',
    avatar: 'https://ui-avatars.com/api/?name=Volt+Geek&background=9B59B6&color=fff&size=256&bold=true',
    role: 'Tech Reviewer',
    personality: 'analytical, curious, compares specs',
    interests: ['specifications', 'comparisons', 'software', 'gadgets'],
  },
  {
    name: 'CityEV',
    avatar: 'https://ui-avatars.com/api/?name=City+EV&background=2ECC71&color=fff&size=256&bold=true',
    role: 'City Driver',
    personality: 'practical, cost-conscious, efficient',
    interests: ['charging costs', 'parking', 'city range', 'compact cars'],
  },
  {
    name: 'RoadTripper',
    avatar: 'https://ui-avatars.com/api/?name=Road+Tripper&background=E67E22&color=fff&size=256&bold=true',
    role: 'Long Distance Driver',
    personality: 'adventurous, experienced, storyteller',
    interests: ['road trips', 'charging networks', 'comfort', 'range'],
  },
  {
    name: 'New2EV',
    avatar: 'https://ui-avatars.com/api/?name=New+2+EV&background=1ABC9C&color=fff&size=256&bold=true',
    role: 'First Time Buyer',
    personality: 'curious, slightly anxious, asks questions',
    interests: ['buying guide', 'incentives', 'charging basics', 'cost'],
  },
  {
    name: 'FleetBoss',
    avatar: 'https://ui-avatars.com/api/?name=Fleet+Boss&background=34495E&color=fff&size=256&bold=true',
    role: 'Commercial Buyer',
    personality: 'business-minded, ROI-focused, practical',
    interests: ['fleet', 'commercial', 'tax benefits', 'durability'],
  },
  {
    name: 'Gearhead_Al',
    avatar: 'https://ui-avatars.com/api/?name=Gearhead+Al&background=C0392B&color=fff&size=256&bold=true',
    role: 'Car Enthusiast',
    personality: 'hands-on, skeptical but curious, detailed',
    interests: ['maintenance', 'modifications', 'DIY', 'build quality'],
  },
];

// Alternative: Use DiceBear Avatars for more variety
const dicebearPersonas = [
  {
    name: 'BladeBatt',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=BladeBatt&backgroundColor=00BFFF',
    role: 'EV Expert',
    personality: 'technical, helpful, detail-oriented',
    interests: ['battery tech', 'charging speeds', 'efficiency'],
  },
  {
    name: 'Seal_Main',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SealMain&backgroundColor=0066CC',
    role: 'Seal Owner',
    personality: 'enthusiastic, sporty, proud owner',
    interests: ['performance', 'design', 'driving experience'],
  },
  {
    name: 'GreenMomma',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GreenMomma&backgroundColor=FF69B4',
    role: 'Family Driver',
    personality: 'practical, safety-conscious, budget-aware',
    interests: ['safety', 'space', 'affordability', 'family'],
  },
  {
    name: 'WattWizard',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=WattWizard&backgroundColor=9B59B6',
    role: 'Tech Reviewer',
    personality: 'analytical, curious, compares specs',
    interests: ['specifications', 'comparisons', 'software', 'gadgets'],
  },
  {
    name: 'Urban_EV',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=UrbanEV&backgroundColor=2ECC71',
    role: 'City Driver',
    personality: 'practical, cost-conscious, efficient',
    interests: ['charging costs', 'parking', 'city range', 'compact cars'],
  },
  {
    name: 'HighwayHawk',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=HighwayHawk&backgroundColor=E67E22',
    role: 'Long Distance Driver',
    personality: 'adventurous, experienced, storyteller',
    interests: ['road trips', 'charging networks', 'comfort', 'range'],
  },
  {
    name: 'EV_Newbie',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=EVNewbie&backgroundColor=1ABC9C',
    role: 'First Time Buyer',
    personality: 'curious, slightly anxious, asks questions',
    interests: ['buying guide', 'incentives', 'charging basics', 'cost'],
  },
  {
    name: 'FleetKing',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=FleetKing&backgroundColor=34495E',
    role: 'Commercial Buyer',
    personality: 'business-minded, ROI-focused, practical',
    interests: ['fleet', 'commercial', 'tax benefits', 'durability'],
  },
  {
    name: 'WrenchIt',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=WrenchIt&backgroundColor=C0392B',
    role: 'Car Enthusiast',
    personality: 'hands-on, skeptical but curious, detailed',
    interests: ['maintenance', 'modifications', 'DIY', 'build quality'],
  },
];

// Choose which persona set to use
const activePersonas = process.env.LOBBY_AVATAR_STYLE === 'dicebear' ? dicebearPersonas : enhancedDefaultPersonas;

// ============================================
// WEBHOOK MANAGEMENT
// ============================================
const webhookClients = new Map();

async function getWebhookClient(webhookUrl) {
  if (webhookClients.has(webhookUrl)) return webhookClients.get(webhookUrl);
  
  const match = webhookUrl.match(/\/webhooks\/(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid webhook URL');
  
  const [, id, token] = match;
  const client = { id, token, url: webhookUrl };
  webhookClients.set(webhookUrl, client);
  return client;
}

async function sendAsPersona(webhookClient, persona, message, retryCount = 0) {
  try {
    await axios.post(webhookClient.url, {
      username: persona.name,
      avatar_url: persona.avatar,
      content: message,
    });
    logger.debug(`💬 ${persona.name}: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
    return true;
  } catch (err) {
    if (retryCount < CONFIG.maxRetries) {
      logger.warn(`Webhook send failed, retrying (${retryCount + 1}/${CONFIG.maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return sendAsPersona(webhookClient, persona, message, retryCount + 1);
    }
    logger.error(`Failed to send webhook message after ${CONFIG.maxRetries} retries:`, err.message);
    return false;
  }
}

// ============================================
// MESSAGE GENERATION
// ============================================

function generateChatTurn(persona, guildMemory, config) {
  const personas = config?.lobby_chatter_personas || activePersonas;
  const currentTopic = guildMemory.currentTopic;
  const lastMessages = guildMemory.messages.slice(-5);
  
  if (!currentTopic) {
    const topicCategory = getRandomItem(conversationTopics);
    const topic = getRandomItem(topicCategory.topics);
    guildMemory.currentTopic = {
      category: topicCategory.category,
      topic: topic,
      keywords: topicCategory.keywords,
    };
    guildMemory.topicStartTime = Date.now();
    guildMemory.messageCount = 0;
  }
  
  return generateThemedMessage(persona, guildMemory.currentTopic, lastMessages);
}

function generateThemedMessage(persona, topic, lastMessages) {
  const topicMessages = {
    'ev_tech': {
      'EV Expert': [
        `The Blade Battery's LFP chemistry is revolutionary. Anyone know the max charge cycles? 🔋`,
        `Just read about BYD's new 800V platform. Charging speeds are going to be insane! ⚡`,
        `The heat pump in newer BYDs can extend winter range by up to 20%. Game changer for cold climates! ❄️`,
        `LFP batteries don't use cobalt at all. More ethical AND cheaper to produce. Win-win 🌍`,
        `Anyone else nerding out over the CTB tech in the Seal? Structural battery packs are the future 🏗️`,
      ],
      'Tech Reviewer': [
        `Comparing specs: BYD's energy density is now competitive with NMC batteries, but way safer. 📊`,
        `The CTB (Cell-to-Body) tech in the Seal is fascinating - it increases structural rigidity by 40%! 🏗️`,
        `Anyone else impressed by BYD's vertical integration? They make their own batteries AND chips! 🤯`,
        `Just benchmarked the Seal's infotainment. The Snapdragon chip is snappy! No lag at all 💻`,
      ],
      'Car Enthusiast': [
        `The regen braking on my ATTO 3 is so smooth. One-pedal driving ftw! 🦶`,
        `Anyone know the exact kWh capacity of the Blade Battery pack? Trying to calculate efficiency 📐`,
        `Just checked my battery health after 30k miles. Still at 98%! Blade Battery is no joke 📊`,
      ],
    },
    'model_discussion': {
      'Seal Owner': [
        `The Seal's 0-100 in 3.8s never gets old! Best purchase ever 🏎️`,
        `Just took my Seal on a 500km trip. Used only 65% battery. Range anxiety? What's that? 😎`,
        `The Seal's drag coefficient is 0.219 - more aerodynamic than a Porsche Taycan! 🎯`,
        `That Ocean X design language hits different at night. The LED light bar is 🔥`,
      ],
      'Family Driver': [
        `We fit 3 car seats in the ATTO 3. So much space for a compact SUV! 👨‍👩‍👧‍👦`,
        `Safety rating on BYDs is no joke - 5 stars across the board. Peace of mind for the family ⭐`,
        `The Dolphin's price point is perfect for a second family car. Thinking of getting one... 🤔`,
        `Kids love the rotating screen in our Tang. Keeps them entertained on long drives! 📱`,
      ],
      'City Driver': [
        `The Seagull is perfect for city parking. Fits in spots my old SUV couldn't dream of 🅿️`,
        `Dolphin hatchback is so practical. Fold the seats down and it's basically a mini van! 🚗`,
      ],
    },
    'ownership': {
      'City Driver': [
        `Home charging costs me about $30/month vs $200+ for gas. The savings are real! 💰`,
        `Anyone installed a Level 2 charger at home? Looking for recommendations 🔌`,
        `Parking assist in the ATTO 3 is a lifesaver in tight city spots! 🅿️`,
        `No more gas stations! Charging at home while I sleep is the dream 😴⚡`,
      ],
      'Long Distance Driver': [
        `Drove coast to coast in my BYD. Charging infrastructure has improved so much! 🗺️`,
        `Pro tip: Use ABRP app for route planning. Takes the stress out of long trips 📱`,
        `Best road trip car ever. The seats are so comfortable for long drives! 🛣️`,
        `Did 800km in a day. Only stopped twice to charge. This is the future of road trips! ⚡`,
      ],
      'Seal Owner': [
        `Just hit 20k miles. Zero issues. Maintenance costs? Basically just tire rotations 😂`,
        `The over-the-air updates are clutch. Got new features without visiting the dealer 📡`,
      ],
    },
    'buying_advice': {
      'First Time Buyer': [
        `The $7,500 federal credit made my Seal almost $10k cheaper than a Model 3! 💸`,
        `Was nervous about switching to EV, but BYD made it so easy. No regrets! ✨`,
        `Any tips for a first-time EV buyer? Test driving the Dolphin this weekend! 🐬`,
        `Dealer gave me a free home charger install. Ask about it when you buy! 🎁`,
      ],
      'Commercial Buyer': [
        `Our delivery fleet switched to BYD vans. 60% reduction in fuel costs! 📊`,
        `The tax benefits for commercial EVs this year are incredible. Talk to your accountant! 💼`,
        `BYD's commercial warranty is one of the best in the industry. 8 years/500,000km! 🚛`,
        `ROI on our fleet conversion hit in just 18 months. The numbers don't lie 💯`,
      ],
      'Tech Reviewer': [
        `Leasing vs buying: With BYD's residuals, buying actually makes more sense rn 📈`,
        `If you're on the fence, just test drive one. The instant torque will sell you ⚡`,
      ],
    },
  };

  const categoryMessages = topicMessages[topic.category] || {};
  let personaMessages = categoryMessages[persona.role] || [];
  
  if (personaMessages.length === 0) {
    personaMessages = [
      `Really interested in learning more about ${topic.topic.toLowerCase()}. Anyone have experience? 🤔`,
      `${topic.topic} is such an important topic for EV adoption. Thoughts? 💭`,
      `Just read an article about ${topic.topic.toLowerCase()}. BYD is really leading here! 📰`,
      `Can we talk about ${topic.topic.toLowerCase()}? I have questions! 🙋‍♂️`,
    ];
  }
  
  const filteredMessages = personaMessages.filter(msg => {
    const lastFromPersona = lastMessages.find(m => m.persona === persona.name);
    return !lastFromPersona || msg !== lastFromPersona.message;
  });
  
  return getRandomItem(filteredMessages.length > 0 ? filteredMessages : personaMessages);
}

// ============================================
// MAIN LOBBY CHATTER FUNCTION
// ============================================

async function runLobbyChatter(client) {
  const guilds = client.guilds.cache;
  let messagesSent = 0;
  
  for (const guild of guilds.values()) {
    try {
      const config = await getGuildConfig(guild.id);
      
      if (!config?.lobby_chatter_enabled || !config?.lobby_webhook_url) {
        continue;
      }
      
      let personas = config.lobby_chatter_personas || activePersonas;
      if (typeof personas === 'string') {
        try {
          personas = JSON.parse(personas);
        } catch {
          personas = activePersonas;
        }
      }
      if (!personas?.length) personas = activePersonas;
      
      const guildMemory = getGuildMemory(guild.id);
      
      let persona;
      const availablePersonas = personas.filter(p => p.name !== guildMemory.lastSpeaker);
      persona = getRandomItem(availablePersonas.length > 0 ? availablePersonas : personas);
      
      const message = generateChatTurn(persona, guildMemory, config);
      
      const webhook = await getWebhookClient(config.lobby_webhook_url);
      const success = await sendAsPersona(webhook, persona, message);
      
      if (success) {
        updateGuildMemory(guild.id, persona, message);
        messagesSent++;
      }
      
      const delay = Math.random() * (CONFIG.maxDelay - CONFIG.minDelay) + CONFIG.minDelay;
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (err) {
      logger.error(`Lobby chatter failed for guild ${guild.id}:`, err.message);
    }
  }
  
  if (messagesSent > 0) {
    logger.info(`💬 Lobby chatter: ${messagesSent} messages sent across ${guilds.size} guilds`);
  }
}

// ============================================
// SCHEDULER STARTUP
// ============================================

function startLobbyChatterScheduler(client) {
  let enabledGuilds = 0;
  client.guilds.cache.forEach(async (guild) => {
    try {
      const config = await getGuildConfig(guild.id);
      if (config?.lobby_chatter_enabled && config?.lobby_webhook_url) {
        enabledGuilds++;
      }
    } catch {}
  });
  
  setTimeout(() => {
    if (enabledGuilds === 0) {
      logger.warn('⚠️ No guilds have lobby chatter enabled. Scheduler will run but do nothing.');
    }
  }, 5000);
  
  cron.schedule(CONFIG.schedule, async () => {
    logger.debug('💬 Lobby chatter: starting round...');
    await runLobbyChatter(client);
  });
  
  logger.ready(`💬 Lobby chatter scheduler started (${CONFIG.schedule})`);
  logger.info(`👥 Personas loaded: ${activePersonas.map(p => p.name).join(', ')}`);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getLobbyStats(guildId) {
  const memory = getGuildMemory(guildId);
  return {
    totalMessages: memory.messages.length,
    currentTopic: memory.currentTopic?.topic || 'None',
    lastSpeaker: memory.lastSpeaker || 'None',
    topicAge: memory.topicStartTime 
      ? Math.floor((Date.now() - memory.topicStartTime) / 1000) 
      : 0,
  };
}

function resetLobbyMemory(guildId) {
  conversationMemory.delete(guildId);
  logger.info(`Lobby memory reset for guild ${guildId}`);
}

function setLobbyTopic(guildId, category, topic) {
  const memory = getGuildMemory(guildId);
  const topicCategory = conversationTopics.find(t => t.category === category);
  if (topicCategory) {
    memory.currentTopic = {
      category: category,
      topic: topic || getRandomItem(topicCategory.topics),
      keywords: topicCategory.keywords,
    };
    memory.topicStartTime = Date.now();
    memory.messageCount = 0;
    logger.info(`Lobby topic set for guild ${guildId}: ${memory.currentTopic.topic}`);
  }
}

module.exports = { 
  startLobbyChatterScheduler,
  getLobbyStats,
  resetLobbyMemory,
  setLobbyTopic,
  activePersonas,
};