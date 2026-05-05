// schedulers/testimonialPosts.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const { getRandomItem, sleep } = require('../utils/helpers');

// ============================================
// CONFIGURATION
// ============================================
const STATIC_URL = process.env.STATIC_BASE_URL || 'http://localhost:3000';
const TESTIMONIAL_CHANNEL_ID = process.env.TESTIMONIAL_CHANNEL_ID;
const GIVEAWAY_SERVER_ID = process.env.GIVEAWAY_SERVER_ID || '1498758472483999814';
const GIVEAWAY_URL = `https://discord.com/channels/${GIVEAWAY_SERVER_ID}/${GIVEAWAY_SERVER_ID}`;
const MIN_INTERVAL = parseInt(process.env.TESTIMONIAL_MIN_INTERVAL, 10) || 5 * 60 * 1000; // 5 minutes
const MAX_INTERVAL = parseInt(process.env.TESTIMONIAL_MAX_INTERVAL, 10) || 3 * 60 * 60 * 1000; // 3 hours

// ============================================
// 20 WINNING TESTIMONIALS WITH PHOTOS
// ============================================
const winningTestimonials = [
  {
    username: 'EV_Mike',
    avatar: 'https://ui-avatars.com/api/?name=EV+Mike&background=00BFFF&color=fff&size=128&bold=true',
    prize: '2026 BYD Seal',
    value: '$39,990',
    testimonial: 'I still can\'t believe I won! The Seal is absolutely incredible. 0-60 in 3.8 seconds and the Ocean X Blue color turns heads everywhere. The Blade Battery gives me so much confidence. Thank you BYD! 🚗⚡',
    location: 'Los Angeles, CA',
    daysAgo: 2,
    image: `${STATIC_URL}/static/testimonial-seal.jpg`,
  },
  {
    username: 'Tesla2BYD',
    avatar: 'https://ui-avatars.com/api/?name=Tesla+2+BYD&background=0066CC&color=fff&size=128&bold=true',
    prize: '2026 BYD Han',
    value: '$59,990',
    testimonial: 'Traded my Model 3 for this beauty and I have ZERO regrets! The Han\'s massage seats, Dynaudio system, and 450-mile range make every drive feel like first class. German luxury brands are officially on notice! 👑✨',
    location: 'Austin, TX',
    daysAgo: 5,
    image: `${STATIC_URL}/static/testimonial-han.jpg`,
  },
  {
    username: 'BudgetLisa',
    avatar: 'https://ui-avatars.com/api/?name=Budget+Lisa&background=FF69B4&color=fff&size=128&bold=true',
    prize: '2026 BYD Dolphin',
    value: '$29,990',
    testimonial: 'As a single mom of 3, I never thought I\'d drive a brand new car! The Dolphin is perfect - affordable, spacious, and the kids LOVE the rotating screen. We\'ve saved $400 on gas already! Best giveaway ever! 🐬💙',
    location: 'Miami, FL',
    daysAgo: 7,
    image: `${STATIC_URL}/static/testimonial-dolphin.jpg`,
  },
  {
    username: 'RoadTripper_Steve',
    avatar: 'https://ui-avatars.com/api/?name=Road+Steve&background=E67E22&color=fff&size=128&bold=true',
    prize: '2026 BYD Tang',
    value: '$49,990',
    testimonial: 'Won the Tang and immediately drove Route 66! 7 seats for the whole family, 390 miles range, and the V2L powered our campsite! Charging stops were quick and easy. This SUV is a road trip LEGEND! 🗺️🚙',
    location: 'Denver, CO',
    daysAgo: 3,
    image: `${STATIC_URL}/static/testimonial-tang.jpg`,
  },
  {
    username: 'CityCommuter_Kai',
    avatar: 'https://ui-avatars.com/api/?name=City+Kai&background=2ECC71&color=fff&size=128&bold=true',
    prize: '2026 BYD Seagull',
    value: '$19,990',
    testimonial: 'The Seagull is the ULTIMATE city car! Parks anywhere, costs pennies to charge, and the Coral Pink color gets so many compliments. Already saved $350 on gas in 2 weeks. Best commuter decision ever! 🏙️🕊️',
    location: 'Brooklyn, NY',
    daysAgo: 14,
    image: `${STATIC_URL}/static/testimonial-seagull.jpg`,
  },
  {
    username: 'FleetBoss_Omar',
    avatar: 'https://ui-avatars.com/api/?name=Fleet+Omar&background=34495E&color=fff&size=128&bold=true',
    prize: '2026 BYD Commercial Van',
    value: '$49,990',
    testimonial: 'Our delivery business was transformed overnight! 280 miles range hauls packages all day, zero fuel costs, and the 3,500 lbs payload is perfect. Already ordered 4 more for the fleet. ROI is incredible! 📦🚛',
    location: 'Chicago, IL',
    daysAgo: 10,
    image: `${STATIC_URL}/static/testimonial-commercial.jpg`,
  },
  {
    username: 'Gearhead_Al',
    avatar: 'https://ui-avatars.com/api/?name=Gearhead+Al&background=C0392B&color=fff&size=128&bold=true',
    prize: '2026 BYD Seal Performance',
    value: '$48,990',
    testimonial: 'Lifelong petrolhead here - the Seal Performance converted me! 3.4 seconds to 60, launch control, and the handling is telepathic. Did a track day and embarrassed cars twice the price. BYD is the real deal! 🏎️🔥',
    location: 'Detroit, MI',
    daysAgo: 4,
    image: `${STATIC_URL}/static/testimonial-seal-perf.jpg`,
  },
  {
    username: 'New2EV_Jen',
    avatar: 'https://ui-avatars.com/api/?name=New2EV+Jen&background=1ABC9C&color=fff&size=128&bold=true',
    prize: '2026 BYD ATTO 3',
    value: '$34,990',
    testimonial: 'First electric car and I\'m NEVER going back to gas! The ATTO 3\'s gym-inspired interior is so unique - guitar string door handles, dumbbell air vents! 380 miles range and the 360 camera makes parking effortless. I\'m officially an EV evangelist! ⚡🎸',
    location: 'Seattle, WA',
    daysAgo: 6,
    image: `${STATIC_URL}/static/testimonial-atto3.jpg`,
  },
  {
    username: 'DadRob_Jr',
    avatar: 'https://ui-avatars.com/api/?name=Dad+Rob&background=3498DB&color=fff&size=128&bold=true',
    prize: '2026 BYD Song Plus',
    value: '$42,990',
    testimonial: 'Our family SUV search ended when we WON the Song Plus! 5-star safety, 400 miles range, and the panoramic roof keeps the kids entertained. My wife wants her own now. Safest, most practical car we\'ve ever owned! 👨‍👩‍👧‍👦⭐',
    location: 'Portland, OR',
    daysAgo: 8,
    image: `${STATIC_URL}/static/testimonial-song-plus.jpg`,
  },
  {
    username: 'LuxuryMarcus',
    avatar: 'https://ui-avatars.com/api/?name=Lux+Marcus&background=8E44AD&color=fff&size=128&bold=true',
    prize: '2026 Yangwang U8',
    value: '$129,990',
    testimonial: 'Pinching myself daily! The Yangwang U8 is the most incredible vehicle on the planet. Tank turn, 1.4m water wading, drone launch, and 450 miles range. It makes my Range Rover look like a toy. BYD is the future of luxury! 👑🌊',
    location: 'Beverly Hills, CA',
    daysAgo: 15,
    image: `${STATIC_URL}/static/testimonial-yangwang-u8.jpg`,
  },
  {
    username: 'AdventurePete',
    avatar: 'https://ui-avatars.com/api/?name=Advent+Pete&background=795548&color=fff&size=128&bold=true',
    prize: '2026 BYD Tang L',
    value: '$56,990',
    testimonial: 'The Tang L took my family to places our old SUV couldn\'t dream of! 410 miles range, 7 seats, 85 cubic feet of cargo with seats down. Off-road mode handled Moab like a champ. Ultimate family adventure machine! 🏔️🚗',
    location: 'Phoenix, AZ',
    daysAgo: 12,
    image: `${STATIC_URL}/static/testimonial-tang-l.jpg`,
  },
  {
    username: 'EcoWarrior_Clara',
    avatar: 'https://ui-avatars.com/api/?name=Eco+Clara&background=27AE60&color=fff&size=128&bold=true',
    prize: '2026 BYD Dolphin',
    value: '$29,990',
    testimonial: 'Winning an eco-friendly EV was destiny! The Dolphin uses recycled ocean plastics in the interior and BYD\'s factories run on renewable energy. Zero emissions, guilt-free driving, and SO much fun. The planet thanks you, BYD! 🌍💚',
    location: 'Boston, MA',
    daysAgo: 9,
    image: `${STATIC_URL}/static/testimonial-dolphin-eco.jpg`,
  },
  {
    username: 'SpeedQueen_Sofia',
    avatar: 'https://ui-avatars.com/api/?name=Sofia+Speed&background=FF5722&color=fff&size=128&bold=true',
    prize: '2026 BYD Han Performance',
    value: '$69,990',
    testimonial: 'Upgraded from my BMW M5 to the Han Performance I won! 3.4 seconds, carbon fiber trim, and the Nappa leather massage seats are heaven. Gets MORE attention than my Bimmer ever did. Sorry Germany, China wins! 🏎️👸',
    location: 'Las Vegas, NV',
    daysAgo: 11,
    image: `${STATIC_URL}/static/testimonial-han-perf.jpg`,
  },
  {
    username: 'StudentDriver_Emma',
    avatar: 'https://ui-avatars.com/api/?name=Student+Em&background=E91E63&color=fff&size=128&bold=true',
    prize: '2026 BYD Seagull',
    value: '$19,990',
    testimonial: 'College student who won a CAR! The Seagull is perfect for campus - tiny turning radius, fits ANY parking spot, and costs like $15/month to charge. My friends are all jealous. Best study break ever was entering this giveaway! 📚🚗',
    location: 'Ann Arbor, MI',
    daysAgo: 18,
    image: `${STATIC_URL}/static/testimonial-seagull-student.jpg`,
  },
  {
    username: 'Retired_Frank',
    avatar: 'https://ui-avatars.com/api/?name=Frank+Ret&background=455A64&color=fff&size=128&bold=true',
    prize: '2026 BYD ATTO 3',
    value: '$34,990',
    testimonial: 'At 72, I wanted something easy to get in and out of. The ATTO 3 is PERFECT - perfect seat height, smooth ride, and I love that I never visit gas stations anymore. My grandkids think their grandpa is cool now! 👴⚡',
    location: 'Sarasota, FL',
    daysAgo: 20,
    image: `${STATIC_URL}/static/testimonial-atto3-senior.jpg`,
  },
  {
    username: 'Rideshare_Carlos',
    avatar: 'https://ui-avatars.com/api/?name=Uber+Carlos&background=D35400&color=fff&size=128&bold=true',
    prize: '2026 BYD Yuan Plus',
    value: '$37,990',
    testimonial: 'My Uber rating went from 4.8 to 4.98 after winning the Yuan Plus! Passengers LOVE the spacious interior and quiet ride. Fuel savings of $800/month means this car pays for itself. Best business decision I never made! 🚕💰',
    location: 'San Diego, CA',
    daysAgo: 13,
    image: `${STATIC_URL}/static/testimonial-yuan-plus.jpg`,
  },
  {
    username: 'YoungPro_Kevin',
    avatar: 'https://ui-avatars.com/api/?name=Pro+Kevin&background=3F51B5&color=fff&size=128&bold=true',
    prize: '2026 BYD Seal',
    value: '$39,990',
    testimonial: 'First big boy car and I WON it! Taking clients to lunch in the Seal is a flex. The Ocean X design, 420-mile range, and that acceleration. My Tesla-driving boss is genuinely impressed. Career AND car upgrade! 💼🚗',
    location: 'San Francisco, CA',
    daysAgo: 16,
    image: `${STATIC_URL}/static/testimonial-seal-pro.jpg`,
  },
  {
    username: 'Outback_Explorer',
    avatar: 'https://ui-avatars.com/api/?name=Outback+Oz&background=F57C00&color=fff&size=128&bold=true',
    prize: '2026 BYD Tang',
    value: '$49,990',
    testimonial: 'Remote Australia tested, BYD approved! The Tang handled 500 miles of outback dirt roads without breaking a sweat. V2L powered our camp for 3 days. The Blade Battery didn\'t flinch in 45°C heat. Unstoppable! 🇦🇺🦘',
    location: 'Perth, Australia',
    daysAgo: 21,
    image: `${STATIC_URL}/static/testimonial-tang-outback.jpg`,
  },
  {
    username: 'TechReviewer_Raj',
    avatar: 'https://ui-avatars.com/api/?name=Tech+Raj&background=9B59B6&color=fff&size=128&bold=true',
    prize: '2026 BYD Han',
    value: '$59,990',
    testimonial: 'I review cars for a living. When I won the Han, I was skeptical. After 1 month: the best EV I\'ve tested under $60k. Better software than Tesla, more luxurious than Mercedes EQE. My review went viral. BYD isn\'t coming - they\'re HERE! 📱🏆',
    location: 'San Jose, CA',
    daysAgo: 17,
    image: `${STATIC_URL}/static/testimonial-han-review.jpg`,
  },
  {
    username: 'SingleMom_Winner',
    avatar: 'https://ui-avatars.com/api/?name=Mom+Winner&background=E91E63&color=fff&size=128&bold=true',
    prize: '2026 BYD Song Plus',
    value: '$42,990',
    testimonial: 'Never won anything in my life until this! The Song Plus fits my twins\' car seats perfectly, has a 5-star safety rating, and the monthly savings on gas means more for their college fund. Cried happy tears at the dealership! 👩‍👧‍👦💕',
    location: 'Atlanta, GA',
    daysAgo: 19,
    image: `${STATIC_URL}/static/testimonial-song-mom.jpg`,
  },
];

