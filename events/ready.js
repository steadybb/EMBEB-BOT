// events/ready.js
const logger = require('../utils/logger');
const { startAutoPostScheduler } = require('../schedulers/autoPost');

module.exports = client => {
  client.once('ready', async () => {
    // ============================================
    // BOT READY - INITIALIZE ALL SYSTEMS
    // ============================================
    
    // Clear console and show banner
    console.clear();
    console.log('═══════════════════════════════════════════════');
    console.log('         🚗 BYD BladeBot is Online! ⚡        ');
    console.log('═══════════════════════════════════════════════');
    
    // Basic bot info
    logger.ready(`✅ Logged in as ${client.user.tag}`);
    logger.ready(`🆔 Bot ID: ${client.user.id}`);
    logger.ready(`🌐 Serving ${client.guilds.cache.size} guilds`);
    logger.ready(`👥 ${client.users.cache.size} users reachable`);
    
    // List guilds
    const guildList = client.guilds.cache.map(g => `  • ${g.name} (${g.id}) - ${g.memberCount} members`).join('\n');
    logger.info(`📋 Connected Guilds:\n${guildList}`);
    
    // ============================================
    // SET BOT PRESENCE
    // ============================================
    client.user.setPresence({
      activities: [{ 
        name: `${client.guilds.cache.size} BYD communities`, 
        type: 3 // WATCHING
      }],
      status: 'online',
    });
    
    // Rotate presence every 30 seconds
    const presenceMessages = [
      { name: '🚗 BYD EVs', type: 3 }, // WATCHING
      { name: '🔋 Blade Battery tech', type: 3 },
      { name: '⚡ The EV revolution', type: 3 },
      { name: '🏎️ BYD Seal 0-100', type: 3 },
      { name: '🌍 Over 3M NEVs sold', type: 3 },
      { name: '/help for commands', type: 2 }, // LISTENING
      { name: '/admin dashboard', type: 2 },
    ];
    
    let presenceIndex = 0;
    setInterval(() => {
      presenceIndex = (presenceIndex + 1) % presenceMessages.length;
      const presence = presenceMessages[presenceIndex];
      client.user.setActivity(presence.name, { type: presence.type });
    }, 30000);
    
    // ============================================
    // INITIALIZE AUTO POSTER
    // ============================================
    try {
      const hasApiKey = !!process.env.OPENROUTER_API_KEY;
      const hasChannels = process.env.AUTO_POST_CHANNELS?.split(',').filter(Boolean).length > 0;
      
      if (hasChannels || hasApiKey) {
        startAutoPostScheduler(client);
      } else {
        logger.warn('⚠️  Auto poster disabled - no API key or channels configured');
      }
    } catch (err) {
      logger.error('Failed to start auto poster scheduler:', err.message);
    }
    
    // ============================================
    // VERIFY CRITICAL CONFIGURATIONS
    // ============================================
    const { getGuildConfig } = require('../utils/database');
    
    // Check each guild's configuration
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const config = await getGuildConfig(guildId);
        
        const checks = [];
        if (config.verify_enabled && config.verify_role_id) checks.push('✅ Verify');
        else checks.push('❌ Verify');
        
        if (config.ticket_category_id && config.staff_role_id) checks.push('✅ Tickets');
        else checks.push('❌ Tickets');
        
        if (config.auto_post_enabled && config.auto_post_channels?.length) checks.push('✅ AutoPost');
        else checks.push('❌ AutoPost');
        
        if (config.lobby_chatter_enabled && config.lobby_webhook_url) checks.push('✅ Lobby');
        else checks.push('❌ Lobby');
        
        logger.debug(`⚙️  ${guild.name}: ${checks.join(' | ')}`);
      } catch (err) {
        logger.debug(`Could not verify config for ${guild.name}`);
      }
    }
    
    // ============================================
    // CHECK ENVIRONMENT VARIABLES
    // ============================================
    const envChecks = [];
    
    // Critical
    if (process.env.DISCORD_TOKEN) envChecks.push('🟢 DISCORD_TOKEN');
    else envChecks.push('🔴 DISCORD_TOKEN');
    
    // Optional but important
    if (process.env.OPENROUTER_API_KEY) envChecks.push('🟢 OPENROUTER_API_KEY');
    else envChecks.push('🟡 OPENROUTER_API_KEY (using fallback)');
    
    if (process.env.AUTO_POST_CHANNELS) envChecks.push('🟢 AUTO_POST_CHANNELS');
    else envChecks.push('🟡 AUTO_POST_CHANNELS (not set)');
    
    if (process.env.STATIC_BASE_URL) envChecks.push('🟢 STATIC_BASE_URL');
    else envChecks.push('🟡 STATIC_BASE_URL (not set)');
    
    if (process.env.DATABASE_URL || process.env.MONGODB_URI) envChecks.push('🟢 Database URL');
    else envChecks.push('🟡 Database URL (using local)');
    
    logger.info('🔧 Environment Variables:');
    envChecks.forEach(check => logger.info(`  ${check}`));
    
    // ============================================
    // SYSTEM READY SUMMARY
    // ============================================
    const summary = [];
    summary.push('');
    summary.push('═══════════════════════════════════════════════');
    summary.push('           🎉 ALL SYSTEMS OPERATIONAL         ');
    summary.push('═══════════════════════════════════════════════');
    summary.push(`  🤖 Bot:        ${client.user.tag}`);
    summary.push(`  📊 Guilds:     ${client.guilds.cache.size}`);
    summary.push(`  👥 Users:      ${client.users.cache.size}`);
    summary.push(`  🔌 API:        ${process.env.OPENROUTER_API_KEY ? 'Configured' : 'Fallback mode'}`);
    summary.push(`  📻 AutoPost:   ${process.env.AUTO_POST_CHANNELS ? 'Scheduled' : 'Disabled'}`);
    summary.push(`  🖼️ Static:     ${process.env.STATIC_BASE_URL || 'Not set'}`);
    summary.push('═══════════════════════════════════════════════');
    
    console.log(summary.join('\n'));
    
    // ============================================
    // OPTIONAL: WEB SERVER FOR UPTIME MONITORING
    // ============================================
    if (process.env.PORT || process.env.WEB_SERVER === 'true') {
      try {
        const express = require('express');
        const path = require('path');
        const app = express();
        const PORT = process.env.PORT || 3000;
        
        // Serve static files
        if (process.env.STATIC_BASE_URL) {
          app.use('/static', express.static(path.join(__dirname, '..', 'static')));
          logger.ready(`🖼️  Static files served at /static`);
        }
        
        // Health check endpoint
        app.get('/', (req, res) => {
          res.json({
            status: 'online',
            bot: client.user.tag,
            guilds: client.guilds.cache.size,
            users: client.users.cache.size,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          });
        });
        
        // Stats endpoint
        app.get('/stats', (req, res) => {
          try {
            const { getAutoPostStats } = require('../schedulers/autoPost');
            const { getApiStats } = require('../utils/openai');
            res.json({
              bot: client.user.tag,
              autopost: getAutoPostStats(),
              api: getApiStats(),
              uptime: process.uptime(),
            });
          } catch (err) {
            res.json({ error: 'Stats not available yet' });
          }
        });
        
        app.listen(PORT, () => {
          logger.ready(`🌐 Web server running on port ${PORT}`);
        });
      } catch (err) {
        logger.warn('Web server not started:', err.message);
      }
    }
    
    logger.ready('🚀 BYD BladeBot is fully ready!');
  });
};