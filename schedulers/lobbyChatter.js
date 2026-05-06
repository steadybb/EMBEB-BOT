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
  schedule: process.env.LOBBY_CHATTER_SCHEDULE || '*/3 * * * *',
  minDelay: 45000,
  maxDelay: 180000,
  maxContextMessages: 100,
  maxRetries: 3,
  welcomeDelay: 5000,
  activeHoursStart: 8,
  activeHoursEnd: 22,
};

// ============================================
// WELCOME MESSAGES FOR NEW MEMBERS
// ============================================
const welcomeMessages = {
  friendly: [
    "Hey {{user}}! Welcome to the BYD family! 🚗⚡",
    "Welcome {{user}}! Glad to have you here! 🙌",
    "Hey hey {{user}}! Pull up a chair and join the EV conversation! 🪑⚡",
    "Yay you made it, {{user}}! Wave to say hi! 👋",
    "Welcome {{user}}! Another EV enthusiast joins the crew! 🎉",
  ],
  informative: [
    "Welcome {{user}}! 👋 Ask away if you have any BYD questions!",
    "Hey {{user}}! We talk EVs, BYD news, and charging tips here. Make yourself at home! 🏡",
    "Welcome {{user}}! Check out <#test-drive> to book a test drive! 📅",
    "Hey {{user}}! 👋 Use `/quote` to see instant EV incentives with federal/state credits! 💰",
  ],
  enthusiastic: [
    "⚡⚡⚡ Welcome {{user}} to the BYD revolution! ⚡⚡⚡",
    "🚀 {{user}} just joined the EV club! Let's gooo! 🚀",
    "🎉 A wild BYD enthusiast appears! Welcome {{user}}! 🎉",
    "💚⚡ Welcome to the future of driving, {{user}}! ⚡💚",
  ],
  personalized: [
    "Hi {{user}}! Great to see you here. What brings you to BYD? 🤔",
    "{{user}}! Welcome to the community. First EV or upgrading? 🔋",
    "Hey {{user}}! 👋 Are you Team Seal, Team ATTO, or Team Dolphin? 🐬🦭⚔️",
    "Welcome {{user}}! Dreaming of a Yangwang U9 or keeping it practical with a Seagull? 🕊️✨",
  ],
};

function getRandomWelcomeMessage() {
  const allMessages = [
    ...welcomeMessages.friendly,
    ...welcomeMessages.informative,
    ...welcomeMessages.enthusiastic,
    ...welcomeMessages.personalized,
  ];
  return getRandomItem(allMessages);
}

