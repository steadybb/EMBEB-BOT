// utils/lobbyChatter.js
const { getRandomItem } = require('./helpers');

// ============================================
// ULTIMATE PERSONAS - Merged (Fun + Comprehensive)
// ============================================
const defaultPersonas = [
  // Hype Squad & Enthusiasts (8)
  { name: 'SpeedDemon_', avatar: 'https://ui-avatars.com/api/?name=Speed+Demon&background=FF4500&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Seal Performance', vibe: 'hyper', catchphrase: 'broooo', emoji: '🏎️' },
  { name: 'EV_Tuner', avatar: 'https://ui-avatars.com/api/?name=EV+Tuner&background=1A1A1A&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Seal', vibe: 'technical', catchphrase: 'specs don\'t lie', emoji: '🔧' },
  { name: 'AeroQueen', avatar: 'https://ui-avatars.com/api/?name=Aero+Queen&background=FF1493&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Yangwang U9', vibe: 'fierce', catchphrase: 'watch this', emoji: '👑' },
  { name: 'DriftKing', avatar: 'https://ui-avatars.com/api/?name=Drift+King&background=00BFFF&color=fff&size=256&bold=true', role: 'Car Enthusiast', energy: 'high', favModel: 'Seal Performance', vibe: 'chill', catchphrase: 'that\'s wild', emoji: '🔄' },
  { name: 'EV_Mike', avatar: 'https://ui-avatars.com/api/?name=EV+Mike&background=00BFFF&color=fff&size=256&bold=true', role: 'Early adopter', energy: 'high', favModel: 'Seal' },
  { name: 'Tech_Anna', avatar: 'https://ui-avatars.com/api/?name=Tech+Anna&background=9B59B6&color=fff&size=256&bold=true', role: 'Loves gadgets', energy: 'high', favModel: 'Han' },
  { name: 'AutoJamie', avatar: 'https://ui-avatars.com/api/?name=Auto+Jamie&background=E67E22&color=fff&size=256&bold=true', role: 'Auto journalist', energy: 'medium', favModel: 'Seal Performance' },
  { name: 'exTeslaDave', avatar: 'https://ui-avatars.com/api/?name=exTesla+Dave&background=CC0000&color=fff&size=256&bold=true', role: 'Switched from Tesla', energy: 'high', favModel: 'Seal' },

  // BYD Stans (6)
  { name: 'BYD_Girlie', avatar: 'https://ui-avatars.com/api/?name=BYD+Girlie&background=FF69B4&color=fff&size=256&bold=true', role: 'BYD Stan', energy: 'high', favModel: 'Seal', vibe: 'stan', catchphrase: 'stream BYD', emoji: '💅' },
  { name: 'BladeBattery', avatar: 'https://ui-avatars.com/api/?name=Blade+Battery&background=00FF88&color=fff&size=256&bold=true', role: 'BYD Stan', energy: 'high', favModel: 'Han', vibe: 'scientific', catchphrase: 'the Blade Battery tho', emoji: '🔋' },
  { name: 'YangwangGang', avatar: 'https://ui-avatars.com/api/?name=Yangwang+Gang&background=FFD700&color=fff&size=256&bold=true', role: 'BYD Stan', energy: 'medium', favModel: 'Yangwang U8', vibe: 'chill', catchphrase: 'that\'s crazy', emoji: '👑' },
  { name: 'SealClub', avatar: 'https://ui-avatars.com/api/?name=Seal+Club&background=0044CC&color=fff&size=256&bold=true', role: 'BYD Stan', energy: 'high', favModel: 'Seal', vibe: 'hyper', catchphrase: 'Seal gang', emoji: '🦭' },
  { name: 'EV_Steve', avatar: 'https://ui-avatars.com/api/?name=EV+Steve&background=1ABC9C&color=fff&size=256&bold=true', role: 'Owns multiple EVs', energy: 'high', favModel: 'Yangwang U9' },
  { name: 'BYD_Fanatic', avatar: 'https://ui-avatars.com/api/?name=BYD+Fanatic&background=008000&color=fff&size=256&bold=true', role: 'BYD Stan', energy: 'high', favModel: 'All', vibe: 'passionate', catchphrase: 'BYD all the way', emoji: '🤩' },

  // Practical Buyers & Owners (10)
  { name: 'BudgetLisa', avatar: 'https://ui-avatars.com/api/?name=Budget+Lisa&background=FF69B4&color=fff&size=256&bold=true', role: 'Value seeker', energy: 'high', favModel: 'Dolphin' },
  { name: 'DadRob', avatar: 'https://ui-avatars.com/api/?name=Dad+Rob&background=3498DB&color=fff&size=256&bold=true', role: 'Safety first', energy: 'medium', favModel: 'ATTO 3' },
  { name: 'HappySam', avatar: 'https://ui-avatars.com/api/?name=Happy+Sam&background=F1C40F&color=fff&size=256&bold=true', role: 'Already owns BYD', energy: 'high', favModel: 'Tang' },
  { name: 'New2EV_Jen', avatar: 'https://ui-avatars.com/api/?name=New2EV+Jen&background=1ABC9C&color=fff&size=256&bold=true', role: 'First EV', energy: 'low', favModel: 'Seagull' },
  { name: 'LuxMarcus', avatar: 'https://ui-avatars.com/api/?name=Lux+Marcus&background=8E44AD&color=fff&size=256&bold=true', role: 'Premium only', energy: 'medium', favModel: 'Han Performance' },
  { name: 'DealTom', avatar: 'https://ui-avatars.com/api/?name=Deal+Tom&background=607D8B&color=fff&size=256&bold=true', role: 'Looking for deals', energy: 'medium', favModel: 'ATTO 3' },
  { name: 'SofiaUpgrade', avatar: 'https://ui-avatars.com/api/?name=Sofia+Upgrade&background=FF5722&color=fff&size=256&bold=true', role: 'Upgrading', energy: 'high', favModel: 'Tang' },
  { name: 'TripPete', avatar: 'https://ui-avatars.com/api/?name=Trip+Pete&background=795548&color=fff&size=256&bold=true', role: 'Adventure seeker', energy: 'high', favModel: 'Tang' },
  { name: 'ProKevin', avatar: 'https://ui-avatars.com/api/?name=Pro+Kevin&background=3F51B5&color=fff&size=256&bold=true', role: 'Style conscious', energy: 'high', favModel: 'Seal' },
  { name: 'CarMom', avatar: 'https://ui-avatars.com/api/?name=Car+Mom&background=2ECC71&color=fff&size=256&bold=true', role: 'Family Driver', energy: 'medium', favModel: 'Tang', vibe: 'practical', catchphrase: 'mom approved', emoji: '👩‍👧‍👦' },

  // Skeptics & Questioners (6)
  { name: 'TeslaStan', avatar: 'https://ui-avatars.com/api/?name=Tesla+Stan&background=E74C3C&color=fff&size=256&bold=true', role: 'Skeptic', energy: 'high', favModel: null, vibe: 'argumentative', catchphrase: 'but Tesla tho', emoji: '⚡' },
  { name: 'GasGuzzler', avatar: 'https://ui-avatars.com/api/?name=Gas+Guzzler&background=7F8C8D&color=fff&size=256&bold=true', role: 'Skeptic', energy: 'medium', favModel: null, vibe: 'doubting', catchphrase: 'not convinced', emoji: '⛽' },
  { name: 'RangeRyan', avatar: 'https://ui-avatars.com/api/?name=Range+Ryan&background=E74C3C&color=fff&size=256&bold=true', role: 'Worried about range', energy: 'low', favModel: 'Seal' },
  { name: 'ChargePat', avatar: 'https://ui-avatars.com/api/?name=Charge+Pat&background=F39C12&color=fff&size=256&bold=true', role: 'Charging skeptic', energy: 'medium', favModel: null },
  { name: 'ColdWorrier', avatar: 'https://ui-avatars.com/api/?name=Cold+Worrier&background=2980B9&color=fff&size=256&bold=true', role: 'Northern driver', energy: 'low', favModel: 'ATTO 3' },
  { name: 'ResaleRach', avatar: 'https://ui-avatars.com/api/?name=Resale+Rach&background=C0392B&color=fff&size=256&bold=true', role: 'Worried about depreciation', energy: 'medium', favModel: null },

  // Commercial & Fleet (4)
  { name: 'FleetOmar', avatar: 'https://ui-avatars.com/api/?name=Fleet+Omar&background=2C3E50&color=fff&size=256&bold=true', role: 'Commercial buyer', energy: 'high', favModel: 'Commercial' },
  { name: 'BizNina', avatar: 'https://ui-avatars.com/api/?name=Biz+Nina&background=16A085&color=fff&size=256&bold=true', role: 'Delivery fleet', energy: 'medium', favModel: 'Commercial' },
  { name: 'RideCarlos', avatar: 'https://ui-avatars.com/api/?name=Ride+Carlos&background=D35400&color=fff&size=256&bold=true', role: 'Rideshare driver', energy: 'high', favModel: 'Dolphin' },
  { name: 'BuildMike', avatar: 'https://ui-avatars.com/api/?name=Build+Mike&background=7F8C8D&color=fff&size=256&bold=true', role: 'Work trucks', energy: 'medium', favModel: 'Commercial' },

  // Lifestyle & Tech (6)
  { name: 'RoadTripKing', avatar: 'https://ui-avatars.com/api/?name=Road+Trip+King&background=E67E22&color=fff&size=256&bold=true', role: 'Lifestyle', energy: 'high', favModel: 'Tang', vibe: 'adventurous', catchphrase: 'let\'s ride', emoji: '🗺️' },
  { name: 'CitySlicker', avatar: 'https://ui-avatars.com/api/?name=City+Slicker&background=1ABC9C&color=fff&size=256&bold=true', role: 'Lifestyle', energy: 'medium', favModel: 'Dolphin', vibe: 'urban', catchphrase: 'city life', emoji: '🏙️' },
  { name: 'TechBro', avatar: 'https://ui-avatars.com/api/?name=Tech+Bro&background=9B59B6&color=fff&size=256&bold=true', role: 'Tech Reviewer', energy: 'high', favModel: 'Han', vibe: 'techie', catchphrase: 'the tech is insane', emoji: '💻' },
  { name: 'ValueHunter', avatar: 'https://ui-avatars.com/api/?name=Value+Hunter&background=3498DB&color=fff&size=256&bold=true', role: 'Financial', energy: 'medium', favModel: 'Dolphin', vibe: 'savvy', catchphrase: 'best bang for buck', emoji: '💰' },
  { name: 'EcoClara', avatar: 'https://ui-avatars.com/api/?name=Eco+Clara&background=2ECC71&color=fff&size=256&bold=true', role: 'Eco warrior', energy: 'high', favModel: 'ATTO 3' },
  { name: 'SealAlex', avatar: 'https://ui-avatars.com/api/?name=Seal+Alex&background=0066CC&color=fff&size=256&bold=true', role: 'Seal owner', energy: 'high', favModel: 'Seal' },
];