// ============================================
// TRACK POSTED TESTIMONIALS (avoid repeats)
// ============================================
const postedTestimonials = new Set();

function getNextTestimonial() {
  const available = winningTestimonials.filter(t => !postedTestimonials.has(t.username));
  
  if (available.length === 0) {
    postedTestimonials.clear();
    logger.info('🔄 All testimonials posted - resetting cycle');
    return getRandomItem(winningTestimonials);
  }
  
  const selected = getRandomItem(available);
  postedTestimonials.add(selected.username);
  return selected;
}

// ============================================
// MAIN POST FUNCTION WITH RETRY LOGIC
// ============================================

async function postTestimonial(client, channelId) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      // Check if client is ready
      if (!client || !client.isReady()) {
        logger.warn('Client not ready, waiting 2 seconds...');
        await sleep(2000);
        retries--;
        continue;
      }
      
      const channel = client.channels.cache.get(channelId || TESTIMONIAL_CHANNEL_ID);
      if (!channel) {
        logger.warn(`Testimonial channel not found: ${channelId || TESTIMONIAL_CHANNEL_ID}`);
        
        // Try to fetch the channel if not in cache
        try {
          const fetchedChannel = await client.channels.fetch(channelId || TESTIMONIAL_CHANNEL_ID);
          if (fetchedChannel) {
            logger.info(`✅ Successfully fetched testimonial channel`);
            const testimonial = getNextTestimonial();
            await sendTestimonialMessage(fetchedChannel, testimonial);
            return true;
          }
        } catch (fetchErr) {
          logger.error(`Could not fetch channel: ${fetchErr.message}`);
        }
        
        return false;
      }

      const testimonial = getNextTestimonial();
      await sendTestimonialMessage(channel, testimonial);
      return true;
      
    } catch (err) {
      retries--;
      logger.error(`Failed to post testimonial (${retries} retries left):`, err.message);
      
      if (retries > 0) {
        // Exponential backoff
        const backoffTime = (4 - retries) * 1000;
        logger.info(`Retrying in ${backoffTime}ms...`);
        await sleep(backoffTime);
      }
    }
  }
  
  return false;
}

