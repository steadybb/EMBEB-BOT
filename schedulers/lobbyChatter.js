// schedulers/lobbyChatter.js
const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');
const { getGuildConfig } = require('../utils/database');
const { getRandomItem } = require('../utils/helpers');

// ============================================
// HUMAN‑LIKE TIMING CONFIGURATION
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
// TIME‑AWARE CONTEXT (minimal emojis)
// ============================================
const timeContexts = {
  morning: { hourRange: [5, 12], greetings: ['Good morning', 'Morning', 'Hey good morning'] },
  afternoon: { hourRange: [12, 17], greetings: ['Good afternoon', 'Hey everyone', 'Afternoon'] },
  evening: { hourRange: [17, 21], greetings: ['Good evening', 'Evening', 'Hey all'] },
  night: { hourRange: [21, 24], greetings: ['Hey night owls', 'Late night', 'Evening'] },
};

// ============================================
// 🚀 YOUNG & FUN PERSONAS (with catchphrases & emojis)
// ============================================
const activePersonas = [
  { name: 'SpeedDemon_', avatar: 'https://ui-avatars.com/api/?name=Speed+Demon&background=FF4500&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Seal Performance', speakingStyle: 'hyper', catchphrase: 'broooo', emoji: '🏎️', activeHours: 'all' },
  { name: 'EV_Tuner', avatar: 'https://ui-avatars.com/api/?name=EV+Tuner&background=1A1A1A&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Seal', speakingStyle: 'technical', catchphrase: 'specs don\'t lie', emoji: '🔧', activeHours: 'night' },
  { name: 'AeroQueen', avatar: 'https://ui-avatars.com/api/?name=Aero+Queen&background=FF1493&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Yangwang U9', speakingStyle: 'fierce', catchphrase: 'watch this', emoji: '👑', activeHours: 'evening' },
  { name: 'DriftKing', avatar: 'https://ui-avatars.com/api/?name=Drift+King&background=00BFFF&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Seal Performance', speakingStyle: 'chill', catchphrase: 'that\'s wild', emoji: '🔄', activeHours: 'all' },
  { name: 'BYD_Girlie', avatar: 'https://ui-avatars.com/api/?name=BYD+Girlie&background=FF69B4&color=fff&size=256&bold=true', role: 'BYD Stan', energy: 'high', favModel: 'Seal', speakingStyle: 'stan', catchphrase: 'stream BYD', emoji: '💅', activeHours: 'all' },
  { name: 'BladeBattery', avatar: 'https://ui-avatars.com/api/?name=Blade+Battery&background=00FF88&color=fff&size=256&bold=true', role: 'BYD Stan', energy: 'high', favModel: 'Han', speakingStyle: 'scientific', catchphrase: 'the Blade Battery tho', emoji: '🔋', activeHours: 'all' },
  { name: 'Tesla2BYD', avatar: 'https://ui-avatars.com/api/?name=Tesla+2+BYD&background=00BFFF&color=fff&size=256&bold=true', role: 'EV Expert', energy: 'high', favModel: 'Seal', speakingStyle: 'analytical', catchphrase: 'the data shows', emoji: '📊', activeHours: 'all' },
  { name: 'RoadTripKing', avatar: 'https://ui-avatars.com/api/?name=Road+Trip+King&background=E67E22&color=fff&size=256&bold=true', role: 'Lifestyle', energy: 'high', favModel: 'Tang', speakingStyle: 'adventurous', catchphrase: 'let\'s ride', emoji: '🗺️', activeHours: 'weekend' },
  { name: 'CitySlicker', avatar: 'https://ui-avatars.com/api/?name=City+Slicker&background=1ABC9C&color=fff&size=256&bold=true', role: 'Lifestyle', energy: 'medium', favModel: 'Dolphin', speakingStyle: 'urban', catchphrase: 'city life', emoji: '🏙️', activeHours: 'day' },
  { name: 'CarMom', avatar: 'https://ui-avatars.com/api/?name=Car+Mom&background=2ECC71&color=fff&size=256&bold=true', role: 'Family Driver', energy: 'medium', favModel: 'ATTO 3', speakingStyle: 'practical', catchphrase: 'mom approved', emoji: '👩‍👧‍👦', activeHours: 'afternoon' },
  { name: 'ValueHunter', avatar: 'https://ui-avatars.com/api/?name=Value+Hunter&background=3498DB&color=fff&size=256&bold=true', role: 'Financial', energy: 'medium', favModel: 'Dolphin', speakingStyle: 'savvy', catchphrase: 'best bang for buck', emoji: '💰', activeHours: 'all' },
  { name: 'TechBro', avatar: 'https://ui-avatars.com/api/?name=Tech+Bro&background=9B59B6&color=fff&size=256&bold=true', role: 'Tech Reviewer', energy: 'high', favModel: 'Han', speakingStyle: 'techie', catchphrase: 'the tech is insane', emoji: '💻', activeHours: 'night' },
  { name: 'PracticalPete', avatar: 'https://ui-avatars.com/api/?name=Practical+Pete&background=7F8C8D&color=fff&size=256&bold=true', role: 'Practical Buyer', energy: 'medium', favModel: 'Seagull', speakingStyle: 'down‑to‑earth', catchphrase: 'real talk', emoji: '🤝', activeHours: 'all' },
];

