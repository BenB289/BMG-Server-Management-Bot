# Pterodactyl Discord Bot

A powerful Discord bot that allows users to manage their Pterodactyl panel servers directly from Discord. Features real-time server monitoring, control commands, and secure server verification.

## Features

- 🔗 **Server Linking**: Securely link Pterodactyl servers to Discord
- 📊 **Real-time Stats**: Live server monitoring with auto-updating embeds
- 🎮 **Server Control**: Start, stop, restart, and kill servers
- 🔒 **Secure Authentication**: Verification system to ensure server ownership
- 📈 **Auto-updating**: Status messages update automatically every 30 seconds
- 📋 **Report Generation**: Generate JSON and PDF reports of connected servers
- ⚡ **Rate Limiting**: Built-in protection against spam and abuse

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- A Discord bot token
- Pterodactyl panel with API access
- Admin access to your Pterodactyl panel

### Setup

1. **Clone and install dependencies:**
```bash
git clone <your-repo-url>
cd pterodactyl-discord-bot
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Pterodactyl Panel Configuration
PTERODACTYL_URL=https://your-panel-url.com
PTERODACTYL_API_KEY=your_pterodactyl_api_key_here

# Bot Configuration
BOT_PREFIX=/
UPDATE_INTERVAL=30000
MAX_SERVERS_PER_USER=5

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Report Configuration
REPORT_OUTPUT_DIR=./reports
```

3. **Deploy slash commands:**
```bash
node deploy-commands.js
```

4. **Start the bot:**
```bash
npm start
```

## Discord Bot Setup

### Creating a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and create a bot
4. Copy the bot token to your `.env` file
5. Copy the Application ID to your `.env` file as `CLIENT_ID`

### Bot Permissions

Your bot needs the following permissions:
- `Send Messages`
- `Use Slash Commands`
- `Embed Links`
- `Read Message History`

### Invite Link

Generate an invite link with these scopes:
- `bot`
- `applications.commands`

## Usage

### Linking a Server

1. Use `/server link server_id:YOUR_SERVER_ID`
2. Follow the verification instructions provided
3. Run the verification command on your server console
4. Use `/server verify server_id:YOUR_SERVER_ID code:VERIFICATION_CODE`

### Viewing Server Status

- `/server status` - View real-time server statistics
- Status messages auto-update every 30 seconds
- Click the refresh button for manual updates

### Controlling Servers

- `/server control` - Access server control panel
- Available actions: Start, Stop, Restart, Kill

### Managing Linked Servers

- `/server unlink server_id:SERVER_ID` - Remove a server from Discord

## Report Generation

Generate reports of all connected servers:

```bash
# Generate both JSON and PDF reports
npm run generate-report

# Generate only JSON report
node scripts/generate-report.js json

# Generate only PDF report
node scripts/generate-report.js pdf

# List existing reports
node scripts/generate-report.js list

# Cleanup old reports (30+ days)
node scripts/generate-report.js cleanup
```

## Security Features

### Server Verification

The bot uses a secure verification system:
1. User requests to link a server
2. Bot generates a unique verification code and token
3. User must run a command on their server console
4. Bot verifies ownership through the generated token
5. Server is linked only after successful verification

### Rate Limiting

- 10 requests per minute per user for commands
- 10 requests per minute per user for button interactions
- Automatic cleanup of failed update attempts

### Data Encryption

- Sensitive data is encrypted using AES-256-CBC
- Verification tokens expire after 24 hours
- User permissions are validated for every action

## File Structure

```
pterodactyl-discord-bot/
├── commands/
│   └── server.js              # Main server management commands
├── config/
│   └── database.js            # JSON-based database system
├── events/
│   ├── ready.js               # Bot ready event
│   └── interactionCreate.js   # Command and interaction handling
├── services/
│   ├── auth.js                # Authentication and security
│   ├── pterodactyl.js         # Pterodactyl API integration
│   └── updateSystem.js        # Auto-updating system
├── scripts/
│   └── generate-report.js     # Report generation utility
├── data/                      # Database files (auto-created)
├── reports/                   # Generated reports (auto-created)
├── index.js                   # Main bot file
├── deploy-commands.js         # Slash command deployment
├── package.json
├── .env.example
└── README.md
```

## API Integration

### Pterodactyl API

The bot uses the Pterodactyl Client API:
- Server details and resource usage
- Power management (start/stop/restart/kill)
- Real-time statistics monitoring

### Supported Endpoints

- `GET /api/client/servers/{server}` - Server details
- `GET /api/client/servers/{server}/resources` - Resource usage
- `POST /api/client/servers/{server}/power` - Power management

## Deployment

### Running in Pterodactyl Panel

1. Create a new Node.js server in your Pterodactyl panel
2. Upload the bot files
3. Install dependencies: `npm install`
4. Configure your `.env` file
5. Deploy commands: `node deploy-commands.js`
6. Start the bot: `npm start`

### Production Considerations

- Use `pm2` for process management
- Set up log rotation
- Configure automatic restarts
- Monitor memory usage
- Regular database backups

## Troubleshooting

### Common Issues

**Bot not responding to commands:**
- Ensure slash commands are deployed: `node deploy-commands.js`
- Check bot permissions in Discord server
- Verify bot token in `.env` file

**Pterodactyl API errors:**
- Verify API key has correct permissions
- Check Pterodactyl URL format (include https://)
- Ensure server IDs are correct

**Verification failing:**
- Check server console access
- Verify the verification command was run correctly
- Ensure verification code hasn't expired (24 hours)

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Check the troubleshooting section
- Review the logs for error messages
- Ensure all configuration is correct
