// schedulers/lobbyChatter.js
const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');
const { getGuildConfig } = require('../utils/database');
const { getRandomItem, getRandomItems, weightedRandom } = require('../utils/helpers');

// ============================================
// INTELLIGENT CONFIGURATION
// ============================================
const CONFIG = {
  schedule: process.env.LOBBY_CHATTER_SCHEDULE || '*/4 * * * *',
  minDelay: 45000,
  maxDelay: 420000,
  activeHoursStart: 8,
  activeHoursEnd: 23,
  peakHoursStart: 19,
  peakHoursEnd: 22,
  weekendMultiplier: 1.3,
  maxContextMessages: 200,
  maxRetries: 3,
  welcomeDelay: 5000,
  typingDelayRange: { min: 1500, max: 5000 },
  conversationCooldown: 300000,
  learningRate: 0.1,
};

// ============================================
// SENTIMENT & MOOD SYSTEM
// ============================================
const moods = {
  excited: { emoji: '🎉', weight: 0.15, triggers: ['new', 'love', 'amazing', 'incredible'] },
  curious: { emoji: '🤔', weight: 0.25, triggers: ['how', 'what', 'why', 'which'] },
  helpful: { emoji: '💡', weight: 0.25, triggers: ['help', 'advice', 'tip', 'recommend'] },
  passionate: { emoji: '🔥', weight: 0.15, triggers: ['best', 'awesome', 'love', 'favorite'] },
  casual: { emoji: '😎', weight: 0.20, triggers: ['cool', 'nice', 'yeah', 'ok'] },
};

// ============================================
// ADVANCED TIME-AWARE CONTEXT
// ============================================
const timeContexts = {
  morning: {
    hourRange: [5, 12],
    emoji: '🌅',
    greetings: ['Good morning', 'Rise and shine', 'Morning everyone'],
    topics: ['morning commute', 'breakfast charging', 'day ahead planning'],
  },
  afternoon: {
    hourRange: [12, 17],
    emoji: '☀️',
    greetings: ['Good afternoon', 'Hey everyone', 'Afternoon crew'],
    topics: ['lunch break charging', 'midday thoughts', 'afternoon productivity'],
  },
  evening: {
    hourRange: [17, 21],
    emoji: '🌙',
    greetings: ['Good evening', 'Evening everyone', 'Sunset squad'],
    topics: ['evening charging', 'day recap', 'night driving tips'],
  },
  night: {
    hourRange: [21, 24],
    emoji: '🌃',
    greetings: ['Late night crew', 'Night owls', 'Quiet hours'],
    topics: ['night charging rates', 'late night research', 'EV dreams'],
  },
};

