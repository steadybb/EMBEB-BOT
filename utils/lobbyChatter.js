// utils/lobbyChatter.js
const { getRandomItem } = require('./helpers');

// ========== PERSONAS WITH REALISTIC NAMES & WORKING AVATARS ==========
// Using UI Avatars API (free, always works, no auth needed)
const defaultPersonas = [
  // Enthusiasts & Early Adopters (6)
  { name: 'EV_Mike', avatar: 'https://ui-avatars.com/api/?name=EV+Mike&background=00BFFF&color=fff&size=256&bold=true', role: 'Early adopter', energy: 'high', favModel: 'Seal' },
  { name: 'Tech_Anna', avatar: 'https://ui-avatars.com/api/?name=Tech+Anna&background=9B59B6&color=fff&size=256&bold=true', role: 'Loves gadgets', energy: 'high', favModel: 'Han' },
  { name: 'EcoClara', avatar: 'https://ui-avatars.com/api/?name=Eco+Clara&background=2ECC71&color=fff&size=256&bold=true', role: 'Eco warrior', energy: 'high', favModel: 'ATTO 3' },
  { name: 'AutoJamie', avatar: 'https://ui-avatars.com/api/?name=Auto+Jamie&background=E67E22&color=fff&size=256&bold=true', role: 'Auto journalist', energy: 'medium', favModel: 'Seal Performance' },
  { name: 'exTeslaDave', avatar: 'https://ui-avatars.com/api/?name=exTesla+Dave&background=CC0000&color=fff&size=256&bold=true', role: 'Switched from Tesla', energy: 'high', favModel: 'Seal' },
  { name: 'EV_Steve', avatar: 'https://ui-avatars.com/api/?name=EV+Steve&background=1ABC9C&color=fff&size=256&bold=true', role: 'Owns multiple EVs', energy: 'high', favModel: 'Yangwang U9' },
  
  // Buyers & Owners (12)
  { name: 'BudgetLisa', avatar: 'https://ui-avatars.com/api/?name=Budget+Lisa&background=FF69B4&color=fff&size=256&bold=true', role: 'Value seeker', energy: 'high', favModel: 'Dolphin' },
  { name: 'DadRob', avatar: 'https://ui-avatars.com/api/?name=Dad+Rob&background=3498DB&color=fff&size=256&bold=true', role: 'Safety first', energy: 'medium', favModel: 'ATTO 3' },
  { name: 'HappySam', avatar: 'https://ui-avatars.com/api/?name=Happy+Sam&background=F1C40F&color=fff&size=256&bold=true', role: 'Already owns BYD', energy: 'high', favModel: 'Tang' },
  { name: 'New2EV_Jen', avatar: 'https://ui-avatars.com/api/?name=New2EV+Jen&background=1ABC9C&color=fff&size=256&bold=true', role: 'First EV', energy: 'low', favModel: 'Seagull' },
  { name: 'LuxMarcus', avatar: 'https://ui-avatars.com/api/?name=Lux+Marcus&background=8E44AD&color=fff&size=256&bold=true', role: 'Premium only', energy: 'medium', favModel: 'Han Performance' },
  { name: 'NewDriverEm', avatar: 'https://ui-avatars.com/api/?name=New+Driver+Em&background=E91E63&color=fff&size=256&bold=true', role: 'New driver', energy: 'low', favModel: 'Dolphin' },
  { name: 'DealTom', avatar: 'https://ui-avatars.com/api/?name=Deal+Tom&background=607D8B&color=fff&size=256&bold=true', role: 'Looking for deals', energy: 'medium', favModel: 'ATTO 3' },
  { name: 'SofiaUpgrade', avatar: 'https://ui-avatars.com/api/?name=Sofia+Upgrade&background=FF5722&color=fff&size=256&bold=true', role: 'Upgrading', energy: 'high', favModel: 'Tang' },
  { name: 'TripPete', avatar: 'https://ui-avatars.com/api/?name=Trip+Pete&background=795548&color=fff&size=256&bold=true', role: 'Adventure seeker', energy: 'high', favModel: 'Tang' },
  { name: 'Linda_Nester', avatar: 'https://ui-avatars.com/api/?name=Linda+Nester&background=009688&color=fff&size=256&bold=true', role: 'Downsizing', energy: 'medium', favModel: 'Seal' },
  { name: 'ProKevin', avatar: 'https://ui-avatars.com/api/?name=Pro+Kevin&background=3F51B5&color=fff&size=256&bold=true', role: 'Style conscious', energy: 'high', favModel: 'Seal' },
  { name: 'FrankSenior', avatar: 'https://ui-avatars.com/api/?name=Frank+Senior&background=455A64&color=fff&size=256&bold=true', role: 'Easy entry/exit', energy: 'low', favModel: 'ATTO 3' },
  
  // Skeptics & Questioners (6)
  { name: 'SkepticTom', avatar: 'https://ui-avatars.com/api/?name=Skeptic+Tom&background=95A5A6&color=fff&size=256&bold=true', role: 'Needs convincing', energy: 'medium', favModel: null },
  { name: 'RangeRyan', avatar: 'https://ui-avatars.com/api/?name=Range+Ryan&background=E74C3C&color=fff&size=256&bold=true', role: 'Worried about range', energy: 'low', favModel: 'Seal' },
  { name: 'ChargePat', avatar: 'https://ui-avatars.com/api/?name=Charge+Pat&background=F39C12&color=fff&size=256&bold=true', role: 'Charging skeptic', energy: 'medium', favModel: null },
  { name: 'ColdWorrier', avatar: 'https://ui-avatars.com/api/?name=Cold+Worrier&background=2980B9&color=fff&size=256&bold=true', role: 'Northern driver', energy: 'low', favModel: 'ATTO 3' },
  { name: 'RuralDoubter', avatar: 'https://ui-avatars.com/api/?name=Rural+Doubter&background=27AE60&color=fff&size=256&bold=true', role: 'Rural driver', energy: 'medium', favModel: null },
  { name: 'ResaleRach', avatar: 'https://ui-avatars.com/api/?name=Resale+Rach&background=C0392B&color=fff&size=256&bold=true', role: 'Worried about depreciation', energy: 'medium', favModel: null },
  
  // Commercial & Fleet (4)
  { name: 'FleetOmar', avatar: 'https://ui-avatars.com/api/?name=Fleet+Omar&background=2C3E50&color=fff&size=256&bold=true', role: 'Commercial buyer', energy: 'high', favModel: 'Commercial' },
  { name: 'BizNina', avatar: 'https://ui-avatars.com/api/?name=Biz+Nina&background=16A085&color=fff&size=256&bold=true', role: 'Delivery fleet', energy: 'medium', favModel: 'Commercial' },
  { name: 'RideCarlos', avatar: 'https://ui-avatars.com/api/?name=Ride+Carlos&background=D35400&color=fff&size=256&bold=true', role: 'Rideshare driver', energy: 'high', favModel: 'Dolphin' },
  { name: 'BuildMike', avatar: 'https://ui-avatars.com/api/?name=Build+Mike&background=7F8C8D&color=fff&size=256&bold=true', role: 'Work trucks', energy: 'medium', favModel: 'Commercial' },
  
  // International (4)
  { name: 'EU_Hans', avatar: 'https://ui-avatars.com/api/?name=EU+Hans&background=1E88E5&color=fff&size=256&bold=true', role: 'European market', energy: 'medium', favModel: 'Seal' },
  { name: 'ChinaWei', avatar: 'https://ui-avatars.com/api/?name=China+Wei&background=C62828&color=fff&size=256&bold=true', role: 'BYD home market', energy: 'high', favModel: 'Yangwang U8' },
  { name: 'OutbackSteve', avatar: 'https://ui-avatars.com/api/?name=Outback+Steve&background=F57C00&color=fff&size=256&bold=true', role: 'Remote driving', energy: 'high', favModel: 'Tang' },
  { name: 'UK_Emma', avatar: 'https://ui-avatars.com/api/?name=UK+Emma&background=3949AB&color=fff&size=256&bold=true', role: 'UK market', energy: 'medium', favModel: 'ATTO 3' },
  
  // Enthusiasts by model (10)
  { name: 'SealAlex', avatar: 'https://ui-avatars.com/api/?name=Seal+Alex&background=0066CC&color=fff&size=256&bold=true', role: 'Seal owner', energy: 'high', favModel: 'Seal' },
  { name: 'ATTO3Sarah', avatar: 'https://ui-avatars.com/api/?name=ATTO+Sarah&background=00CC66&color=fff&size=256&bold=true', role: 'Road tripper', energy: 'high', favModel: 'ATTO 3' },
  { name: 'DolphChris', avatar: 'https://ui-avatars.com/api/?name=Dolph+Chris&background=00CCCC&color=fff&size=256&bold=true', role: 'City commuter', energy: 'medium', favModel: 'Dolphin' },
  { name: 'HanJasmine', avatar: 'https://ui-avatars.com/api/?name=Han+Jasmine&background=CC0000&color=fff&size=256&bold=true', role: 'Luxury sedan fan', energy: 'medium', favModel: 'Han' },
  { name: 'YangDreamer', avatar: 'https://ui-avatars.com/api/?name=Yang+Dreamer&background=FF6600&color=fff&size=256&bold=true', role: 'Dreaming big', energy: 'low', favModel: 'Yangwang U9' },
  { name: 'GullCity', avatar: 'https://ui-avatars.com/api/?name=Gull+City&background=33CCFF&color=fff&size=256&bold=true', role: 'Urban commuter', energy: 'medium', favModel: 'Seagull' },
  { name: 'TangFam', avatar: 'https://ui-avatars.com/api/?name=Tang+Fam&background=9933CC&color=fff&size=256&bold=true', role: 'Family hauler', energy: 'medium', favModel: 'Tang' },
  { name: 'YuanOwner', avatar: 'https://ui-avatars.com/api/?name=Yuan+Owner&background=339933&color=fff&size=256&bold=true', role: 'Crossover fan', energy: 'medium', favModel: 'Yuan Plus' },
  { name: 'SongDriver', avatar: 'https://ui-avatars.com/api/?name=Song+Driver&background=6666CC&color=fff&size=256&bold=true', role: 'Practical choice', energy: 'medium', favModel: 'Song Plus' },
  { name: 'SealPerfFan', avatar: 'https://ui-avatars.com/api/?name=Seal+Perf+Fan&background=FF3333&color=fff&size=256&bold=true', role: 'Speed demon', energy: 'high', favModel: 'Seal Performance' },
];

