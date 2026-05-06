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
  schedule: process.env.LOBBY_CHATTER_SCHEDULE || '*/5 * * * *',
  minDelay: 60000,
  maxDelay: 480000,
  activeHoursStart: 9,
  activeHoursEnd: 22,
  peakHoursStart: 19,
  peakHoursEnd: 21,
  weekendMultiplier: 1.2,
  maxContextMessages: 150,
  maxRetries: 3,
  welcomeDelay: 8000,
  typingDelayRange: { min: 2000, max: 6000 },
  conversationCooldown: 300000,
};

// ============================================
// TIME-AWARE CONTEXT (Reduced emojis)
// ============================================
const timeContexts = {
  morning: {
    hourRange: [5, 12],
    greetings: ['Good morning', 'Morning', 'Hey good morning'],
  },
  afternoon: {
    hourRange: [12, 17],
    greetings: ['Good afternoon', 'Hey everyone', 'Afternoon'],
  },
  evening: {
    hourRange: [17, 21],
    greetings: ['Good evening', 'Evening', 'Hey all'],
  },
  night: {
    hourRange: [21, 24],
    greetings: ['Hey night owls', 'Late night', 'Evening'],
  },
};

// ============================================
// ENHANCED PERSONAS - More natural speaking
// ============================================
const activePersonas = [
  { 
    name: 'Tesla2BYD', 
    avatar: 'https://ui-avatars.com/api/?name=Tesla+2+BYD&background=00BFFF&color=fff&size=256&bold=true',
    role: 'EV Expert',
    traits: { openness: 0.9, agreeableness: 0.6, neuroticism: 0.2 },
    speakingStyle: 'analytical',
    catchphrases: ['the data shows', 'from what I\'ve seen', 'research indicates'],
    activeHours: 'all',
  },
  { 
    name: 'Seal_Driver', 
    avatar: 'https://ui-avatars.com/api/?name=Seal+Driver&background=0066CC&color=fff&size=256&bold=true',
    role: 'Seal Owner',
    traits: { openness: 0.7, agreeableness: 0.8, neuroticism: 0.3 },
    speakingStyle: 'passionate',
    catchphrases: ['I love my', 'best decision', 'honestly'],
    activeHours: 'evening',
  },
  { 
    name: 'EcoMom', 
    avatar: 'https://ui-avatars.com/api/?name=Eco+Mom&background=FF69B4&color=fff&size=256&bold=true',
    role: 'Family Driver',
    traits: { openness: 0.6, agreeableness: 0.9, neuroticism: 0.4 },
    speakingStyle: 'practical',
    catchphrases: ['for our family', 'the kids love', 'it really works'],
    activeHours: 'afternoon',
  },
  { 
    name: 'VoltGeek', 
    avatar: 'https://ui-avatars.com/api/?name=Volt+Geek&background=9B59B6&color=fff&size=256&bold=true',
    role: 'Tech Reviewer',
    traits: { openness: 0.95, agreeableness: 0.5, neuroticism: 0.1 },
    speakingStyle: 'analytical',
    catchphrases: ['numbers show', 'efficiency wise', 'the specs indicate'],
    activeHours: 'night',
  },
  { 
    name: 'CityEV', 
    avatar: 'https://ui-avatars.com/api/?name=City+EV&background=2ECC71&color=fff&size=256&bold=true',
    role: 'City Driver',
    traits: { openness: 0.6, agreeableness: 0.7, neuroticism: 0.3 },
    speakingStyle: 'casual',
    catchphrases: ['around town', 'city driving is', 'parking is'],
    activeHours: 'day',
  },
  { 
    name: 'RoadTripper', 
    avatar: 'https://ui-avatars.com/api/?name=Road+Tripper&background=E67E22&color=fff&size=256&bold=true',
    role: 'Long Distance Driver',
    traits: { openness: 0.8, agreeableness: 0.7, neuroticism: 0.2 },
    speakingStyle: 'adventurous',
    catchphrases: ['on the road', 'long distance', 'cross country'],
    activeHours: 'weekend',
  },
  { 
    name: 'PracticalPete', 
    avatar: 'https://ui-avatars.com/api/?name=Practical+Pete&background=7F8C8D&color=fff&size=256&bold=true',
    role: 'Practical Buyer',
    traits: { openness: 0.5, agreeableness: 0.8, neuroticism: 0.3 },
    speakingStyle: 'down-to-earth',
    catchphrases: ['honestly', 'real talk', 'to be fair'],
    activeHours: 'all',
  },
];

