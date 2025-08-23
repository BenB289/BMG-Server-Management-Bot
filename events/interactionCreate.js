const { Events } = require('discord.js');
const PterodactylAPI = require('../services/pterodactyl');
const authService = require('../services/auth');
const database = require('../config/database');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            await handleSelectMenu(interaction);
        } else if (interaction.isButton()) {
            await handleButton(interaction);
        }
    },
};

async function handleSelectMenu(interaction) {
    const { customId, values } = interaction;
    const serverId = values[0];
    const userId = interaction.user.id;

    // Check permissions
    const hasPermission = await authService.hasServerPermission(userId, serverId);
    if (!hasPermission) {
        return interaction.reply({
            content: '❌ You do not have permission to access this server.',
            ephemeral: true
        });
    }

    if (customId === 'select_server_status') {
        await interaction.deferUpdate();
        const serverCommand = require('../commands/server');
        await serverCommand.showServerStatus(interaction, serverId);
    } else if (customId === 'select_server_control') {
        await interaction.deferUpdate();
        const serverCommand = require('../commands/server');
        await serverCommand.showServerControls(interaction, serverId);
    }
}

async function handleButton(interaction) {
    const { customId } = interaction;
    const userId = interaction.user.id;

    // Rate limiting
    if (authService.isRateLimited(userId, 'button_action')) {
        return interaction.reply({
            content: '⚠️ You are being rate limited. Please wait a moment.',
            ephemeral: true
        });
    } else if (customId.startsWith('select_server_dashboard')) {
        const serverId = interaction.values[0];
        
        // Check permissions
        const hasPermission = await authService.hasServerPermission(userId, serverId);
        if (!hasPermission) {
            return interaction.reply({
                content: '❌ You do not have permission to view this server.',
                ephemeral: true
            });
        }

        await interaction.deferUpdate();
        const serverCommand = require('../commands/server');
        await serverCommand.showServerDashboard(interaction, serverId);
    } else if (customId.startsWith('refresh_status_')) {
        const serverId = customId.replace('refresh_status_', '');
        
        // Check permissions
        const hasPermission = await authService.hasServerPermission(userId, serverId);
        if (!hasPermission) {
            return interaction.reply({
                content: '❌ You do not have permission to access this server.',
                ephemeral: true
            });
        }

        await interaction.deferUpdate();
        const serverCommand = require('../commands/server');
        await serverCommand.showServerStatus(interaction, serverId);
    } else if (customId.startsWith('refresh_')) {
        const serverId = customId.replace('refresh_', '');
        
        // Check permissions
        const hasPermission = await authService.hasServerPermission(userId, serverId);
        if (!hasPermission) {
            return interaction.reply({
                content: '❌ You do not have permission to access this server.',
                ephemeral: true
            });
        }

        await interaction.deferUpdate();
        const serverCommand = require('../commands/server');
        await serverCommand.showServerDashboard(interaction, serverId);
    } else if (customId.startsWith('start_') || customId.startsWith('stop_') || 
               customId.startsWith('restart_') || customId.startsWith('kill_')) {
        
        const [action, serverId] = customId.split('_');
        
        // Check permissions
        const hasPermission = await authService.hasServerPermission(userId, serverId);
        if (!hasPermission) {
            return interaction.reply({
                content: '❌ You do not have permission to control this server.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });
        
        const pterodactyl = new PterodactylAPI();
        let result;

        switch (action) {
            case 'start':
                result = await pterodactyl.startServer(serverId);
                break;
            case 'stop':
                result = await pterodactyl.stopServer(serverId);
                break;
            case 'restart':
                result = await pterodactyl.restartServer(serverId);
                break;
            case 'kill':
                result = await pterodactyl.killServer(serverId);
                break;
        }

        if (result.success) {
            await interaction.editReply({
                content: `✅ Server **${serverId}** ${action} command sent successfully!`
            });
            
            // Update last active timestamp
            const userServers = await database.getUserServers(userId);
            const server = userServers.find(s => s.serverId === serverId);
            if (server) {
                await database.saveServer(userId, {
                    ...server,
                    lastActive: Date.now()
                });
            }
        } else {
            await interaction.editReply({
                content: `❌ Failed to ${action} server: ${result.error}`
            });
        }
    }
}