// ============================================
// 🧠 RICH TOPIC CONTENT – real conversation snippets
// ============================================
const topicContent = {
  'Blade Battery safety testing': {
    questions: [
      "Has anyone seen the nail penetration test results? How does it compare to NMC batteries?",
      "Is the Blade Battery really as safe as they claim? Looking for real‑world data.",
      "How does LFP chemistry make the Blade Battery safer exactly?"
    ],
    answers: [
      "The Blade Battery passed the nail penetration test without fire or smoke. NMC batteries ignite within seconds. Huge difference.",
      "LFP chemistry is inherently stable – it doesn't produce oxygen when breaking down, so thermal runaway is nearly impossible.",
      "I watched a teardown – the cells are arranged like blades, which helps with cooling and structural rigidity. Brilliant engineering."
    ],
    opinions: [
      "The Blade Battery is why I chose BYD. Safety first for my family.",
      "After seeing the puncture test comparisons, I'm convinced LFP is the future.",
      "BYD under‑markets their battery safety – it's a massive selling point they barely mention."
    ]
  },
  '800V charging architecture': {
    questions: [
      "Does the Seal support true 800V charging? Heard mixed things.",
      "How much faster is 800V vs 400V in real‑world charging?",
      "Is 800V worth the premium or is 400V enough for occasional road trips?"
    ],
    answers: [
      "The Seal uses a 550V system – not true 800V but way faster than 400V. 10‑80% in ~30 minutes on a 150kW charger.",
      "800V cuts charging time nearly in half. Kia EV6 and Taycan charge insanely fast.",
      "For daily driving, 400V is plenty. If you road trip often, 800V makes a huge difference."
    ],
    opinions: [
      "800V is nice but I charge at home 95% of the time. Not worth the extra cost for me.",
      "Once you experience 800V, you'll never go back. 18 minutes to 80% is game‑changing.",
      "BYD should make 800V standard across all models – it's becoming a competitive disadvantage."
    ]
  },
  'Seal Performance vs Model 3': {
    questions: [
      "Has anyone driven both the Seal Performance and Model 3 Performance? How do they compare?",
      "Is the Seal really $8k cheaper than a comparably specced Model 3?",
      "Which has better build quality – Seal or Model 3?"
    ],
    answers: [
      "Test drove both. Seal is quieter, rides smoother, interior feels more premium. Model 3 has better software and app.",
      "Yes, comparably equipped the Seal is about $8k less, before BYD's better warranty. Value is hard to beat.",
      "Seal's panel gaps are more consistent, paint quality is better. Tesla's app ecosystem and OTA updates are superior."
    ],
    opinions: [
      "I chose the Seal after testing both – better value, more comfortable ride, and physical climate buttons.",
      "Tesla's Supercharger network is still the killer feature. Road tripping in a Seal requires more planning.",
      "The Seal feels like a luxury car at a mainstream price. The Model 3 feels like a tech gadget on wheels."
    ]
  },
  'ATTO 3 interior quality': {
    questions: [
      "How's the ATTO 3 interior holding up after a year? Any rattles?",
      "Is the rotating screen useful or just a gimmick?",
      "How does the interior compare to a VW ID.4 or Ioniq 5?"
    ],
    answers: [
      "18 months in, interior still looks new. No rattles, no sagging seats. The vegan leather is durable.",
      "I use the rotating screen daily – vertical for navigation, horizontal for everything else. Not a gimmick.",
      "ATTO 3 interior is more playful than ID.4 – guitar string pockets, wavy dash. ID.4 is more conservative."
    ],
    opinions: [
      "The ATTO 3 interior punches way above its price point. People think it's a $50k car inside.",
      "Wish they'd tone down some design elements. Guitar strings are cool but the wavy dash is a bit much.",
      "Build quality exceeded my expectations coming from a Honda. Genuinely impressive."
    ]
  },
  'Dolphin city driving': {
    questions: [
      "How's the Dolphin in tight city parking? As nimble as it looks?",
      "What's the real‑world city range? EPA numbers seem optimistic.",
      "Is it comfortable for taller drivers (6'2)?"
    ],
    answers: [
      "Turning radius is crazy small – I can U‑turn on narrow streets my old Civic couldn't manage.",
      "I get 190‑210 miles real city range with AC on. City driving is actually more efficient.",
      "Upright seating gives good headroom. I'm 6'1 and have 3 inches clearance. Glass roof helps."
    ],
    opinions: [
      "Dolphin is the perfect city car. Small enough to park anywhere, doesn't feel cramped.",
      "Handles 70mph fine but it's happiest under 55 – that's where it shines.",
      "For the price, nothing comes close. Bolt is cheaper but Dolphin has more features and faster charging."
    ]
  },
  'Han luxury features': {
    questions: [
      "Are the massage seats in the Han actually good or just a gimmick?",
      "How does the Han's interior compare to a BMW 5 Series or E‑Class?",
      "Is the Dynaudio sound system worth the upgrade?"
    ],
    answers: [
      "Massage seats have 5 programs and work well on long drives – not as strong as a real massage but definitely noticeable.",
      "Interior quality rivals the Germans at half the price. Real wood trim, Nappa leather, soft‑touch everywhere.",
      "Dynaudio system is excellent – 12 speakers, dedicated subwoofer. Crystal clear, deep bass. Worth it."
    ],
    opinions: [
      "The Han convinced me that Chinese cars can be luxury. It's not copying – it has its own design language.",
      "Customer service is where the gap still exists. BMW and Mercedes have decades of experience.",
      "You get S‑Class features for E‑Class money. Value is insane."
    ]
  },
  'Yangwang U8 off‑road capability': {
    questions: [
      "Can the U8 really float on water? Sounds like science fiction.",
      "How does the U8 compare to a Land Rover Defender off‑road?",
      "Is the U8 practical as a daily driver or too extreme?"
    ],
    answers: [
      "Yes, it can float for 30 minutes in up to 1.4m of water. Uses wheels as propellers – emergency feature, not recreation.",
      "1100 hp, individual wheel motors, tank turns. Genuinely capable – beats Defender on specs.",
      "Despite extreme capability, it's luxurious on‑road. Air suspension, massage seats, 23‑speaker sound system."
    ],
    opinions: [
      "The U8 is BYD's halo car – proves they can compete with anyone.",
      "I don't need off‑road, but the tech trickles down to other models. That's exciting.",
      "Pricey, but you get Range Rover capability with Rolls‑Royce tech. Hard to beat the proposition."
    ]
  },
  'home charger installation': {
    questions: [
      "What did you pay for Level 2 installation? Getting wild quotes.",
      "Does BYD cover any of the installation cost?",
      "Can I install a charger myself or does it legally require an electrician?"
    ],
    answers: [
      "Paid $1,200 total including ChargePoint Home Flex + professional install. Took about 3 hours.",
      "BYD covers up to $1,000 in certain states – check with BladeBot for your eligibility.",
      "Legally need a licensed electrician. Quotes ranged from $800 to $2,200. Shop around."
    ],
    opinions: [
      "Installation cost was worth every penny. Waking up to a full battery every day is life‑changing.",
      "Wish BYD included free installation like some competitors – adds up when you're already spending $40k+.",
      "Don't cheap out on the electrician. A bad install can be dangerous – hire an EV specialist."
    ]
  },
  'winter range impact': {
    questions: [
      "How much range do you actually lose in freezing temps?",
      "Does the heat pump make a big difference or is it marginal?",
      "Any tips for maximizing range in winter? First winter coming up."
    ],
    answers: [
      "I lose about 25% at 25°F. Preheating while plugged in helps a lot.",
      "Heat pump absolutely worth it. Old EV lost 40% in winter. Seal loses 25% max.",
      "Use seat heaters instead of cabin heat, preheat while plugged in, keep tires at 42 PSI."
    ],
    opinions: [
      "Winter range loss is real but totally manageable if you have home charging.",
      "Range anxiety is worse than actual loss – after one winter you stop worrying.",
      "Heat pump should be standard, not an option. It pays for itself in two winters."
    ]
  },
  'BYD vs Tesla competition': {
    questions: [
      "Is BYD really outselling Tesla globally? Numbers seem unbelievable.",
      "What advantages does BYD have over Tesla besides price?",
      "Will BYD overtake Tesla in the US eventually?"
    ],
    answers: [
      "Yes, BYD sold more EVs than Tesla in Q4 2024 globally. Strength in China and Europe drives volume.",
      "BYD makes their own batteries and chips – controls costs. Build quality is more consistent.",
      "Will likely surpass Tesla in US within 3‑5 years once Mexico factory is operational and NACS access gained."
    ],
    opinions: [
      "Competition is great for consumers. Tesla's dominance made them complacent.",
      "Vertical integration is BYD's secret weapon – huge cost advantage.",
      "Tesla still leads in software and charging. BYD wins on value and build quality. Different strengths."
    ]
  },
  // -- Add more topics as needed (you can extend this object) --
};

