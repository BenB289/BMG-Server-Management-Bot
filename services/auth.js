const crypto = require('crypto');
const database = require('../config/database');

class AuthService {
    constructor() {
        this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    }

    // Generate a secure verification code for server linking
    async generateVerificationCode(userId, serverId) {
        const code = this.generateRandomCode(8);
        const token = await database.generateVerificationToken(userId, serverId);
        
        return {
            code,
            token,
            instructions: `To link your server, run this command in your Pterodactyl panel console:\n\`\`\`\necho "DISCORD_VERIFY:${code}:${token}" > /tmp/discord_verify.txt\n\`\`\``
        };
    }

    // Verify server ownership through the verification file
    async verifyServerOwnership(userId, serverId, verificationCode) {
        try {
            // In a real implementation, you would check the server's file system
            // For this example, we'll simulate the verification process
            
            // This would typically involve:
            // 1. Connecting to the server via SFTP/SSH
            // 2. Reading the verification file
            // 3. Parsing the verification data
            // 4. Validating the token
            
            // For now, we'll use a simplified verification through the database
            const isValid = await this.validateVerificationCode(userId, serverId, verificationCode);
            
            if (isValid) {
                await database.saveServer(userId, {
                    serverId,
                    userId,
                    verified: true,
                    verifiedAt: Date.now(),
                    lastActive: Date.now()
                });
                return { success: true, message: 'Server successfully verified and linked!' };
            } else {
                return { success: false, message: 'Invalid verification code or expired token.' };
            }
        } catch (error) {
            return { success: false, message: 'Verification failed: ' + error.message };
        }
    }

    async validateVerificationCode(userId, serverId, code) {
        // In a real implementation, this would validate against the file on the server
        // For demo purposes, we'll accept any 8-character alphanumeric code
        return code && code.length === 8 && /^[A-Z0-9]+$/.test(code);
    }

    generateRandomCode(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Encrypt sensitive data
    encrypt(text) {
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    // Decrypt sensitive data
    decrypt(encryptedText) {
        const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    // Check if user has permission to manage a server
    async hasServerPermission(userId, serverId) {
        const userServers = await database.getUserServers(userId);
        return userServers.some(server => server.serverId === serverId && server.verified);
    }

    // Rate limiting for API calls
    isRateLimited(userId, action = 'general') {
        // Simple in-memory rate limiting
        if (!this.rateLimits) this.rateLimits = new Map();
        
        const key = `${userId}:${action}`;
        const now = Date.now();
        const limit = this.rateLimits.get(key);
        
        if (limit && now - limit.lastReset < 60000) { // 1 minute window
            if (limit.count >= 10) { // 10 requests per minute
                return true;
            }
            limit.count++;
        } else {
            this.rateLimits.set(key, { count: 1, lastReset: now });
        }
        
        return false;
    }
}

module.exports = new AuthService();
