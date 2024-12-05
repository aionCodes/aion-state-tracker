const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SupabaseClient {
    constructor() {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            throw new Error('Supabase configuration is missing. Please check SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
        }

        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }

    async subscribeToTransactions(callback) {
        const channel = this.supabase
            .channel('doctrine_transactions_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'doctrine_transactions',
                },
                async () => {
                    console.log('New transaction detected, scheduling two checks...');
                    
                    // First check after 5 seconds
                    setTimeout(async () => {
                        console.log('Running first check...');
                        await callback();
                        
                        // Second check after another 5 seconds
                        setTimeout(async () => {
                            console.log('Running second check...');
                            await callback();
                        }, 5000);
                    }, 5000);
                }
            )
            .subscribe();

        return channel;
    }
}

module.exports = new SupabaseClient();
