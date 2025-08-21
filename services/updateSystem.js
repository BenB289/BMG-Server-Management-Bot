const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const PterodactylAPI = require('./pterodactyl');
const database = require('../config/database');

class UpdateSystem {
    constructor() {
        this.activeMessages = new Map(); // Store active status messages
        this.updateInterval = parseInt(process.env.UPDATE_INTERVAL) || 30000; // 30 seconds default
        this.isRunning = false;
    }

    start(client) {
        if (this.isRunning) return;
        
        this.client = client;
        this.isRunning = true;
        
        console.log('🔄 Starting auto-update system...');
        
        // Update every 30 seconds (or configured interval)
        this.updateTask = cron.schedule('*/30 * * * * *', async () => {
            await this.updateAllActiveMessages();
        });
        
        console.log(`✅ Auto-update system started (${this.updateInterval/1000}s intervals)`);
    }

    stop() {
        if (this.updateTask) {
            this.updateTask.destroy();
        }
        this.isRunning = false;
        console.log('🛑 Auto-update system stopped');
    }

    async registerStatusMessage(messageId, channelId, serverId, userId) {
        this.activeMessages.set(messageId, {
            channelId,
            serverId,
            userId,
            lastUpdate: Date.now(),
            updateCount: 0
        });
        
        console.log(`📝 Registered status message for server ${serverId}`);
    }

    async unregisterStatusMessage(messageId) {
        this.activeMessages.delete(messageId);
        console.log(`🗑️ Unregistered status message ${messageId}`);
    }

    async updateAllActiveMessages() {
        if (this.activeMessages.size === 0) return;
        
        console.log(`🔄 Updating ${this.activeMessages.size} active status messages...`);
        
        const pterodactyl = new PterodactylAPI();
        const updatePromises = [];

        for (const [messageId, messageData] of this.activeMessages.entries()) {
            updatePromises.push(this.updateSingleMessage(messageId, messageData, pterodactyl));
        }

        await Promise.allSettled(updatePromises);
    }

    async updateSingleMessage(messageId, messageData, pterodactyl) {
        try {
            const { channelId, serverId, userId } = messageData;
            
            // Check if user still has permission
            const authService = require('./auth');
            const hasPermission = await authService.hasServerPermission(userId, serverId);
            if (!hasPermission) {
                this.activeMessages.delete(messageId);
                return;
            }

            // Get channel and message
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                this.activeMessages.delete(messageId);
                return;
            }

            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (!message) {
                this.activeMessages.delete(messageId);
                return;
            }

            // Fetch updated server data
            const [serverDetails, serverResources] = await Promise.all([
                pterodactyl.getServerDetails(serverId),
                pterodactyl.getServerResources(serverId)
            ]);

            if (!serverDetails.success || !serverResources.success) {
                console.error(`Failed to fetch data for server ${serverId}`);
                return;
            }

            // Save stats to database
            await database.saveStats(serverId, {
                cpu: serverResources.data.cpu_absolute,
                memory: serverResources.data.memory_bytes,
                disk: serverResources.data.disk_bytes,
                uptime: serverResources.data.uptime || 0,
                state: serverResources.data.current_state
            });

            // Create updated embed
            const serverCommand = require('../commands/server');
            const updatedEmbed = serverCommand.createStatusEmbed(
                serverDetails.data, 
                serverResources.data, 
                pterodactyl
            );

            // Add update counter to footer
            messageData.updateCount++;
            updatedEmbed.setFooter({ 
                text: `Last updated • Update #${messageData.updateCount}` 
            });

            // Update the message
            await message.edit({ embeds: [updatedEmbed] });
            
            messageData.lastUpdate = Date.now();
            
        } catch (error) {
            console.error(`Error updating message ${messageId}:`, error);
            
            // Remove problematic messages after 3 failed attempts
            if (!messageData.failCount) messageData.failCount = 0;
            messageData.failCount++;
            
            if (messageData.failCount >= 3) {
                this.activeMessages.delete(messageId);
                console.log(`Removed problematic message ${messageId} after 3 failed attempts`);
            }
        }
    }

    // Clean up old messages (older than 1 hour)
    async cleanup() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        for (const [messageId, messageData] of this.activeMessages.entries()) {
            if (messageData.lastUpdate < oneHourAgo) {
                this.activeMessages.delete(messageId);
                console.log(`🧹 Cleaned up old message ${messageId}`);
            }
        }
    }

    getActiveMessageCount() {
        return this.activeMessages.size;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            activeMessages: this.activeMessages.size,
            updateInterval: this.updateInterval
        };
    }
}

module.exports = new UpdateSystem();
