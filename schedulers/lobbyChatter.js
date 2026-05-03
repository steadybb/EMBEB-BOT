// schedulers/lobbyChatter.js
const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');
const { getGuildConfig } = require('../utils/database');
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
  { category: 'ev_tech', topics: ['Blade Battery safety', 'Fast charging speeds', 'Battery range in winter', 'Regenerative braking efficiency', 'BYD e-Platform 3.0', 'Cell-to-Body technology', 'Heat pump efficiency', '800V architecture benefits'] },
  { category: 'model_discussion', topics: ['Seal vs Tesla Model 3', 'ATTO 3 interior design', 'Dolphin affordability', 'Han luxury features', 'Seagull city driving', 'Tang family space', 'Yangwang performance'] },
  { category: 'ownership', topics: ['Home charging setup', 'Maintenance costs', 'Insurance rates', 'Road trip experiences', 'Cold weather performance', 'Software updates', 'Community meetups'] },
  { category: 'buying_advice', topics: ['EV tax credits 2026', 'Financing vs leasing', 'Trade-in values', 'First-time EV buyer tips', 'Charging infrastructure', 'Total cost of ownership', 'Best time to buy'] },
];

// ============================================
// CONVERSATION MEMORY
// ============================================
const conversationMemory = new Map();

function getGuildMemory(guildId) {
  if (!conversationMemory.has(guildId)) {
    conversationMemory.set(guildId, { messages: [], currentTopic: null, lastSpeaker: null, lastMessageType: null, topicStartTime: null, messageCount: 0, conversationPhase: 'opening' });
  }
  return conversationMemory.get(guildId);
}

function updateGuildMemory(guildId, persona, message, messageType) {
  const memory = getGuildMemory(guildId);
  memory.messages.push({ persona: persona.name, message, type: messageType, timestamp: Date.now() });
  memory.lastSpeaker = persona.name;
  memory.lastMessageType = messageType;
  memory.messageCount++;
  if (memory.messageCount <= 2) memory.conversationPhase = 'opening';
  else if (memory.messageCount <= 6) memory.conversationPhase = 'discussion';
  else memory.conversationPhase = 'closing';
  if (memory.messages.length > CONFIG.maxContextMessages) memory.messages = memory.messages.slice(-CONFIG.maxContextMessages);
  if (memory.messageCount >= 10 + Math.floor(Math.random() * 5)) { memory.currentTopic = null; memory.messageCount = 0; memory.conversationPhase = 'opening'; }
}

// ============================================
// PERSONAS
// ============================================
const activePersonas = [
  { name: 'Tesla2BYD', avatar: 'https://ui-avatars.com/api/?name=Tesla+2+BYD&background=00BFFF&color=fff&size=256&bold=true', role: 'EV Expert' },
  { name: 'Seal_Driver', avatar: 'https://ui-avatars.com/api/?name=Seal+Driver&background=0066CC&color=fff&size=256&bold=true', role: 'Seal Owner' },
  { name: 'EcoMom', avatar: 'https://ui-avatars.com/api/?name=Eco+Mom&background=FF69B4&color=fff&size=256&bold=true', role: 'Family Driver' },
  { name: 'VoltGeek', avatar: 'https://ui-avatars.com/api/?name=Volt+Geek&background=9B59B6&color=fff&size=256&bold=true', role: 'Tech Reviewer' },
  { name: 'CityEV', avatar: 'https://ui-avatars.com/api/?name=City+EV&background=2ECC71&color=fff&size=256&bold=true', role: 'City Driver' },
  { name: 'RoadTripper', avatar: 'https://ui-avatars.com/api/?name=Road+Tripper&background=E67E22&color=fff&size=256&bold=true', role: 'Long Distance Driver' },
  { name: 'New2EV', avatar: 'https://ui-avatars.com/api/?name=New+2+EV&background=1ABC9C&color=fff&size=256&bold=true', role: 'First Time Buyer' },
  { name: 'FleetBoss', avatar: 'https://ui-avatars.com/api/?name=Fleet+Boss&background=34495E&color=fff&size=256&bold=true', role: 'Commercial Buyer' },
  { name: 'Gearhead_Al', avatar: 'https://ui-avatars.com/api/?name=Gearhead+Al&background=C0392B&color=fff&size=256&bold=true', role: 'Car Enthusiast' },
];

// ============================================
// SMART MESSAGE BANK (10 types × 9 personas × 3+ messages each)
// ============================================
function getMessageType(phase, lastType) {
  const phaseTypes = {
    'opening': ['question', 'question', 'statement', 'fact'],
    'discussion': ['answer', 'answer', 'debate', 'testimonial', 'comparison', 'reaction', 'statement'],
    'closing': ['testimonial', 'fact', 'humor', 'tip', 'reaction', 'statement'],
  };
  const types = phaseTypes[phase] || phaseTypes['discussion'];
  const filtered = types.filter(t => t !== lastType);
  return getRandomItem(filtered.length > 0 ? filtered : types);
}

