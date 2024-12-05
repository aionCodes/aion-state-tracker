require('dotenv').config();
const { initializeAnchor, findDoctrine, findPage, findMessageTransactions } = require('./anchor');
const { getIPFSContent } = require('./ipfs');
const TelegramNotifier = require('./telegram');
const db = require('./db');
const supabase = require('./supabase');
const { upsertDoctrine, upsertDoctrinePages, batchUpsertMessages } = require('./supabase-store');

const PARALLEL_DOCTRINES = 1; // Process one doctrine at a time
const PARALLEL_PAGES = 1;     // Process one page at a time
const RPC_DELAY = 1000;      // 1 second delay between RPC requests
const BATCH_SIZE = 5;        // Process messages in batches of 5

let isProcessing = false;  // Lock mechanism

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processMessages(program, connection, doctrine, pageNumber, page, telegram) {
    try {
        console.log(`[Doctrine ${doctrine.account.doctrineId}] Processing messages for page ${pageNumber}...`);
        await sleep(RPC_DELAY);
        
        const newMessages = [];
        const supabaseMessages = [];

        // Update doctrine and page information in Supabase
        await upsertDoctrine(doctrine, doctrine.account.doctrineId);
        await upsertDoctrinePages({
            doctrine_id: doctrine.account.doctrineId,
            public_key: doctrine.publicKey.toString(),
            authority: doctrine.account.authority.toString(),
            total_messages: doctrine.account.totalMessages.toString(),
            active_page_number: doctrine.account.activePageNumber,
            messages_per_page: doctrine.account.messagesPerPage,
            current_page_message_count: doctrine.account.currentPageMessageCount,
            current_message_cost: doctrine.account.currentMessageCost.toString(),
            pagePubkey: page.publicKey.toString()
        });

        // Collect new messages
        for (const [index, message] of page.account.messages.entries()) {
            if (!message.ipfsCid) continue;
            
            // Skip if message already processed
            if (db.hasMessage(doctrine.account.doctrineId, pageNumber, index)) {
                continue;
            }
            
            const messageCid = Buffer.from(message.ipfsCid).toString('utf8').replace(/\0/g, '');
            console.log(`[Message ${index}] Found new message with CID: ${messageCid}`);
            
            newMessages.push({
                index,
                ipfs_cid: messageCid
            });
        }

        if (newMessages.length === 0) {
            console.log(`[Doctrine ${doctrine.account.doctrineId}] No new messages found in page ${pageNumber}`);
            return;
        }

        console.log(`\n[Doctrine ${doctrine.account.doctrineId}] Found ${newMessages.length} new messages in page ${pageNumber}`);
        
        // Fetch transactions and IPFS content
        console.log('\nFetching transaction signatures and IPFS content...');
        const txSignatures = await findMessageTransactions(
            connection,
            page.publicKey,
            newMessages.map(msg => msg.index)
        );

        // Process each message
        for (const message of newMessages) {
            // Get transaction info
            const txInfo = txSignatures.get(message.index);
            if (!txInfo) {
                console.log(`[Message ${message.index}] No transaction found`);
                continue;
            }

            // Fetch IPFS content
            console.log(`[Message ${message.index}] Fetching content for CID: ${message.ipfs_cid}`);
            const messageContent = await getIPFSContent(message.ipfs_cid);
            if (messageContent === null) {
                console.error(`[Message ${message.index}] Failed to fetch content`);
                continue;
            }

            // Save to database and send notification
            db.saveMessage(
                doctrine.account.doctrineId,
                pageNumber,
                message.index,
                message.ipfs_cid,
                txInfo.signature,
                txInfo.senderPubkey,
                messageContent
            );

            // Prepare message for Supabase batch upsert
            supabaseMessages.push({
                doctrine_id: doctrine.account.doctrineId,
                page_number: pageNumber,
                message_index: message.index,
                message: messageContent,
                ipfs_cid: message.ipfs_cid,
                txid: txInfo.signature,
                sender_pubkey: txInfo.senderPubkey
            });

            await telegram.sendNewDoctrineMessage({
                doctrineId: doctrine.account.doctrineId,
                message: messageContent,
                txId: txInfo.signature,
                sender: txInfo.senderPubkey,
                pageNumber: pageNumber,
                messageIndex: message.index
            });

            await sleep(500); // Add delay between messages
        }

        // Batch upsert messages to Supabase
        if (supabaseMessages.length > 0) {
            await batchUpsertMessages(supabaseMessages);
        }

    } catch (error) {
        console.error(`Error processing messages for doctrine ${doctrine.account.doctrineId}, page ${pageNumber}:`, error);
    }
}

