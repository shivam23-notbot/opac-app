import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qnxpeqdptrqlfrugwskm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_m5wavrkGV8NTBWQ4JWMTgA_HQOJIzSl';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
