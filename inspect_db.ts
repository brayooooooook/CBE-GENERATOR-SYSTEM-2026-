import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data: classes } = await supabase.from('classes').select('*');
  console.log('--- CLASSES ---');
  console.log(JSON.stringify(classes, null, 2));

  const { data: streams } = await supabase.from('streams').select('*');
  console.log('--- STREAMS ---');
  console.log(JSON.stringify(streams, null, 2));
}

run();
