const Database = require('better-sqlite3');
const path = require('path');

class MessageDB {
    constructor() {
        this.db = new Database(path.join(__dirname, '../messages.db'));
        this.init();
    }

    init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                doctrine_id INTEGER,
                page_number INTEGER,
                message_index INTEGER,
                ipfs_cid TEXT,
                tx_signature TEXT UNIQUE,
                sender TEXT,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (doctrine_id, page_number, message_index)
            )
        `);
    }

    hasMessage(doctrineId, pageNumber, messageIndex) {
        const stmt = this.db.prepare(
            'SELECT 1 FROM messages WHERE doctrine_id = ? AND page_number = ? AND message_index = ?'
        );
        return stmt.get(doctrineId, pageNumber, messageIndex) !== undefined;
    }

    hasTransactionSignature(txSignature) {
        const stmt = this.db.prepare('SELECT 1 FROM messages WHERE tx_signature = ?');
        return stmt.get(txSignature) !== undefined;
    }

    getNextMessageIndex(doctrineId, pageNumber) {
        const stmt = this.db.prepare(
            'SELECT COALESCE(MAX(message_index) + 1, 0) as next_index FROM messages WHERE doctrine_id = ? AND page_number = ?'
        );
        const result = stmt.get(doctrineId, pageNumber);
        return result.next_index;
    }

    saveMessage(doctrineId, pageNumber, messageIndex, ipfsCid, txSignature, sender, content) {
        // Check if transaction signature already exists
        if (this.hasTransactionSignature(txSignature)) {
            console.log(`Message with transaction signature ${txSignature} already exists, skipping...`);
            return;
        }

        // If messageIndex is 0 (default), get the next available index
        if (messageIndex === 0) {
            messageIndex = this.getNextMessageIndex(doctrineId, pageNumber);
        }

        const stmt = this.db.prepare(`
            INSERT INTO messages (doctrine_id, page_number, message_index, ipfs_cid, tx_signature, sender, content)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(doctrineId, pageNumber, messageIndex, ipfsCid, txSignature, sender, content);
    }
}

module.exports = new MessageDB();
