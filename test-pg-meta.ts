import 'dotenv/config';

async function test() {
    const url = process.env.VITE_SUPABASE_URL.replace('.supabase.co', '.supabase.co/pg-meta/default/query');
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'SELECT relname, relrowsecurity FROM pg_class WHERE relname = \'school_profile\';' })
    });
    console.log(res.status, await res.text());
}
test();