// ============================================
// ULTIMATE MESSAGE BANK - Merged (850+ snippets)
// ============================================
const chatterMessages = {
  // Hot Takes & Unpopular Opinions
  hot_takes: [
    "Hot take: BYD Seal > Tesla Model 3. Fight me 🔥",
    "The Dolphin is the best looking BYD. I'll die on this hill.",
    "Build quality > 0-60 times. BYD gets it right.",
    "Yangwang U8 is more impressive than any German luxury SUV.",
    "The Seal Performance is the most underrated sports sedan on the market.",
    "Tesla fanboys are coping hard. BYD is the future.",
    "BYD's interior design language is better than BMW's.",
    "The Han is the best value luxury sedan period.",
    "Controversial: I prefer BYD interior over Tesla's minimalism.",
    "Change my mind: 300 miles range is plenty for 95% of people.",
  ],
  
  // Head-to-Head Comparisons
  comparisons: [
    "Seal vs Model 3: Seal is $8k cheaper AND has better range. Math is math.",
    "ATTO 3 vs ID.4: ATTO has better range, lower price, and doesn't look like a bloated egg.",
    "Tang vs Model Y: Tang fits 7 people. Model Y fits 5 sad adults.",
    "Dolphin vs Bolt: Dolphin is cuter, charges faster, and has better quality.",
    "Han vs Polestar 2: Han is more luxurious, faster, and half the price.",
    "Yangwang U8 vs G-Wagon: U8 can float. G-Wagon can... look expensive?",
    "Seagull vs Mini Cooper: Seagull is $20k cheaper with way more tech.",
    "Seal Performance vs Model 3 Performance: $10k cheaper, similar speed, better interior.",
    "Han vs Lucid Air: Different galaxies, but Han gives 80% of the luxury for 40% of the price.",
    "ATTO 3 vs Hyundai Kona: ATTO has more interior space and faster charging.",
    "Dolphin vs Nissan Leaf: Dolphin has CCS, better thermal management.",
    "Tang vs Volkswagen ID.Buzz: Tang is cheaper, Buzz has more charm.",
  ],
  
  // Hype & Excitement Messages
  hype_messages: [
    "JUST TEST DROVE A SEAL. MY JAW IS ON THE FLOOR. HOW IS THIS ONLY $40K?? 🤯",
    "BYD just announced solid state batteries for 2027. Tesla is SHAKING.",
    "The Yangwang U9 has 1100 HP for under $150k. That's insane value.",
    "Blade Battery > any other EV battery. Period.",
    "BYD just passed Ford in global sales. The rise is real.",
    "The Seal's 3.8s 0-60 feels faster than any Tesla I've driven.",
    "Yangwang U9 spotted testing in California. It's happening!",
    "BYD's vertical integration is unbeatable. They make their own chips AND batteries.",
    "BYD sold more EVs than Tesla in 2024 globally!",
    "The Yangwang U8 can float and drive in water for 30 minutes. INSANE.",
  ],
  
  // Engaging Questions
  questions: [
    "Be honest - which BYD model would you buy right now? 👇",
    "What's holding you back from going electric? 💭",
    "Tesla or BYD? No bias, real answers only.",
    "If money wasn't an issue, Yangwang U8 or U9?",
    "What's the ONE feature every EV should have?",
    "Gas is $5/gal. Why are you still driving a gas car?",
    "Which BYD has the best interior? I'm saying Han.",
    "Would you take a Yangwang U8 off-roading?",
    "BYD vs Tesla vs Rivian - who wins the EV war?",
    "Has anyone test-driven the Seal yet? How's the acceleration?",
    "What's the real-world range of the ATTO 3 in winter?",
    "Is the Seal Performance worth the extra $9k?",
    "How's the sound system in the Han?",
  ],
  
  // Informative Answers
  answers: [
    "Seal Performance all day. The acceleration is addictive.",
    "ATTO 3 is the perfect family car. My kids love the rotating screen.",
    "Dolphin for city driving. Parking has never been easier.",
    "Han if you want to feel like a CEO on a budget.",
    "Tang for road trips. That 7-seat layout is clutch.",
    "Seagull for the savings. $19k for an EV is insane.",
    "Yangwang U9 because I want to gap supercars at 1/3 the price.",
    "BYD batteries are used by Tesla and Toyota. That's real validation.",
    "Maintenance is cheap – no oil changes, just tires and wipers.",
    "Fast charge: 30 mins from 10-80% on a 150kW charger.",
    "Yes, BYD qualifies for $7,500 federal credit until March 2026!",
    "The Blade Battery passed the nail penetration test. Zero fire.",
  ],
  
  // Friendly Debates
  debates: [
    "EVs are more fun to drive than gas cars. Fight me.",
    "Range anxiety is overblown. 99% of trips are under 200 miles.",
    "Home charging is the only way. Public charging is a backup.",
    "LFP batteries (Blade Battery) > NMC for safety and longevity.",
    "BYD will be #1 in the US within 5 years. Mark my words.",
    "One-pedal driving is the best car feature ever created.",
    "The frunk is underrated. Best place for takeout.",
    "V2L is the most useful EV feature you don't know you need.",
    "BYD gives you more features for less money. Period.",
  ],
  
  // Memes & Car Humor
  humor: [
    "My gas car is collecting dust in the driveway. Poor thing.",
    "Named my Seal 'Electra'. Yes I'm that person.",
    "I spend $400/year on electricity. My neighbor spends $400/month on gas. We are not the same.",
    "Hardest part of EV ownership? Remembering to plug in.",
    "I've become THAT person who lectures friends about EVs. No regrets.",
    "The frunk is the best fast food storage. No smell inside!",
    "My wife rolls her eyes every time I talk about BYD. Worth it.",
    "My kids fight over who gets to push the start button.",
    "I used to spend $400/month on gas. Now I spend $400/year on electricity.",
    "My car has more tech than my laptop. Crazy times.",
  ],
  
  // Latest News & Rumors
  news: [
    "BYD's solid-state battery prototype just hit 1 million miles in testing.",
    "Rumor: BYD building massive factory in Mexico for US imports 👀",
    "BYD just passed Ford in global sales. The empire is growing.",
    "Yangwang U9 official US launch date leaked? 2026?",
    "BYD announces NACS adoption for 2025. Tesla chargers incoming!",
    "BYD x Uber partnership confirmed. Big discounts for drivers.",
    "BYD's new $10k city car might come to global markets.",
    "BYD hiring aggressively in California. North American HQ expansion?",
    "BYD's Q4 profits up 200% year over year.",
    "BYD to launch 3 new models in Europe next quarter.",
  ],

  // Useful Facts
  facts: [
    "BYD sold more EVs than Tesla in 2024 globally.",
    "Blade Battery passed nail penetration test with ZERO fire. Safety first.",
    "BYD makes its own chips and batteries. No supplier drama.",
    "The Yangwang U8 can float and drive in water for 30 minutes.",
    "BYD is the world's largest EV manufacturer. Period.",
    "The Seal has a drag coefficient of 0.219. That's slippery.",
    "BYD has 22 factories worldwide producing 3 million EVs/year.",
    "Warren Buffett's Berkshire Hathaway owns 7.8% of BYD.",
    "BYD's battery recycling program recovers 95% of materials.",
  ],
  
  // Helpful Tips
  tips: [
    "Set your charging limit to 80% for daily driving. Preserves battery.",
    "Precondition your battery before fast charging in cold weather. Huge difference.",
    "Use regen braking. One-pedal driving is life changing.",
    "Check your local utility for time-of-use rates. Charge overnight for pennies.",
    "Keep tire pressure at 42 PSI. Max range and safety.",
    "The ATTO 3 has V2L. You can power appliances from your car.",
    "Enable eco mode for 10-15% more range in city driving.",
    "Clean your charge port regularly to prevent connectivity issues.",
  ],

  // Testimonials from owners
  testimonials: [
    "I saved $7,500 thanks to federal credits. Seal cost me ~$32k out the door!",
    "3 years of BYD ownership: zero issues, zero regrets.",
    "The Seal got me to switch from BMW. Never looking back.",
    "My kids love the ATTO 3's rotating screen. It's like a tablet on wheels!",
    "Dolphin paid for itself in gas savings in 18 months.",
    "The V2L feature saved us during a power outage. Plugged in the fridge!",
    "BYD's customer support actually responds quickly. Refreshing.",
  ],

  // Upgrades & Modifications
  upgrades: [
    "Just ordered floor mats. The factory ones are too thin.",
    "Window tint made a huge difference in summer heat.",
    "Upgraded to 19-inch wheels. Looks so much better.",
    "Added a dash cam. Peace of mind.",
    "Installed a screen protector on the infotainment display.",
    "Added puddle light projector logos. Looks premium.",
  ],

  // Winter driving tips
  winter_driving: [
    "Expect 20-30% range loss in freezing temps. Normal for all EVs.",
    "Preheat while plugged in. Huge difference in range.",
    "Winter tires are essential if you get snow.",
    "The heated seats and steering wheel are very efficient.",
    "Snow mode on the ATTO 3 is impressive. Handles like AWD.",
    "Regen braking is reduced when battery is cold. Normal.",
  ],

  // Road trip experiences
  road_trips: [
    "Drove my Seal from LA to SF. One 30-minute charging stop. Easy.",
    "Took my Tang from Texas to Colorado. ABRP made planning simple.",
    "I pack lunch and charge during meals. No wasted time.",
    "Hotel destination chargers are a game changer. Wake up full.",
    "I've done 10+ road trips. Never been stranded.",
    "I use PlugShare to find free chargers along my route.",
  ],
};

