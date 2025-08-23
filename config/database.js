const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data');
        this.serversFile = path.join(this.dbPath, 'servers.json');
        this.tokensFile = path.join(this.dbPath, 'tokens.json');
        this.statsFile = path.join(this.dbPath, 'stats.json');
        this.credentialsFile = path.join(this.dbPath, 'credentials.json');
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
        if (!await fs.pathExists(this.credentialsFile)) {
            await fs.writeJson(this.credentialsFile, {});
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

    // User credentials management
    async saveUserCredentials(userId, credentials) {
        const allCredentials = await fs.readJson(this.credentialsFile);
        
        // Encrypt the API key
        const encryptedApiKey = this.encrypt(credentials.apiKey);
        
        allCredentials[userId] = {
            apiKey: encryptedApiKey,
            panelUrl: credentials.panelUrl,
            verifiedAt: credentials.verifiedAt
        };
        
        await fs.writeJson(this.credentialsFile, allCredentials);
        return true;
    }

    async getUserCredentials(userId) {
        const allCredentials = await fs.readJson(this.credentialsFile);
        const userCreds = allCredentials[userId];
        
        if (!userCreds) {
            return null;
        }
        
        // Decrypt the API key
        return {
            apiKey: this.decrypt(userCreds.apiKey),
            panelUrl: userCreds.panelUrl,
            verifiedAt: userCreds.verifiedAt
        };
    }

    async removeUserCredentials(userId) {
        const allCredentials = await fs.readJson(this.credentialsFile);
        delete allCredentials[userId];
        await fs.writeJson(this.credentialsFile, allCredentials);
        return true;
    }

    // Simple encryption/decryption for API keys
    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, key);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    decrypt(encryptedText) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
        const textParts = encryptedText.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encrypted = textParts.join(':');
        const decipher = crypto.createDecipher(algorithm, key);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

module.exports = new Database();
