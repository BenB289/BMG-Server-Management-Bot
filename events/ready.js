const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
        console.log(`📊 Serving ${client.guilds.cache.size} servers`);
        
        // Set bot status
        client.user.setActivity('Pterodactyl servers', { type: 'WATCHING' });
        
        // Start the auto-update system
        const updateSystem = require('../services/updateSystem');
        updateSystem.start(client);
    },
};