// ============================================
// ENHANCED PERSONAS WITH PSYCHOLOGICAL PROFILES
// ============================================
const activePersonas = [
  { 
    name: 'Tesla2BYD', 
    avatar: 'https://ui-avatars.com/api/?name=Tesla+2+BYD&background=00BFFF&color=fff&size=256&bold=true',
    role: 'EV Expert',
    traits: { openness: 0.9, agreeableness: 0.6, neuroticism: 0.2 },
    expertise: 'technical',
    speakingStyle: 'analytical',
    catchphrases: ['the data shows', 'statistically speaking', 'research indicates'],
    activeHours: 'all',
    responseStyle: 'thoughtful',
  },
  { 
    name: 'Seal_Driver', 
    avatar: 'https://ui-avatars.com/api/?name=Seal+Driver&background=0066CC&color=fff&size=256&bold=true',
    role: 'Seal Owner',
    traits: { openness: 0.7, agreeableness: 0.8, neuroticism: 0.3 },
    expertise: 'owner',
    speakingStyle: 'passionate',
    catchphrases: ['I love my', 'best decision', 'never going back'],
    activeHours: 'evening',
    responseStyle: 'emotional',
  },
  { 
    name: 'EcoMom', 
    avatar: 'https://ui-avatars.com/api/?name=Eco+Mom&background=FF69B4&color=fff&size=256&bold=true',
    role: 'Family Driver',
    traits: { openness: 0.6, agreeableness: 0.9, neuroticism: 0.4 },
    expertise: 'family',
    speakingStyle: 'practical',
    catchphrases: ['for the kids', 'safety first', 'peace of mind'],
    activeHours: 'afternoon',
    responseStyle: 'caring',
  },
  { 
    name: 'VoltGeek', 
    avatar: 'https://ui-avatars.com/api/?name=Volt+Geek&background=9B59B6&color=fff&size=256&bold=true',
    role: 'Tech Reviewer',
    traits: { openness: 0.95, agreeableness: 0.5, neuroticism: 0.1 },
    expertise: 'technical',
    speakingStyle: 'analytical',
    catchphrases: ['benchmarked', 'efficiency metrics', 'specs show'],
    activeHours: 'night',
    responseStyle: 'detailed',
  },
  { 
    name: 'CityEV', 
    avatar: 'https://ui-avatars.com/api/?name=City+EV&background=2ECC71&color=fff&size=256&bold=true',
    role: 'City Driver',
    traits: { openness: 0.6, agreeableness: 0.7, neuroticism: 0.3 },
    expertise: 'urban',
    speakingStyle: 'casual',
    catchphrases: ['downtown', 'parking is', 'city driving'],
    activeHours: 'day',
    responseStyle: 'concise',
  },
  { 
    name: 'RoadTripper', 
    avatar: 'https://ui-avatars.com/api/?name=Road+Tripper&background=E67E22&color=fff&size=256&bold=true',
    role: 'Long Distance Driver',
    traits: { openness: 0.8, agreeableness: 0.7, neuroticism: 0.2 },
    expertise: 'touring',
    speakingStyle: 'adventurous',
    catchphrases: ['road trip', 'cross country', 'destination charging'],
    activeHours: 'weekend',
    responseStyle: 'enthusiastic',
  },
  { 
    name: 'EV_Philosopher',
    avatar: 'https://ui-avatars.com/api/?name=EV+Philosopher&background=8E44AD&color=fff&size=256&bold=true',
    role: 'EV Philosopher',
    traits: { openness: 0.9, agreeableness: 0.7, neuroticism: 0.1 },
    expertise: 'big picture',
    speakingStyle: 'thoughtful',
    catchphrases: ['the future is', 'we\'re witnessing', 'this changes everything'],
    activeHours: 'night',
    responseStyle: 'philosophical',
  },
];

// ============================================
// INTELLIGENT TOPIC DATABASE WITH WEIGHTS
// ============================================
const conversationTopics = [
  { category: 'ev_tech', weight: 1.2, topics: [
    'Blade Battery safety innovations',
    '800V architecture advantages',
    'Battery thermal management systems',
    'Regenerative braking efficiency',
    'V2L / V2G technology potential',
  ]},
  { category: 'model_discussion', weight: 1.5, topics: [
    'Seal Performance vs Model 3',
    'ATTO 3 interior quality',
    'Dolphin city driving experience',
    'Han luxury features value',
    'Yangwang U8 off-road capability',
  ]},
  { category: 'ownership', weight: 1.3, topics: [
    'Home charging installation tips',
    'Long-term maintenance costs',
    'Winter range optimization',
    'Software update experiences',
    'Road trip charging strategies',
  ]},
  { category: 'buying_advice', weight: 1.4, topics: [
    'EV tax credit qualification 2026',
    'Financing vs leasing analysis',
    'Trade-in negotiation tips',
    'First-time EV owner checklist',
    'Total cost of ownership breakdown',
  ]},
  { category: 'industry', weight: 1.0, topics: [
    'BYD vs Tesla market dynamics',
    'Charging network expansion',
    'New battery technologies',
    'Government policy impacts',
    'Global EV adoption trends',
  ]},
];

