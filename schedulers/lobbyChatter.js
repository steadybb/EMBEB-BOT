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
// TIME-AWARE CONTEXT
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
// ENHANCED PERSONAS
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
// RICH TOPIC CONTENT - Actual conversation snippets
// ============================================
const topicContent = {
  'Blade Battery safety testing': {
    questions: [
      "Has anyone seen the nail penetration test results for the Blade Battery? Curious how it compares to NMC batteries.",
      "Is the Blade Battery really as safe as they claim? Looking for real-world data, not marketing.",
      "How does LFP chemistry make the Blade Battery safer exactly? Trying to understand the science."
    ],
    answers: [
      "The Blade Battery passed the nail penetration test without fire or smoke. NMC batteries tend to catch fire within seconds of the same test. It's a massive difference.",
      "LFP chemistry is inherently stable - it doesn't produce oxygen when it breaks down, so thermal runaway is nearly impossible. That's the key advantage.",
      "I watched a teardown video. The cells are arranged like blades (hence the name) which helps with cooling and structural rigidity. Really clever engineering."
    ],
    opinions: [
      "Honestly, the Blade Battery is why I chose BYD over Tesla. Safety first for my family, and the data backs it up.",
      "After seeing the puncture test comparisons, I'm convinced LFP is the future. NMC is too risky for daily use.",
      "I think BYD under-markets their battery safety. It's a massive selling point they barely mention in advertising.",
      "The peace of mind from knowing my battery won't catch fire is worth more than any performance spec."
    ]
  },
  '800V charging architecture': {
    questions: [
      "Does the Seal support 800V charging? I've heard mixed things and can't find a clear answer.",
      "How much faster is 800V vs 400V in real-world charging? Is it worth the premium?",
      "Is 800V charging worth it or is 400V enough for occasional road trips?"
    ],
    answers: [
      "The Seal uses a 550V system actually - not quite 800V but way faster than standard 400V. I get 10-80% in about 30 minutes on a 150kW charger.",
      "800V cuts charging time nearly in half compared to 400V. The Kia EV6 and Porsche Taycan use true 800V systems and charge insanely fast.",
      "For daily driving, 400V is plenty. But if you road trip often, 800V makes a huge difference. Fewer and shorter stops at chargers."
    ],
    opinions: [
      "800V is nice but honestly I charge at home 95% of the time. The extra cost isn't worth it for my use case.",
      "Once you experience 800V charging, you'll never want to go back. 18 minutes to 80% is absolutely game-changing.",
      "BYD should make 800V standard across all models. It's becoming a competitive disadvantage against Hyundai and Porsche."
    ]
  },
  'battery thermal management': {
    questions: [
      "How does the ATTO 3 handle battery temps in extreme heat? I live in Arizona and it gets brutal here.",
      "Does the thermal management system run while the car is parked? Worried about battery degradation.",
      "Anyone tested battery degradation in hot climates over a few years?"
    ],
    answers: [
      "BYD uses a heat pump system that's much more efficient than resistive heating. Better range in winter and keeps the battery cool in summer.",
      "The thermal management keeps the battery between 25-35°C even in 110°F weather. I live in Phoenix and it's been solid for 2 summers now.",
      "I've got 40k miles in Florida heat. Battery health still shows 98% according to the diagnostic tool. The thermal system works."
    ],
    opinions: [
      "The heat pump was worth every penny. I get 15% more range in winter compared to my old EV with resistive heating.",
      "Thermal management is something you never think about until it fails. BYD's system seems over-engineered in a good way.",
      "I was worried about battery degradation in Texas heat, but after 18 months my range is basically unchanged."
    ]
  },
  'regenerative braking efficiency': {
    questions: [
      "What regen setting do you all use for daily driving? Still trying to find the sweet spot.",
      "Does max regen actually extend range noticeably or is it mostly for feel?",
      "Anyone else find the regen too aggressive in stop-and-go traffic?"
    ],
    answers: [
      "I use level 2 regen most of the time. Level 3 is great for downhill mountain driving but too jerky in city traffic.",
      "On my commute through the mountains, regen recovers about 15% of the charge. It's actually measurable if you track it.",
      "One-pedal driving took about a week to get used to. Now I hate driving cars without it. So much smoother."
    ],
    opinions: [
      "The regen calibration in the Seal is perfect - smooth and predictable. Way better than my old Model 3 which was too aggressive.",
      "I wish BYD had a true one-pedal mode that comes to a complete stop. Having to brake at the very end defeats the purpose.",
      "Regen braking is the most underrated EV feature. My brake pads still look new at 45k miles."
    ]
  },
  'V2L and V2G potential': {
    questions: [
      "Has anyone actually used the V2L feature during a power outage? How did it work?",
      "What kind of appliances can the ATTO 3 actually power through V2L?",
      "Is V2G available yet or is it coming in a future software update?"
    ],
    answers: [
      "During our last blackout, I powered my fridge, lights, and internet router for 3 full days with my ATTO 3. V2L is absolutely incredible.",
      "The V2L adapter outputs 3.3kW - enough for most household appliances. I've run a microwave and coffee maker simultaneously without issues.",
      "V2G isn't available yet in the US but BYD has it working in China. They're waiting on regulatory approval and utility partnerships here."
    ],
    opinions: [
      "V2L is the most underrated EV feature. It's basically a whole-house backup battery on wheels. Saved us twice already.",
      "I bought a portable induction cooktop just to use with V2L on camping trips. It's amazing for tailgating too.",
      "V2G will be revolutionary once utilities support it. Imagine getting paid to stabilize the grid with your car while it's parked."
    ]
  },
  'Seal Performance vs Model 3': {
    questions: [
      "Has anyone driven both the Seal Performance and Model 3 Performance? How do they actually compare?",
      "Is the Seal really $8k cheaper than a comparably equipped Model 3? The pricing seems confusing.",
      "Which has better build quality - Seal or Model 3? I've heard mixed things about both."
    ],
    answers: [
      "I test drove both back to back. The Seal is quieter, has a smoother ride, and the interior feels more premium. Model 3 has better software and app.",
      "Yes, comparably equipped the Seal is about $8k less. That's before BYD's better warranty too. The value proposition is hard to beat.",
      "The Seal's panel gaps are more consistent than Tesla. Paint quality is better too. But Tesla's app ecosystem and OTA updates are superior."
    ],
    opinions: [
      "I chose the Seal over Model 3 after testing both. Better value, more comfortable ride, and I prefer having physical buttons for climate control.",
      "Tesla's Supercharger network is still the killer feature. Until BYD gets NACS access, road tripping in a Seal requires more planning.",
      "The Seal feels like a luxury car at a mainstream price. The Model 3 feels like a tech gadget on wheels. Different philosophies."
    ]
  },
  'ATTO 3 interior quality': {
    questions: [
      "How's the ATTO 3 interior holding up after a year or two? Any rattles or wear issues?",
      "Is the rotating screen actually useful or just a gimmick?",
      "How does the ATTO 3 interior compare to a VW ID.4 or Hyundai Ioniq 5?"
    ],
    answers: [
      "After 18 months my ATTO 3 interior still looks new. No rattles, no sagging seats. The vegan leather is surprisingly durable.",
      "I thought the rotating screen was a gimmick too, but I use it daily. Vertical mode is great for navigation, horizontal for everything else.",
      "The ATTO 3 interior is more playful than the ID.4 - guitar string door pockets, wavy dash. The ID.4 is more conservative and traditional."
    ],
    opinions: [
      "The ATTO 3 interior punches way above its price point. People think it's a $50k car when they sit inside.",
      "I wish they'd tone down some of the design elements. The guitar strings are cool but the wavy dash is a bit much for me.",
      "Build quality exceeded my expectations. Coming from a Honda, I was worried about Chinese manufacturing, but it's genuinely impressive."
    ]
  },
  'Dolphin city driving': {
    questions: [
      "How's the Dolphin in tight city parking? Is it as nimble as it looks?",
      "What's the real city range on the Dolphin? The EPA numbers seem optimistic.",
      "Is the Dolphin comfortable for taller drivers? I'm 6'2 and worried about headroom."
    ],
    answers: [
      "The turning radius is absurdly small - I can U-turn on narrow city streets that my old Civic couldn't manage. Parking is effortless.",
      "I get about 190-210 miles of real city range with AC on. The EPA rating of 260 is highway-optimized. City driving is more efficient actually.",
      "The Dolphin's upright seating position gives good headroom. I'm 6'1 and have 3 inches clearance. The glass roof helps the cabin feel airy."
    ],
    opinions: [
      "The Dolphin is the perfect city car. Small enough to park anywhere but doesn't feel cramped inside. Best urban EV for the money.",
      "I was worried about highway capability but it handles 70mph just fine. It's happiest under 55 though - that's where it shines.",
      "For the price, nothing comes close. The Bolt is cheaper but the Dolphin has more features and better charging speed."
    ]
  },
  'Han luxury features': {
    questions: [
      "Are the massage seats in the Han actually good or just a gimmick?",
      "How does the Han's interior compare to a BMW 5 Series or Mercedes E-Class?",
      "Is the Dynaudio sound system worth the upgrade over the standard audio?"
    ],
    answers: [
      "The massage seats have 5 different programs and actually work well on long drives. Not as strong as a real massage but definitely noticeable.",
      "The Han's interior quality rivals the Germans at half the price. Real wood trim, Nappa leather, soft-touch everywhere. It's genuinely premium.",
      "The Dynaudio system is excellent - 12 speakers with a dedicated subwoofer. Crystal clear at high volume with deep bass. Definitely worth it."
    ],
    opinions: [
      "The Han is what convinced me Chinese cars can be luxury. It's not just copying the Germans - it has its own design language.",
      "Customer service is where the gap still exists. BMW and Mercedes have decades of experience. BYD is improving but still learning.",
      "The value proposition is insane. You get S-Class features for E-Class money. The depreciation curve is the only real question mark."
    ]
  },
  'Yangwang U8 off-road capability': {
    questions: [
      "Can the Yangwang U8 really float on water? That sounds like science fiction.",
      "How does the U8's off-road capability compare to a Land Rover Defender?",
      "Is the U8 practical as a daily driver or is it too extreme?"
    ],
    answers: [
      "Yes, the U8 can float for 30 minutes in water up to 1.4 meters deep. It uses the wheels as propellers. It's an emergency feature, not for recreation.",
      "The U8 has 1,100 horsepower and individual wheel motors. It can do tank turns and has more ground clearance than a Defender. It's genuinely capable.",
      "Despite the extreme off-road capability, the U8 is actually a luxurious SUV on-road. Air suspension, massage seats, and a 23-speaker sound system."
    ],
    opinions: [
      "The U8 is the most impressive vehicle BYD has ever made. It's their halo car that proves they can compete with anyone.",
      "I don't need the off-road capability but the technology in the U8 trickles down to other models. That's exciting for the whole lineup.",
      "The price tag is steep but you're getting Range Rover capability with Rolls-Royce tech. Hard to beat that value proposition."
    ]
  },
  'home charger installation': {
    questions: [
      "What did you all pay for Level 2 charger installation? Getting some wild quotes.",
      "Does BYD cover any of the installation cost or is it all out of pocket?",
      "Can I install a charger myself or does it legally require an electrician?"
    ],
    answers: [
      "I paid $1,200 total including the ChargePoint Home Flex and professional installation. Took about 3 hours for the electrician.",
      "BYD covers up to $1,000 toward charger installation in certain states. Check with BladeBot for your specific eligibility.",
      "You legally need a licensed electrician. I got 3 quotes ranging from $800 to $2,200. Definitely shop around before committing."
    ],
    opinions: [
      "The installation cost was worth every penny. Waking up to a full battery every single day is absolutely life-changing.",
      "I wish BYD included free installation like some competitors. It adds up when you're already spending $40k+ on a car.",
      "Don't cheap out on the electrician. A bad install can be dangerous. Get someone who specializes in EV chargers specifically."
    ]
  },
  'maintenance costs over time': {
    questions: [
      "What's the actual maintenance cost after 2-3 years of ownership? Is it really that cheap?",
      "Are tires the only real expense? What about brake fluid and coolant changes?",
      "How much does the annual service cost at a BYD dealer?"
    ],
    answers: [
      "At 30k miles I've spent $0 on maintenance beyond tire rotations. The dealer did a $99 annual multi-point inspection.",
      "Tires lasted 35k miles and cost $900 to replace. That's been my only expense in 2 years. Brake pads still at 80% thanks to regen.",
      "Brake fluid is recommended every 2 years ($120). Coolant at 100k miles. That's it. No oil changes, no belts, no spark plugs. Nothing."
    ],
    opinions: [
      "People don't believe me when I say I haven't spent anything on maintenance. No oil changes, no belts, no spark plugs. It's ridiculous how cheap EVs are.",
      "The savings on maintenance alone justified the EV premium. My old BMW was costing me $2k/year just in routine stuff.",
      "I actually miss the ritual of oil changes. Sounds crazy but it felt like I was taking care of the car. Now I just... drive it."
    ]
  },
  'winter range impact': {
    questions: [
      "How much range do you actually lose in freezing temps? The EPA doesn't test for that.",
      "Does the heat pump make a big difference in winter range or is it marginal?",
      "Any tips for maximizing range in winter? First winter with an EV coming up."
    ],
    answers: [
      "I lose about 25% range at 25°F. Preheating the cabin and battery while plugged in helps a lot. Expect 180-200 miles instead of 260.",
      "The heat pump is absolutely worth it. My old EV with resistive heating lost 40% in winter. The Seal with heat pump loses 25% max.",
      "Use seat heaters instead of cabin heat when possible, preheat while plugged in, and keep tires at 42 PSI. I get 90% of summer range doing this."
    ],
    opinions: [
      "Winter range loss is real but totally manageable if you have home charging. I've never been stranded or even come close.",
      "Honestly, range anxiety is worse than actual range loss. After one winter you stop worrying about it and just plan accordingly.",
      "The heat pump should be standard, not an option. It pays for itself in efficiency gains within the first two winters."
    ]
  },
  'EV tax credit eligibility': {
    questions: [
      "Does the BYD Seal qualify for the full $7,500 federal credit? Getting conflicting information.",
      "How does the tax credit work if I lease vs buy? The rules seem different.",
      "Are there income limits for the EV tax credit? I might be over the threshold."
    ],
    answers: [
      "Yes, all BYD models currently qualify for the full $7,500 federal tax credit. But check the latest IRS guidance - these rules change frequently.",
      "If you lease, the credit goes to the leasing company and they pass the savings to you as a lower monthly payment. If you buy, you claim it on your taxes.",
      "Income limits: $150k single, $225k head of household, $300k married filing jointly. Also MSRP caps apply depending on vehicle type."
    ],
    opinions: [
      "The tax credit is confusing but totally worth figuring out. $7,500 is a huge discount that makes EVs cheaper than equivalent gas cars.",
      "I wish they just took it off at the point of sale like a rebate. The current tax system is unnecessarily complicated for most people.",
      "Don't count on the credit lasting forever. Political winds can shift. If you're on the fence, now is the time to buy."
    ]
  },
  'software update experiences': {
    questions: [
      "How often does BYD push OTA updates? Coming from Tesla and worried about this.",
      "Have any updates actually added new features or just bug fixes?",
      "Do updates happen automatically or do I need to approve them?"
    ],
    answers: [
      "I get updates about every 2-3 months. They're not as frequent as Tesla but they've been stable and actually improve things.",
      "The last update added improved lane centering and a new energy consumption screen. The one before that improved phone key reliability.",
      "You get a notification on the screen and in the app. You can schedule the update for overnight. It takes about 30 minutes."
    ],
    opinions: [
      "Coming from Tesla, BYD's software is less polished but more stable. I've never had an update break something that was working before.",
      "The OTA process is solid but the feature additions are conservative. Tesla is more aggressive with new features, sometimes too aggressive.",
      "BYD's software team is clearly improving. Each update is noticeably better than the last. They're on the right trajectory."
    ]
  },
  'road trip charging strategies': {
    questions: [
      "What apps do you use to plan charging stops on road trips? ABRP? PlugShare?",
      "How long do you typically spend at each charging stop on a long trip?",
      "Any tips for finding reliable chargers? Got burned by a broken EA station once."
    ],
    answers: [
      "I use A Better Route Planner (ABRP) for planning and PlugShare to check recent reviews of each station. The combo works great.",
      "Typical stops are 20-30 minutes. I use that time for bathroom breaks and snacks. By the time I'm done, the car is usually at 80%.",
      "Always check PlugShare reviews before relying on a charger. Look for recent check-ins. Have a backup charger within 20 miles just in case."
    ],
    opinions: [
      "Road tripping in an EV takes more planning but it's totally doable. After 3-4 trips you develop a rhythm and it becomes second nature.",
      "Electrify America is getting better but still not as reliable as Tesla Superchargers. Can't wait for BYD to get NACS access.",
      "The charging stops actually make road trips more relaxing. Forced breaks every 2-3 hours keep me from getting fatigued."
    ]
  },
  'financing vs leasing': {
    questions: [
      "Is it better to lease or buy a BYD right now? The technology is changing so fast.",
      "What kind of lease deals are people getting on the Seal?",
      "Does leasing still qualify for the tax credit somehow?"
    ],
    answers: [
      "Leasing makes sense if you want lower payments and worry about depreciation. Buying is better if you keep cars 5+ years.",
      "I got a 36-month lease on a Seal for $389/month with $3k down. The residual value was set at 58% which seemed reasonable.",
      "Yes, the leasing company claims the credit and passes it to you as a lower capitalized cost. It's actually simpler than buying."
    ],
    opinions: [
      "I leased because EV tech is improving so fast. In 3 years I'll upgrade to whatever has solid-state batteries and 500-mile range.",
      "Buying made more sense for me. I drive 18k miles a year and lease mileage limits were too restrictive and expensive.",
      "The leasing vs buying math really depends on your state incentives. Some states give extra rebates for buying but not leasing."
    ]
  },
  'trade-in negotiation': {
    questions: [
      "How's the trade-in experience with BYD dealers? Fair offers or lowball?",
      "Should I sell my old car privately or trade it in?",
      "Do BYD dealers negotiate on trade-in values?"
    ],
    answers: [
      "I got a fair offer on my trade - within $500 of CarMax's quote. They used KBB instant cash offer as a baseline.",
      "Private sale will always net more money but takes time and effort. I valued the convenience of trading in and avoiding the hassle.",
      "Yes, I negotiated my trade up by $1,200 by showing them the Carvana offer on my phone. Come prepared with competing offers."
    ],
    opinions: [
      "Get quotes from CarMax, Carvana, and Vroom before going to the dealer. Having leverage makes the negotiation much easier.",
      "The tax savings from trading in (you only pay tax on the difference) can make up for a lower trade offer. Do the math both ways.",
      "Be willing to walk if the trade offer is insulting. There are plenty of ways to sell a car these days."
    ]
  },
  'first-time EV owner tips': {
    questions: [
      "What do you wish you knew before buying your first EV?",
      "Any surprises after switching from gas to electric?",
      "What accessories are actually worth buying for a new EV?"
    ],
    answers: [
      "Get a Level 2 charger installed before taking delivery. Using a regular outlet for a week while waiting for installation was painful.",
      "The instant torque never gets old. I still smile every time I accelerate onto a highway. Also, one-pedal driving takes about a week to master.",
      "Must-have accessories: all-weather floor mats, a screen protector for the infotainment, and a portable charger for emergencies."
    ],
    opinions: [
      "I wish someone had told me to stop obsessing over range. After a month you learn your car's real range and plan accordingly. The anxiety fades fast.",
      "The biggest surprise was how much I enjoy driving again. I find excuses to go places just to drive. Never did that with my gas car.",
      "Don't overthink the charging situation. If you can charge at home, 95% of your charging is done while you sleep. It's way more convenient than gas stations."
    ]
  },
  'total cost of ownership': {
    questions: [
      "Has anyone calculated their true cost per mile with a BYD?",
      "How do insurance costs compare to a similar gas car?",
      "Does the lower maintenance really offset the higher purchase price?"
    ],
    answers: [
      "I'm at about $0.04 per mile for electricity plus $0.02 for maintenance. My old Camry was $0.12 per mile. The savings are real.",
      "My insurance went up $300/year compared to my old Accord. But I'm saving $2,400/year on gas and maintenance. Net positive by $2,100/year.",
      "Absolutely. Over 5 years I'll save about $10k in fuel and maintenance compared to a $35k gas car. The EV was $8k more upfront, so I'm $2k ahead."
    ],
    opinions: [
      "The financial case for EVs gets stronger every year as gas prices rise and EV prices drop. We're past the tipping point.",
      "People focus on the purchase price but ignore the total cost. My BYD will be cheaper than any gas car I've owned after 3 years.",
      "The biggest variable is electricity rates. If you have solar or cheap overnight rates, the savings are massive. If not, it's still cheaper than gas."
    ]
  },
  'BYD vs Tesla competition': {
    questions: [
      "Is BYD really outselling Tesla globally? The numbers seem unbelievable.",
      "What advantages does BYD have over Tesla besides price?",
      "Will BYD overtake Tesla in the US market eventually?"
    ],
    answers: [
      "Yes, BYD sold more EVs than Tesla in Q4 2024 globally. Their strength in China and Europe is driving massive volume.",
      "BYD makes their own batteries and chips, so they control costs better. Their build quality is more consistent and their interiors are more traditional.",
      "BYD will likely surpass Tesla in US sales within 3-5 years once their Mexico factory is operational and they have NACS access."
    ],
    opinions: [
      "Competition is great for consumers. Tesla's dominance made them complacent. BYD is forcing everyone to improve.",
      "BYD's vertical integration is their secret weapon. Making batteries, chips, and cars under one roof gives them a huge cost advantage.",
      "Tesla still leads in software and charging infrastructure. BYD wins on value and build quality. Different strengths, different buyers."
    ]
  },
  'battery tech breakthroughs': {
    questions: [
      "Are solid-state batteries really coming in 2027 or is that just hype?",
      "What's the next big battery breakthrough after LFP?",
      "How much longer until we have 500-mile range EVs under $40k?"
    ],
    answers: [
      "BYD and Toyota are both targeting 2027-2028 for solid-state production. It's real but the timeline might slip. Expect 2028-2030 for mass adoption.",
      "Sodium-ion batteries are the next big thing. Cheaper than LFP, no lithium needed, and good enough for city cars. BYD is already producing them.",
      "Solid-state will get us to 500 miles at the same price point. Probably 2028-2030 for mainstream availability. The tech works, scaling is the challenge."
    ],
    opinions: [
      "Battery tech is improving faster than anyone predicted. We'll look back at current EVs in 10 years the way we look at flip phones today.",
      "Solid-state is the holy grail but LFP keeps getting better too. I wouldn't wait for solid-state - current batteries are already excellent.",
      "The real breakthrough will be when charging speed matches gas fill-up time. That's when EVs truly go mainstream with everyone."
    ]
  },
  'government EV policies': {
    questions: [
      "Are the current EV incentives likely to survive the next administration?",
      "What's the deal with the EV mandate? Is it actually happening?",
      "How do US EV policies compare to Europe and China?"
    ],
    answers: [
      "The $7,500 credit is law through 2032 but could be modified. Most states have their own incentives that are more stable.",
      "The EPA emissions standards effectively mandate 67% EV sales by 2032. It's not a ban on gas cars but it's pushing manufacturers hard.",
      "China is way ahead - 40% of new cars are EVs. Europe is at 25% and growing fast. The US is around 10% but accelerating rapidly."
    ],
    opinions: [
      "Regardless of politics, EVs are winning on economics. Even without incentives, total cost of ownership favors EVs at current prices.",
      "The transition is happening faster than policy. Automakers are investing billions in EVs because that's where the market is going.",
      "State-level policies matter more than federal. California's ZEV mandate drives national policy because it's such a huge market."
    ]
  },
  'EV adoption trends': {
    questions: [
      "Are we past the early adopter phase for EVs or still in it?",
      "What's holding back mass adoption besides price?",
      "When do you think EVs will be 50% of new car sales in the US?"
    ],
    answers: [
      "We're transitioning from early adopters to early majority. About 10% of new car buyers chose EVs in 2025, up from 3% in 2022.",
      "Charging infrastructure and education are the biggest barriers. People don't know how easy home charging is. Public charging still needs work.",
      "Bloomberg predicts 50% EV market share by 2030 in the US. That might be optimistic but 40% by 2030 seems very achievable."
    ],
    opinions: [
      "The tipping point is near. Once EVs hit price parity with gas cars (around 2026-2027), adoption will explode.",
      "People vastly underestimate how fast this transition is happening. It took smartphones 5 years to go from niche to dominant. EVs will be similar.",
      "The biggest blocker isn't technology or price - it's mindset. Once people ride in a modern EV, most are convinced within 10 minutes."
    ]
  }
};

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
      messageCount: 0,
    });
  }
  return conversationMemory.get(guildId);
}

