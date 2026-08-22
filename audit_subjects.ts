import { createSupabaseClient, api } from './src/lib/storage';

async function audit() {
  console.log('=== AUDITING SUPABASE SUBJECTS TABLE AND LOCAL DATA ===');
  const client = createSupabaseClient();
  
  if (!client) {
    console.log('Supabase client is null!');
    return;
  }

  const { data: dbSubjects, error: sbError } = await client.from('subjects').select('*');
  if (sbError) {
    console.error('Error querying subjects:', sbError);
    return;
  }

  console.log(`Found ${dbSubjects?.length || 0} subjects in Supabase public.subjects table.`);
  
  const { data: teacherSubjects } = await client.from('teacher_subjects').select('*');
  const { data: examSubjects } = await client.from('exam_subjects').select('*');
  const { data: marks } = await client.from('marks').select('*');

  console.log('\n--- ALL SUBJECTS IN SUPABASE ---');
  for (const s of dbSubjects || []) {
    const teachers = (teacherSubjects || []).filter((ts: any) => ts.subject_id === s.id);
    const exams = (examSubjects || []).filter((es: any) => es.subject_id === s.id);
    const mks = (marks || []).filter((m: any) => m.subject_id === s.id);
    console.log(`ID: ${s.id} | Code: "${s.subject_code}" | Name: "${s.subject_name}" | LearningArea/Level: "${s.learning_area}" | Teachers: ${teachers.length} | Exams: ${exams.length} | Marks: ${mks.length}`);
  }

  console.log('\n--- LOCAL API getSubjects() ---');
  const localSubs = api.getSubjects();
  for (const s of localSubs) {
    if (s.education_level === 'Upper Primary' || (s.applicable_grades && s.applicable_grades.some(g => ['Grade 4', 'Grade 5', 'Grade 6'].includes(g)))) {
      console.log(`Local ID: ${s.id} | Code: "${s.subject_code}" | Name: "${s.subject_name}" | Level: "${s.education_level}" | Grades: ${JSON.stringify(s.applicable_grades)} | Status: ${s.status}`);
    }
  }
}

audit().catch(console.error);