async function sendTestimonialMessage(channel, testimonial) {
  // Validate image URL - if image fails, we'll still send the embed
  let imageUrl = testimonial.image;
  let imageValid = true;
  
  // Check if image URL is properly formatted
  if (!imageUrl || imageUrl === `${STATIC_URL}/static/undefined`) {
    imageValid = false;
    imageUrl = null;
    logger.warn(`Invalid image URL for ${testimonial.username}, posting without image`);
  }
  
  const embed = new EmbedBuilder()
    .setAuthor({ 
      name: `${testimonial.username} 🏆`, 
      iconURL: testimonial.avatar,
      url: GIVEAWAY_URL
    })
    .setTitle(`🎉 Won a ${testimonial.prize}!`)
    .setDescription(
      `> *"${testimonial.testimonial}"*\n\n` +
      `## 🏆 Prize Details\n` +
      `**Vehicle:** ${testimonial.prize}\n` +
      `**Value:** ${testimonial.value}\n` +
      `**Location:** ${testimonial.location}\n` +
      `**Won:** ${testimonial.daysAgo} days ago\n\n` +
      `## 🚗 Want to be our next winner?\n` +
      `Click the button below to join our giveaway server!\n\n` +
      `*Real winners. Real cars. Real dreams coming true.*`
    )
    .setColor('#FFD700')
    .setFooter({ 
      text: '⚡ BYD Official Giveaways • Build Your Dreams • Verified Winner', 
      iconURL: 'https://cdn.byd.com/bot/byd-logo.png' 
    })
    .setTimestamp();

  // Only add image if it's valid
  if (imageValid && imageUrl) {
    embed.setImage(imageUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🚗 Enter Giveaway Now')
      .setStyle(ButtonStyle.Link)
      .setURL(GIVEAWAY_URL),
    new ButtonBuilder()
      .setLabel('📋 View All Giveaways')
      .setStyle(ButtonStyle.Link)
      .setURL(GIVEAWAY_URL)
  );

  // Send the message with a timeout
  const sendPromise = channel.send({ embeds: [embed], components: [row] });
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Send timeout after 15 seconds')), 15000)
  );
  
  const message = await Promise.race([sendPromise, timeoutPromise]);
  
  // Try to crosspost if it's an announcement channel
  try {
    if (channel.type === 5 || channel.type === 0) { // Announcement channel or text channel
      await message.crosspost().catch(() => {});
    }
  } catch {}

  logger.info(`📢 Testimonial posted: ${testimonial.username} - ${testimonial.prize}`);
  return message;
}

