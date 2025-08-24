# BMG Server Management Bot

A Discord bot designed specifically for BMG Hosting customers to manage their Pterodactyl servers directly from Discord. Features per-user API keys, real-time monitoring, and a two-tier permission system.

## Features

- 🔗 **Server Linking**: Link servers using UUIDs with secure verification
- 📊 **Live Dashboard**: Auto-refreshing server stats every 10 seconds
- 🎮 **Server Control**: Start, stop, restart, and kill servers via buttons
- 🔒 **Two-Tier Permissions**: Verified users create dashboards, anyone can use controls
- 👥 **Multi-User Support**: Each user provides their own BMG Hosting API key
- 🏢 **BMG Hosting Integration**: Hardcoded for https://cp.bmghosting.com
- ⚡ **No Setup Required**: Auto-prompts for API keys when needed

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- A Discord bot token and application
- BMG Hosting account with Pterodactyl access

### Bot Setup

1. **Clone and install dependencies:**
```bash
git clone <your-repo-url>
cd BMG-Server-Management-Bot
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your Discord bot configuration:
```env
# Discord Bot Configuration (Required)
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Optional: For guild-specific deployment
GUILD_ID=your_server_id_here

# Optional: For API key encryption (auto-generated if not provided)
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

3. **Deploy slash commands:**
```bash
npm run deploy
```

This will deploy commands and start the bot automatically.

### Discord Application Setup

1. **Create Discord Application:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and name it "BMG Server Management"
   - Copy the Application ID to your `.env` as `CLIENT_ID`

2. **Create Bot:**
   - Go to "Bot" section
   - Click "Add Bot"
   - Copy the bot token to your `.env` as `DISCORD_TOKEN`

3. **Set Bot Permissions:**
   - In "Bot" section, enable these intents:
     - ✅ Guilds
     - ✅ Guild Messages
     - ❌ Message Content Intent (not needed)

4. **Invite Bot to Server:**
   - Go to "OAuth2" > "URL Generator"
   - Select scopes: `bot` and `applications.commands`
   - Select permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
   - Use generated URL to invite bot

## User Guide

### For BMG Hosting Customers

#### Getting Your API Key

1. **Log into BMG Hosting Panel:**
   - Go to https://cp.bmghosting.com
   - Log in with your BMG Hosting account

2. **Generate Client API Key:**
   - Click your profile (top right)
   - Go to "Account Settings" > "API Credentials"
   - Click "Create API Key"
   - **Important:** Create an "Account API Key" (not Application API Key)
   - Copy the key starting with `ptlc_`

#### First Time Setup

1. **Verify Your Server:**
   ```
   /server verify server_uuid:your-server-uuid code:verification-code
   ```
   - Get your server UUID from the BMG Hosting panel
   - When prompted, send your `ptlc_` API key in chat
   - Bot will automatically delete your message for security
   - Follow verification instructions in your server console

2. **Link Additional Servers:**
   ```
   /server link server_uuid:your-server-uuid
   ```
   - Only available after you're verified
   - Follow the same verification process

3. **View Server Dashboard:**
   ```
   /server dashboard
   ```
   - Shows all your linked servers
   - Auto-refreshes every 10 seconds
   - Control buttons work for everyone

#### Commands

**For Verified Users:**
- `/server verify` - Verify server ownership (first step)
- `/server link` - Link additional servers
- `/server dashboard` - View server dashboard
- `/server unlink` - Remove server from Discord

**For Everyone:**
- Power buttons on dashboards work for anyone
- No API key required to use Start/Stop/Restart/Kill buttons

### Permission System

**Verified Users (Server Owners):**
- Can create and view dashboards
- Can link/unlink servers
- Must provide their own BMG Hosting API key

**Regular Users:**
- Can use power buttons on shared dashboards
- No setup or API key required
- Cannot create their own dashboards

## Technical Details

### Security Features

**Server Verification:**
- Unique verification codes and tokens
- Console-based ownership verification
- 24-hour token expiration

**Data Protection:**
- API keys encrypted with AES-256-CBC
- User messages with API keys automatically deleted
- Per-user credential isolation

**Rate Limiting:**
- 10 requests per minute per user
- Protection against spam and abuse

### Architecture

**Per-User API Keys:**
- Each user provides their own BMG Hosting API key
- Credentials stored encrypted on disk
- Shared credentials for power button access

**Two-Tier Permissions:**
- Verified users: Full dashboard access
- Regular users: Power button access only

**Auto-Refresh System:**
- Dashboard updates every 10 seconds
- Automatic timeout after 5 minutes
- Error handling stops failed refreshes

## File Structure

```
BMG-Server-Management-Bot/
├── commands/
│   └── server.js              # Server management commands
├── config/
│   └── database.js            # JSON database with encryption
├── events/
│   ├── ready.js               # Bot startup event
│   └── interactionCreate.js   # Command and button handling
├── services/
│   ├── auth.js                # Authentication and permissions
│   ├── pterodactyl.js         # BMG Hosting API integration
│   └── updateSystem.js        # Auto-update system
├── data/                      # Database files (auto-created)
├── index.js                   # Main bot file
├── deploy-commands.js         # Slash command deployment
├── setup.js                   # Initial setup script
├── package.json
├── .env.example
└── README.md
```

## Troubleshooting

### Common Issues

**Bot not responding:**
- Run `npm run deploy` to deploy commands
- Check bot permissions in Discord server
- Verify `DISCORD_TOKEN` and `CLIENT_ID` in `.env`

**API key issues:**
- Ensure you're using a CLIENT API key (`ptlc_`) not APPLICATION key (`ptla_`)
- Generate key from Account Settings > API Credentials in BMG panel
- Key must be from https://cp.bmghosting.com

**Verification failing:**
- Check server UUID is correct (from BMG panel)
- Run verification command exactly as shown in server console
- Codes expire after 24 hours

**Permission errors:**
- Only verified users can create dashboards
- Anyone can use power buttons on existing dashboards
- Use `/server verify` first to become verified

### Getting Help

**For BMG Hosting customers:**
- Check your server console for verification commands
- Ensure you have access to your server's console
- Contact BMG Hosting support for panel access issues

**For bot administrators:**
- Check bot logs for error messages
- Verify all environment variables are set
- Ensure bot has proper Discord permissions

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your bot credentials

# Deploy commands and start
npm run deploy
```

### Key Components

- **Per-user credentials**: Each user stores their own encrypted API key
- **UUID-based linking**: Uses server UUIDs instead of numeric IDs
- **Auto-refresh dashboards**: Live updates every 10 seconds
- **Shared power controls**: Anyone can use buttons without API keys

## License

MIT License - see LICENSE file for details.
