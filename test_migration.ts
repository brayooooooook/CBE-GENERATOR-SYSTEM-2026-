import { createClient } from "@supabase/supabase-js";

async function test() {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if(!supabaseUrl || !supabaseServiceKey) {
        console.log("Missing credentials", supabaseUrl, !!supabaseServiceKey);
        return;
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
        sql_statement: "SELECT 1 as num;"
    });
    console.log("Result:", data, "Error:", error);
}
test();
