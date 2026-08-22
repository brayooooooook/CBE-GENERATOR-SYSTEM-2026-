import { createSupabaseClient } from './src/lib/storage';

async function run() {
  const supabase = createSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.rpc('execute_sql', {
    sql_statement: `
      ALTER TABLE public.subjects 
      ADD COLUMN IF NOT EXISTS education_level TEXT,
      ADD COLUMN IF NOT EXISTS applicable_grades TEXT[],
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
    `
  });
  console.log(error || 'Success');
}
run();