// ============================================
// NATURAL TOPIC DATABASE
// ============================================
const conversationTopics = [
  { category: 'ev_tech', weight: 1.2, topics: [
    'Blade Battery safety testing',
    '800V charging architecture',
    'battery thermal management',
    'regenerative braking efficiency',
    'V2L and V2G potential',
  ]},
  { category: 'model_discussion', weight: 1.5, topics: [
    'Seal Performance vs Model 3',
    'ATTO 3 interior quality',
    'Dolphin city driving',
    'Han luxury features',
    'Yangwang U8 off-road capability',
  ]},
  { category: 'ownership', weight: 1.3, topics: [
    'home charger installation',
    'maintenance costs over time',
    'winter range impact',
    'software update experiences',
    'road trip charging strategies',
  ]},
  { category: 'buying_advice', weight: 1.4, topics: [
    'EV tax credit eligibility',
    'financing vs leasing',
    'trade-in negotiation',
    'first-time EV owner tips',
    'total cost of ownership',
  ]},
  { category: 'industry', weight: 1.0, topics: [
    'BYD vs Tesla competition',
    'charging network expansion',
    'battery tech breakthroughs',
    'government EV policies',
    'EV adoption trends',
  ]},
];

// ============================================
// CONVERSATION MEMORY
// ============================================
const conversationMemory = new Map();
const learningData = new Map();

function getGuildMemory(guildId) {
  if (!conversationMemory.has(guildId)) {
    conversationMemory.set(guildId, { 
      messages: [],
      currentTopic: null,
      lastSpeaker: null,
      lastMessageType: null,
      conversationPhase: 'opening',
      activeParticipants: new Set(),
      conversationHeat: 0,
      lastActivityTime: Date.now(),
    });
  }
  return conversationMemory.get(guildId);
}

// ============================================
// NATURAL RESPONSE GENERATION (Minimal emojis)
// ============================================