// ============================================
// NATURAL TOPIC DATABASE (references the rich content)
// ============================================
const conversationTopics = [
  { category: 'ev_tech', weight: 1.2, topics: ['Blade Battery safety testing', '800V charging architecture', 'battery thermal management', 'regenerative braking efficiency', 'V2L and V2G potential'] },
  { category: 'model_discussion', weight: 1.5, topics: ['Seal Performance vs Model 3', 'ATTO 3 interior quality', 'Dolphin city driving', 'Han luxury features', 'Yangwang U8 off‑road capability'] },
  { category: 'ownership', weight: 1.3, topics: ['home charger installation', 'maintenance costs over time', 'winter range impact', 'software update experiences', 'road trip charging strategies'] },
  { category: 'buying_advice', weight: 1.4, topics: ['EV tax credit eligibility', 'financing vs leasing', 'trade‑in negotiation', 'first‑time EV owner tips', 'total cost of ownership'] },
  { category: 'industry', weight: 1.0, topics: ['BYD vs Tesla competition', 'battery tech breakthroughs', 'government EV policies', 'EV adoption trends'] },
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
      lastMessageType: null,
      conversationPhase: 'opening',
      activeParticipants: new Set(),
      conversationHeat: 0,
      lastActivityTime: Date.now(),
      messageCount: 0,
    });
  }
  return conversationMemory.get(guildId);
}