// ============================================
// NATURAL RESPONSE GENERATION (COMPLETELY REWRITTEN)
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
  const content = topicContent[topicName];
  
  // If we have rich content for this topic, use it
  if (content) {
    return generateRichResponse(persona, topicName, content, phase, messageType, memory, timeGreeting, mood);
  }
  
  // Fallback for topics without rich content
  return generateFallbackResponse(persona, topicName, phase, messageType, timeGreeting);
}

function generateRichResponse(persona, topicName, content, phase, messageType, memory, timeGreeting, mood) {
  const lastMessage = memory.messages[memory.messages.length - 1];
  const wasQuestion = lastMessage?.message?.includes('?');
  
  switch (phase) {
    case 'opening':
      return generateOpening(persona, topicName, content, timeGreeting);
    
    case 'discussion':
      return generateDiscussion(persona, topicName, content, messageType, wasQuestion, memory);
    
    case 'deep_dive':
      return generateDeepDive(persona, topicName, content, messageType);
    
    case 'wrapping':
      return generateWrapping(persona, topicName, content);
    
    default:
      return buildFromContent(persona, topicName, content, messageType);
  }
}

function generateOpening(persona, topicName, content, timeGreeting) {
  // Start with a real question from the content
  if (content.questions && content.questions.length > 0) {
    const question = getRandomItem(content.questions);
    if (persona.catchphrases && Math.random() < 0.3) {
      return `${timeGreeting}! ${getRandomItem(persona.catchphrases)} - ${question.toLowerCase()}`;
    }
    return `${timeGreeting}. ${question}`;
  }
  
  // Fallback
  return `${timeGreeting}. Been thinking about ${topicName.toLowerCase()} lately. Anyone else have experience with this?`;
}

