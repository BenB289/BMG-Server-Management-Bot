const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data');
        this.serversFile = path.join(this.dbPath, 'servers.json');
        this.tokensFile = path.join(this.dbPath, 'tokens.json');
        this.statsFile = path.join(this.dbPath, 'stats.json');
        this.init();
    }

    async init() {
        await fs.ensureDir(this.dbPath);
        
        // Initialize files if they don't exist
        if (!await fs.pathExists(this.serversFile)) {
            await fs.writeJson(this.serversFile, {});
        }
        if (!await fs.pathExists(this.tokensFile)) {
            await fs.writeJson(this.tokensFile, {});
        }
        if (!await fs.pathExists(this.statsFile)) {
            await fs.writeJson(this.statsFile, {});
        }
    }

    async getServers() {
        return await fs.readJson(this.serversFile);
    }

    async saveServer(userId, serverData) {
        const servers = await this.getServers();
        if (!servers[userId]) {
            servers[userId] = [];
        }
        
        // Check if server already exists
        const existingIndex = servers[userId].findIndex(s => s.serverId === serverData.serverId);
        if (existingIndex !== -1) {
            servers[userId][existingIndex] = { ...servers[userId][existingIndex], ...serverData };
        } else {
            servers[userId].push(serverData);
        }
        
        await fs.writeJson(this.serversFile, servers);
        return true;
    }

    async removeServer(userId, serverId) {
        const servers = await this.getServers();
        if (servers[userId]) {
            servers[userId] = servers[userId].filter(s => s.serverId !== serverId);
            if (servers[userId].length === 0) {
                delete servers[userId];
            }
            await fs.writeJson(this.serversFile, servers);
        }
        return true;
    }

    async getUserServers(userId) {
        const servers = await this.getServers();
        return servers[userId] || [];
    }

    async generateVerificationToken(userId, serverId) {
        const tokens = await fs.readJson(this.tokensFile);
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        tokens[token] = {
            userId,
            serverId,
            expiresAt,
            used: false
        };
        
        await fs.writeJson(this.tokensFile, tokens);
        return token;
    }

    async verifyToken(token, userId, serverId) {
        const tokens = await fs.readJson(this.tokensFile);
        const tokenData = tokens[token];
        
        if (!tokenData || tokenData.used || tokenData.expiresAt < Date.now()) {
            return false;
        }
        
        if (tokenData.userId === userId && tokenData.serverId === serverId) {
            tokenData.used = true;
            await fs.writeJson(this.tokensFile, tokens);
            return true;
        }
        
        return false;
    }

    async saveStats(serverId, stats) {
        const allStats = await fs.readJson(this.statsFile);
        if (!allStats[serverId]) {
            allStats[serverId] = [];
        }
        
        allStats[serverId].push({
            ...stats,
            timestamp: Date.now()
        });
        
        // Keep only last 100 entries per server
        if (allStats[serverId].length > 100) {
            allStats[serverId] = allStats[serverId].slice(-100);
        }
        
        await fs.writeJson(this.statsFile, allStats);
    }

    async getStats(serverId) {
        const allStats = await fs.readJson(this.statsFile);
        return allStats[serverId] || [];
    }

    async getAllConnectedServers() {
        const servers = await this.getServers();
        const result = [];
        
        for (const userId in servers) {
            for (const server of servers[userId]) {
                result.push({
                    userId,
                    serverId: server.serverId,
                    serverName: server.serverName,
                    discordGuild: server.discordGuild,
                    lastActive: server.lastActive,
                    status: server.status
                });
            }
        }
        
        return result;
    }
}

module.exports = new Database();
