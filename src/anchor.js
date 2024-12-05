const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const idl = require('./idl/aion.json');
const TelegramNotifier = require('./telegram');

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // Increased to 2 seconds
const BATCH_SIZE = 5;    // Reduced transaction batch size

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryOperation(operation, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (error.toString().includes('429')) { // Rate limit error
                const delay = RETRY_DELAY * Math.pow(2, i); // Exponential backoff
                console.log(`Rate limit reached. Waiting ${delay}ms before retry...`);
                await sleep(delay);
                continue;
            }
            if (i === retries - 1) throw error;
            await sleep(RETRY_DELAY * (i + 1));
        }
    }
}

async function initializeAnchor() {
    // Get network configuration
    const network = process.env.NETWORK || 'devnet';
    const rpcUrl = network === 'mainnet' 
        ? process.env.MAINNET_RPC_URL 
        : process.env.DEVNET_RPC_URL;

    if (!rpcUrl) {
        throw new Error(`RPC URL not found for network: ${network}`);
    }

    const connection = new Connection(rpcUrl);
    const wallet = new anchor.Wallet(Keypair.generate());
    
    const opts = {
        preflightCommitment: 'processed',
        commitment: 'processed',
    };
    
    const provider = new anchor.AnchorProvider(
        connection,
        wallet,
        opts
    );
    
    anchor.setProvider(provider);
    
    const programId = new PublicKey(process.env.PROGRAM_ID);
    const program = new anchor.Program(idl, programId);
    
    // Initialize Telegram notifier
    const telegram = new TelegramNotifier();

    console.log(`Initialized Anchor with network: ${network}`);
    return { program, connection, telegram };
}

async function findDoctrine(program, doctrineId) {
    try {
        const [doctrinePDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("doctrine"),
                new Uint8Array([doctrineId])
            ],
            program.programId
        );

        const doctrine = await retryOperation(async () => {
            return program.account.doctrine.fetch(doctrinePDA);
        });

        return {
            publicKey: doctrinePDA,
            account: doctrine
        };
    } catch (error) {
        console.error(`Error fetching doctrine ${doctrineId}:`, error);
        return null;
    }
}

async function findPage(program, doctrine, pageNumber) {
    try {
        const [pagePDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("page"),
                Buffer.from("doctrine"),
                Buffer.from([doctrine.account.doctrineId]),
                new anchor.BN(pageNumber).toArrayLike(Buffer, 'le', 4)
            ],
            program.programId
        );

        const page = await retryOperation(async () => {
            return program.account.doctrinePage.fetch(pagePDA);
        });

        return {
            publicKey: pagePDA,
            account: page
        };
    } catch (error) {
        console.error(`Error fetching page ${pageNumber} for doctrine:`, error);
        return null;
    }
}

async function findMessageTransactions(connection, pageKey, messageIndices) {
    const results = new Map();
    const processedIndices = new Set();
    let lastSignature = null;
    
    while (true) {
        try {
            await sleep(RETRY_DELAY);
            
            const signatures = await retryOperation(async () => {
                return await connection.getSignaturesForAddress(pageKey, {
                    before: lastSignature,
                    limit: 1000
                });
            });
            
            if (signatures.length === 0) break;
            
            lastSignature = signatures[signatures.length - 1].signature;
            
            // Process transactions in small batches
            for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
                const batchSignatures = signatures.slice(i, i + BATCH_SIZE);
                await sleep(RETRY_DELAY);
                
                const transactions = await Promise.all(
                    batchSignatures.map(sig => 
                        retryOperation(async () => {
                            return connection.getTransaction(sig.signature, {
                                maxSupportedTransactionVersion: 0
                            });
                        })
                    )
                );
                
                for (let j = 0; j < transactions.length; j++) {
                    const tx = transactions[j];
                    const signature = batchSignatures[j].signature;
                    
                    if (!tx || !tx.meta || !tx.meta.logMessages) continue;
                    
                    const logs = tx.meta.logMessages;
                    
                    // Find message index and CID from transaction logs
                    let foundIndex = null;
                    for (const log of logs) {
                        const match = log.match(/Added message with CID: (.*?) at index: (\d+)/);
                        if (match) {
                            const [_, cid, index] = match;
                            foundIndex = parseInt(index);
                            console.log(`Found transaction log - CID: ${cid}, Index: ${foundIndex}`);
                            break;
                        }
                    }
                    
                    // Only process if we found a valid message index that we're looking for
                    if (foundIndex !== null && 
                        messageIndices.includes(foundIndex) && 
                        !processedIndices.has(foundIndex)) {
                        
                        const senderPubkey = tx.transaction.message.accountKeys[0].toString();
                        results.set(foundIndex, {
                            signature,
                            senderPubkey,
                            blockNumber: tx.slot
                        });
                        processedIndices.add(foundIndex);
                        
                        console.log(`Matched transaction for message ${foundIndex}:`, {
                            signature,
                            blockNumber: tx.slot
                        });
                        
                        if (processedIndices.size === messageIndices.length) {
                            return results;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error finding message transactions:', error);
            break;
        }
    }
    
    return results;
}

module.exports = {
    initializeAnchor,
    findDoctrine,
    findPage,
    findMessageTransactions
};