// ============================================
// 🧠 INTELLIGENT RESPONSE GENERATION (using rich content)
// ============================================
function analyzeConversationMood(messages) {
  const recent = messages.slice(-5);
  let excitement = 0, questions = 0;
  for (const msg of recent) {
    if (msg.message.includes('!')) excitement += 0.2;
    if (msg.message.includes('?')) questions += 0.3;
  }
  if (excitement > 0.6) return 'excited';
  if (questions > 0.8) return 'curious';
  return 'balanced';
}

function getCurrentTimeContext() {
  const hour = new Date().getHours();
  for (const [key, ctx] of Object.entries(timeContexts)) {
    if (hour >= ctx.hourRange[0] && hour < ctx.hourRange[1]) return { ...ctx, key };
  }
  return timeContexts.evening;
}

function generateNaturalResponse(persona, topic, phase, messageType, memory, timeContext, mood) {
  const topicName = topic?.topic || 'electric vehicles';
  const content = topicContent[topicName];
  const timeGreeting = getRandomItem(timeContext.greetings);

  // If we have rich content, use it
  if (content) {
    return generateRichResponse(persona, topicName, content, phase, messageType, memory, timeGreeting, mood);
  }
  // Fallback for topics without rich content (should not happen with current topics)
  return `${timeGreeting}. Anyone have thoughts on ${topicName.toLowerCase()}?`;
}

