import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

async function test() {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'pg_catalog' } });

    const { data: fetchRes, error: fetchErr } = await supabaseAdmin.from('pg_policies').select('*');
    console.log("pg_policies Fetch:", fetchRes, "Error:", fetchErr);
    
    const { data: classRes, error: classErr } = await supabaseAdmin.from('pg_class').select('relname, relrowsecurity').eq('relname', 'school_profile');
    console.log("pg_class Fetch:", classRes, "Error:", classErr);
}
test();