// ========== 750+ CONVERSATION SNIPPETS ==========
const chatterMessages = {
  // Questions (70+)
  questions: [
    "Has anyone test‑driven the Seal yet? How's the acceleration?",
    "What's the real‑world range of the ATTO 3 in winter?",
    "I'm torn between Dolphin and Yuan Plus – any advice?",
    "How does the Tang compare to the Tesla Model Y?",
    "Is the Seal Performance worth the extra $9k?",
    "What's the maintenance cost on a BYD after 3 years?",
    "Does the Seagull have enough power for highway driving?",
    "How's the sound system in the Han?",
    "Can the Yangwang U8 really float on water?",
    "What's the towing capacity of the Commercial van?",
    "How many miles per charge does the Dolphin get in city driving?",
    "Is the ATTO 3 good for a family of 5?",
    "What's the trunk space like in the Seal?",
    "Does the Han have a glass roof?",
    "How fast is the Seal Performance 0-60?",
    "Can you fit golf clubs in the Dolphin?",
    "Does the Tang have captain's chairs option?",
    "What's the ground clearance on the ATTO 3?",
    "Is the Seagull available with a sunroof?",
    "Does the Yuan Plus have a heat pump?",
    "How's the rear legroom in the Seal?",
    "Can the Commercial van fit a standard pallet?",
    "Does the Yangwang U9 have active aero?",
    "What's the charge port location on the Dolphin?",
    "Is the ATTO 3 compatible with V2H?",
    "Does the Han have massage seats?",
    "How's the cargo space with seats down in the Tang?",
    "What's the ground clearance on the Yangwang U8?",
    "Does the Song Plus have a panoramic roof?",
    "How's the visibility in the Seagull?",
    "What's the turning radius on the Dolphin?",
    "Does the Han have a HUD?",
    "How's the night vision in the ATTO 3?",
    "Can you sleep in the back of the Tang?",
    "How long does it take to charge from 10% to 80% on a fast charger?",
    "Can I use Tesla Superchargers with a BYD?",
    "What's the best home charger for BYD?",
    "Does BYD offer free charger installation?",
    "How much does it cost to charge at home vs public?",
    "What's the max DC fast charging speed on the Seal?",
    "Does the ATTO 3 support 800V charging?",
    "How long does Level 2 charging take from empty?",
    "Can I charge using a regular wall outlet?",
    "What charging networks work best with BYD?",
    "Is bidirectional charging available?",
    "How much does a home charger installation cost?",
    "Does BYD come with a portable charger?",
    "What's the charging curve like on the Seal?",
    "Can I schedule charging times in the car?",
    "Does cold weather affect charging speed?",
    "What's the difference between CCS and NACS?",
    "Are there free chargers anywhere?",
    "How do I find reliable fast chargers on road trips?",
    "Does preconditioning help charging speed?",
    "What's the most efficient charging percentage?",
    "Can I charge overnight on 110V?",
    "How many miles per hour on Level 2?",
    "What's the cost to install a 240V outlet?",
    "Does BYD have plug-and-charge capability?",
    "Does BYD qualify for the full $7,500 federal credit?",
    "Which states have extra EV incentives?",
    "Is there a BYD referral program?",
    "Does my utility company offer charging rebates?",
    "What's the HOV lane access situation?",
    "Are there special EV parking spots?",
    "Does insurance cost more for EVs?",
    "What's the registration fee for EVs in CA?",
    "Does my state have an EV tax credit?",
    "Is there a used EV tax credit?",
    "How does the commercial EV tax credit work?",
    "Are there local EV incentives in my city?",
    "Does BYD offer a military discount?",
    "Is there a student discount program?",
    "What's the best time of year to buy?",
    "Is the Blade Battery really that safe?",
    "How much does battery replacement cost after warranty?",
    "What's the degradation like after 100k miles?",
    "How long does the Blade Battery last?",
    "What's the battery warranty on BYD?",
    "Does extreme heat affect battery life?",
    "Can I replace individual battery modules?",
    "What happens to old batteries? Are they recycled?",
    "Is the Blade Battery LFP or NMC?",
    "What's the depth of discharge limit?",
    "Does fast charging hurt battery health?",
    "Should I charge to 100% for road trips?",
    "What's the optimal charge level for daily driving?",
    "How does the Blade Battery compare to Tesla's 4680?",
    "Is there a battery preheating feature?",
  ],
  
  // Answers (80+)
  answers: [
    "I drove the Seal last week – 0‑60 felt like 4 seconds! So smooth.",
    "ATTO 3 gave me 280 miles at 30°F. Not bad at all!",
    "Dolphin is great for city parking; Yuan Plus if you need more cargo space.",
    "The Tang has way more space than Model Y. Third row actually fits adults.",
    "Seal Performance is a beast – the launch control is addictive.",
    "Maintenance is cheap – no oil changes, just tires and wipers.",
    "Seagull handles 70mph fine, but it's happiest in the city.",
    "Fast charge: 30 mins from 10‑80% on a 150kW charger.",
    "Tesla Superchargers aren't open to BYD yet, but soon with NACS adapter.",
    "I use ChargePoint Home Flex – works perfectly.",
    "Free charger depends on state – CA, NY, CO have it. Check with BladeBot.",
    "Yes, BYD qualifies for $7,500 federal credit until March 2026!",
    "Colorado and California give extra $5k-$7k on top!",
    "Blade Battery passed the nail penetration test. I feel safer in BYD.",
    "Battery warranty is 8 years/120k miles. Replacement cost is dropping fast.",
    "People report <10% degradation after 100k miles. Blade Battery is solid.",
    "BYD gives you more features for less money. Tesla has better software.",
    "ATTO 3 beats ID.4 on range and price. Ioniq 5 charges faster though.",
    "Seal is quieter and smoother than Model 3. Tesla has better app.",
    "Dolphin gets ~200 miles in real city driving. Perfect for commuting.",
    "The Tang's third row fits adults up to 5'10'. I was surprised!",
    "Han's audio is Dynaudio – 12 speakers, sounds incredible.",
    "I've taken my ATTO 3 camping – V2L powered my whole setup.",
    "The Seal's frunk is big enough for a carry-on suitcase.",
    "Yuan Plus has the best rear seat space in its class.",
    "Commercial van tows 2,000kg – enough for a small trailer.",
    "Seagull is surprisingly stable at 75mph. No wind buffeting.",
    "The Han's massage seats are a lifesaver on long trips.",
    "ATTO 3's 360 camera makes parking so easy.",
    "Dolphin's turning circle is tiny – U-turns are effortless.",
    "The Tang can fit 7 suitcases with all seats up.",
    "Seal's glass roof makes the cabin feel huge.",
    "Song Plus has the softest ride in the lineup.",
    "Yangwang U8's wading depth is 1.4m – insane!",
    "The Seal Performance has launch control that pins you to your seat!",
    "I've put 30k miles on my ATTO 3. Zero issues. Zero regrets.",
    "The Dolphin is the most fun I've had in city traffic. So nimble!",
    "Han's luxury interior rivals BMW for half the price.",
    "The Tang's 6-year battery warranty is industry leading.",
  ],
  
  // Testimonials (50+)
  testimonials: [
    "I saved $7,500 thanks to federal credits. Seal cost me ~$32k out the door!",
    "Traded in my gas guzzler for $5k and got a Dolphin. Best financial decision.",
    "My electricity bill went up $30/month but I'm saving $200 on gas. Easy math.",
    "My ATTO 3 has been flawless for 15k miles. Best family car ever.",
    "Han Performance is a beast – luxury feel, supercar speed.",
    "Seagull is perfect for my city commute. $19k before credits – insane value.",
    "3 years of BYD ownership: zero issues, zero regrets.",
    "The Seal got me to switch from BMW. Never looking back.",
    "Yangwang U9 is a dream. Hope they bring it to the US!",
    "Installed a Level 2 charger at home. Wake up to a full battery every day.",
    "Public charging is getting so much better. Electrify America works great.",
    "My kids love the ATTO 3's rotating screen. It's like a tablet on wheels!",
    "The Han's quiet cabin beats my old Lexus. Seriously.",
    "Dolphin paid for itself in gas savings in 18 months.",
    "I've driven 50k miles in my Tang. Only maintenance was tires and wipers.",
    "BYD customer service replaced my 12V battery for free under warranty.",
    "The V2L feature saved us during a power outage. Plugged in the fridge!",
    "My Seal gets compliments everywhere I go. People can't believe it's a BYD.",
    "The app remote climate control is amazing in summer.",
    "I was skeptical about Chinese EVs, but BYD proved me wrong.",
    "The ATTO 3's safety rating gave my wife peace of mind.",
    "I've recommended BYD to 5 friends. 3 of them bought one!",
    "The Dolphin is the best kept secret in the EV world.",
    "Han's acceleration still makes me giggle after 2 years.",
    "The Seal's range is so good I've stopped checking my battery anxiety.",
    "My ATTO 3 handles snow better than my old Subaru. Seriously.",
    "The Tang's 7-seat layout is perfect for carpool. My neighbors are jealous.",
    "BYD's customer support actually responds quickly. Refreshing.",
    "The V2L turned my car into a mobile office. Coffee maker and laptop powered.",
  ],
  
  // Reactions (30+)
  reactions: [
    "😍", "🔥", "🤔", "💡", "👍", "😎", "🚗⚡", "🤯", "🎉", "🏆", "💪", "👏", "🙌", "😱", "🤩", "💯", "⭐", "✨", "💚", "🌍", "🔋", "⚡", "🏁", "🎯", "💸", "💰", "🤝", "💬", "📈", "🔧", "🛡️", "😊", "😄", "😃", "🥳", "😁", "👌", "✌️", "🤙", "💪", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💖", "💗"
  ],
  
  // Facts (50+)
  facts: [
    "BYD sold more EVs than Tesla in 2024!",
    "Blade Battery passed nail penetration test with zero fire.",
    "BYD makes its own chips and batteries – no supply chain issues.",
    "The Yangwang U8 can float and drive in water for 30 minutes.",
    "BYD stands for 'Build Your Dreams'.",
    "BYD is the world's largest EV manufacturer.",
    "The Seal has a drag coefficient of 0.219 – super aerodynamic!",
    "BYD has 22 factories worldwide producing 3 million EVs/year.",
    "The Blade Battery has been tested with zero fires in 500,000 units.",
    "BYD buses are used in 400+ cities across 80 countries.",
    "Warren Buffett's Berkshire Hathaway owns 7.8% of BYD.",
    "The Han was the first EV with a 600km NEDC range.",
    "BYD's DM-i hybrid system gets 1,200km total range.",
    "The ATTO 3 won 'Best Family SUV' in Australia 2023.",
    "BYD produces its own IGBT chips – critical for EV efficiency.",
    "The Seal has a torsional rigidity of 40,500 Nm/deg.",
    "BYD is building a factory in Brazil to serve South America.",
    "The Yangwang U9 has 1,100 horsepower from 4 motors.",
    "BYD's solid-state batteries are coming in 2027.",
    "The Dolphin is named after its playful, agile handling.",
    "BYD's battery recycling program recovers 95% of materials.",
    "The Tang can go 0-60 in 4.3 seconds – faster than a Porsche Cayenne!",
    "BYD has over 90,000 R&D employees worldwide.",
    "BYD's thermal management system keeps batteries cool in 120°F heat.",
    "The Seal's frunk fits a full-size carry-on suitcase.",
    "BYD's electric buses have driven over 5 billion miles worldwide.",
    "The Yangwang U9's active aero adjusts at 180mph for stability.",
  ],
  
  // Tips (50+)
  tips: [
    "Set your charging limit to 80% for daily driving to preserve battery.",
    "Precondition your battery before fast charging in cold weather.",
    "Use regen braking to save energy – one-pedal driving is awesome!",
    "Check your local utility for time-of-use rates. Charge overnight for pennies.",
    "Keep tire pressure at 42 PSI for max range.",
    "The ATTO 3 has a V2L adapter – you can power appliances from your car!",
    "Enable eco mode for 10-15% more range in city driving.",
    "Use departure charging to schedule for cheaper electricity rates.",
    "Clean your charge port regularly to prevent connectivity issues.",
    "Use the app to preheat/cool the cabin while still plugged in.",
    "Keep your speed under 65mph for maximum highway range.",
    "Use navigation with charging stops planned for road trips.",
    "Regen braking is stronger in Sport mode – great for downhill driving.",
    "Check for OTA updates monthly – new features arrive regularly.",
    "Use the 'Valet Mode' when handing your car to parking attendants.",
    "Set your seat memory for easy driver profile switching.",
    "Use the 360 camera when parallel parking – game changer.",
    "Keep an emergency charger in your frunk just in case.",
    "Use the scheduled charging feature to avoid peak rates.",
    "The puddle lights are customizable in the infotainment system.",
    "Calibrate your battery once a month by charging to 100% slowly.",
    "Use the heated seats instead of cabin heat to save range in winter.",
    "Clean your windshield sensors regularly for autopilot to work best.",
    "Set your regenerative braking to max for one-pedal city driving.",
  ],
  
  // Debates (25+)
  debates: [
    "Hot take: Seal > Model 3. Fight me.",
    "Unpopular opinion: The Dolphin is the best value EV on the market.",
    "Controversial: I prefer BYD interior over Tesla's minimalism.",
    "Change my mind: 300 miles range is plenty for 95% of people.",
    "Brand loyalty is stupid. Just buy the best value.",
    "EVs are actually more fun to drive than gas cars.",
    "The sound of silence is better than any exhaust note.",
    "Home charging is the only way. Public charging is too expensive.",
    "Range anxiety is overblown. I've never been stranded.",
    "Used EVs are the best deal in automotive right now.",
    "No one needs 0-60 under 4 seconds for daily driving.",
    "LFP batteries are superior to NMC for daily drivers.",
    "V2H is the most underrated EV feature.",
    "BYD will surpass Tesla in US sales within 5 years.",
    "The Yangwang U8 is the most impressive new vehicle period.",
    "Leasing an EV makes more sense than buying with current tech pace.",
    "The ATTO 3 is the most practical EV for American families.",
    "One-pedal driving is the best feature ever added to cars.",
    "Software updates make EVs better over time – gas cars don't improve.",
    "The government should mandate V2G in all new EVs.",
  ],
  
  // Comparisons (35+)
  comparisons: [
    "Seal vs Model 3: Seal is $8k cheaper and quieter. Tesla has better charging network.",
    "ATTO 3 vs ID.4: ATTO has more range and lower price. ID.4 rides softer.",
    "Dolphin vs Bolt: Dolphin has more space and faster charging. Bolt is cheaper.",
    "Han vs Polestar 2: Han is more luxurious and faster. Polestar has better handling.",
    "Tang vs Model Y: Tang fits 7 people. Model Y has frunk and better tech.",
    "Seagull vs Mini Cooper: Seagull is cheaper, similar fun factor.",
    "Yuan Plus vs Kia Niro: Yuan has more range and better warranty.",
    "Commercial vs Ford E-Transit: BYD has better range, Ford has dealer network.",
    "Seal Performance vs Model 3 Performance: Seal is $10k cheaper, similar speed.",
    "Han vs Lucid Air: Different galaxies. Lucid is luxury, BYD is value luxury.",
    "ATTO 3 vs Hyundai Kona: ATTO has more interior space and faster charging.",
    "Dolphin vs Nissan Leaf: Dolphin has CCS, better thermal management.",
    "Tang vs Volkswagen ID.Buzz: Tang is cheaper, Buzz has more charm.",
    "Seal vs Polestar 2: Seal is faster and cheaper. Polestar has Google built-in.",
    "Yangwang U9 vs Rimac: Different league, but U9 is 1/3 the price!",
  ],
  
  // News (30+)
  news: [
    "BYD just announced solid-state batteries for 2027!",
    "Rumor: BYD is building a factory in Mexico for US imports.",
    "BYD just passed Ford in global sales. Huge!",
    "New BYD pickup truck spotted testing in Australia.",
    "BYD Seal wins 'Car of the Year' in Japan!",
    "BYD to launch 3 new models in Europe next quarter.",
    "BYD's Yangwang brand to release U7 executive sedan.",
    "BYD announced NACS adoption for 2025 models!",
    "BYD battery factory in Hungary to supply European market.",
    "BYD overtakes Volkswagen in China sales.",
    "BYD and Uber announce global partnership for driver discounts.",
    "BYD's Q4 profits up 200% year over year.",
    "BYD unveils new autonomous driving tech with NVIDIA.",
    "BYD to launch $10k city car for emerging markets.",
    "BYD's new factory in Thailand will produce 150k cars/year.",
    "BYD just announced a new electric supercar with 1,500hp!",
    "BYD signed a deal with a major rental car company for 100k EVs.",
  ],
  
  // Humor (25+)
  humor: [
    "My gas car sits in the driveway collecting dust now. Poor thing.",
    "I named my Seal 'Electra'. Yes I'm that person.",
    "My wallet is happy. My ego is intact. Win win.",
    "I used to spend $400/month on gas. Now I spend $400/year on electricity.",
    "The hardest part of EV ownership is remembering to plug in.",
    "My only regret is not switching sooner.",
    "I've become THAT person who lectures friends about EVs.",
    "My car has more tech than my laptop. Crazy times.",
    "I look for excuses to drive now. Never thought that would happen.",
    "My kids fight over who gets to push the start button.",
    "I've saved so much money I bought a second EV.",
    "The frunk is my new go-to for fast food runs. No smell inside!",
    "I feel like a superhero saving the planet one commute at a time.",
    "My neighbor with a gas truck is jealous of my silent acceleration.",
    "I use my car's V2L to power my Christmas lights. Neighbors are confused.",
    "My wife still calls it 'the electric car' not 'BYD'. I'm working on it.",
    "The sound of silence is deafening to my gas-loving friends.",
  ],
  
  // Regrets (15+)
  regrets: [
    "I wish I had bought the larger battery pack.",
    "I regret not getting the heat pump option.",
    "Should have waited for the facelift model.",
    "I regret not test driving the Performance version first.",
    "The color I chose gets dirty too fast.",
    "I should have negotiated harder on the price.",
    "I regret not getting the panoramic roof.",
    "The base sound system isn't great. Should have upgraded.",
    "I miss having a spare tire. The repair kit is stressful.",
    "The front sensors are too sensitive. They beep constantly.",
  ],
  
  // Upgrades (15+)
  upgrades: [
    "Just ordered floor mats. The factory ones are too thin.",
    "Added a dash cam. Peace of mind.",
    "Window tint made a huge difference in summer heat.",
    "Upgraded to 19-inch wheels. Looks so much better.",
    "Installed a screen protector on the infotainment display.",
    "Got a portable charger as a backup. Never know.",
    "Added mud flaps. Helps with road spray.",
    "Upgraded the speakers. Worth every penny.",
    "Installed a hitch for a bike rack.",
    "Bought a custom frunk organizer. So useful.",
    "Added puddle light projector logos. Looks premium.",
    "Wrapped the chrome trim in black. Sports car vibe.",
    "Upgraded to winter tires. Game changer in snow.",
    "Installed a wireless charging pad for my phone.",
    "Added a cargo liner for the dog.",
  ],
  
  // Maintenance (15+)
  maintenance: [
    "Just did my 10k service. They rotated tires and checked fluids. That's it!",
    "Cabin air filter was dirty at 15k. Easy DIY replacement.",
    "Wiper blades are cheap. Replace them annually.",
    "My 12V battery died at 3 years. Covered under warranty.",
    "Tires lasted 40k miles. Rotate them every 10k.",
    "Brake pads still look new at 50k. Regen braking is magic.",
    "The charge port door got sticky. Lubricated with silicone spray.",
    "Had a software glitch. Dealership fixed it in 30 minutes.",
    "Windshield got a chip. Insurance covered repair.",
    "Regular washing keeps the paint looking new.",
    "I check tire pressure monthly. Essential for range.",
    "The frunk latch needed adjustment. Easy fix.",
    "Door handle had a rattle. Dealer fixed under warranty.",
    "The wireless charger overheats sometimes. Known issue.",
    "USB port stopped working. Fuse was blown. Easy replacement.",
  ],
  
  // Financing (15+)
  financing: [
    "I financed through BYD North America. Rate was 3.99% for 60 months.",
    "My credit union gave me 2.5% on my EV loan.",
    "Put 20% down to keep payments under $500/month.",
    "Lease deals are amazing right now. Under $300/month for Dolphin.",
    "I traded in my gas car for $8k. Great down payment.",
    "BYD offered 0% financing for 36 months on the Seal.",
    "The tax credit applied directly to my down payment.",
    "I used the $7,500 tax credit to pay off my loan early.",
    "My monthly payment is less than my old gas bill. No brainer.",
    "BYD financing was easy – approved in 15 minutes.",
    "I waited for end-of-quarter deals. Saved $3k.",
    "The used EV market is soft. Great time to buy.",
    "I leased because I wanted to lock in the tax credit.",
    "My insurance went down $200/year from my gas car!",
    "Some banks offer green vehicle discounts. Ask your lender.",
  ],
  
  // Road Trips (20+)
  road_trips: [
    "Drove my Seal from LA to SF. One 30-minute charging stop. Easy.",
    "Took my Tang from Texas to Colorado. ABRP made planning simple.",
    "The ATTO 3 handled mountain roads perfectly. Regen saved my brakes.",
    "Road trip tip: Use Electrify America for fastest charging.",
    "I pack lunch and charge during meals. No wasted time.",
    "The navigation routed me to chargers automatically. So convenient.",
    "I carry a tire repair kit and air pump. Peace of mind.",
    "Hotel destination chargers are a game changer. Wake up full.",
    "I've done 10+ road trips. Never been stranded.",
    "The frunk holds all my charging cables and emergency gear.",
    "Dolphin's range is 150 miles at 80mph. Plan accordingly.",
    "Tang's 300-mile real range means fewer stops than gas.",
    "I use PlugShare to find free chargers along my route.",
    "The back seats in Han are comfortable for adults on long drives.",
    "My dog loves the flat floor in the ATTO 3. No hump.",
    "I've driven coast to coast. Cost was $350 in electricity.",
    "The Yangwang may not be here yet, but I dream of off-roading it.",
    "ATTO 3's V2L powered my coffee maker at a rest stop. Showstopper.",
  ],
  
  // Winter Driving (15+)
  winter_driving: [
    "Expect 20-30% range loss in freezing temps. Normal for all EVs.",
    "Preheat while plugged in. Huge difference in range.",
    "Winter tires are essential if you get snow.",
    "The heated seats and steering wheel are very efficient.",
    "I lost 80 miles of range in -10°C temps. Plan ahead.",
    "The defroster works fast. Glass is clear in 3 minutes.",
    "Snow mode on the ATTO 3 is impressive. Handles like AWD.",
    "Regen braking is reduced when battery is cold. Normal.",
    "I keep a snow brush in the frunk. Easy access.",
    "The cameras fog up in cold weather. Wipe them before driving.",
    "Door handles can freeze. Use de-icer spray.",
    "Charging speed is slower in extreme cold. Batteries need to warm.",
    "I use departure time to warm the battery before driving.",
    "The Tang's all-wheel drive is confidence-inspiring in snow.",
    "Winter range improves after the first 30 minutes of driving.",
  ],
};