// ============================================
// AUTOMATED SCHEDULER (Random 5 min - 3 hours)
// ============================================

let isRunning = false;
let shutdownRequested = false;

async function runTestimonialLoop(client) {
  if (isRunning) {
    logger.warn('Testimonial loop already running');
    return;
  }
  
  isRunning = true;
  shutdownRequested = false;
  
  const minMin = Math.round(MIN_INTERVAL / 60000);
  const maxHr = Math.round(MAX_INTERVAL / 3600000 * 10) / 10;
  logger.ready(`📢 Testimonial scheduler started (every ${minMin} min - ${maxHr} hours randomly)`);
  
  while (!shutdownRequested) {
    try {
      const delay = Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) + MIN_INTERVAL;
      
      if (delay < 3600000) {
        logger.debug(`📢 Next testimonial in ~${Math.round(delay / 60000)} minutes`);
      } else {
        logger.debug(`📢 Next testimonial in ~${Math.round(delay / 3600000 * 10) / 10} hours`);
      }
      
      await sleep(delay);
      
      // Check if shutdown was requested during sleep
      if (shutdownRequested) break;
      
      // Check if client is still connected
      if (!client || !client.isReady()) {
        logger.warn('Client disconnected, waiting for reconnect...');
        await sleep(30000);
        continue;
      }
      
      await postTestimonial(client);
      
    } catch (err) {
      logger.error('Testimonial loop error:', err.message);
      // Wait a bit before retrying on error
      await sleep(60000);
    }
  }
  
  isRunning = false;
  logger.info('📢 Testimonial scheduler stopped');
}