// ============================================
// INTELLIGENT CONVERSATION MEMORY
// ============================================
const conversationMemory = new Map();
const learningData = new Map(); // For adaptive learning

function getGuildMemory(guildId) {
  if (!conversationMemory.has(guildId)) {
    conversationMemory.set(guildId, { 
      messages: [],
      topicsDiscussed: new Map(),
      participantProfiles: new Map(),
      currentTopic: null,
      lastSpeaker: null,
      lastMessageType: null,
      conversationPhase: 'opening',
      activeParticipants: new Set(),
      conversationHeat: 0,
      lastActivityTime: Date.now(),
      successfulTopics: new Map(),
      mood: 'casual',
    });
  }
  return conversationMemory.get(guildId);
}

function updateConversationLearning(guildId, topic, wasEngaging) {
  const data = learningData.get(guildId) || new Map();
  const current = data.get(topic) || { count: 0, engagement: 0 };
  current.count++;
  if (wasEngaging) current.engagement++;
  data.set(topic, current);
  learningData.set(guildId, data);
}

function getTopicWeight(guildId, topic) {
  const data = learningData.get(guildId);
  if (!data) return 1.0;
  const stats = data.get(topic);
  if (!stats || stats.count < 3) return 1.0;
  const engagementRate = stats.engagement / stats.count;
  return 0.5 + engagementRate;
}

// ============================================
// CONTEXTUAL RESPONSE GENERATION ENGINE
// ============================================

function analyzeConversationMood(messages) {
  const recentMessages = messages.slice(-5);
  let excitementScore = 0;
  let questionScore = 0;
  
  for (const msg of recentMessages) {
    if (msg.message.includes('!')) excitementScore += 0.2;
    if (msg.message.includes('?')) questionScore += 0.3;
    if (msg.message.includes('🔥') || msg.message.includes('🎉')) excitementScore += 0.3;
  }
  
  if (excitementScore > 0.6) return 'excited';
  if (questionScore > 0.8) return 'curious';
  if (excitementScore < 0.2 && questionScore < 0.3) return 'casual';
  return 'balanced';
}

function getCurrentTimeContext() {
  const hour = new Date().getHours();
  for (const [key, context] of Object.entries(timeContexts)) {
    if (hour >= context.hourRange[0] && hour < context.hourRange[1]) {
      return { ...context, key };
    }
  }
  return timeContexts.evening;
}