function generateSmartMessage(persona, topic, phase, messageType, memory) {
  const topicName = topic.topic;
  const lastMessages = memory.messages.slice(-3);
  
  const M = {
    question: {
      'EV Expert': [`Anyone looked into the new ${topicName} developments? Curious what you all think 🤔`, `What's the latest on ${topicName}? Seen some interesting data lately 📊`, `Question for the group: how important is ${topicName} in your buying decision?`],
      'Seal Owner': [`Quick question on ${topicName} - anyone have real-world experience? 🚗`, `For those with hands-on time: how does ${topicName} perform daily?`, `Curious about ${topicName} on the Seal specifically. Anyone?`],
      'Family Driver': [`Wondering about ${topicName}. Is it worth it for families? 👨‍👩‍👧‍👦`, `Safety question: how does ${topicName} hold up with kids? 🛡️`, `Mom question: is ${topicName} easy to use with car seats?`],
      'Tech Reviewer': [`What's the latest on ${topicName}? Seen some interesting specs 📊`, `Anyone done independent testing on ${topicName}? I'd love to compare 🔍`, `Tech deep dive on ${topicName} - anyone have benchmark data?`],
      'City Driver': [`For city driving, how much does ${topicName} matter day-to-day? 🏙️`, `Parking question: does ${topicName} help with tight urban spots?`, `City EV owners: is ${topicName} worth prioritizing?`],
      'Long Distance Driver': [`Anyone tested ${topicName} on long road trips? Planning cross-country 🗺️`, `How does ${topicName} affect range on extended highway drives? 🛣️`, `Road warriors: is ${topicName} reliable for 500+ mile days?`],
      'First Time Buyer': [`New here! Can someone explain ${topicName} in simple terms? 🙋‍♂️`, `Still learning about ${topicName}. Should a first-timer prioritize this? 📝`, `Total newbie question about ${topicName} - please be kind! 🥹`],
      'Commercial Buyer': [`Business perspective: anyone seeing ROI from ${topicName}? 💼`, `Fleet managers: how does ${topicName} impact operational costs? 📊`, `Scaling question: how does ${topicName} perform across multiple vehicles?`],
      'Car Enthusiast': [`Technical question about ${topicName} - know the detailed specs? 🔧`, `DIY question: how accessible is ${topicName} for home mechanics? 🛠️`, `Under the hood: what makes ${topicName} tick? Anyone torn one apart?`],
    },
    answer: {
      'EV Expert': [`From my research, ${topicName} is ahead of the curve. Numbers speak for themselves 📈`, `Great question! ${topicName} has improved significantly this year 🔍`, `I've tracked ${topicName} for 2 years. The progress is remarkable 🎯`],
      'Seal Owner': [`Can confirm ${topicName} works great. 15k miles, no complaints ✅`, `${topicName} exceeded my expectations. Way better than my old BMW 🏎️`, `Real talk: ${topicName} is why I love my Seal 💙`],
      'Family Driver': [`6 months in: ${topicName} makes family trips so much easier 👨‍👩‍👧‍👦`, `As a mom of 3, ${topicName} has been a lifesaver ⭐`, `Honest review: ${topicName} is the feature I use most daily`],
      'Tech Reviewer': [`Benchmarked this. ${topicName} scores above average in tests 📊`, `Tested 5 EVs head-to-head. BYD's ${topicName} came out on top 🏆`, `Numbers time: ${topicName} outperforms by 25-30% in independent testing`],
      'City Driver': [`For city use, ${topicName} is a game-changer. Parking is simpler 🅿️`, `6 months downtown: ${topicName} saves me $150/month easily 💰`],
      'Long Distance Driver': [`50k miles in, ${topicName} holds up perfectly on long hauls 🛣️`, `20+ road trips. ${topicName} makes long drives effortless ⚡`],
      'Commercial Buyer': [`Fleet data shows 40% improvement with ${topicName}. Numbers don't lie 💯`, `ROI analysis: ${topicName} paid for itself in 14 months 📈`],
      'Car Enthusiast': [`Done maintenance myself. ${topicName} is well-engineered 🛠️`, `${topicName} uses quality parts. No corners cut here 🔧`],
    },
    statement: {
      'EV Expert': [`The industry is moving toward ${topicName}. Smart money follows 🎯`, `${topicName} adoption is growing 3x faster than predicted 📊`],
      'Seal Owner': [`${topicName} was a main reason I chose BYD. No regrets 💯`, `Every drive, I appreciate ${topicName} more. It just works ✨`],
      'Family Driver': [`${topicName} gives me real peace of mind with the kids ⭐`, `My husband was skeptical but ${topicName} won him over 😂`],
      'Tech Reviewer': [`BYD's ${topicName} implementation is among the best I've seen 🏆`],
      'First Time Buyer': [`Learning about ${topicName} makes me confident about going EV ✨`],
      'Long Distance Driver': [`${topicName} is the reason I can do 800-mile days comfortably`],
      'Commercial Buyer': [`${topicName} is now a requirement for all our future fleet purchases`],
    },
    testimonial: {
      'Seal Owner': [`Best decision ever. ${topicName} saves me $200/month 💰`, `${topicName} makes every drive enjoyable. Never going back 🚗⚡`, `1 year later: ${topicName} is still my favorite thing about this car`],
      'Family Driver': [`${topicName} made our road trips stress-free. Zero complaints 👨‍👩‍👧‍👦`, `Never going back to gas. ${topicName} is superior in every way 💚`],
      'City Driver': [`3 months, saved $600 on fuel. ${topicName} pays for itself 💸`, `My commute used to be stressful. ${topicName} made it the best part ☀️`],
      'Long Distance Driver': [`800 miles last weekend. ${topicName} made it effortless 🚗⚡`, `Road trips are fun again thanks to ${topicName} 🗺️`],
      'Commercial Buyer': [`Best business decision this year. ${topicName} transformed our fleet 📈`],
      'First Time Buyer': [`Was nervous but ${topicName} made switching seamless. So happy! 🎉`],
    },
    fact: {
      'EV Expert': [`Fun fact: ${topicName} reduces operating costs up to 60% 📊`, `BYD's ${topicName} tech is used by Tesla and Toyota 🤯`, `${topicName} tested for 1M+ miles with zero failures 🔬`],
      'Tech Reviewer': [`${topicName} outperforms competitors by 30% in independent tests 📈`, `Tests confirm: ${topicName} is most efficient in its class 🏆`],
      'Car Enthusiast': [`${topicName} uses military-grade materials. Over-engineered 🔧`, `${topicName} has fewer moving parts. Less to break 🛠️`],
      'Seal Owner': [`Did you know? ${topicName} was developed entirely in-house by BYD engineers`],
      'Family Driver': [`Safety stat: vehicles with ${topicName} have 40% fewer accidents in testing`],
    },
    debate: {
      'EV Expert': [`Hot take: ${topicName} > horsepower for daily driving. Change my mind 🤔`, `Unpopular: ${topicName} matters more than 0-60 for 95% of drivers 😤`],
      'Seal Owner': [`I'll say it: ${topicName} on the Seal beats anything in its price range 🏎️`],
      'Tech Reviewer': [`Controversial: BYD's ${topicName} approach beats Tesla. Here's why 📊`, `Fight me: ${topicName} is more innovative than anything coming from Germany right now`],
      'Car Enthusiast': [`I'll die on this hill: ${topicName} is the most underrated EV feature 💪`],
      'Long Distance Driver': [`Argument: ${topicName} matters more than charging speed for road trips`],
    },
    comparison: {
      'EV Expert': [`Comparing ${topicName} across brands: BYD leads in 4 of 5 categories 📊`, `Deep dive: ${topicName} on BYD vs competitors. Significant difference 🔍`],
      'Tech Reviewer': [`Side-by-side test: BYD's ${topicName} is the most polished implementation 🏆`, `Tested 3 EVs with ${topicName}. BYD wins on efficiency and cost`],
      'Seal Owner': [`Traded my old car. The ${topicName} alone was worth the switch 🏎️`],
      'Commercial Buyer': [`Compared 5 fleet options. BYD's ${topicName} had lowest TCO by far`],
    },
    humor: {
      'Seal Owner': [`My neighbor asked about ${topicName}. Now he's at the dealership 😂`, `Gas station guy misses me. Haven't been there in 6 months ⛽❌`, `I've become a ${topicName} evangelist. My friends are tired of me 🤷‍♂️`],
      'City Driver': [`Hardest part about ${topicName}? Remembering what gas stations look like 😂`, `Coworkers are tired of hearing about ${topicName}. I can't stop!`],
      'Family Driver': [`Kids think ${topicName} is magic. I'm not correcting them ✨`, `Explained ${topicName} to my mom. She thinks I joined a cult 😂`],
      'First Time Buyer': [`Told friends about ${topicName}. They think I'm obsessed. Maybe I am 🤷‍♂️`, `I've become THAT person at parties talking about ${topicName} 💁‍♂️`],
      'Long Distance Driver': [`Pulled up to a charger next to a Tesla. He asked about ${topicName}. Converted! 😎`],
      'Car Enthusiast': [`My garage is now a ${topicName} shrine. Wife is not amused 😂`],
    },
    tip: {
      'EV Expert': [`Pro tip: Maximize ${topicName} by scheduling during off-peak hours 💡`, `Insider: ${topicName} works best when preconditioned before driving 🔋`],
      'Seal Owner': [`The app has ${topicName} settings most people never discover 📱`, `After a year, I found ${topicName}'s hidden efficiency mode. Game changer! 🔍`],
      'City Driver': [`Life hack: ${topicName} + planning ahead = maximum savings 🗓️`, `${topicName} tip: Keep tires at 42 PSI for max efficiency 🛞`],
      'Long Distance Driver': [`Road trip tip: ${topicName} adds 50+ miles if you precondition 🛣️`, `${topicName} + ABRP app = perfect route planning 📱`],
      'Car Enthusiast': [`DIY tip: ${topicName} maintenance is easier than you think. YouTube it! 🛠️`],
      'Family Driver': [`Mom tip: Use ${topicName}'s scheduling feature around school runs. Saves so much ⏰`],
    },
    reaction: {
      default: [`This is exactly what I've been saying! 💯`, `Couldn't agree more. Well said! 👏`, `This thread is gold. Learning so much 📚`, `BYD community is the best. So helpful 🤝`, `Adding this to my notes. Great discussion 📝`, `Preach! 🙌`, `Facts! 💪`, `This right here 🔥`, `Finally someone said it 🎯`, `Saving this for later 💾`],
    },
  };

  const typeMessages = M[messageType] || {};
  let messages = typeMessages[persona.role] || typeMessages['EV Expert'] || [];
  if (messages.length === 0 && messageType === 'reaction') messages = M['reaction']['default'];
  if (messages.length === 0) messages = [`Great discussion about ${topicName}. Love this community! 🤝`, `Really enjoying the ${topicName} conversation. So much knowledge here 💯`, `${topicName} is fascinating. Everyone's perspectives are super valuable 🌟`];
  
  const recentTexts = lastMessages.map(m => m.message);
  const fresh = messages.filter(m => !recentTexts.includes(m));
  return getRandomItem(fresh.length > 0 ? fresh : messages);
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
// MAIN FUNCTION
// ============================================
async function runLobbyChatter(client) {
  const guilds = client.guilds.cache;
  let sent = 0;
  for (const guild of guilds.values()) {
    try {
      const config = await getGuildConfig(guild.id);
      if (!config?.lobby_chatter_enabled || !config?.lobby_webhook_url) continue;
      let personas = config.lobby_chatter_personas || activePersonas;
      if (typeof personas === 'string') { try { personas = JSON.parse(personas); } catch { personas = activePersonas; } }
      if (!personas?.length) personas = activePersonas;
      const mem = getGuildMemory(guild.id);
      if (!mem.currentTopic) {
        const cat = getRandomItem(conversationTopics);
        mem.currentTopic = { category: cat.category, topic: getRandomItem(cat.topics) };
        mem.messageCount = 0; mem.conversationPhase = 'opening';
      }
      const avail = personas.filter(p => p.name !== mem.lastSpeaker);
      const persona = getRandomItem(avail.length > 0 ? avail : personas);
      const msgType = getMessageType(mem.conversationPhase, mem.lastMessageType);
      const message = generateSmartMessage(persona, mem.currentTopic, mem.conversationPhase, msgType, mem);
      const wc = await getWebhookClient(config.lobby_webhook_url);
      const ok = await sendAsPersona(wc, persona, message);
      if (ok) { updateGuildMemory(guild.id, persona, message, msgType); sent++; }
      await new Promise(r => setTimeout(r, Math.random() * (CONFIG.maxDelay - CONFIG.minDelay) + CONFIG.minDelay));
    } catch (err) { logger.error(`Lobby failed for ${guild.id}:`, err.message); }
  }
  if (sent > 0) logger.info(`💬 Lobby: ${sent} messages sent`);
}

// ============================================
// SCHEDULER
// ============================================
function startLobbyChatterScheduler(client) {
  cron.schedule(CONFIG.schedule, async () => { await runLobbyChatter(client); });
  logger.ready(`💬 Lobby chatter scheduler started (${CONFIG.schedule})`);
}

function getLobbyStats(guildId) {
  const m = getGuildMemory(guildId);
  return { totalMessages: m.messages.length, currentTopic: m.currentTopic?.topic || 'None', phase: m.conversationPhase, lastSpeaker: m.lastSpeaker || 'None' };
}
function resetLobbyMemory(guildId) { conversationMemory.delete(guildId); }

module.exports = { startLobbyChatterScheduler, getLobbyStats, resetLobbyMemory, activePersonas };