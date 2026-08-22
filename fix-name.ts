import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

async function test() {
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    await supabaseAnon.from('users').update({ name: "Test Anon" }).eq('id', '5a36f5e9-4cd6-4840-af3c-9eb875d25f6d').select();
}
test();
