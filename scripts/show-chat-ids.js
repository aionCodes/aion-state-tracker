require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

async function showChatIds() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error('Error: TELEGRAM_BOT_TOKEN not found in environment variables');
        process.exit(1);
    }

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

    try {
        // Get bot information
        const me = await bot.getMe();
        console.log('\nBot Information:');
        console.log(`Name: ${me.first_name}`);
        console.log(`Username: @${me.username}`);
        console.log(`ID: ${me.id}`);

        // Get updates to find chat IDs
        const updates = await bot.getUpdates();
        
        // Extract unique chat IDs
        const chatIds = new Set();
        const chatDetails = new Map();

        updates.forEach(update => {
            if (update.message) {
                const chat = update.message.chat;
                chatIds.add(chat.id);
                chatDetails.set(chat.id, {
                    type: chat.type,
                    title: chat.title, // For groups
                    username: chat.username, // For users/channels
                    firstName: chat.first_name, // For users
                    lastName: chat.last_name, // For users
                    date: new Date(update.message.date * 1000).toISOString()
                });
            }
        });

        if (chatIds.size === 0) {
            console.log('\nNo chat history found. The bot needs to receive at least one message to show chat IDs.');
            console.log('Try sending a message to the bot first.');
        } else {
            console.log('\nFound Chat IDs:');
            chatIds.forEach(chatId => {
                const details = chatDetails.get(chatId);
                console.log(`\nChat ID: ${chatId}`);
                console.log(`Type: ${details.type}`);
                if (details.title) console.log(`Title: ${details.title}`);
                if (details.username) console.log(`Username: @${details.username}`);
                if (details.firstName) console.log(`First Name: ${details.firstName}`);
                if (details.lastName) console.log(`Last Name: ${details.lastName}`);
                console.log(`Last Activity: ${details.date}`);
            });
        }

    } catch (error) {
        console.error('Error fetching chat IDs:', error.message);
        if (error.response && error.response.statusCode === 401) {
            console.error('Invalid bot token. Please check your TELEGRAM_BOT_TOKEN in .env file');
        }
    }
}

showChatIds().catch(console.error);