// ============================================
// ENHANCED PERSONAS (15 unique personalities)
// ============================================
const activePersonas = [
  { name: 'Tesla2BYD', avatar: 'https://ui-avatars.com/api/?name=Tesla+2+BYD&background=00BFFF&color=fff&size=256&bold=true', role: 'EV Expert', energy: 'high', expertise: 'technical', style: 'factual' },
  { name: 'Seal_Driver', avatar: 'https://ui-avatars.com/api/?name=Seal+Driver&background=0066CC&color=fff&size=256&bold=true', role: 'Seal Owner', energy: 'high', expertise: 'owner', style: 'passionate' },
  { name: 'EcoMom', avatar: 'https://ui-avatars.com/api/?name=Eco+Mom&background=FF69B4&color=fff&size=256&bold=true', role: 'Family Driver', energy: 'medium', expertise: 'family', style: 'practical' },
  { name: 'VoltGeek', avatar: 'https://ui-avatars.com/api/?name=Volt+Geek&background=9B59B6&color=fff&size=256&bold=true', role: 'Tech Reviewer', energy: 'high', expertise: 'technical', style: 'analytical' },
  { name: 'CityEV', avatar: 'https://ui-avatars.com/api/?name=City+EV&background=2ECC71&color=fff&size=256&bold=true', role: 'City Driver', energy: 'medium', expertise: 'urban', style: 'casual' },
  { name: 'RoadTripper', avatar: 'https://ui-avatars.com/api/?name=Road+Tripper&background=E67E22&color=fff&size=256&bold=true', role: 'Long Distance Driver', energy: 'high', expertise: 'touring', style: 'adventurous' },
  { name: 'New2EV', avatar: 'https://ui-avatars.com/api/?name=New+2+EV&background=1ABC9C&color=fff&size=256&bold=true', role: 'First Time Buyer', energy: 'low', expertise: 'newbie', style: 'curious' },
  { name: 'FleetBoss', avatar: 'https://ui-avatars.com/api/?name=Fleet+Boss&background=34495E&color=fff&size=256&bold=true', role: 'Commercial Buyer', energy: 'medium', expertise: 'commercial', style: 'professional' },
  { name: 'Gearhead_Al', avatar: 'https://ui-avatars.com/api/?name=Gearhead+Al&background=C0392B&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', expertise: 'mechanical', style: 'technical' },
  { name: 'BYD_Fan', avatar: 'https://ui-avatars.com/api/?name=BYD+Fan&background=FF6600&color=fff&size=256&bold=true', role: 'BYD Enthusiast', energy: 'high', expertise: 'brand', style: 'enthusiastic' },
  { name: 'ChargePro', avatar: 'https://ui-avatars.com/api/?name=Charge+Pro&background=33CC99&color=fff&size=256&bold=true', role: 'Charging Expert', energy: 'medium', expertise: 'charging', style: 'helpful' },
  { name: 'ValueHunter', avatar: 'https://ui-avatars.com/api/?name=Value+Hunter&background=8E44AD&color=fff&size=256&bold=true', role: 'Deal Seeker', energy: 'medium', expertise: 'financial', style: 'practical' },
  { name: 'EV_Advocate', avatar: 'https://ui-avatars.com/api/?name=EV+Advocate&background=27AE60&color=fff&size=256&bold=true', role: 'EV Advocate', energy: 'high', expertise: 'policy', style: 'persuasive' },
  { name: 'Tech_Explorer', avatar: 'https://ui-avatars.com/api/?name=Tech+Explorer&background=2980B9&color=fff&size=256&bold=true', role: 'Tech Explorer', energy: 'high', expertise: 'innovation', style: 'curious' },
  { name: 'Practical_Pete', avatar: 'https://ui-avatars.com/api/?name=Practical+Pete&background=7F8C8D&color=fff&size=256&bold=true', role: 'Practical Buyer', energy: 'medium', expertise: 'value', style: 'down-to-earth' },
];

// ============================================
// COMPREHENSIVE TOPIC DATABASE
// ============================================
const conversationTopics = [
  { category: 'ev_tech', topics: ['Blade Battery safety', 'Fast charging speeds', 'Battery range in winter', 'Regenerative braking efficiency', 'BYD e-Platform 3.0', 'Cell-to-Body technology', 'Heat pump efficiency', '800V architecture benefits', 'Battery thermal management', 'V2L technology'] },
  { category: 'model_discussion', topics: ['Seal vs Tesla Model 3', 'ATTO 3 interior design', 'Dolphin affordability', 'Han luxury features', 'Seagull city driving', 'Tang family space', 'Yangwang performance', 'Song Plus practicality', 'Yuan Plus versatility', 'Seal Performance track capability'] },
  { category: 'ownership', topics: ['Home charging setup', 'Maintenance costs', 'Insurance rates', 'Road trip experiences', 'Cold weather performance', 'Software updates', 'Community meetups', 'Resale value', 'Winter driving tips', 'Service center experiences'] },
  { category: 'buying_advice', topics: ['EV tax credits 2026', 'Financing vs leasing', 'Trade-in values', 'First-time EV buyer tips', 'Charging infrastructure', 'Total cost of ownership', 'Best time to buy', 'Dealer experiences', 'Demo drive tips', 'Price negotiation'] },
  { category: 'industry_news', topics: ['BYD market share', 'New model announcements', 'Charging network expansion', 'Government incentives', 'Competitor analysis', 'Manufacturing updates', 'Global expansion', 'Battery technology breakthroughs', 'Sustainability initiatives'] },
  { category: 'charging', topics: ['Home installation costs', 'Public charger reliability', 'Fast charging curves', 'Battery preconditioning', 'Charge scheduling', 'App integration', 'Charger compatibility', 'NACS adoption', 'Tesla Supercharger access', 'Route planning'] },
  { category: 'lifestyle', topics: ['EV camping with V2L', 'Daily commuting savings', 'Road trip planning', 'Winter storage tips', 'EV etiquette', 'Parking with EVs', 'Car wash tips', 'Detailing recommendations', 'Accessories', 'Phone app features'] },
  { category: 'community', topics: ['Local EV meetups', 'Online forums', 'Owner clubs', 'Charity drives', 'Group test drives', 'Q&A sessions', 'New owner mentoring', 'DIY maintenance', 'Charging station reviews'] },
];

