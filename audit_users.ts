import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, serviceKey!);

async function inspectUsers() {
  console.log('=== USERS IN SUPABASE ===');
  const { data: users, error } = await supabase.from('users').select('*');
  console.log('Users found:', users?.length);
  const marcusUser = users?.find(u => 
    (u.username && u.username.toLowerCase().includes('marcus')) ||
    (u.name && u.name.toLowerCase().includes('marcus')) ||
    (u.email && u.email.toLowerCase().includes('marcus')) ||
    u.student_id === 'e534459c-787f-4c3a-b48c-9cb09e34b011' ||
    u.student_id === '230'
  );
  console.log('Marcus User in DB:', marcusUser);

  const kevinUser = users?.find(u => 
    (u.username && u.username.toLowerCase().includes('kevin')) ||
    (u.name && u.name.toLowerCase().includes('kevin')) ||
    u.student_id === '25892c85-5343-4307-b042-91b5f5c982a1' ||
    u.student_id === '234'
  );
  console.log('Kevin User in DB:', kevinUser);

  console.log('\nAll learner users:', users?.filter(u => u.role === 'student' || u.role === 'learner'));
}

inspectUsers();
