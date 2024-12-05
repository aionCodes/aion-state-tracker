# AION State Telegram Bot

A Telegram bot that monitors the AION blockchain state on Solana and provides notifications through Telegram.

## Features

- Solana blockchain state monitoring
- Real-time notifications via Telegram
- Data storage through Supabase
- Local data management using SQLite
- IPFS integration for decentralized storage

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd aion-state-telegram-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env` and set the following:
     - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_KEY`: Your Supabase API key
     - `PROGRAM_ID`: Solana program ID
     - `NETWORK`: Solana network (mainnet or devnet)
     - `PINATA_JWT`: Pinata JWT for IPFS integration
     - Other required environment variables

## Usage

1. Start the bot:
```bash
npm start
```

2. View chat IDs:
```bash
npm run show-chats
```

## Project Structure

- `src/index.js`: Main application entry point
- `src/telegram.js`: Telegram bot functionality
- `src/anchor.js`: Solana/Anchor integration
- `src/db.js`: SQLite database management
- `src/supabase.js`: Supabase integration
- `src/ipfs.js`: IPFS functionality

## Dependencies

- @coral-xyz/anchor: ^0.28.0
- @solana/web3.js: ^1.87.0
- @supabase/supabase-js: ^2.46.2
- node-telegram-bot-api: ^0.66.0
- better-sqlite3: ^11.6.0
- And other supporting packages

## License

MIT