// ============================================
// ADVANCED CONVERSATION MEMORY
// ============================================
const conversationMemory = new Map();
const pendingWelcomeMessages = new Map();

function getGuildMemory(guildId) {
  if (!conversationMemory.has(guildId)) {
    conversationMemory.set(guildId, { 
      messages: [], 
      currentTopic: null, 
      lastSpeaker: null, 
      lastMessageType: null, 
      topicStartTime: null, 
      messageCount: 0, 
      conversationPhase: 'opening',
      activeParticipants: new Set(),
      topicHistory: [],
      dailyMessageCount: 0,
      lastDailyReset: Date.now(),
    });
  }
  return conversationMemory.get(guildId);
}

function updateGuildMemory(guildId, persona, message, messageType) {
  const memory = getGuildMemory(guildId);
  const now = Date.now();
  
  // Daily reset
  if (now - memory.lastDailyReset > 86400000) {
    memory.dailyMessageCount = 0;
    memory.lastDailyReset = now;
  }
  
  memory.messages.push({ persona: persona.name, message, type: messageType, timestamp: now, role: persona.role });
  memory.lastSpeaker = persona.name;
  memory.lastMessageType = messageType;
  memory.messageCount++;
  memory.dailyMessageCount++;
  memory.activeParticipants.add(persona.name);
  
  // Update phase based on engagement
  if (memory.messageCount <= 2) memory.conversationPhase = 'opening';
  else if (memory.messageCount <= 8) memory.conversationPhase = 'discussion';
  else if (memory.messageCount <= 15) memory.conversationPhase = 'deep_dive';
  else memory.conversationPhase = 'wrapping';
  
  // Trim memory if too large
  if (memory.messages.length > CONFIG.maxContextMessages) {
    memory.messages = memory.messages.slice(-CONFIG.maxContextMessages);
  }
  
  // Natural topic drift (15% chance after 8 messages)
  if (memory.messageCount >= 8 && Math.random() < 0.15) {
    memory.topicHistory.push({ topic: memory.currentTopic?.topic, endedAt: now });
    memory.currentTopic = null;
    memory.messageCount = 0;
    memory.conversationPhase = 'opening';
  }
}

// ============================================
// CONTEXT-AWARE RESPONSE GENERATION
// ============================================

function getMessageType(phase, lastType) {
  const phaseTypes = {
    'opening': ['question', 'question', 'greeting', 'fact', 'statement', 'icebreaker'],
    'discussion': ['question', 'answer', 'debate', 'testimonial', 'comparison', 'reaction', 'opinion', 'insight'],
    'deep_dive': ['analysis', 'technical', 'comparison', 'debate', 'insight', 'prediction', 'data_share'],
    'wrapping': ['testimonial', 'summary', 'humor', 'tip', 'reaction', 'closing', 'call_to_action'],
  };
  
  let types = phaseTypes[phase] || phaseTypes['discussion'];
  const filtered = types.filter(t => t !== lastType);
  return getRandomItem(filtered.length > 0 ? filtered : types);
}

