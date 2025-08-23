const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PterodactylAPI = require('../services/pterodactyl');
const authService = require('../services/auth');
const database = require('../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Manage your Pterodactyl servers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription('Link a server to this Discord')
                .addStringOption(option =>
                    option.setName('server_uuid')
                        .setDescription('Your Pterodactyl server UUID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('verify')
                .setDescription('Verify server ownership')
                .addStringOption(option =>
                    option.setName('server_uuid')
                        .setDescription('Your Pterodactyl server UUID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('code')
                        .setDescription('Verification code from your server')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('View server status and control panel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlink')
                .setDescription('Unlink a server from this Discord')
                .addStringOption(option =>
                    option.setName('server_uuid')
                        .setDescription('Server UUID to unlink')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Rate limiting check
        if (authService.isRateLimited(userId, 'server_command')) {
            return interaction.reply({
                content: '⚠️ You are being rate limited. Please wait a moment before trying again.',
                ephemeral: true
            });
        }

        switch (subcommand) {
            case 'link':
                await this.handleLink(interaction, userId);
                break;
            case 'verify':
                await this.handleVerify(interaction, userId);
                break;
            case 'dashboard':
                await this.handleDashboard(interaction, userId);
                break;
            case 'unlink':
                await this.handleUnlink(interaction, userId);
                break;
        }
    },

    async handleLink(interaction, userId) {
        const serverUuid = interaction.options.getString('server_uuid');
        
        try {
            // Find server by UUID first
            const pterodactyl = new PterodactylAPI();
            const serverResult = await pterodactyl.findServerByUuid(serverUuid);
            
            if (!serverResult.success) {
                return interaction.reply({
                    content: `❌ ${serverResult.error}. Please check the server UUID and try again.`,
                    ephemeral: true
                });
            }
            
            const serverId = serverResult.data.id;
            const verification = await authService.generateVerificationCode(userId, serverId);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔗 Server Linking')
                .setDescription(`Linking server: **${serverResult.data.name}**`)
                .addFields(
                    { name: '1. Access your server console', value: 'Log into your Pterodactyl panel and access the server console.' },
                    { name: '2. Run the verification command', value: verification.instructions },
                    { name: '3. Verify ownership', value: `Use \`/server verify server_uuid:${serverUuid} code:${verification.code}\`` }
                )
                .setFooter({ text: 'Verification code expires in 24 hours' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            await interaction.reply({
                content: '❌ Failed to generate verification code. Please try again.',
                ephemeral: true
            });
        }
    },

    async handleVerify(interaction, userId) {
        const serverUuid = interaction.options.getString('server_uuid');
        const code = interaction.options.getString('code').toUpperCase();

        await interaction.deferReply({ ephemeral: true });

        try {
            // Find server by UUID first
            const pterodactyl = new PterodactylAPI();
            const serverResult = await pterodactyl.findServerByUuid(serverUuid);
            
            if (!serverResult.success) {
                return interaction.editReply({
                    content: `❌ ${serverResult.error}. Please check the server UUID and try again.`
                });
            }
            
            const serverId = serverResult.data.id;
            const result = await authService.verifyServerOwnership(userId, serverId, code);
            
            if (result.success) {
                // Get server details from Pterodactyl
                const serverDetails = await pterodactyl.getServerDetails(serverId);
                
                if (serverDetails.success) {
                    // Save server info with Discord guild data
                    await database.saveServer(userId, {
                        serverId,
                        serverName: serverDetails.data.name,
                        discordGuild: {
                            id: interaction.guild.id,
                            name: interaction.guild.name
                        },
                        verified: true,
                        verifiedAt: Date.now(),
                        lastActive: Date.now(),
                        status: 'linked'
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Server Verified!')
                    .setDescription(`Server **${serverResult.data.name}** has been successfully linked to this Discord server.`)
                    .addFields(
                        { name: 'Next Steps', value: 'Use `/server status` to view your server stats or `/server control` to manage it.' }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({
                    content: `❌ ${result.message}`
                });
            }
        } catch (error) {
            await interaction.editReply({
                content: '❌ Verification failed. Please check your code and try again.'
            });
        }
    },

    async handleDashboard(interaction, userId) {
        await interaction.deferReply();

        try {
            const userServers = await database.getUserServers(userId);
            
            if (userServers.length === 0) {
                return interaction.editReply({
                    content: '❌ No servers linked. Use `/server link` to link a server first.'
                });
            }

            if (userServers.length === 1) {
                // Single server - show dashboard directly
                await this.showServerDashboard(interaction, userServers[0].serverId);
            } else {
                // Multiple servers - show selection menu
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_server_dashboard')
                    .setPlaceholder('Choose a server to view dashboard')
                    .addOptions(
                        userServers.map(server => ({
                            label: server.serverName || server.serverId,
                            description: `Server ID: ${server.serverId}`,
                            value: server.serverId
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.editReply({
                    content: 'Select a server to view its dashboard:',
                    components: [row]
                });
            }
        } catch (error) {
            await interaction.editReply({
                content: '❌ Failed to fetch server information.'
            });
        }
    },

    async handleUnlink(interaction, userId) {
        const serverUuid = interaction.options.getString('server_uuid');

        try {
            // Find server by UUID first
            const pterodactyl = new PterodactylAPI();
            const serverResult = await pterodactyl.findServerByUuid(serverUuid);
            
            if (!serverResult.success) {
                return interaction.reply({
                    content: `❌ ${serverResult.error}. Please check the server UUID and try again.`,
                    ephemeral: true
                });
            }
            
            const serverId = serverResult.data.id;
            const hasPermission = await authService.hasServerPermission(userId, serverId);
            
            if (!hasPermission) {
                return interaction.reply({
                    content: '❌ You do not have permission to unlink this server.',
                    ephemeral: true
                });
            }

            await database.removeServer(userId, serverId);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🔗 Server Unlinked')
                .setDescription(`Server **${serverResult.data.name}** has been unlinked from this Discord server.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            await interaction.reply({
                content: '❌ Failed to unlink server.',
                ephemeral: true
            });
        }
    },

    async showServerStatus(interaction, serverId) {
        const pterodactyl = new PterodactylAPI();
        
        try {
            const [serverDetails, serverResources] = await Promise.all([
                pterodactyl.getServerDetails(serverId),
                pterodactyl.getServerResources(serverId)
            ]);

            if (!serverDetails.success || !serverResources.success) {
                return interaction.editReply({
                    content: '❌ Failed to fetch server data from Pterodactyl panel.'
                });
            }

            const server = serverDetails.data;
            const resources = serverResources.data;

            // Save stats to database
            await database.saveStats(serverId, {
                cpu: resources.cpu_absolute,
                memory: resources.memory_bytes,
                disk: resources.disk_bytes,
                uptime: resources.uptime || 0,
                state: resources.current_state
            });

            const embed = this.createStatusEmbed(server, resources, pterodactyl);
            
            // Add refresh button
            const refreshButton = new ButtonBuilder()
                .setCustomId(`refresh_status_${serverId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(refreshButton);

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            await interaction.editReply({
                content: '❌ Error fetching server status.'
            });
        }
    },

    async showServerDashboard(interaction, serverId) {
        const pterodactyl = new PterodactylAPI();
        
        try {
            const serverDetails = await pterodactyl.getServerDetails(serverId);
            const serverResources = await pterodactyl.getServerResources(serverId);
            
            if (!serverDetails.success || !serverResources.success) {
                return interaction.editReply({
                    content: '❌ Failed to fetch server data.'
                });
            }

            const embed = this.createStatusEmbed(serverDetails.data, serverResources.data, pterodactyl);

            // Create control buttons
            const startButton = new ButtonBuilder()
                .setCustomId(`start_${serverId}`)
                .setLabel('▶️ Start')
                .setStyle(ButtonStyle.Success);

            const stopButton = new ButtonBuilder()
                .setCustomId(`stop_${serverId}`)
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger);

            const restartButton = new ButtonBuilder()
                .setCustomId(`restart_${serverId}`)
                .setLabel('🔄 Restart')
                .setStyle(ButtonStyle.Primary);

            const killButton = new ButtonBuilder()
                .setCustomId(`kill_${serverId}`)
                .setLabel('💀 Kill')
                .setStyle(ButtonStyle.Danger);

            const refreshButton = new ButtonBuilder()
                .setCustomId(`refresh_${serverId}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary);

            const row1 = new ActionRowBuilder().addComponents(startButton, stopButton, restartButton, killButton);
            const row2 = new ActionRowBuilder().addComponents(refreshButton);

            await interaction.editReply({ embeds: [embed], components: [row1, row2] });
        } catch (error) {
            await interaction.editReply({
                content: '❌ Error loading server dashboard.'
            });
        }
    },

    async showServerControls(interaction, serverId) {
        const pterodactyl = new PterodactylAPI();
        
        try {
            const serverDetails = await pterodactyl.getServerDetails(serverId);
            
            if (!serverDetails.success) {
                return interaction.editReply({
                    content: '❌ Failed to fetch server data.'
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`🎮 Server Controls: ${serverDetails.data.name}`)
                .setDescription(`Control your server **${serverId}**`)
                .addFields(
                    { name: 'Server ID', value: serverId, inline: true },
                    { name: 'Status', value: serverDetails.data.status || 'Unknown', inline: true }
                )
                .setTimestamp();

            const startButton = new ButtonBuilder()
                .setCustomId(`start_${serverId}`)
                .setLabel('▶️ Start')
                .setStyle(ButtonStyle.Success);

            const stopButton = new ButtonBuilder()
                .setCustomId(`stop_${serverId}`)
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger);

            const restartButton = new ButtonBuilder()
                .setCustomId(`restart_${serverId}`)
                .setLabel('🔄 Restart')
                .setStyle(ButtonStyle.Primary);

            const killButton = new ButtonBuilder()
                .setCustomId(`kill_${serverId}`)
                .setLabel('💀 Kill')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(startButton, stopButton, restartButton, killButton);

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            await interaction.editReply({
                content: '❌ Error loading server controls.'
            });
        }
    },

    createStatusEmbed(server, resources, pterodactyl) {
        const statusColor = resources.current_state === 'running' ? '#00ff00' : 
                           resources.current_state === 'stopped' ? '#ff0000' : '#ffff00';

        const cpuUsage = resources.cpu_absolute ? `${resources.cpu_absolute.toFixed(2)}%` : 'N/A';
        const memoryUsage = resources.memory_bytes ? 
            `${pterodactyl.formatBytes(resources.memory_bytes)} / ${pterodactyl.formatBytes(server.limits.memory * 1024 * 1024)}` : 'N/A';
        const diskUsage = resources.disk_bytes ? 
            `${pterodactyl.formatBytes(resources.disk_bytes)} / ${pterodactyl.formatBytes(server.limits.disk * 1024 * 1024)}` : 'N/A';
        const uptime = resources.uptime ? pterodactyl.formatUptime(resources.uptime / 1000) : 'N/A';

        return new EmbedBuilder()
            .setColor(statusColor)
            .setTitle(`📊 ${server.name}`)
            .setDescription(`Server Status Dashboard`)
            .addFields(
                { name: '🟢 Status', value: resources.current_state || 'Unknown', inline: true },
                { name: '⏱️ Uptime', value: uptime, inline: true },
                { name: '🆔 Server ID', value: server.identifier, inline: true },
                { name: '💾 CPU Usage', value: cpuUsage, inline: true },
                { name: '🧠 Memory Usage', value: memoryUsage, inline: true },
                { name: '💿 Disk Usage', value: diskUsage, inline: true }
            )
            .setFooter({ text: 'Last updated' })
            .setTimestamp();
    }
};
