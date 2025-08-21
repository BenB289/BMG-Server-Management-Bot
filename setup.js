const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

async function setup() {
    console.log('🚀 Setting up Pterodactyl Discord Bot...\n');

    // Create necessary directories
    const directories = ['data', 'reports'];
    for (const dir of directories) {
        await fs.ensureDir(dir);
        console.log(`✅ Created directory: ${dir}/`);
    }

    // Check if .env exists, if not copy from example
    if (!await fs.pathExists('.env')) {
        if (await fs.pathExists('.env.example')) {
            await fs.copy('.env.example', '.env');
            console.log('✅ Created .env file from .env.example');
            
            // Generate random keys
            const jwtSecret = crypto.randomBytes(64).toString('hex');
            const encryptionKey = crypto.randomBytes(32).toString('hex');
            
            let envContent = await fs.readFile('.env', 'utf8');
            envContent = envContent.replace('your_jwt_secret_here', jwtSecret);
            envContent = envContent.replace('your_32_character_encryption_key_here', encryptionKey);
            
            await fs.writeFile('.env', envContent);
            console.log('✅ Generated secure JWT secret and encryption key');
        } else {
            console.log('⚠️ .env.example not found, please create .env manually');
        }
    } else {
        console.log('✅ .env file already exists');
    }

    // Create initial database files
    const dbFiles = {
        'data/servers.json': {},
        'data/tokens.json': {},
        'data/stats.json': {}
    };

    for (const [file, content] of Object.entries(dbFiles)) {
        if (!await fs.pathExists(file)) {
            await fs.writeJson(file, content);
            console.log(`✅ Created database file: ${file}`);
        }
    }

    console.log('\n🎉 Setup complete!\n');
    console.log('Next steps:');
    console.log('1. Edit .env file with your Discord bot token and Pterodactyl API details');
    console.log('2. Run: node deploy-commands.js');
    console.log('3. Run: npm start');
    console.log('\nFor detailed instructions, see README.md');
}

setup().catch(console.error);