function generateSmartMessage(persona, topic, phase, messageType, memory) {
  const topicName = topic?.topic || 'electric vehicles';
  const lastMessages = memory.messages.slice(-3);
  
  // Check if this persona hasn't spoken in a while
  const lastSpokeIndex = memory.messages.findLastIndex(m => m.persona === persona.name);
  const hasBeenQuiet = lastSpokeIndex === -1 || (memory.messages.length - lastSpokeIndex) > 5;
  
  const M = {
    greeting: {
      default: [
        `Hey everyone! 👋 How's the ${topicName} discussion going?`,
        `Jumping in here - love this conversation about ${topicName}! 💬`,
        `Great to see the community so active! What's everyone's take on ${topicName}? 🌟`,
        `Just catching up. Fascinating points about ${topicName}! ⚡`,
      ],
    },
    icebreaker: {
      default: [
        `Random question: what's your dream EV road trip destination? 🗺️`,
        `Curious - what made you first consider going electric? 💭`,
        `Fun poll: Favorite BYD color? 🤔`,
        `Quick show of hands - who's done a 500+ mile EV road trip? ✋`,
      ],
    },
    question: {
      'EV Expert': [`Anyone have real-world data on ${topicName}? 📊`, `What's everyone's experience with ${topicName}? 🔍`, `Curious - how does ${topicName} impact daily charging habits? 💭`],
      'Seal Owner': [`Seal owners - how's ${topicName} treating you? 🚗`, `Anyone else notice the ${topicName} improvements? ✨`, `Quick poll: ${topicName} - worth the upgrade? 📊`],
      'Tech Reviewer': [`Has anyone benchmarked ${topicName} against competitors? 📈`, `What's the consensus on ${topicName} in real-world testing? 🔬`],
      'New2EV': [`Newbie question: can someone explain ${topicName} in simple terms? 🙋`, `Still learning - is ${topicName} as good as people say? 🥹`],
      'Family Driver': [`Parents - how does ${topicName} work for car seats and kid gear? 👨‍👩‍👧‍👦`, `Family perspective: is ${topicName} worth prioritizing? 👪`],
      'Practical Buyer': [`Value question: does ${topicName} justify the cost? 💰`, `Long-term - how does ${topicName} affect resale? 📈`],
    },
    answer: {
      'EV Expert': [`Great question! ${topicName} has evolved significantly 📈`, `From my research: ${topicName} is a game-changer 🎯`, `Statistics show ${topicName} improves efficiency by 25% 🔬`],
      'Seal Owner': [`15k miles in - ${topicName} has been flawless ✅`, `Real talk: ${topicName} exceeded every expectation 💯`, `${topicName} is why I recommend BYD to everyone 🏆`],
      'Tech Reviewer': [`Benchmarked this: ${topicName} scores top in its class 📊`, `Independent tests confirm ${topicName} leads the market 🏅`],
      'City Driver': [`For city driving, ${topicName} is perfect 🏙️`, `Daily commute verdict: ${topicName} saves me hours ⏰`],
      'RoadTripper': [`Long distance tested: ${topicName} holds up great 🛣️`, `Cross-country verified: ${topicName} is reliable 🗺️`],
    },
    opinion: {
      'EV Expert': [`In my professional opinion, ${topicName} is underrated 🎯`, `I firmly believe ${topicName} will be standard in 2 years 📈`],
      'Seal Owner': [`Hot take: ${topicName} is the best feature of the Seal 🔥`, `Unpopular opinion: ${topicName} > horsepower any day 💪`],
      'Car Enthusiast': [`From a mechanical standpoint, ${topicName} is brilliantly engineered 🔧`, `${topicName} shows BYD really understands drivers 🏎️`],
      'EV_Advocate': [`Here's why ${topicName} matters for the EV transition 🌍`, `${topicName} is the future, and BYD is leading the way ⚡`],
    },
    analysis: {
      'EV Expert': [`Deep dive: ${topicName} shows 40% improvement year-over-year 📊`, `Analyzing the data: ${topicName} is where the market is heading 🎯`],
      'Tech Reviewer': [`Breaking down ${topicName}: the engineering is impressive 🔬`, `Technical analysis: ${topicName} outperforms by significant margin 📈`],
      'Tech_Explorer': [`Interesting patterns in ${topicName} adoption rates 📈`, `The innovation in ${topicName} is accelerating 🚀`],
    },
    insight: {
      'EV Expert': [`Key insight: ${topicName} adoption is accelerating faster than predicted 🚀`, `What's interesting about ${topicName} is how it's changing buyer behavior 🔍`],
      'Tech Reviewer': [`Here's something most miss about ${topicName}: the long-term value 💡`, `The real story with ${topicName} is the total cost of ownership 📉`],
      'ValueHunter': [`Most people overlook: ${topicName} saves money long-term 💰`, `Hidden value in ${topicName} most buyers don't consider 📊`],
    },
    prediction: {
      'EV Expert': [`Prediction: ${topicName} will be standard by 2028 📅`, `I see ${topicName} becoming the differentiator for EVs 🎯`],
      'Tech Reviewer': [`My bet: ${topicName} technology will trickle down to all models 📉`, `Future forecast: ${topicName} will be table stakes in 3 years 🔮`],
      'EV_Advocate': [`Soon, ${topicName} will be as common as power windows ⚡`, `The EV tipping point is here, and ${topicName} is proof 🎯`],
    },
    debate: {
      'EV Expert': [`Counterpoint: ${topicName} matters more than 0-60 for 95% of drivers 🎯`, `Change my mind: ${topicName} is the #1 EV feature worth paying for 💪`],
      'Tech Reviewer': [`Controversial: ${topicName} implementations vary wildly. BYD does it best 📊`, `Tested 5 EVs. ${topicName} winner? BYD by a landslide 🏆`],
      'Seal Owner': [`I'll die on this hill: ${topicName} makes every other feature better 💯`, `Fight me: ${topicName} > range anxiety arguments 🔥`],
      'Gearhead_Al': [`Traditionalists might disagree, but ${topicName} is superior 🔧`, `Some say it's hype, but ${topicName} delivers real results 🏎️`],
    },
    comparison: {
      'EV Expert': [`Comparing ${topicName} across brands: BYD leads in 4/5 metrics 📊`, `${topicName} on BYD vs others - significant gap in quality 🔍`],
      'Tech Reviewer': [`Side-by-side: ${topicName} implementation - BYD is most polished 🏆`, `Tested head-to-head: BYD's ${topicName} beats competitors 🥇`],
      'ValueHunter': [`Price-to-performance: ${topicName} on BYD is unbeatable value 💰`, `Dollar for dollar, ${topicName} delivers the most ROI 📈`],
      'Practical_Pete': [`Real world comparison: ${topicName} delivers what matters 🎯`, `For most drivers, ${topicName} is the better choice ✅`],
    },
    technical: {
      'Car Enthusiast': [`Technical breakdown: ${topicName} uses premium components throughout 🔧`, `${topicName} engineering is over-spec'd. Quality shines 🛠️`],
      'Tech Reviewer': [`Specs check: ${topicName} numbers are verified and impressive 📊`, `Deep dive: ${topicName} architecture is future-proof 🔬`],
      'Gearhead_Al': [`Under the hood, ${topicName} is brilliantly executed 🔧`, `DIY perspective: ${topicName} is accessible and well-built 🛠️`],
    },
    testimonial: {
      'Seal Owner': [`Best decision ever. ${topicName} saves me $200/month 💰`, `1 year later: ${topicName} is still my favorite feature 🚗`],
      'Family Driver': [`${topicName} made our road trips stress-free. Zero complaints 👨‍👩‍👧‍👦`, `Never going back to gas. ${topicName} is superior in every way 💚`],
      'City Driver': [`3 months, saved $600 on fuel. ${topicName} pays for itself 💸`, `My commute is the best part of my day thanks to ${topicName} ☀️`],
      'RoadTripper': [`800 miles last weekend. ${topicName} made it effortless 🚗⚡`, `Road trips are fun again thanks to ${topicName} 🗺️`],
      'Commercial Buyer': [`Best business decision this year. ${topicName} transformed our fleet 📈`],
      'New2EV': [`Was nervous but ${topicName} made switching seamless. So happy! 🎉`],
    },
    fact: {
      'EV Expert': [`Fun fact: ${topicName} reduces operating costs up to 60% 📊`, `BYD's ${topicName} tech is used by Tesla and Toyota 🤯`, `${topicName} tested for 1M+ miles with zero failures 🔬`],
      'Tech Reviewer': [`${topicName} outperforms competitors by 30% in independent tests 📈`, `Tests confirm: ${topicName} is most efficient in its class 🏆`],
      'Car Enthusiast': [`${topicName} uses military-grade materials. Over-engineered 🔧`, `${topicName} has fewer moving parts. Less to break 🛠️`],
      'EV_Advocate': [`Did you know? ${topicName} helps reduce carbon footprint significantly 🌍`, `${topicName} is a major step toward sustainable transportation 💚`],
    },
    tip: {
      'EV Expert': [`Pro tip: Maximize ${topicName} by scheduling during off-peak hours 💡`, `Insider: ${topicName} works best when preconditioned before driving 🔋`],
      'Seal Owner': [`The app has ${topicName} settings most people never discover 📱`, `After a year, I found ${topicName}'s hidden efficiency mode. Game changer! 🔍`],
      'City Driver': [`Life hack: ${topicName} + planning ahead = maximum savings 🗓️`, `${topicName} tip: Keep tires at 42 PSI for max efficiency 🛞`],
      'RoadTripper': [`Road trip tip: ${topicName} adds 50+ miles if you precondition 🛣️`, `${topicName} + ABRP app = perfect route planning 📱`],
      'ChargePro': [`Charging tip: ${topicName} works best between 20-80% 🔋`, `Home charging setup: ${topicName} pairs perfectly with scheduled rates ⚡`],
    },
    data_share: {
      'EV Expert': [`Data point: ${topicName} adoption up 150% year-over-year 📈`, `Study shows: ${topicName} reduces range anxiety by 70% 📊`],
      'Tech Reviewer': [`Benchmark results: ${topicName} efficiency rating of 94% 🏆`, `Testing data: ${topicName} consistent across temperature ranges 🌡️`],
      'ChargePro': [`Charging data: ${topicName} saves average of 15 min per session ⏱️`, `Usage stats: ${topicName} feature used by 85% of owners daily 📱`],
    },
    call_to_action: {
      default: [
        `Has anyone else had similar experiences with ${topicName}? Share below! 👇`,
        `What's your take on ${topicName}? Would love to hear more perspectives 💬`,
        `Anyone want to add their experience with ${topicName}? 🗣️`,
        `Let's keep this discussion going - what do others think? 🤝`,
      ],
    },
    summary: {
      default: [
        `Great discussion everyone! Learned a lot about ${topicName} today 📚`,
        `Really valuable insights on ${topicName} - thanks all! 🙏`,
        `This conversation about ${topicName} has been super helpful! 💯`,
      ],
    },
    humor: {
      'Seal Owner': [`My neighbor asked about ${topicName}. Now he's at the dealership 😂`, `Gas station guy misses me. Haven't been there in 6 months ⛽❌`],
      'City Driver': [`Hardest part about ${topicName}? Remembering what gas stations look like 😂`],
      'Family Driver': [`Kids think ${topicName} is magic. I'm not correcting them ✨`],
      'New2EV': [`Told friends about ${topicName}. They think I'm obsessed. Maybe I am 🤷‍♂️`],
      'RoadTripper': [`Pulled up to a charger next to a Tesla. He asked about ${topicName}. Converted! 😎`],
      'BYD_Fan': [`My garage is now a BYD shrine. Wife is not amused 😂`],
    },
    reaction: {
      default: [`This is exactly what I've been saying! 💯`, `Couldn't agree more. Well said! 👏`, `Great point! Learned something new today 📚`, `BYD community is the best. So helpful 🤝`, `Adding this to my notes. Great discussion 📝`, `Preach! 🙌`, `Facts! 💪`, `This right here 🔥`, `Finally someone said it 🎯`, `Saving this for later 💾`, `Mind officially blown 🤯`, `Take my upvote! ⬆️`],
    },
    closing: {
      default: [
        `Great chat everyone! Talk soon about ${topicName} 👋`,
        `Thanks for the awesome discussion! Catch you all later 🌟`,
        `Learned so much! Looking forward to the next topic 🚀`,
      ],
    },
  };

  // Add quiet persona re-engagement
  if (hasBeenQuiet && Math.random() < 0.3) {
    return `*catching up* Great points about ${topicName}! Been following this thread 📝 ${M.reaction.default[0]}`;
  }

  const typeMessages = M[messageType] || {};
  let messages = typeMessages[persona.role] || typeMessages['EV Expert'] || typeMessages.default || [];
  if (messages.length === 0 && messageType === 'reaction') messages = M.reaction.default;
  if (messages.length === 0) messages = [`Really interesting discussion about ${topicName}! Love this community 🤝`];
  
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
// WELCOME MESSAGE FOR NEW MEMBERS
// ============================================
async function sendWelcomeMessage(guild, member, config) {
  if (!config?.lobby_webhook_url) return false;
  
  try {
    const welcomeMessage = getRandomWelcomeMessage().replace('{{user}}', member.displayName);
    const randomPersona = getRandomItem(activePersonas);
    const wc = await getWebhookClient(config.lobby_webhook_url);
    const success = await sendAsPersona(wc, randomPersona, welcomeMessage);
    
    if (success) {
      logger.info(`👋 Welcome message sent to ${member.user.tag}`);
    }
    return success;
  } catch (err) {
    logger.error(`Failed to send welcome message to ${member.user.tag}:`, err.message);
    return false;
  }
}

// ============================================
// CHECK IF WITHIN ACTIVE HOURS
// ============================================
function isWithinActiveHours() {
  const hour = new Date().getHours();
  return hour >= CONFIG.activeHoursStart && hour < CONFIG.activeHoursEnd;
}

// ============================================
// MAIN FUNCTION
// ============================================
async function runLobbyChatter(client) {
  // Don't run during inactive hours
  if (!isWithinActiveHours()) return;
  
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
      
      // Select or rotate topic
      if (!mem.currentTopic) {
        const cat = getRandomItem(conversationTopics);
        mem.currentTopic = { category: cat.category, topic: getRandomItem(cat.topics) };
        mem.messageCount = 0;
        mem.conversationPhase = 'opening';
      }
      
      // Select persona (avoid same speaker twice)
      const avail = personas.filter(p => p.name !== mem.lastSpeaker);
      const persona = getRandomItem(avail.length > 0 ? avail : personas);
      
      // Determine message type based on phase
      const msgType = getMessageType(mem.conversationPhase, mem.lastMessageType);
      const message = generateSmartMessage(persona, mem.currentTopic, mem.conversationPhase, msgType, mem);
      
      const wc = await getWebhookClient(config.lobby_webhook_url);
      const ok = await sendAsPersona(wc, persona, message);
      
      if (ok) {
        updateGuildMemory(guild.id, persona, message, msgType);
        sent++;
      }
      
      // Random delay between messages
      await new Promise(r => setTimeout(r, Math.random() * (CONFIG.maxDelay - CONFIG.minDelay) + CONFIG.minDelay));
      
    } catch (err) { 
      logger.error(`Lobby failed for ${guild.id}:`, err.message); 
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
  
  logger.ready(`💬 Intelligent lobby chatter scheduler started (${CONFIG.schedule})`);
}

function getLobbyStats(guildId) {
  const m = getGuildMemory(guildId);
  return { 
    totalMessages: m.messages.length, 
    currentTopic: m.currentTopic?.topic || 'None', 
    phase: m.conversationPhase, 
    lastSpeaker: m.lastSpeaker || 'None',
    activeParticipants: Array.from(m.activeParticipants),
    dailyMessageCount: m.dailyMessageCount,
    topicHistory: m.topicHistory.slice(-5),
  };
}

function resetLobbyMemory(guildId) { 
  conversationMemory.delete(guildId); 
}

// Process welcome messages for new members
async function processWelcomeQueue(client) {
  for (const [guildId, memberId] of pendingWelcomeMessages) {
    const guild = client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(memberId);
    if (guild && member) {
      const config = await getGuildConfig(guild.id);
      if (config?.lobby_chatter_enabled) {
        await sendWelcomeMessage(guild, member, config);
      }
    }
    pendingWelcomeMessages.delete(guildId);
  }
}

// Call this from guildMemberAdd event
function queueWelcomeMessage(guildId, memberId) {
  pendingWelcomeMessages.set(guildId, memberId);
  setTimeout(() => processWelcomeQueue(client), 5000);
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