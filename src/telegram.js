const TelegramBot = require('node-telegram-bot-api');
const { getSolscanUrl, calculateBurntAion, formatNumber } = require('./utils');
const path = require('path');
require('dotenv').config();

class TelegramNotifier {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        
        if (!this.token || !this.chatId) {
            throw new Error('Telegram configuration is missing. Please check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env file');
        }

        this.bot = new TelegramBot(this.token, { polling: false });
    }

    async sendMessage(message, photo = null) {
        try {
            if (photo) {
                // Send photo with caption
                await this.bot.sendPhoto(this.chatId, photo, {
                    caption: message,
                    parse_mode: 'HTML',
                });
            } else {
                // Send text only message
                await this.bot.sendMessage(this.chatId, message, { 
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
            }
        } catch (error) {
            console.error('Failed to send Telegram message:', error);
        }
    }

    async sendNewDoctrineMessage({ doctrineId, message, txId, sender, pageNumber, messageIndex }) {
        const txUrl = getSolscanUrl('tx', txId);
        const senderUrl = getSolscanUrl('address', sender);
        const burntAmount = calculateBurntAion(pageNumber, messageIndex);

        const messageText = `🔔 <b>New Doctrine Message</b>\n\n` +
            `📜 <b>Doctrine:</b> ${doctrineId}\n` +
            `💬 <b>Message:</b> ${message}\n` +
            `🔥 <b>Burnt AION:</b> ${formatNumber(burntAmount)}\n` +
            `🔗 <b>Transaction:</b> <a href="${txUrl}">${txId.slice(0, 8)}...${txId.slice(-8)}</a>\n` +
            `👤 <b>Sender:</b> <a href="${senderUrl}">${sender.slice(0, 8)}...${sender.slice(-8)}</a>`;

        const imagePath = path.join(__dirname, '..', 'assets', 'telegram_image.png');
        await this.sendMessage(messageText, imagePath);
    }
}

module.exports = TelegramNotifier;
