// utils/lobbyChatter.js
const { getRandomItem } = require('./helpers'); // we'll define simple helpers

// Default persona set (9 people). Each has name, avatar URL (use static images), and a "role".
const defaultPersonas = [
  { name: 'EV_Enthusiast_Mike', avatar: 'https://i.imgur.com/avatar1.png', role: 'Early adopter' },
  { name: 'Budget_Buyer_Lisa', avatar: 'https://i.imgur.com/avatar2.png', role: 'Value seeker' },
  { name: 'Family_Dad_Robert', avatar: 'https://i.imgur.com/avatar3.png', role: 'Safety first' },
  { name: 'Tech_Guru_Anna', avatar: 'https://i.imgur.com/avatar4.png', role: 'Loves gadgets' },
  { name: 'Skeptical_Tom', avatar: 'https://i.imgur.com/avatar5.png', role: 'Needs convincing' },
  { name: 'Happy_Owner_Sam', avatar: 'https://i.imgur.com/avatar6.png', role: 'Already owns BYD' },
  { name: 'EV_Newbie_Jen', avatar: 'https://i.imgur.com/avatar7.png', role: 'First EV' },
  { name: 'Fleet_Manager_Omar', avatar: 'https://i.imgur.com/avatar8.png', role: 'Commercial buyer' },
  { name: 'Green_Activist_Clara', avatar: 'https://i.imgur.com/avatar9.png', role: 'Eco warrior' },
];

// Pre‑written conversation snippets (rotated)
const chatterMessages = {
  questions: [
    "Has anyone test‑driven the Seal yet? How's the acceleration?",
    "What’s the real‑world range of the ATTO 3 in winter?",
    "Does BYD offer free home charger installation in all states?",
    "I'm torn between Dolphin and Yuan Plus – any advice?",
    "How long does it take to charge from 10% to 80% on a fast charger?",
    "Is the Blade Battery really that safe? Seen videos but want real feedback.",
  ],
  answers: [
    "I drove the Seal last week – 0‑60 felt like 4 seconds! So smooth.",
    "ATTO 3 gave me 280 miles at 30°F. Not bad at all!",
    "Free charger depends on state – CA, NY, CO have it. Check with BladeBot.",
    "Dolphin is great for city parking; Yuan Plus if you need more cargo space.",
    "Fast charge: 30 mins from 10‑80% on a 150kW charger.",
    "Blade Battery passed the nail penetration test. I feel safer in BYD.",
  ],
  testimonials: [
    "I saved $7,500 thanks to federal credits. Seal cost me ~$32k out the door!",
    "My ATTO 3 has been flawless for 15k miles. Best family car ever.",
    "Han Performance is a beast – luxury feel, supercar speed.",
    "Seagull is perfect for my city commute. $19k before credits – insane value.",
  ],
  reactions: [
    "😍", "🔥", "🤔", "💡", "👍", "😎", "🚗⚡"
  ]
};

function getRandomMessage(type) {
  const arr = chatterMessages[type];
  return arr ? getRandomItem(arr) : '';
}

// Generate a short conversation turn from a persona
function generateChatTurn(persona) {
  const type = getRandomItem(['questions', 'answers', 'testimonials', 'reactions']);
  let message = getRandomMessage(type);
  if (type === 'reactions') {
    message = `${message} ${getRandomMessage('reactions')}`; // double emoji
  }
  // Add occasional persona‑specific flavor
  if (Math.random() < 0.3) {
    message += ` (${persona.role})`;
  }
  return message;
}

module.exports = { defaultPersonas, generateChatTurn, chatterMessages };