function generateDiscussion(persona, topicName, content, messageType, wasQuestion, memory) {
  // If someone asked a question, answer it
  if (wasQuestion && content.answers && content.answers.length > 0) {
    const answer = getRandomItem(content.answers);
    if (persona.catchphrases && Math.random() < 0.4) {
      return `${getRandomItem(persona.catchphrases)} ${answer.toLowerCase()}`;
    }
    return answer;
  }
  
  // Mix of opinions and answers based on message type
  if (messageType === 'question' && content.questions) {
    return getRandomItem(content.questions);
  }
  
  if (messageType === 'reaction') {
    const reactions = [
      `That's a really good point. ${getRandomItem(content.opinions || content.answers)}`,
      `I hadn't thought of it that way. ${getRandomItem(content.opinions || content.answers)}`,
      `Interesting perspective. In my experience, ${getRandomItem(content.answers || content.opinions).toLowerCase()}`,
    ];
    return getRandomItem(reactions);
  }
  
  // Default: share an opinion or answer
  const pool = [...(content.opinions || []), ...(content.answers || [])];
  if (pool.length > 0) {
    let message = getRandomItem(pool);
    if (persona.catchphrases && Math.random() < 0.25) {
      message = `${getRandomItem(persona.catchphrases)} - ${message.toLowerCase()}`;
    }
    return message;
  }
  
  return getRandomItem(content.questions || ['Interesting discussion on this topic.']);
}

