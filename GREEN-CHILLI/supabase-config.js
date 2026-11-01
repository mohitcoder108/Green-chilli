const SUPABASE_URL = "https://bhpfxqjoxjdhyywkgeyt.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_RRsOOuByfVCceLe16SCaLA_fAREvNFF";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);