function getRandomMessage(type) {
  const arr = chatterMessages[type];
  return arr ? getRandomItem(arr) : '';
}

/**
 * Get a random message type with weighted probabilities
 */
function getRandomMessageType() {
  const weightedTypes = [
    'questions', 'questions', 'questions', 
    'answers', 'answers', 'answers',
    'testimonials', 'testimonials', 
    'facts', 'tips', 'tips',
    'reactions', 'debates', 'comparisons', 'news', 'humor',
    'regrets', 'upgrades', 'maintenance', 'financing', 'road_trips', 'winter_driving'
  ];
  return getRandomItem(weightedTypes);
}

/**
 * Generate a rich conversation turn from a persona
 * @param {Object} persona - Persona object with name, role, favModel, etc.
 * @param {Object} options - Optional configuration
 * @returns {string} - Generated message
 */
function generateChatTurn(persona, options = {}) {
  const { 
    includePersonalNote = true, 
    includeFavModel = true,
    maxLength = 350,
    forceType = null 
  } = options;
  
  const type = forceType || getRandomMessageType();
  let message = getRandomMessage(type);
  
  if (!message) {
    message = getRandomMessage('reactions') || "Nice! 👍";
  }
  
  // Make reactions more expressive
  if (type === 'reactions') {
    const count = Math.random() > 0.7 ? 2 : 1;
    const emojis = [];
    for (let i = 0; i < count; i++) {
      const emoji = getRandomMessage('reactions');
      if (emoji) emojis.push(emoji);
    }
    message = emojis.join(' ');
  }
  
  // Add persona-specific flavor
  if (includePersonalNote && Math.random() < 0.25) {
    const personalNotes = {
      'Early adopter': ' Been following BYD since before they came to the US!',
      'Value seeker': ' Gotta stretch that dollar. The savings are real.',
      'Safety first': ' That Blade Battery gives me and my family peace of mind.',
      'Loves gadgets': ' The tech in this car is insane! Have you tried the rotating screen?',
      'Needs convincing': ' Still not 100% sure about EVs though. But BYD is making me think.',
      'Already owns BYD': ' Best decision I ever made. 2 years and counting.',
      'First EV': ' Still learning all the features! Any tips?',
      'Commercial buyer': ' Looking at fleet options too. The numbers make sense.',
      'Eco warrior': ' Saving the planet one mile at a time. Feels good.',
      'Switched from Tesla': ' So glad I made the switch. BYD just feels more solid.',
      'Auto journalist': ' I review EVs professionally. BYD is consistently impressive.',
      'European market': ' BYD is everywhere here. The ATTO 3 is a common sight.',
      'BYD home market': ' We have BYDs everywhere in China. They\'re like Toyotas.',
      'Seal owner': ' The Seal is my baby! Best car I\'ve ever owned.',
      'Road tripper': ' Took my ATTO 3 across 12 states. Zero issues.',
      'City commuter': ' Perfect for my daily commute. Saves me hours at the pump.',
      'Luxury sedan fan': ' The Han is pure class. Understated elegance.',
      'Dreaming big': ' One day I\'ll get the Yangwang! Saving up now.',
      'Worried about range': ' Range anxiety is real though. But I\'ve never been stranded.',
      'Charging skeptic': ' Still not enough chargers everywhere. But getting better.',
      'Speed demon': ' The launch control on the Seal Performance is addictive!',
      'Family hauler': ' My kids love the big screen and space in the Tang.',
      'Practical choice': ' The Song Plus just makes sense. Good value, good space.',
      'Northern driver': ' Winter range takes a hit but preheating helps a lot.',
      'Rural driver': ' Charging stations are sparse out here but improving fast.',
      'Worried about depreciation': ' EVs hold value better than people think.',
      'Delivery fleet': ' Our delivery times improved with BYD vans. Quiet and efficient.',
      'Rideshare driver': ' Passengers love the BYD! Tips have gone up since I switched.',
      'Work trucks': ' These BYD work vans are tough. Handles job sites no problem.',
      'Remote driving': ' The Tang handles rough roads like a champ. Very impressed.',
      'UK market': ' BYD is growing fast here. Seeing more on the roads weekly.',
      'Downsizing': ' The Seal is perfect now that the kids are grown. Fun and practical.',
      'Style conscious': ' The Seal turns heads everywhere. Best looking EV under $50k.',
      'Easy entry/exit': ' The ATTO 3 is so easy to get in and out of. Perfect height.',
      'Upgrading': ' Moving up from my old EV. BYD offers so much more for the money.',
      'Adventure seeker': ' The Tang has taken me places my old SUV couldn\'t.',
      'Looking for deals': ' Found a great CPO ATTO 3. Nearly new at used car prices.',
      'New driver': ' The Dolphin is so easy to drive. Perfect first car for anyone.',
      'Premium only': ' The Han Performance rivals German luxury at half the price.',
      'Owns multiple EVs': ' I have a Seal and an ATTO 3. Best of both worlds.',
      'Urban commuter': ' The Seagull fits in parking spots my old car couldn\'t dream of.',
      'Crossover fan': ' The Yuan Plus hits the sweet spot between car and SUV.',
    };
    const note = personalNotes[persona.role] || '';
    if (note) message += note;
  }
  
  // Add occasional mention of persona's favorite model
  if (includeFavModel && persona.favModel && Math.random() < 0.12) {
    message += ` The ${persona.favModel} is amazing by the way!`;
  }
  
  // Keep messages reasonably short for Discord
  if (message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }
  
  return message;
}