function generateDeepDive(persona, topicName, content, messageType) {
  const deepDiveTemplates = [
    `The more I research ${topicName.toLowerCase()}, the more I realize it's a game-changer. ${getRandomItem(content.opinions || content.answers)}`,
    `Here's something most people don't know about ${topicName.toLowerCase()}: ${getRandomItem(content.answers || content.opinions)}`,
    `I've been following ${topicName.toLowerCase()} developments closely. ${getRandomItem(content.answers || content.opinions)}`,
    `Let me add some perspective on ${topicName.toLowerCase()}: ${getRandomItem(content.answers || content.opinions)}`,
  ];
  
  if (messageType === 'analysis' || messageType === 'technical') {
    const analytical = [
      `Looking at the data on ${topicName.toLowerCase()}: ${getRandomItem(content.answers || content.opinions)}`,
      `From a technical standpoint, ${getRandomItem(content.answers || content.opinions)}`,
      `Breaking this down objectively: ${getRandomItem(content.answers || content.opinions)}`,
    ];
    return getRandomItem(analytical);
  }
  
  return getRandomItem(deepDiveTemplates);
}

function generateWrapping(persona, topicName, content) {
  if (content.opinions && content.opinions.length > 0) {
    const wrapTemplates = [
      `Great discussion everyone! My takeaway on ${topicName.toLowerCase()}: ${getRandomItem(content.opinions)}`,
      `Lots of good perspectives on ${topicName.toLowerCase()} today. Personally, ${getRandomItem(content.opinions).toLowerCase()}`,
      `This has been really informative. On ${topicName.toLowerCase()}, I think ${getRandomItem(content.opinions).toLowerCase()}`,
      `Solid conversation. If anyone wants to know more about ${topicName.toLowerCase()}, happy to share my experience.`,
    ];
    return getRandomItem(wrapTemplates);
  }
  
  return `Good discussion on ${topicName}. Lots of useful perspectives here. Anyone have more questions?`;
}