// Graceful shutdown function
function stopTestimonialScheduler() {
  if (isRunning) {
    shutdownRequested = true;
    logger.info('📢 Stopping testimonial scheduler...');
  }
}

// ============================================
// STARTUP
// ============================================

function startTestimonialScheduler(client) {
  if (!TESTIMONIAL_CHANNEL_ID) {
    logger.warn('⚠️  TESTIMONIAL_CHANNEL_ID not set. Testimonial posts disabled.');
    return;
  }

  // Validate channel exists after client is ready
  setTimeout(async () => {
    try {
      const channel = await client.channels.fetch(TESTIMONIAL_CHANNEL_ID);
      if (!channel) {
        logger.error(`❌ Testimonial channel ${TESTIMONIAL_CHANNEL_ID} not found! Check your TESTIMONIAL_CHANNEL_ID env var.`);
        return;
      }
      logger.info(`✅ Testimonial channel found: ${channel.name}`);
    } catch (err) {
      logger.error(`❌ Cannot access testimonial channel: ${err.message}`);
    }
  }, 5000);

  runTestimonialLoop(client);
  
  logger.ready(`📢 Testimonial scheduler ready`);
  logger.info(`📢 Channel ID: ${TESTIMONIAL_CHANNEL_ID}`);
  logger.info(`📢 Giveaway Server: ${GIVEAWAY_SERVER_ID}`);
  logger.info(`📢 Giveaway URL: ${GIVEAWAY_URL}`);
  logger.info(`📢 Interval: ${Math.round(MIN_INTERVAL / 60000)} min - ${Math.round(MAX_INTERVAL / 3600000 * 10) / 10} hours (random)`);
  logger.info(`📢 Total testimonials: ${winningTestimonials.length}`);
}

// ============================================
// MANUAL TRIGGER
// ============================================

async function postTestimonialNow(client, channelId) {
  if (!client || !client.isReady()) {
    throw new Error('Client is not ready');
  }
  return postTestimonial(client, channelId);
}

// ============================================
// LIST AVAILABLE TESTIMONIALS
// ============================================

function listTestimonials() {
  return winningTestimonials.map(t => ({
    username: t.username,
    prize: t.prize,
    value: t.value,
    image: t.image,
  }));
}

// ============================================
// EXPORTS
// ============================================

module.exports = { 
  startTestimonialScheduler,
  stopTestimonialScheduler,
  postTestimonialNow,
  winningTestimonials,
  listTestimonials,
};