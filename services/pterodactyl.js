const axios = require('axios');
require('dotenv').config();

class PterodactylAPI {
    constructor() {
        this.baseURL = process.env.PTERODACTYL_URL;
        this.apiKey = process.env.PTERODACTYL_API_KEY;
        this.client = axios.create({
            baseURL: `${this.baseURL}/api/client`,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'Application/vnd.pterodactyl.v1+json'
            }
        });
    }

    async getServerDetails(serverId) {
        try {
            const response = await this.client.get(`/servers/${serverId}`);
            return {
                success: true,
                data: response.data.attributes
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors?.[0]?.detail || error.message
            };
        }
    }

    async getServerResources(serverId) {
        try {
            const response = await this.client.get(`/servers/${serverId}/resources`);
            return {
                success: true,
                data: response.data.attributes
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors?.[0]?.detail || error.message
            };
        }
    }

    async startServer(serverId) {
        try {
            await this.client.post(`/servers/${serverId}/power`, {
                signal: 'start'
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors?.[0]?.detail || error.message
            };
        }
    }

    async stopServer(serverId) {
        try {
            await this.client.post(`/servers/${serverId}/power`, {
                signal: 'stop'
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors?.[0]?.detail || error.message
            };
        }
    }

    async restartServer(serverId) {
        try {
            await this.client.post(`/servers/${serverId}/power`, {
                signal: 'restart'
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors?.[0]?.detail || error.message
            };
        }
    }

    async killServer(serverId) {
        try {
            await this.client.post(`/servers/${serverId}/power`, {
                signal: 'kill'
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors?.[0]?.detail || error.message
            };
        }
    }

    async getUserServers() {
        try {
            const response = await this.client.get('/');
            return {
                success: true,
                data: response.data.data.map(server => ({
                    id: server.attributes.identifier,
                    uuid: server.attributes.uuid,
                    name: server.attributes.name,
                    description: server.attributes.description,
                    status: server.attributes.server_owner ? 'owner' : 'user'
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors?.[0]?.detail || error.message
            };
        }
    }

    async findServerByUuid(serverUuid) {
        try {
            const serversResult = await this.getUserServers();
            if (!serversResult.success) {
                return serversResult;
            }

            const server = serversResult.data.find(s => 
                s.uuid.toLowerCase() === serverUuid.toLowerCase()
            );

            if (!server) {
                return {
                    success: false,
                    error: `Server with UUID "${serverUuid}" not found`
                };
            }

            return {
                success: true,
                data: server
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
}

module.exports = PterodactylAPI;