function generateRichResponse(persona, topicName, content, phase, messageType, memory, timeGreeting, mood) {
  const lastMsg = memory.messages[memory.messages.length - 1];
  const wasQuestion = lastMsg?.message?.includes('?');

  switch (phase) {
    case 'opening':
      // Start with a real question from the content
      if (content.questions?.length) {
        let q = getRandomItem(content.questions);
        if (persona.catchphrase && Math.random() < 0.3) {
          q = `${persona.catchphrase}! ${q.toLowerCase()}`;
        }
        return `${timeGreeting}. ${q}`;
      }
      return `${timeGreeting}. Been thinking about ${topicName.toLowerCase()} lately. Anyone else?`;

    case 'discussion':
      // Answer if someone asked a question
      if (wasQuestion && content.answers?.length) {
        let ans = getRandomItem(content.answers);
        if (persona.catchphrase && Math.random() < 0.4) {
          ans = `${persona.catchphrase} – ${ans.toLowerCase()}`;
        }
        return ans;
      }
      // Otherwise mix opinions/answers based on messageType
      if (messageType === 'question' && content.questions?.length) {
        return getRandomItem(content.questions);
      }
      if (messageType === 'reaction') {
        const reactions = [
          `That's a good point. ${getRandomItem(content.opinions || content.answers)}`,
          `Interesting. I hadn't thought of it that way. ${getRandomItem(content.opinions || content.answers)}`,
          `In my experience, ${getRandomItem(content.answers || content.opinions).toLowerCase()}`,
        ];
        return getRandomItem(reactions);
      }
      // Default – opinion or answer
      const pool = [...(content.opinions || []), ...(content.answers || [])];
      if (pool.length) {
        let msg = getRandomItem(pool);
        if (persona.catchphrase && Math.random() < 0.25) {
          msg = `${persona.catchphrase} – ${msg.toLowerCase()}`;
        }
        return msg;
      }
      return getRandomItem(content.questions || [`What's your take on ${topicName}?`]);

    case 'deep_dive':
      if (messageType === 'analysis' || messageType === 'technical') {
        const analytical = [
          `Looking at the data: ${getRandomItem(content.answers || content.opinions)}`,
          `From a technical standpoint, ${getRandomItem(content.answers || content.opinions)}`,
          `Breaking it down objectively: ${getRandomItem(content.answers || content.opinions)}`,
        ];
        return getRandomItem(analytical);
      }
      const deep = [
        `The more I learn about ${topicName}, the more I realize it's a game‑changer. ${getRandomItem(content.opinions || content.answers)}`,
        `Here's something most people miss: ${getRandomItem(content.answers || content.opinions)}`,
        `I've been following this closely. ${getRandomItem(content.answers || content.opinions)}`,
      ];
      return getRandomItem(deep);

    case 'wrapping':
      if (content.opinions?.length) {
        const wrap = [
          `Great discussion! My takeaway: ${getRandomItem(content.opinions)}`,
          `Lots of good perspectives. Personally, ${getRandomItem(content.opinions).toLowerCase()}`,
          `If anyone wants to know more about ${topicName}, happy to share my experience.`,
        ];
        return getRandomItem(wrap);
      }
      return `Good talk about ${topicName}. Anyone have more questions?`;

    default:
      // fallback
      const fallbackPool = content.answers || content.opinions || content.questions;
      if (fallbackPool?.length) {
        let msg = getRandomItem(fallbackPool);
        if (persona.catchphrase && Math.random() < 0.3) {
          msg = `${persona.catchphrase} – ${msg.toLowerCase()}`;
        }
        return msg;
      }
      return `I've got thoughts on ${topicName}. Anyone else interested?`;
  }
}