/**
 * Generate a conversational response to a specific topic
 * @param {string} topic - Topic keyword (e.g., 'range', 'charging', 'price')
 * @param {Object} persona - Persona object
 * @returns {string} - Generated response
 */
function generateTopicResponse(topic, persona = null) {
  const topicMap = {
    'range': ['answers', 'facts', 'tips'],
    'charging': ['answers', 'tips', 'facts'],
    'price': ['answers', 'testimonials', 'financing'],
    'battery': ['answers', 'facts', 'maintenance'],
    'maintenance': ['maintenance', 'answers'],
    'safety': ['answers', 'facts', 'testimonials'],
    'performance': ['answers', 'comparisons', 'testimonials'],
    'winter': ['winter_driving', 'tips'],
    'roadtrip': ['road_trips', 'tips'],
  };
  
  const types = topicMap[topic.toLowerCase()] || ['answers', 'facts'];
  const type = getRandomItem(types);
  let message = getRandomMessage(type);
  
  if (!message) {
    message = getRandomMessage('answers') || "Great question about BYD!";
  }
  
  if (persona) {
    message = generateChatTurn(persona, { includePersonalNote: true, forceType: type });
  }
  
  return message;
}

/**
 * Get random persona
 * @returns {Object} - Random persona
 */
function getRandomPersona() {
  return { ...getRandomItem(defaultPersonas) };
}

