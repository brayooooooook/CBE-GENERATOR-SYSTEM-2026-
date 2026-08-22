import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.log('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('--- ALL SUBJECTS IN SUPABASE ---');
  const { data: subjects, error: subjErr } = await supabase.from('subjects').select('*').order('learning_area').order('subject_code');
  if (subjErr) {
    console.error('Error fetching subjects:', subjErr);
  } else {
    console.log(`Total subjects count in DB: ${subjects?.length}`);
    subjects?.forEach((s, idx) => {
      console.log(`${idx + 1}. ID: ${s.id} | Name: "${s.subject_name}" | Code: "${s.subject_code}" | Level/LearningArea: "${s.learning_area}" | Category: "${s.category}" | Active/Status: ${s.is_active ?? s.status ?? 'N/A'}`);
    });
  }
}


run();