// ============================================
// INTELLIGENT TOPIC SELECTION (prefers topics with rich content)
// ============================================
function selectIntelligentTopic(memory) {
  const recentTopics = memory.messages.slice(-10).map(m => m.topicName).filter(Boolean);
  const topicsWithContent = conversationTopics.filter(cat =>
    cat.topics.some(t => topicContent[t] && !recentTopics.includes(t))
  );
  const available = topicsWithContent.length ? topicsWithContent : conversationTopics;
  const category = getRandomItem(available);
  const topicsInCat = category.topics.filter(t => topicContent[t]);
  const topic = topicsInCat.length ? getRandomItem(topicsInCat) : getRandomItem(category.topics);
  return { category: category.category, topic };
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
  const filtered = types.filter(([t]) => t !== lastType);
  const total = filtered.reduce((s, [, w]) => s + w, 0);
  let rand = Math.random() * total;
  for (const [t, w] of filtered) {
    rand -= w;
    if (rand <= 0) return t;
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
// WELCOME MESSAGES (natural, no emoji spam)
// ============================================
const welcomeMessages = [
  "Hey {{user}}, welcome to the BYD community. What brings you here?",
  "Welcome {{user}}. Another EV enthusiast joins the conversation.",
  "Hey {{user}}, glad you found us. Have any EV questions?",
  "Welcome aboard {{user}}. Feel free to ask about anything EV related.",
  "Hey {{user}}, nice to have you here. What BYD models are you interested in?"
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
// MAIN LOBBY CHATTER SCHEDULER
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
        try { personas = JSON.parse(personas); } catch { personas = activePersonas; }
      }
      if (!personas?.length) personas = activePersonas;

      const mem = getGuildMemory(guild.id);
      const timeContext = getCurrentTimeContext();
      const mood = analyzeConversationMood(mem.messages);
      const isStale = (Date.now() - mem.lastActivityTime) > 7200000;

      if (isStale || !mem.currentTopic) {
        mem.currentTopic = selectIntelligentTopic(mem);
        mem.conversationPhase = 'opening';
        mem.messageCount = 0;
      }

      // Select persona (avoid same speaker)
      let avail = personas.filter(p => p.name !== mem.lastSpeaker);
      if (timeContext.key !== 'all') {
        avail = avail.filter(p => p.activeHours === 'all' || p.activeHours === timeContext.key);
      }
      if (!avail.length) avail = personas;
      const persona = getRandomItem(avail);

      const msgType = getMessageType(mem.conversationPhase, mem.lastMessageType);
      const message = generateNaturalResponse(persona, mem.currentTopic, mem.conversationPhase, msgType, mem, timeContext, mood);

      const wc = await getWebhookClient(config.lobby_webhook_url);
      const success = await sendAsPersona(wc, persona, message);

      if (success) {
        mem.messages.push({
          persona: persona.name,
          message,
          type: msgType,
          topicName: mem.currentTopic?.topic,
          timestamp: Date.now()
        });
        mem.lastSpeaker = persona.name;
        mem.lastMessageType = msgType;
        mem.messageCount++;
        mem.lastActivityTime = Date.now();
        mem.activeParticipants.add(persona.name);
        mem.conversationHeat = Math.min(100, mem.conversationHeat + 5);

        // Phase progression
        if (mem.messageCount >= 10) mem.conversationPhase = 'wrapping';
        else if (mem.messageCount >= 5) mem.conversationPhase = 'deep_dive';
        else if (mem.messageCount >= 2) mem.conversationPhase = 'discussion';

        // Trim memory
        if (mem.messages.length > CONFIG.maxContextMessages) {
          mem.messages = mem.messages.slice(-CONFIG.maxContextMessages);
        }
        sent++;
      }

      // Human‑like delay
      const isPeak = hour >= CONFIG.peakHoursStart && hour < CONFIG.peakHoursEnd;
      const isWeekend = [0, 6].includes(new Date().getDay());
      let delay = Math.random() * (CONFIG.maxDelay - CONFIG.minDelay) + CONFIG.minDelay;
      if (isPeak) delay *= 0.7;
      if (isWeekend) delay *= 1.2;
      await new Promise(r => setTimeout(r, Math.min(delay, 600000)));

    } catch (err) {
      logger.error(`Lobby failed for ${guild.id}: ${err.message}`);
    }
  }
  if (sent > 0) logger.info(`Lobby: ${sent} messages sent`);
}

let schedulerRunning = false;
function startLobbyChatterScheduler(client) {
  if (schedulerRunning) return;
  schedulerRunning = true;
  cron.schedule(CONFIG.schedule, () => runLobbyChatter(client));
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
}

// Welcome queue
const welcomeQueue = [];
function queueWelcomeMessage(guildId, memberId, client) {
  welcomeQueue.push({ guildId, memberId, client });
  setTimeout(() => processWelcomeQueue(), 3000);
}
async function processWelcomeQueue() {
  while (welcomeQueue.length) {
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