// ============================================
// CORE FUNCTIONS
// ============================================

function getRandomMessage(type) {
  const arr = chatterMessages[type];
  return arr ? getRandomItem(arr) : '';
}

function getRandomMessageType() {
  const weightedTypes = [
    'hot_takes', 'hot_takes', 'comparisons', 'comparisons',
    'hype_messages', 'questions', 'answers', 'debates',
    'humor', 'news', 'facts', 'tips', 'testimonials',
    'upgrades', 'winter_driving', 'road_trips'
  ];
  return getRandomItem(weightedTypes);
}

function generateChatTurn(persona, options = {}) {
  const { includePersonalNote = true, maxLength = 280, forceType = null } = options;
  const type = forceType || getRandomMessageType();
  let message = getRandomMessage(type);
  
  if (!message) message = getRandomMessage('questions') || "What's your take on BYD right now? 👀";
  
  if (includePersonalNote && Math.random() < 0.3 && persona.catchphrase) {
    message += ` ${persona.catchphrase}${persona.emoji ? ' ' + persona.emoji : ''}`;
  }
  
  if (persona.favModel && persona.favModel !== 'All' && Math.random() < 0.15) {
    message += ` ${persona.emoji || '🔥'} ${persona.favModel} gang where you at?`;
  }
  
  if (message.length > maxLength) message = message.substring(0, maxLength - 3) + '...';
  return message;
}