/**
 * Get multiple random personas
 * @param {number} count - Number of personas to get
 * @returns {Array} - Array of personas
 */
function getRandomPersonas(count = 1) {
  const shuffled = [...defaultPersonas].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, defaultPersonas.length)).map(p => ({ ...p }));
}

/**
 * Get persona by name
 * @param {string} name - Persona name
 * @returns {Object|null} - Persona object or null
 */
function getPersonaByName(name) {
  const persona = defaultPersonas.find(p => p.name === name);
  return persona ? { ...persona } : null;
}

/**
 * Get all personas
 * @returns {Array} - Array of all personas
 */
function getAllPersonas() {
  return defaultPersonas.map(p => ({ ...p }));
}

/**
 * Get personas by role category
 * @param {string} roleCategory - Role category (e.g., 'Enthusiast', 'Buyer', 'Skeptic')
 * @returns {Array} - Filtered personas
 */
function getPersonasByRoleCategory(roleCategory) {
  const categories = {
    'enthusiast': ['Early adopter', 'Loves gadgets', 'Eco warrior', 'Auto journalist', 'Switched from Tesla', 'Owns multiple EVs'],
    'buyer': ['Value seeker', 'Safety first', 'Already owns BYD', 'First EV', 'Premium only', 'New driver', 'Looking for deals', 'Upgrading'],
    'family': ['DadRob', 'Family hauler', 'TripPete'],
    'skeptic': ['Needs convincing', 'Worried about range', 'Charging skeptic', 'Northern driver', 'Rural driver', 'Worried about depreciation'],
    'commercial': ['Commercial buyer', 'Delivery fleet', 'Rideshare driver', 'Work trucks'],
    'international': ['European market', 'BYD home market', 'Remote driving', 'UK market'],
  };
  
  const roleNames = categories[roleCategory.toLowerCase()] || [];
  return defaultPersonas
    .filter(p => roleNames.includes(p.role) || roleNames.includes(p.name))
    .map(p => ({ ...p }));
}

// Get message counts for stats
function getMessageCounts() {
  const counts = {};
  for (const [type, messages] of Object.entries(chatterMessages)) {
    counts[type] = messages.length;
  }
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
  getPersonasByRoleCategory,
  getRandomMessage,
  getRandomMessageType,
  getMessageCounts,
  chatterMessages 
};