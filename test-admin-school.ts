import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

async function test() {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: fetchRes, error: fetchErr } = await supabaseAdmin.from('school_profile').select('*');
    console.log("Admin Fetch:", fetchRes, "Error:", fetchErr);
}
test();