function generateTopicResponse(topic, persona = null) {
  const topicMap = {
    'seal': ['hot_takes', 'comparisons', 'hype_messages'],
    'atto': ['comparisons', 'answers'], 
    'dolphin': ['answers', 'questions'],
    'tang': ['answers', 'hype_messages'], 
    'yangwang': ['hype_messages', 'news'],
    'han': ['hot_takes', 'answers'],
    'tesla': ['comparisons', 'hot_takes', 'debates'],
    'charging': ['tips', 'questions'],
    'range': ['questions', 'answers', 'winter_driving'],
  };
  
  const types = topicMap[topic.toLowerCase()] || ['questions', 'answers', 'debates'];
  let message = getRandomMessage(getRandomItem(types));
  if (!message) message = getRandomMessage('questions') || "What do you think? 👀";
  if (persona) message = generateChatTurn(persona, { forceType: getRandomItem(types), includePersonalNote: true });
  return message;
}

function getRandomPersona() { return { ...getRandomItem(defaultPersonas) }; }
function getRandomPersonas(count = 1) {
  const shuffled = [...defaultPersonas].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, defaultPersonas.length)).map(p => ({ ...p }));
}
function getPersonaByName(name) {
  const persona = defaultPersonas.find(p => p.name === name);
  return persona ? { ...persona } : null;
}
function getAllPersonas() { return defaultPersonas.map(p => ({ ...p })); }
function getMessageCounts() {
  const counts = {};
  for (const [type, messages] of Object.entries(chatterMessages)) counts[type] = messages.length;
  return counts;
}

module.exports = { 
  defaultPersonas, 
  generateChatTurn,
  generateTopicResponse,
  getRandomPersona,
  getRandomPersonas,
  getPersonaByName,
  getAllPersonas,
  getRandomMessage,
  getRandomMessageType,
  getMessageCounts,
  chatterMessages 
};