function buildFromContent(persona, topicName, content, messageType) {
  // Try each content type in order of preference based on messageType
  let arr;
  if (messageType === 'question') arr = content.questions;
  else if (messageType === 'opinion') arr = content.opinions;
  else arr = content.answers || content.opinions || content.questions;
  
  if (arr && arr.length > 0) {
    let message = getRandomItem(arr);
    if (persona.catchphrases && Math.random() < 0.3) {
      message = `${getRandomItem(persona.catchphrases)} - ${message.toLowerCase()}`;
    }
    return message;
  }
  
  return `I've got some thoughts on ${topicName.toLowerCase()}. Anyone else interested in this?`;
}

function generateFallbackResponse(persona, topicName, phase, messageType, timeGreeting) {
  const fallbacks = [
    `${timeGreeting || 'Hey'}. I've been learning more about ${topicName.toLowerCase()}. Happy to share what I know if anyone's curious.`,
    `Anyone else interested in ${topicName.toLowerCase()}? I've got some experience with it.`,
    `${topicName} is something I've been paying attention to. Would love to hear others' thoughts.`,
    `Been reading up on ${topicName.toLowerCase()} recently. Some interesting developments happening.`,
  ];
  
  let message = getRandomItem(fallbacks);
  
  if (persona.catchphrases && Math.random() < 0.4) {
    message = `${getRandomItem(persona.catchphrases)}. ${message}`;
  }
  
  return message;
}

// ============================================
// INTELLIGENT TOPIC SELECTION
// ============================================
function selectIntelligentTopic(memory, guildId) {
  const recentTopics = memory.messages.slice(-10)
    .map(m => m.topicName)
    .filter(Boolean);
  
  // Prioritize topics that have rich content AND haven't been used recently
  const topicsWithContent = conversationTopics.filter(cat => 
    cat.topics.some(t => topicContent[t] && !recentTopics.includes(t))
  );
  
  const availableTopics = topicsWithContent.length > 0 ? topicsWithContent : [...conversationTopics];
  
  const selectedCategory = weightedRandom(
    availableTopics.map(cat => ({ item: cat, weight: cat.weight }))
  );
  
  // Prefer topics with rich content
  const topicsWithRichContent = selectedCategory.topics.filter(t => topicContent[t]);
  const selectedTopic = topicsWithRichContent.length > 0 
    ? getRandomItem(topicsWithRichContent)
    : getRandomItem(selectedCategory.topics);
  
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
// WELCOME MESSAGES
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