function analyzeConversationMood(messages) {
  const recentMessages = messages.slice(-5);
  let excitementScore = 0;
  let questionScore = 0;
  
  for (const msg of recentMessages) {
    if (msg.message.includes('!')) excitementScore += 0.2;
    if (msg.message.includes('?')) questionScore += 0.3;
  }
  
  if (excitementScore > 0.6) return 'excited';
  if (questionScore > 0.8) return 'curious';
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

function generateNaturalResponse(persona, topic, phase, messageType, memory, timeContext, mood) {
  const topicName = topic?.topic || 'electric vehicles';
  const timeGreeting = getRandomItem(timeContext.greetings);
  const isWeekend = [0, 6].includes(new Date().getDay());
  
  // Natural response templates - minimal emojis
  const responseTemplates = {
    opening: {
      casual: [`${timeGreeting}. Been thinking about ${topicName} lately. Anyone else?`],
      curious: [`${timeGreeting}. Quick question about ${topicName} - what do you all think?`],
    },
    discussion: {
      agreeing: [`That's a good point about ${topicName}. I've noticed the same thing.`],
      adding: [`Adding to what was said about ${topicName} - I've found that...`],
      questioning: [`Interesting take on ${topicName}. Has anyone considered the long-term aspect?`],
    },
    deep_dive: {
      analytical: [`Looking deeper at ${topicName}. One thing that stands out is...`],
      experiential: [`From my experience with ${topicName}, the key factor seems to be...`],
    },
    wrapping: {
      closing: [`Good discussion on ${topicName}. Lots of useful perspectives here.`],
      farewell: [`Alright, that's all from me on ${topicName}. Catch you all later.`],
    },
    reaction: {
      agreement: [`Agreed.`, `Same here.`, `That makes sense.`, `Good point.`],
      thoughtful: [`Interesting.`, `Hadn't thought of that.`, `Fair take.`],
    },
  };
  
  const phaseKey = phase === 'heated' ? 'discussion' : phase;
  let templates = responseTemplates[phaseKey] || responseTemplates.discussion;
  let templateSet = Object.values(templates)[0];
  
  // Select appropriate template based on mood and messageType
  if (messageType === 'question' && templates.questioning) templateSet = templates.questioning;
  if (messageType === 'answer' && templates.adding) templateSet = templates.adding;
  if (messageType === 'reaction') templateSet = responseTemplates.reaction.agreement;
  if (messageType === 'thoughtful') templateSet = responseTemplates.reaction.thoughtful;
  
  let message = getRandomItem(templateSet);
  
  // Add personality flair occasionally
  if (Math.random() < 0.25 && persona.catchphrases) {
    message = `${getRandomItem(persona.catchphrases)}. ${message.toLowerCase()}`;
  }
  
  // Very rare emoji (only 5% of messages)
  if (Math.random() < 0.05) {
    const rareEmojis = ['👍', '👌', '💡', '🔥'];
    message = `${message} ${getRandomItem(rareEmojis)}`;
  }
  
  return message;
}

// ============================================
// INTELLIGENT TOPIC SELECTION
// ============================================
function selectIntelligentTopic(memory, guildId) {
  const availableTopics = [...conversationTopics];
  const selectedCategory = getRandomItem(availableTopics);
  const selectedTopic = getRandomItem(selectedCategory.topics);
  return { category: selectedCategory.category, topic: selectedTopic };
}

// ============================================
// MESSAGE TYPE SELECTION
// ============================================
const messageTypeWeights = {
  opening: { question: 0.5, statement: 0.3, greeting: 0.2 },
  discussion: { question: 0.35, answer: 0.3, opinion: 0.2, reaction: 0.15 },
  deep_dive: { analysis: 0.4, insight: 0.35, technical: 0.25 },
  wrapping: { closing: 0.5, summary: 0.3, farewell: 0.2 },
};

function getMessageType(phase, lastType) {
  const weights = messageTypeWeights[phase] || messageTypeWeights.discussion;
  const types = Object.entries(weights);
  
  const filtered = types.filter(([type]) => type !== lastType);
  const totalWeight = filtered.reduce((sum, [, weight]) => sum + weight, 0);
  
  let random = Math.random() * totalWeight;
  for (const [type, weight] of filtered) {
    random -= weight;
    if (random <= 0) return type;
  }
  return filtered[0]?.[0] || 'statement';
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
// WELCOME MESSAGES (Natural, minimal emojis)
// ============================================
const welcomeMessages = [
  "Hey {{user}}, welcome to the BYD community. What brings you here?",
  "Welcome {{user}}. Another EV enthusiast joins the conversation.",
  "Hey {{user}}, glad you found us. Have any EV questions?",
  "Welcome aboard {{user}}. Feel free to ask about anything EV related.",
  "Hey {{user}}, nice to have you here. What BYD models are you interested in?",
];

function getNaturalWelcomeMessage(member) {
  const base = getRandomItem(welcomeMessages);
  return base.replace('{{user}}', member.displayName);
}

async function sendWelcomeMessage(guild, member, config) {
  if (!config?.lobby_webhook_url) return false;
  
  try {
    await new Promise(r => setTimeout(r, CONFIG.welcomeDelay));
    
    const welcomeMessage = getNaturalWelcomeMessage(member);
    const persona = getRandomItem(activePersonas.filter(p => p.activeHours === 'all' || p.activeHours === getCurrentTimeContext().key));
    const wc = await getWebhookClient(config.lobby_webhook_url);
    const success = await sendAsPersona(wc, persona, welcomeMessage);
    
    if (success) logger.info(`Welcome message sent to ${member.user.tag}`);
    return success;
  } catch (err) {
    logger.error(`Failed to send welcome: ${err.message}`);
    return false;
  }
}

// ============================================
// MAIN LOBBY CHATTER
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
      const isStale = (Date.now() - mem.lastActivityTime) > 7200000;
      
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
      
      const msgType = getMessageType(mem.conversationPhase, mem.lastMessageType);
      const message = generateNaturalResponse(persona, mem.currentTopic, mem.conversationPhase, msgType, mem, timeContext, mood);
      
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
        if (mem.messageCount >= 10) mem.conversationPhase = 'wrapping';
        else if (mem.messageCount >= 5) mem.conversationPhase = 'deep_dive';
        else if (mem.messageCount >= 2) mem.conversationPhase = 'discussion';
        
        // Trim memory
        if (mem.messages.length > CONFIG.maxContextMessages) {
          mem.messages = mem.messages.slice(-CONFIG.maxContextMessages);
        }
        
        sent++;
      }
      
      // Natural delay
      const isPeak = hour >= CONFIG.peakHoursStart && hour < CONFIG.peakHoursEnd;
      const isWeekend = [0, 6].includes(new Date().getDay());
      let delay = Math.random() * (CONFIG.maxDelay - CONFIG.minDelay) + CONFIG.minDelay;
      if (isPeak) delay *= 0.7;
      if (isWeekend) delay *= 1.2;
      await new Promise(r => setTimeout(r, Math.min(delay, 600000)));
      
    } catch (err) { 
      logger.error(`Lobby failed: ${err.message}`); 
    }
  }
  
  if (sent > 0) logger.info(`Lobby: ${sent} messages sent`);
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
  
  logger.ready(`Lobby chatter started (${CONFIG.schedule})`);
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