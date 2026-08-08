import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

async function test() {
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    console.log("Fetching users as anon...");
    const { data: fetchRes, error: fetchErr } = await supabaseAnon.from('users').select('*');
    console.log("Fetch Users count:", fetchRes?.length, "Error:", fetchErr);
    
    console.log("Updating user as anon...");
    if (fetchRes?.[0]?.id) {
        const { data: updateRes, error: updateErr } = await supabaseAnon.from('users').update({ name: "Hacked Name" }).eq('id', fetchRes[0].id).select();
        console.log("Update User:", updateRes, "Error:", updateErr);
    }
}
test();