async function processPages(program, connection, doctrine, telegram) {
    try {
        console.log(`[Doctrine ${doctrine.account.doctrineId}] Processing pages...`);
        await sleep(RPC_DELAY);
        
        if (doctrine.account.activePageNumber === null || doctrine.account.activePageNumber < 0) {
            console.log(`[Doctrine ${doctrine.account.doctrineId}] No active pages found`);
            return;
        }

        const pageNumbers = Array.from(
            { length: doctrine.account.activePageNumber + 1 },
            (_, i) => i
        );

        console.log(`[Doctrine ${doctrine.account.doctrineId}] Found ${pageNumbers.length} pages to process`);

        for (let i = 0; i < pageNumbers.length; i += PARALLEL_PAGES) {
            const batch = pageNumbers.slice(i, i + PARALLEL_PAGES);
            await Promise.all(
                batch.map(async pageNum => {
                    await sleep(RPC_DELAY);
                    console.log(`[Doctrine ${doctrine.account.doctrineId}] Fetching page ${pageNum}...`);
                    const page = await findPage(program, doctrine, pageNum);
                    if (!page) {
                        console.log(`[Doctrine ${doctrine.account.doctrineId}] Page ${pageNum} not found`);
                        return;
                    }

                    await processMessages(program, connection, doctrine, pageNum, page, telegram);
                })
            );
        }
        console.log(`[Doctrine ${doctrine.account.doctrineId}] Finished processing all pages`);
    } catch (error) {
        console.error(`Error processing pages for doctrine ${doctrine.account.doctrineId}:`, error);
    }
}

async function trackDoctrineState(forceCheck = false) {
    if (isProcessing) {
        console.log('Another check is already in progress, skipping...');
        return;
    }

    try {
        isProcessing = true;

        if (!forceCheck) {
            console.log('Starting Aion state tracking...');
        }

        const { program, connection } = await initializeAnchor();
        const telegram = new TelegramNotifier();
        const doctrineIds = Array.from({ length: 10 }, (_, i) => i + 1);

        if (!forceCheck) {
            console.log(`Processing ${doctrineIds.length} doctrines...`);
        }

        for (let i = 0; i < doctrineIds.length; i += PARALLEL_DOCTRINES) {
            const batch = doctrineIds.slice(i, i + PARALLEL_DOCTRINES);
            await Promise.all(
                batch.map(async doctrineId => {
                    try {
                        await sleep(RPC_DELAY);
                        if (!forceCheck) {
                            console.log(`\n[Doctrine ${doctrineId}] Processing...`);
                        }
                        const doctrine = await findDoctrine(program, doctrineId);
                        if (!doctrine) {
                            if (!forceCheck) {
                                console.log(`[Doctrine ${doctrineId}] Not found`);
                            }
                            return;
                        }

                        await processPages(program, connection, doctrine, telegram);
                        if (!forceCheck) {
                            console.log(`[Doctrine ${doctrineId}] Completed processing`);
                        }
                    } catch (error) {
                        console.error(`Error processing doctrine ${doctrineId}:`, error);
                    }
                })
            );
        }
        
        if (!forceCheck) {
            console.log('\nWaiting for next cycle...');
            // Start the next cycle after 10 minutes
            setTimeout(() => trackDoctrineState(), 600000);
        }
    } finally {
        isProcessing = false;
    }
}

async function main() {
    // Start the regular polling process
    trackDoctrineState().catch(console.error);
    
    // Subscribe to Supabase realtime updates
    console.log('Subscribing to Supabase realtime updates...');
    await supabase.subscribeToTransactions(() => trackDoctrineState(true));
    console.log('Supabase realtime subscription active');
}

main().catch(console.error);
