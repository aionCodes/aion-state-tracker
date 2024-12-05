const supabase = require('./supabase');

async function upsertDoctrine(doctrine, doctrineId) {
    try {
        const { data, error } = await supabase.supabase
            .from('doctrines')
            .upsert({
                doctrine_id: doctrineId,
                public_key: doctrine.publicKey.toString(),
                authority: doctrine.account.authority.toString(),
                total_messages: doctrine.account.totalMessages.toString(),
                active_page_number: doctrine.account.activePageNumber,
                messages_per_page: doctrine.account.messagesPerPage,
                current_page_message_count: doctrine.account.currentPageMessageCount,
                current_message_cost: doctrine.account.currentMessageCost.toString()
            }, {
                onConflict: 'doctrine_id'
            });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting doctrine:', error);
        throw error;
    }
}

async function upsertDoctrinePages({ 
    doctrine_id, 
    public_key, 
    authority,
    total_messages,
    active_page_number,
    messages_per_page,
    current_page_message_count,
    current_message_cost,
    pagePubkey 
}) {
    try {
        const { data: currentData } = await supabase.supabase
            .from('doctrines')
            .select('pages')
            .eq('doctrine_id', doctrine_id)
            .single();

        const pages = currentData?.pages || [];
        if (!pages.includes(pagePubkey)) {
            pages.push(pagePubkey);
        }

        const { data, error } = await supabase.supabase
            .from('doctrines')
            .upsert(
                { 
                    doctrine_id,
                    public_key,
                    authority,
                    total_messages,
                    messages_per_page,
                    active_page_number,
                    current_page_message_count,
                    current_message_cost,
                    pages
                },
                {
                    onConflict: 'doctrine_id'
                }
            );

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error upserting doctrine pages:', error);
        throw error;
    }
}

async function batchUpsertMessages(messages) {
    if (!messages || messages.length === 0) return;
    
    try {
        const { data, error } = await supabase.supabase
            .from('messages')
            .upsert(messages.map(msg => ({
                doctrine_id: msg.doctrine_id,
                page_number: msg.page_number,
                message_index: msg.message_index,
                message: msg.message,
                ipfs_cid: msg.ipfs_cid,
                txid: msg.txid,
                sender_pubkey: msg.sender_pubkey
            })), {
                onConflict: 'doctrine_id,page_number,message_index'
            });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error batch upserting messages:', error);
        throw error;
    }
}

module.exports = {
    upsertDoctrine,
    upsertDoctrinePages,
    batchUpsertMessages
};