function generateIntelligentResponse(persona, topic, phase, messageType, memory, timeContext, mood) {
  const topicName = topic?.topic || 'electric vehicles';
  const lastMessages = memory.messages.slice(-5);
  const timeGreeting = getRandomItem(timeContext.greetings);
  const isWeekend = [0, 6].includes(new Date().getDay());
  
  // Dynamic response templates based on phase and mood
  const responseTemplates = {
    opening: {
      excited: [`${timeGreeting}! ⚡ So hyped about ${topicName}! Anyone else? 🎉`],
      curious: [`${timeGreeting}! 👋 Quick question - what's everyone's take on ${topicName}? 🤔`],
      casual: [`${timeGreeting} everyone! 🌟 ${topicName} crossed my mind today. Thoughts?`],
    },
    discussion: {
      excited: [`This ${topicName} discussion is 🔥! ${persona.catchphrases[0]} ${getRandomItem(['mind-blowing', 'game-changing', 'incredible'])}!`],
      curious: [`Building on that ${topicName} point - has anyone considered ${getRandomItem(['the long-term', 'the cost perspective', 'the environmental impact'])}?`],
      helpful: [`Great ${topicName} insights! To add ${getRandomItem(['a tip', 'some data', 'my experience'])}...`],
    },
    deep_dive: {
      analytical: [`Let me dive deeper into ${topicName}. ${getRandomItem(['The key factor is', 'What\'s interesting is', 'Research shows'])}...`],
      passionate: [`I could talk about ${topicName} all day! ${persona.catchphrases[1]} ${getRandomItem(['by a mile', 'without question', 'any day of the week'])}!`],
    },
    wrapping: {
      thoughtful: [`This ${topicName} conversation has been ${getRandomItem(['illuminating', 'thought-provoking', 'genuinely helpful'])}. Thanks everyone! 🙏`],
      casual: [`Great chat about ${topicName}! Catch you all ${getRandomItem(['later', 'tomorrow', 'next time'])}! 👋`],
    },
    reaction: {
      agree: [`${getRandomItem(['💯', 'Exactly!', 'This!', 'Couldn\'t agree more', '🎯'])}`],
      thoughtful: [`${getRandomItem(['Hmm', 'Interesting point', 'Never thought of that', 'Good perspective'])} 🤔`],
    },
  };
  
  // Select appropriate template based on context
  const phaseKey = phase === 'heated' ? 'discussion' : phase;
  const moodKey = mood === 'balanced' ? (persona.speakingStyle === 'analytical' ? 'analytical' : mood) : mood;
  
  let templates = responseTemplates[phaseKey] || responseTemplates.discussion;
  let templateSet = templates[moodKey] || templates.casual || templates;
  
  let message = getRandomItem(templateSet);
  
  // Add personality flair
  if (Math.random() < 0.3 && persona.catchphrases) {
    message = message.replace(persona.catchphrases[0], getRandomItem(persona.catchphrases));
  }
  
  // Add time context emoji
  if (Math.random() < 0.2) {
    message = `${timeContext.emoji} ${message}`;
  }
  
  // Add weekend vibe
  if (isWeekend && Math.random() < 0.15) {
    message = `🏖️ ${message}`;
  }
  
  return message;
}

// ============================================
// INTELLIGENT TOPIC SELECTION
// ============================================
function selectIntelligentTopic(memory, guildId) {
  // Weighted selection based on past engagement
  const availableTopics = [...conversationTopics];
  const weights = availableTopics.map(topic => {
    const topicWeight = getTopicWeight(guildId, topic.category);
    return topic.weight * topicWeight;
  });
  
  const selectedCategory = weightedRandom(
    availableTopics.map((t, i) => ({ ...t, weight: weights[i] })),
    'weight'
  );
  
  const selectedTopic = getRandomItem(selectedCategory.topics);
  return { category: selectedCategory.category, topic: selectedTopic };
}

// ============================================
// CONTEXT-AWARE MESSAGE TYPE SELECTION
// ============================================
const messageTypeWeights = {
  opening: { question: 0.4, greeting: 0.3, fact: 0.2, icebreaker: 0.1 },
  discussion: { question: 0.3, answer: 0.2, opinion: 0.2, reaction: 0.15, insight: 0.1, comparison: 0.05 },
  deep_dive: { analysis: 0.35, technical: 0.25, insight: 0.2, data_share: 0.2 },
  heated: { debate: 0.4, opinion: 0.3, reaction: 0.2, fact: 0.1 },
  wrapping: { summary: 0.4, closing: 0.3, testimonial: 0.2, reaction: 0.1 },
};

function getIntelligentMessageType(phase, lastType) {
  const weights = messageTypeWeights[phase] || messageTypeWeights.discussion;
  const types = Object.entries(weights);
  
  // Reduce chance of repeating the same type
  const filtered = types.filter(([type]) => type !== lastType);
  const totalWeight = filtered.reduce((sum, [, weight]) => sum + weight, 0);
  
  let random = Math.random() * totalWeight;
  for (const [type, weight] of filtered) {
    random -= weight;
    if (random <= 0) return type;
  }
  return filtered[0]?.[0] || 'reaction';
}

// ============================================
// WEBHOOK MANAGEMENT
// ============================================
const webhookClients = new Map();

async function getWebhookClient(url) {
  if (webhookClients.has(url)) return webhookClients.get(url);
  const match = url.match(/\/webhooks\/(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid webhook URL');
  const client = { id: match[1], token: match[2], url };
  webhookClients.set(url, client);
  return client;
}

async function sendAsPersona(wc, persona, message, retry = 0) {
  const typingDelay = Math.random() * (CONFIG.typingDelayRange.max - CONFIG.typingDelayRange.min) + CONFIG.typingDelayRange.min;
  await new Promise(r => setTimeout(r, typingDelay));
  
  try {
    await axios.post(wc.url, { username: persona.name, avatar_url: persona.avatar, content: message });
    logger.debug(`💬 ${persona.name}: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
    return true;
  } catch (err) {
    if (retry < CONFIG.maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
      return sendAsPersona(wc, persona, message, retry + 1);
    }
    logger.error(`Webhook failed:`, err.message);
    return false;
  }
}

// ============================================
// WELCOME MESSAGES
// ============================================
const welcomeMessages = {
  personalized: [
    "Hey {{user}}! 👋 Welcome to the BYD family! What brings you here today?",
    "Welcome {{user}}! 🚗⚡ Another EV enthusiast joins the conversation! Tell us about yourself!",
    "Hey {{user}}! 🎉 So glad you found us! Are you team Seal, ATTO, or Dolphin?",
    "Welcome aboard {{user}}! 🌟 Have any questions about going electric? We're here to help!",
  ],
};

function getIntelligentWelcomeMessage(member) {
  const base = getRandomItem(welcomeMessages.personalized);
  return base.replace('{{user}}', member.displayName);
}

// ============================================
// WELCOME MESSAGE FOR NEW MEMBERS
// ============================================
async function sendWelcomeMessage(guild, member, config) {
  if (!config?.lobby_webhook_url) return false;
  
  try {
    await new Promise(r => setTimeout(r, CONFIG.welcomeDelay));
    
    const welcomeMessage = getIntelligentWelcomeMessage(member);
    const persona = getRandomItem(activePersonas.filter(p => p.activeHours === 'all' || p.activeHours === getCurrentTimeContext().key));
    const wc = await getWebhookClient(config.lobby_webhook_url);
    const success = await sendAsPersona(wc, persona, welcomeMessage);
    
    if (success) logger.info(`👋 Intelligent welcome sent to ${member.user.tag}`);
    return success;
  } catch (err) {
    logger.error(`Failed to send welcome: ${err.message}`);
    return false;
  }
}

// ============================================
// MAIN INTELLIGENT LOBBY CHATTER
// ============================================
async function runLobbyChatter(client) {
  const hour = new Date().getHours();
  if (hour < CONFIG.activeHoursStart || hour >= CONFIG.activeHoursEnd) return;
  
  const guilds = client.guilds.cache;
  let sent = 0;
  
  for (const guild of guilds.values()) {
    try {
      const config = await getGuildConfig(guild.id);
      if (!config?.lobby_chatter_enabled || !config?.lobby_webhook_url) continue;
      
      let personas = config.lobby_chatter_personas || activePersonas;
      if (typeof personas === 'string') { 
        try { personas = JSON.parse(personas); } 
        catch { personas = activePersonas; } 
      }
      if (!personas?.length) personas = activePersonas;
      
      const mem = getGuildMemory(guild.id);
      const timeContext = getCurrentTimeContext();
      const mood = analyzeConversationMood(mem.messages);
      const isStale = (Date.now() - mem.lastActivityTime) > 3600000;
      
      if (isStale || !mem.currentTopic) {
        mem.currentTopic = selectIntelligentTopic(mem, guild.id);
        mem.conversationPhase = 'opening';
        mem.messageCount = 0;
      }
      
      // Smart persona selection
      let avail = personas.filter(p => p.name !== mem.lastSpeaker);
      if (timeContext.key !== 'all') {
        avail = avail.filter(p => p.activeHours === 'all' || p.activeHours === timeContext.key);
      }
      if (avail.length === 0) avail = personas;
      const persona = getRandomItem(avail);
      
      const msgType = getIntelligentMessageType(mem.conversationPhase, mem.lastMessageType);
      const message = generateIntelligentResponse(persona, mem.currentTopic, mem.conversationPhase, msgType, mem, timeContext, mood);
      
      const wc = await getWebhookClient(config.lobby_webhook_url);
      const success = await sendAsPersona(wc, persona, message);
      
      if (success) {
        mem.messages.push({ persona: persona.name, message, type: msgType, timestamp: Date.now() });
        mem.lastSpeaker = persona.name;
        mem.lastMessageType = msgType;
        mem.messageCount++;
        mem.lastActivityTime = Date.now();
        mem.activeParticipants.add(persona.name);
        mem.conversationHeat = Math.min(100, mem.conversationHeat + 5);
        
        // Update conversation phase
        if (mem.messageCount >= 12) mem.conversationPhase = 'wrapping';
        else if (mem.messageCount >= 6) mem.conversationPhase = 'deep_dive';
        else if (mem.messageCount >= 3) mem.conversationPhase = 'discussion';
        
        // Trim memory
        if (mem.messages.length > CONFIG.maxContextMessages) {
          mem.messages = mem.messages.slice(-CONFIG.maxContextMessages);
        }
        
        sent++;
      }
      
      // Natural delay between messages
      const isPeak = hour >= CONFIG.peakHoursStart && hour < CONFIG.peakHoursEnd;
      const isWeekend = [0, 6].includes(new Date().getDay());
      let delay = Math.random() * (CONFIG.maxDelay - CONFIG.minDelay) + CONFIG.minDelay;
      if (isPeak) delay *= 0.6;
      if (isWeekend) delay *= 1.3;
      await new Promise(r => setTimeout(r, Math.min(delay, 600000)));
      
    } catch (err) { 
      logger.error(`Lobby failed: ${err.message}`); 
    }
  }
  
  if (sent > 0) logger.info(`💬 Lobby: ${sent} intelligent messages sent`);
}

// ============================================
// SCHEDULER
// ============================================
let schedulerRunning = false;

function startLobbyChatterScheduler(client) {
  if (schedulerRunning) return;
  schedulerRunning = true;
  
  cron.schedule(CONFIG.schedule, async () => { 
    await runLobbyChatter(client); 
  });
  
  logger.ready(`🧠 Intelligent lobby chatter started (${CONFIG.schedule})`);
}

function getLobbyStats(guildId) {
  const m = getGuildMemory(guildId);
  return { 
    totalMessages: m.messages.length,
    currentTopic: m.currentTopic?.topic || 'None',
    phase: m.conversationPhase,
    heat: m.conversationHeat,
    lastSpeaker: m.lastSpeaker,
    activeParticipants: Array.from(m.activeParticipants),
    dailyActivity: m.dailyMessageCount,
  };
}

function resetLobbyMemory(guildId) { 
  conversationMemory.delete(guildId); 
  learningData.delete(guildId);
}

// Welcome queue
const welcomeQueue = [];

function queueWelcomeMessage(guildId, memberId, client) {
  welcomeQueue.push({ guildId, memberId, client });
  setTimeout(() => processWelcomeQueue(), 3000);
}

async function processWelcomeQueue() {
  while (welcomeQueue.length > 0) {
    const { guildId, memberId, client } = welcomeQueue.shift();
    const guild = client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(memberId);
    if (guild && member) {
      const config = await getGuildConfig(guild.id);
      if (config?.lobby_chatter_enabled) {
        await sendWelcomeMessage(guild, member, config);
      }
    }
  }
}

module.exports = { 
  startLobbyChatterScheduler, 
  getLobbyStats, 
  resetLobbyMemory, 
  activePersonas,
  queueWelcomeMessage,
  sendWelcomeMessage,
  conversationTopics,
};