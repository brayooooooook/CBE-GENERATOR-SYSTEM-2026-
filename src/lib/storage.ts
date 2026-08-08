import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  School,
  User,
  Teacher,
  ClassStream,
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  VerificationLog,
  Role,
  AcademicYear,
  SchoolTerm,
  GradeName,
  EducationLevel,
  TermName,
  LearnerPromotionRecord,
  LoginLog,
  SubjectGroup,
  LearnerReportComment,
  LEVEL_TO_GRADES,
  getEducationLevelForGrade,
  getGradeOrderIndex,
  getStudentFullName,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  sortClasses,
} from '../types';
import {
  initialSchool,
  initialGrades,
  initialSubjects,
  isStandardSubject,
  initialClasses,
  initialTeachers,
  initialUsers,
  initialStudents,
  initialExaminations,
  initialMarks,
  initialAcademicYears,
  initialTerms,
  initialSubjectGroups,
} from '../data/seedData';

// Singleton instance variables
export let supabase: SupabaseClient | null = null;
let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

// Supabase credentials resolution (checks process/import.meta env or localStorage)
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const env = (import.meta as any).env || {};
  const procEnv = typeof process !== 'undefined' ? process.env : {};
  const url = env.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL || (typeof localStorage !== 'undefined' ? localStorage.getItem('cbe_supabase_url') : '') || '';
  const anonKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || procEnv.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || procEnv.VITE_SUPABASE_ANON_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem('cbe_supabase_anon_key') : '') || '';
  return { url: url.trim(), anonKey: anonKey.trim() };
}

/**
 * Returns the global single Supabase client instance (Singleton).
 * Reuses the existing GoTrueClient and Supabase instance unless credentials change.
 */
export function getSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  const finalUrl = (url !== undefined ? url : creds.url).trim();
  const finalKey = (anonKey !== undefined ? anonKey : creds.anonKey).trim();

  if (!finalUrl || !finalKey) {
    return null;
  }

  // If a singleton client already exists and credentials haven't changed, return the singleton instance
  if (supabaseInstance && currentUrl === finalUrl && currentKey === finalKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(finalUrl, finalKey);
    currentUrl = finalUrl;
    currentKey = finalKey;
    supabase = supabaseInstance;
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to create Supabase client', err);
    return null;
  }
}

/**
 * Alias for getSupabaseClient to preserve backward compatibility while ensuring a single GoTrueClient instance.
 */
export function createSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  return getSupabaseClient(url, anonKey);
}

// Initial singleton lookup on module load
getSupabaseClient();

export function saveSupabaseCredentials(url: string, anonKey: string) {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (cleanUrl) localStorage.setItem('cbe_supabase_url', cleanUrl);
  else localStorage.removeItem('cbe_supabase_url');

  if (cleanKey) localStorage.setItem('cbe_supabase_anon_key', cleanKey);
  else localStorage.removeItem('cbe_supabase_anon_key');

  supabase = getSupabaseClient(cleanUrl, cleanKey);
}

export async function testSupabaseConnection(customUrl?: string, customKey?: string) {
  const client = createSupabaseClient(customUrl, customKey);
  const creds = getSupabaseCredentials();
  const activeUrl = customUrl || creds.url;
  const activeKey = customKey || creds.anonKey;

  if (!client || !activeUrl || !activeKey) {
    return {
      success: false,
      url: activeUrl,
      hasKey: !!activeKey,
      tableReadSuccess: false,
      recordCount: 0,
      message: 'Supabase URL or Anon Key is missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      error: 'Credentials missing',
      fixInstructions: 'Provide your Supabase URL (e.g. https://xyz.supabase.co) and Anon API Key in environment variables or connection modal.'
    };
  }

  try {
    // 1. Read 'school_profile' table
    let { data, error } = await client.from('school_profile').select('*').limit(10);

    // If error because table does not exist
    if (error && (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('not found'))) {
      // Also check fallback 'schools' table
      const fallback = await client.from('schools').select('*').limit(10);
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      } else {
        return {
          success: false,
          url: activeUrl,
          hasKey: true,
          tableReadSuccess: false,
          recordCount: 0,
          message: `Connected to Supabase client, but table 'school_profile' does not exist in your database. Exact error: ${error.message}`,
          error: error.message,
          fixInstructions: `To create the database schema:\n1. Copy the PostgreSQL DDL schema provided in the Supabase Modal.\n2. Open your Supabase Dashboard at ${activeUrl}\n3. Go to SQL Editor -> New Query, paste the schema, and click 'Run'.`
        };
      }
    }

    if (error) {
      const isPermissionDenied =
        error.code === '42501' ||
        error.message.toLowerCase().includes('permission denied') ||
        error.message.toLowerCase().includes('rls') ||
        error.message.toLowerCase().includes('row-level security');

      const fixInstructions = isPermissionDenied
        ? `Permission Denied Error (Code 42501):\nTo allow access to the school_profile table, run this SQL in your Supabase SQL Editor:\n\nGRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;\nGRANT SELECT ON public.school_profile TO anon;\nGRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;\nGRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;\n\nDROP POLICY IF EXISTS "Public read school_profile" ON public.school_profile;\nCREATE POLICY "Public read school_profile" ON public.school_profile FOR SELECT TO public, anon, authenticated USING (true);`
        : `Check table permissions or Row Level Security (RLS) policies in your Supabase Dashboard for table 'school_profile'.`;

      return {
        success: false,
        url: activeUrl,
        hasKey: true,
        tableReadSuccess: false,
        recordCount: 0,
        message: `Connected to Supabase client, but reading table 'school_profile' failed. Exact error: ${error.message}`,
        error: error.message,
        fixInstructions,
      };
    }

    // If table exists but is empty, seed initial school profile into Supabase
    if (data && data.length === 0) {
      const seedInsert = await client.from('school_profile').insert([{
        school_name: initialSchool.school_name || '',
        motto: initialSchool.motto || '',
        county: initialSchool.county || '',
        address: initialSchool.address || initialSchool.postal_code || '',
        email: initialSchool.email || '',
      }]).select('*');

      if (!seedInsert.error && seedInsert.data) {
        data = seedInsert.data;
      }
    }

    return {
      success: true,
      url: activeUrl,
      hasKey: true,
      tableReadSuccess: true,
      recordCount: data ? data.length : 0,
      records: data,
      message: `Supabase connection successful! Table 'school_profile' read successfully (${data ? data.length : 0} records).`,
    };
  } catch (err: any) {
    return {
      success: false,
      url: activeUrl,
      hasKey: true,
      tableReadSuccess: false,
      recordCount: 0,
      message: `Network or unexpected error while connecting to Supabase: ${err.message || err}`,
      error: err.message || String(err),
      fixInstructions: `Verify your network connection and confirm that the Supabase project URL is accessible.`
    };
  }
}

/**
 * Utility to standardize subject codes and subject names to the simplified CBE format.
 */
export function sanitizeSubject(sb: Subject): Subject {
  if (!sb) return sb;
  const code = (sb.subject_code || '').trim().toUpperCase();
  const name = (sb.subject_name || '').trim();
  const id = sb.id || '';

  let eduLevel = sb.education_level;
  let applicableGrades = sb.applicable_grades ? [...sb.applicable_grades] : [];

  // --- REPAIR KNOWN CURRICULUM MAPPINGS ---
  // 1. Language Activities / LANG (Pre-Primary only)
  if (code === 'LANG' || code === 'LANG ACT' || name === 'Language' || name === 'Language Activities' || id === 'sb_pp_lang') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
  }
  // 2. Psychomotor & Creative Activities / PSY-CRE (Pre-Primary only)
  else if (code === 'PSY-CRE' || code === 'PSYCH ACT' || name.includes('Psychomotor') || id === 'sb_pp_psy') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
  }
  // 3. Environmental Activities
  else if (code === 'ENV ACT' || id === 'sb_pp_env') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
  } else if (code === 'ENV LP' || id === 'sb_lp_env') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
  } else if (code === 'ENV' || name.includes('Environmental')) {
    eduLevel = 'Lower Primary';
    applicableGrades = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3'];
  }
  // 4. Science & Technology / SCI-TECH (Upper Primary only: Grade 4-6)
  else if (code === 'SCI-TECH' || code === 'SCI UP' || name === 'Science & Technology' || name === 'Science and Technology' || id === 'sb_up_sci') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  }
  // 5. Creative Activities (Lower Primary only: Grade 1-3)
  else if (code === 'CREAT' || code === 'CREAT LP' || name === 'Creative' || name === 'Creative Activities' || id === 'sb_lp_crt') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
  }
  // 6. Integrated Science (Junior School only: Grade 7-9)
  else if (code === 'INT-SCI' || (code === 'SCI' && name === 'Integrated Science') || id === 'sb_sci') {
    eduLevel = 'Junior School';
    applicableGrades = ['Grade 7', 'Grade 8', 'Grade 9'];
  }
  // 7. Pre-Technical Studies (Junior School only: Grade 7-9)
  else if (code === 'PRE TECH' || code === 'PTS' || name.includes('Pre-Technical') || id === 'sb_pts') {
    eduLevel = 'Junior School';
    applicableGrades = ['Grade 7', 'Grade 8', 'Grade 9'];
  }
  // 8. Creative Arts / Creative Arts & Sports
  else if (code === 'CREAT UP' || id === 'sb_up_crt') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  } else if (code === 'CAS' || code === 'CA' || name.includes('Creative Arts') || name.includes('Sports') || id === 'sb_cas') {
    eduLevel = 'Junior School';
    applicableGrades = ['Grade 7', 'Grade 8', 'Grade 9'];
    return {
      ...sb,
      subject_name: 'Creative Arts and Sports',
      subject_code: 'CAS',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 9. Social Studies
  else if (code === 'SST UP' || id === 'sb_up_sst') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  } else if (code === 'SST' || name === 'Social Studies' || id === 'sb_sst') {
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
    eduLevel = 'Junior School';
  }
  // 10. Mathematics
  else if (code === 'MATH ACT' || id === 'sb_pp_math') {
    eduLevel = 'Pre-Primary';
    applicableGrades = ['PP1', 'PP2'];
  } else if (code === 'MAT LP' || id === 'sb_lp_mat') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
  } else if (code === 'MAT UP' || id === 'sb_up_mat') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  } else if (code === 'MATH' || code === 'MAT' || name.includes('Math') || id === 'sb_mat') {
    applicableGrades = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
    eduLevel = 'Junior School';
  }
  // 11. English
  else if (code === 'ENG LP' || id === 'sb_lp_eng') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
  } else if (code === 'ENG UP' || id === 'sb_up_eng') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  } else if (code === 'ENG' || name.includes('English') || id === 'sb_eng') {
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
    eduLevel = 'Junior School';
  }
  // 12. Kiswahili
  else if (code === 'KIS LP' || id === 'sb_lp_kis') {
    eduLevel = 'Lower Primary';
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
  } else if (code === 'KIS UP' || id === 'sb_up_kis') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  } else if (code === 'KIS' || name.includes('Kiswahili') || id === 'sb_kis') {
    applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];
    eduLevel = 'Junior School';
  }
  // 13. Agriculture
  else if (code === 'AGR UP' || id === 'sb_up_agr') {
    eduLevel = 'Upper Primary';
    applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
  } else if (code === 'AGR' || code === 'AGN' || name.includes('Agriculture') || name.includes('Nutrition') || id === 'sb_agn') {
    eduLevel = 'Junior School';
    applicableGrades = ['Grade 7', 'Grade 8', 'Grade 9'];
    return {
      ...sb,
      subject_name: 'Agriculture and Nutrition',
      subject_code: 'AGN',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }
  // 14. CRE / Religious Education
  else if (
    code === 'CRE' ||
    code === 'RE' ||
    code === 'RE ACT' ||
    code === 'RE LP' ||
    code === 'RE UP' ||
    code === 'C.R.E' ||
    name.includes('Religious') ||
    name.toUpperCase() === 'CRE' ||
    id === 'sb_cre' ||
    id === 'sb_pp_re' ||
    id === 'sb_lp_re' ||
    id === 'sb_up_re'
  ) {
    if (id === 'sb_pp_re' || code === 'RE ACT') {
      eduLevel = 'Pre-Primary';
      applicableGrades = ['PP1', 'PP2'];
    } else if (id === 'sb_lp_re' || code === 'RE LP') {
      eduLevel = 'Lower Primary';
      applicableGrades = ['Grade 1', 'Grade 2', 'Grade 3'];
    } else if (id === 'sb_up_re' || code === 'RE UP') {
      eduLevel = 'Upper Primary';
      applicableGrades = ['Grade 4', 'Grade 5', 'Grade 6'];
    } else {
      eduLevel = sb.education_level || 'Junior School';
      applicableGrades = sb.applicable_grades && sb.applicable_grades.length > 0
        ? sb.applicable_grades
        : LEVEL_TO_GRADES[eduLevel] || ['Grade 7', 'Grade 8', 'Grade 9'];
    }
    return {
      ...sb,
      subject_name: 'Christian Religious Education',
      subject_code: 'CRE',
      education_level: eduLevel,
      applicable_grades: applicableGrades,
    };
  }

  if (!eduLevel) {
    if (applicableGrades.length > 0) {
      eduLevel = getEducationLevelForGrade(applicableGrades[0]);
    } else {
      eduLevel = 'Junior School';
    }
  }

  if (!applicableGrades || applicableGrades.length === 0) {
    applicableGrades = LEVEL_TO_GRADES[eduLevel] || [];
  }

  return {
    ...sb,
    subject_code: code,
    subject_name: name,
    education_level: eduLevel,
    applicable_grades: applicableGrades,
  };
}

/**
 * Utility to standardize and sanitize ClassStream objects, ensuring stream name and properties are never lost.
 */
export function sanitizeClass(c: any): ClassStream {
  if (!c) {
    return {
      id: `cls_${Date.now()}`,
      class_name: 'Grade 7',
      stream: 'Blue',
      capacity: 40,
      education_level: 'Junior School',
      status: 'Active',
      allocated_subject_ids: [],
    };
  }

  let classNameStr = (c.class_name || c.grade || 'Grade 7').trim();
  let rawStream = (c.stream !== undefined && c.stream !== null ? String(c.stream) : (c.stream_name || c.name || '')).trim();

  // If rawStream is empty, check if classNameStr contains grade + stream, e.g. "Grade 7 Blue" or "Grade 7 - Blue"
  if (!rawStream && classNameStr) {
    const match = classNameStr.match(/^(PP1|PP2|Grade\s*\d+)\s*[\-\|•\(\s]\s*([A-Za-z0-9\s]+)\)?$/i);
    if (match) {
      classNameStr = match[1].replace(/\s+/g, ' ').trim();
      rawStream = match[2].trim();
    }
  }

  const className = classNameStr as GradeName;
  const eduLevel = c.education_level || getEducationLevelForGrade(className);

  return {
    id: String(c.id || `cls_${Date.now()}`),
    class_name: className,
    stream: rawStream,
    capacity: typeof c.capacity === 'number' && c.capacity > 0 ? c.capacity : (c.capacity ? Number(c.capacity) : 40),
    class_teacher_id: c.class_teacher_id || undefined,
    education_level: eduLevel,
    status: c.status === 'Inactive' ? 'Inactive' : 'Active',
    allocated_subject_ids: Array.isArray(c.allocated_subject_ids) ? c.allocated_subject_ids : [],
  };
}

/**
 * Asynchronously sync class changes to Supabase if client is configured
 */
async function syncClassToSupabase(cls: ClassStream, isDelete: boolean = false) {
  const client = createSupabaseClient();
  if (!client) return;
  try {
    if (isDelete) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cls.id)) {
        await client.from('classes').delete().eq('id', cls.id);
        await client.from('streams').delete().eq('id', cls.id);
      }
    } else {
      // Check if class exists in Supabase
      const { data: existingClasses } = await client.from('classes').select('*').ilike('class_name', cls.class_name);
      let classObj = existingClasses?.[0];
      if (!classObj) {
        const gradeLevelNum = getGradeOrderIndex(cls.class_name);
        const { data: createdClass } = await client.from('classes').insert([{
          class_name: cls.class_name,
          grade_level: gradeLevelNum >= 0 && gradeLevelNum <= 12 ? gradeLevelNum : 0,
          capacity: cls.capacity || 40,
        }]).select('*');
        classObj = createdClass?.[0];
      }

      if (classObj) {
        const streamName = cls.stream || 'A';
        const { data: existingStreams } = await client.from('streams').select('*').eq('class_id', classObj.id).ilike('stream_name', streamName);
        if (!existingStreams || existingStreams.length === 0) {
          const streamPayload: any = {
            class_id: classObj.id,
            stream_name: streamName,
            capacity: cls.capacity || 40,
            class_teacher_id: cls.class_teacher_id || null,
          };
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cls.id)) {
            streamPayload.id = cls.id;
          }
          await client.from('streams').insert([streamPayload]);
        } else if (cls.class_teacher_id) {
          await client.from('streams').update({ class_teacher_id: cls.class_teacher_id }).eq('id', existingStreams[0].id);
        }
      }
    }
  } catch (err) {
    console.warn('Sync class to Supabase warning:', err);
  }
}

export async function resolveStudentClassAndStreamUuids(
  classOrStreamId: string,
  client: any
): Promise<{ class_id: string | null; stream_id: string | null }> {
  if (!classOrStreamId || !isUUID(classOrStreamId) || !client) {
    return { class_id: null, stream_id: null };
  }

  // Check if classOrStreamId is in streams table
  const { data: streamMatch } = await client.from('streams').select('id, class_id').eq('id', classOrStreamId).maybeSingle();
  if (streamMatch) {
    return { class_id: streamMatch.class_id, stream_id: streamMatch.id };
  }

  // Check if classOrStreamId is in classes table
  const { data: classMatch } = await client.from('classes').select('id').eq('id', classOrStreamId).maybeSingle();
  if (classMatch) {
    const { data: defaultStream } = await client.from('streams').select('id').eq('class_id', classMatch.id).limit(1);
    return { class_id: classMatch.id, stream_id: defaultStream?.[0]?.id || null };
  }

  return { class_id: null, stream_id: null };
}

/**
 * Fetch and load real data from Supabase tables into local cache
 */
export async function syncFromSupabase(): Promise<boolean> {
  const client = createSupabaseClient();
  if (!client) return false;

  try {
    // 1. Fetch School Profile
    const { data: schoolData } = await client.from('school_profile').select('*').limit(1);
    if (schoolData && schoolData.length > 0) {
      const sp = schoolData[0];
      const postalVal = sp.postal_code || sp.address || initialSchool.postal_code || initialSchool.address || '';
      const schoolObj: School = {
        id: sp.id || initialSchool.id,
        school_name: sp.school_name || sp.name || initialSchool.school_name || '',
        motto: sp.motto || sp.school_motto || initialSchool.motto || '',
        county: sp.county || initialSchool.county || '',
        postal_code: postalVal,
        address: postalVal,
        email: sp.email || sp.email_address || initialSchool.email || '',
      };
      setStorage(KEYS.SCHOOL, schoolObj);
    }

    // 1b. Fetch Users from public.users
    const { data: userData } = await client.from('users').select('*');
    if (userData && userData.length > 0) {
      api.syncUsersFromDatabase(userData);
    }

    // 2. Fetch Classes & Streams first so student resolution works
    const { data: classData, error: classError } = await client.from('classes').select('*');
    const { data: streamData, error: streamError } = await client.from('streams').select('*');

    let currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    if (!classError && classData) {
      const existing = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      const merged: ClassStream[] = [];

      classData.forEach((c: any) => {
        const cStreams = (streamData || []).filter((s: any) => s.class_id === c.id);
        if (cStreams.length > 0) {
          cStreams.forEach((st: any) => {
            const cleanName = c.class_name;
            const eduLevel = c.education_level || getEducationLevelForGrade(cleanName);
            const match = existing.find((e) => e.id === st.id || (e.class_name.toLowerCase() === cleanName.toLowerCase() && e.stream.toLowerCase() === st.stream_name.toLowerCase()));

            merged.push(sanitizeClass({
              id: st.id || c.id,
              class_name: cleanName,
              stream: st.stream_name || 'A',
              capacity: st.capacity || c.capacity || 40,
              class_teacher_id: st.class_teacher_id || c.class_teacher_id || match?.class_teacher_id,
              education_level: eduLevel,
              status: c.status || 'Active',
              allocated_subject_ids: match?.allocated_subject_ids || [],
            }));
          });
        } else {
          const clean = sanitizeClass(c);
          const match = existing.find((e) => e.id === clean.id) ||
                        existing.find((e) => e.class_name.toLowerCase() === clean.class_name.toLowerCase());
          if (match) {
            if (!clean.stream && match.stream) clean.stream = match.stream;
            if ((!clean.allocated_subject_ids || clean.allocated_subject_ids.length === 0) && match.allocated_subject_ids) {
              clean.allocated_subject_ids = match.allocated_subject_ids;
            }
            if (!clean.class_teacher_id && match.class_teacher_id) {
              clean.class_teacher_id = match.class_teacher_id;
            }
          }
          merged.push(clean);
        }
      });

      setStorage(KEYS.CLASSES, merged);
      currentClasses = merged;
    } else if (classError) {
      console.warn('Error fetching classes from Supabase:', classError);
    }

    // 3. Fetch Students from public.students
    const { data: studentData, error: studentError } = await client.from('students').select('*');
    if (!studentError && studentData) {
      const mappedStudents: Student[] = studentData.map((s: any) => {
        const matchedClass = currentClasses.find((c) => c.id === s.stream_id || c.id === s.class_id);
        const grade = matchedClass ? (matchedClass.class_name as GradeName) : undefined;
        const level = matchedClass ? matchedClass.education_level : (grade ? getEducationLevelForGrade(grade) : undefined);

        const nameParts = (s.full_name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const secondName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined;

        return {
          id: s.id,
          admission_number: s.admission_number || '',
          full_name: s.full_name || '',
          first_name: firstName,
          second_name: secondName,
          last_name: lastName,
          gender: (s.gender === 'M' || s.gender === 'Boy' || s.gender === 'Male') ? 'M' : 'F',
          class_id: s.stream_id || s.class_id || '',
          stream_id: s.stream_id || s.class_id || '',
          dob: s.dob || undefined,
          active: s.active ?? true,
          grade: grade,
          education_level: level,
        };
      });
      setStorage(KEYS.STUDENTS, mappedStudents);
    } else if (studentError) {
      console.warn('Error fetching students from Supabase:', studentError);
    }

    // 4. Fetch Teachers & Teacher Allocations
    const { data: subjectData, error: subjectError } = await client.from('subjects').select('*');
    const { data: teacherData, error: teacherError } = await client.from('teachers').select('*');
    const { data: teacherSubjectsData, error: teacherSubjectsError } = await client.from('teacher_subjects').select('*');

    if (!teacherError && teacherData) {
      const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, []);
      const existingTeachers = getStorage<Teacher[]>(KEYS.TEACHERS, []);
      const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();

      const cleanTeachers = teacherData
        .filter((t: any) => {
          if (!t) return false;
          if (isBlacklistedTestEmail(t?.email)) return false;
          if (delIds.has(t.id) || (t.id && delIds.has(t.id.toLowerCase()))) return false;
          if (t.email && delEmails.has(t.email.trim().toLowerCase())) return false;
          return true;
        })
        .map((t: any) => {
          const exT = existingTeachers.find((et) => et.id === t.id || et.email.toLowerCase() === t.email.toLowerCase());

          // Find class teacher stream assignment from streams/classes
          const assignedClassStream = currentClasses.find((c) => c.class_teacher_id === t.id) ||
                                      (streamData && streamData.find((s: any) => s.class_teacher_id === t.id));

          // Find teacher subject allocations from teacher_subjects table
          const dbAllocations = (teacherSubjectsData || [])
            .filter((ts: any) => ts.teacher_id === t.id)
            .map((ts: any) => {
              const matchedClass = currentClasses.find((c) => c.id === ts.stream_id || c.id === ts.class_id);
              const matchedSubject = (subjectData || []).find((s: any) => s.id === ts.subject_id);
              return {
                id: ts.id,
                class_id: ts.stream_id || ts.class_id,
                stream_id: ts.stream_id,
                subject_id: ts.subject_id,
                subject_name: matchedSubject?.subject_name,
                subject_code: matchedSubject?.subject_code,
                class_name: matchedClass?.class_name,
                stream: matchedClass?.stream,
                education_level: matchedClass?.education_level || (matchedClass ? getEducationLevelForGrade(matchedClass.class_name) : 'Upper Primary')
              };
            });

          const combinedAllocations = dbAllocations.length > 0 ? dbAllocations : (exT?.allocations || t.allocations || []);

          return {
            ...t,
            is_class_teacher: t.is_class_teacher || !!assignedClassStream || exT?.is_class_teacher || false,
            class_teacher_of_id: assignedClassStream?.id || exT?.class_teacher_of_id || t.class_teacher_of_id,
            allocations: combinedAllocations,
          };
        });

      // Deduplicate loaded teachers by email / username / identity
      const uniqueCleanTeachers: Teacher[] = [];
      for (const tch of cleanTeachers) {
        const existingIdx = uniqueCleanTeachers.findIndex((ex) => areTeachersSamePerson(ex, tch));
        if (existingIdx >= 0) {
          uniqueCleanTeachers[existingIdx] = mergeTeacherObjects(uniqueCleanTeachers[existingIdx], tch);
        } else {
          uniqueCleanTeachers.push(tch);
        }
      }

      setStorage(KEYS.TEACHERS, uniqueCleanTeachers);
      api.deduplicateTeachersAndUsers();
    } else if (teacherError) {
      console.warn('Error fetching teachers from Supabase:', teacherError);
    }

    // 5. Fetch Subjects & Auto-Migrate Old Codes
    if (!subjectError && subjectData) {
      const sanitized = subjectData.map((s: any) => {
        const clean = sanitizeSubject(s);
        const initSb = initialSubjects.find(isb => isb.subject_code === clean.subject_code || isb.subject_name === clean.subject_name || isb.id === clean.id);
        if (initSb) {
          if (!clean.education_level) clean.education_level = initSb.education_level;
          if (!clean.applicable_grades || clean.applicable_grades.length === 0) clean.applicable_grades = initSb.applicable_grades;
          if (!clean.status) clean.status = initSb.status || 'Active';
        }
        return clean;
      });
      setStorage(KEYS.SUBJECTS, sanitized);

      // Auto update any subject in Supabase if code/name was old format
      subjectData.forEach(async (oldSb: any) => {
        const clean = sanitizeSubject(oldSb);
        if (clean.subject_code !== oldSb.subject_code || clean.subject_name !== oldSb.subject_name) {
          try {
            await client.from('subjects').update({
              subject_code: clean.subject_code,
              subject_name: clean.subject_name,
            }).eq('id', oldSb.id);
          } catch (err) {
            console.warn('Could not update subject code in Supabase:', err);
          }
        }
      });
    } else if (subjectError) {
      console.warn('Error fetching subjects from Supabase:', subjectError);
    }

    // 6. Fetch Examinations
    const { data: examData, error: examError } = await client.from('examinations').select('*');
    if (!examError && examData) {
      setStorage(KEYS.EXAMS, examData);
    } else if (examError) {
      console.warn('Error fetching examinations from Supabase:', examError);
    }

    // 7. Fetch Marks
    const { data: markData, error: markError } = await client.from('marks').select('*');
    if (!markError && markData) {
      setStorage(KEYS.MARKS, markData);
    } else if (markError) {
      console.warn('Error fetching marks from Supabase:', markError);
    }

    return true;
  } catch (err) {
    console.error('Error syncing from Supabase:', err);
    return false;
  }
}


// Storage keys for local persistence
export const KEYS = {
  SCHOOL: 'cbe_school',
  GRADES: 'cbe_grades',
  SUBJECTS: 'cbe_subjects',
  CLASSES: 'cbe_classes',
  TEACHERS: 'cbe_teachers',
  USERS: 'cbe_users',
  STUDENTS: 'cbe_students',
  ALLOCATED_STUDENTS: 'cbe_allocated_students',
  EXAMS: 'cbe_exams',
  MARKS: 'cbe_marks',
  VERIFICATIONS: 'cbe_verifications',
  CURRENT_USER: 'cbe_current_user',
  ACADEMIC_YEARS: 'cbe_academic_years',
  SCHOOL_TERMS: 'cbe_school_terms',
  LOGIN_LOGS: 'cbe_login_logs',
  SUBJECT_GROUPS: 'cbe_subject_groups',
  DELETED_TEACHERS: 'cbe_deleted_teachers',
};

const memoryStorage: Record<string, string> = {};

// Helper for in-memory storage (Supabase is single source of truth for persistent data)
export function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = memoryStorage[key];
    return item !== undefined && item !== null ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from memory storage`, err);
    return defaultValue;
  }
}

export function setStorage<T>(key: string, value: T): void {
  try {
    if (value === null || value === undefined) {
      delete memoryStorage[key];
      return;
    }
    memoryStorage[key] = JSON.stringify(value);
  } catch (err) {
    console.error(`Error writing ${key} to memory storage`, err);
  }
}

export function getDeletedTeacherIdentifiers(): { ids: Set<string>; emails: Set<string> } {
  const list = getStorage<string[]>(KEYS.DELETED_TEACHERS, []);
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const item of list) {
    if (item && typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (trimmed.includes('@')) {
        emails.add(trimmed.toLowerCase());
      } else {
        ids.add(trimmed);
        ids.add(trimmed.toLowerCase());
      }
    }
  }
  return { ids, emails };
}

export function recordDeletedTeacherIdentifier(...identifiers: (string | undefined | null)[]): void {
  const current = getStorage<string[]>(KEYS.DELETED_TEACHERS, []);
  const set = new Set(current);
  for (const id of identifiers) {
    if (id && typeof id === 'string' && id.trim()) {
      const trimmed = id.trim();
      set.add(trimmed);
      if (trimmed.includes('@')) {
        set.add(trimmed.toLowerCase());
      }
    }
  }
  setStorage(KEYS.DELETED_TEACHERS, Array.from(set));
}

export function removeDeletedTeacherIdentifier(...identifiers: (string | undefined | null)[]): void {
  const current = getStorage<string[]>(KEYS.DELETED_TEACHERS, []);
  const toRemove = new Set(
    identifiers.filter((i): i is string => Boolean(i && typeof i === 'string')).map((i) => i.trim().toLowerCase())
  );
  if (toRemove.size === 0) return;
  const updated = current.filter((item) => !toRemove.has(item.trim().toLowerCase()));
  setStorage(KEYS.DELETED_TEACHERS, updated);
}

export function sanitizeUser(u: User): User {
  if (!u) return u;
  if (u.name && (u.name.toLowerCase().includes('omwenga') || u.name.includes('Dr. Joseph'))) {
    return {
      ...u,
      name: u.role === 'admin' ? 'Administrator' : u.name.replace(/Dr\.\s*Joseph\s*Omwenga/gi, 'Administrator'),
    };
  }
  return u;
}

const TARGET_TEST_TEACHER_EMAILS = [
  'test_teacher_1785574605292@example.com',
  'test_teacher_e2e_1785574890386@example.com',
];

export function isBlacklistedTestEmail(email?: string): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    TARGET_TEST_TEACHER_EMAILS.includes(lower) ||
    lower.includes('test_teacher_1785574605292') ||
    lower.includes('test_teacher_e2e_1785574890386')
  );
}

export function getCleanUsername(username?: string): string {
  if (!username) return '';
  return username.replace(/^@+/, '').trim().toLowerCase();
}

export function areTeachersSamePerson(t1?: Partial<Teacher> | null, t2?: Partial<Teacher> | null): boolean {
  if (!t1 || !t2) return false;
  if (t1.id && t2.id && t1.id === t2.id) return true;

  const email1 = t1.email ? t1.email.trim().toLowerCase() : '';
  const email2 = t2.email ? t2.email.trim().toLowerCase() : '';
  if (email1 && email2 && email1 === email2) return true;

  const uname1 = getCleanUsername(t1.username);
  const uname2 = getCleanUsername(t2.username);
  if (uname1 && uname2 && uname1 === uname2) return true;

  const tsc1 = (t1.tsc_number && t1.tsc_number !== 'TSC-PENDING') ? t1.tsc_number.trim().toLowerCase() : '';
  const tsc2 = (t2.tsc_number && t2.tsc_number !== 'TSC-PENDING') ? t2.tsc_number.trim().toLowerCase() : '';
  if (tsc1 && tsc2 && tsc1 === tsc2) return true;

  const name1 = t1.teacher_name ? t1.teacher_name.trim().toLowerCase() : '';
  const name2 = t2.teacher_name ? t2.teacher_name.trim().toLowerCase() : '';
  if (name1 && name2 && name1 === name2) {
    const phone1 = t1.phone ? t1.phone.trim() : '';
    const phone2 = t2.phone ? t2.phone.trim() : '';
    if (phone1 && phone2 && phone1 === phone2) return true;
    if (!email1 || !email2) return true;
  }

  return false;
}

export function mergeTeacherObjects(t1: Teacher, t2: Teacher): Teacher {
  const keptId = isUUID(t1.id) ? t1.id : (isUUID(t2.id) ? t2.id : t1.id);
  
  // Merge allocations
  const mergedAllocations = [...(t1.allocations || [])];
  if (t2.allocations) {
    for (const alloc of t2.allocations) {
      if (!mergedAllocations.some((a) => a.class_id === alloc.class_id && a.subject_id === alloc.subject_id && (a.stream || '') === (alloc.stream || ''))) {
        mergedAllocations.push(alloc);
      }
    }
  }

  return {
    ...t2,
    ...t1,
    id: keptId,
    teacher_name: t1.teacher_name || t2.teacher_name,
    email: t1.email ? t1.email.trim().toLowerCase() : (t2.email ? t2.email.trim().toLowerCase() : ''),
    phone: t1.phone || t2.phone || '',
    username: t1.username || t2.username || '',
    tsc_number: (t1.tsc_number && t1.tsc_number !== 'TSC-PENDING') ? t1.tsc_number : (t2.tsc_number || 'TSC-PENDING'),
    user_id: isUUID(t1.user_id) ? t1.user_id : (isUUID(t2.user_id) ? t2.user_id : (t1.user_id || t2.user_id)),
    is_class_teacher: t1.is_class_teacher || t2.is_class_teacher,
    class_teacher_of_id: t1.class_teacher_of_id || t2.class_teacher_of_id,
    status: (t1.status === 'Active' || t2.status === 'Active') ? 'Active' : (t1.status || t2.status || 'Active'),
    allocations: mergedAllocations,
  };
}

/**
 * Initialize storage with default seed data if empty
 */
export function initDatabase() {
  if (getStorage<School | null>(KEYS.SCHOOL, null) === null) setStorage(KEYS.SCHOOL, initialSchool);
  if (getStorage<string[] | null>(KEYS.GRADES, null) === null) setStorage(KEYS.GRADES, initialGrades);
  if (getStorage<Subject[] | null>(KEYS.SUBJECTS, null) === null) {
    setStorage(KEYS.SUBJECTS, initialSubjects.map(sanitizeSubject));
  } else {
    const storedSubjects = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    setStorage(KEYS.SUBJECTS, storedSubjects.map(sanitizeSubject));
  }
  if (getStorage<ClassStream[] | null>(KEYS.CLASSES, null) === null) setStorage(KEYS.CLASSES, initialClasses);
  if (getStorage<Teacher[] | null>(KEYS.TEACHERS, null) === null) setStorage(KEYS.TEACHERS, initialTeachers);
  if (getStorage<User[] | null>(KEYS.USERS, null) === null) setStorage(KEYS.USERS, initialUsers);
  if (getStorage<Student[] | null>(KEYS.STUDENTS, null) === null) setStorage(KEYS.STUDENTS, initialStudents);
  if (getStorage<Examination[] | null>(KEYS.EXAMS, null) === null) setStorage(KEYS.EXAMS, initialExaminations);
  if (getStorage<Mark[] | null>(KEYS.MARKS, null) === null) setStorage(KEYS.MARKS, initialMarks);
  if (getStorage<any[] | null>(KEYS.VERIFICATIONS, null) === null) setStorage(KEYS.VERIFICATIONS, []);
  if (getStorage<AcademicYear[] | null>(KEYS.ACADEMIC_YEARS, null) === null) setStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
  if (getStorage<SchoolTerm[] | null>(KEYS.SCHOOL_TERMS, null) === null) setStorage(KEYS.SCHOOL_TERMS, initialTerms);
  if (getStorage<LoginLog[] | null>(KEYS.LOGIN_LOGS, null) === null) setStorage(KEYS.LOGIN_LOGS, []);
  if (getStorage<SubjectGroup[] | null>(KEYS.SUBJECT_GROUPS, null) === null) setStorage(KEYS.SUBJECT_GROUPS, initialSubjectGroups);
}

// Ensure database is initialized
initDatabase();

export function isUUID(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function resolveSubjectUUID(client: SupabaseClient, alloc: any): Promise<string> {
  
  // 1. If subject_id is already a valid UUID, verify it exists in public.subjects
  if (isUUID(alloc.subject_id)) {
    const { data: sb } = await client.from('subjects').select('id').eq('id', alloc.subject_id).maybeSingle();
    if (sb) return sb.id;
  }

  let code = alloc.subject_code;
  let name = alloc.subject_name;

  // Search local storage KEYS.SUBJECTS or initialSubjects for a match
  const localSubjects = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
  const matchedLocal = localSubjects.find(s => s.id === alloc.subject_id || s.subject_code === alloc.subject_id || s.subject_name === alloc.subject_id);
  if (matchedLocal) {
    if (isUUID(matchedLocal.id)) {
      const { data: sb } = await client.from('subjects').select('id').eq('id', matchedLocal.id).maybeSingle();
      if (sb) return sb.id;
    }
    code = code || matchedLocal.subject_code;
    name = name || matchedLocal.subject_name;
  }

  // Fallback if alloc.subject_id is string like sb_mat
  if (alloc.subject_id && typeof alloc.subject_id === 'string' && !code && !name) {
    const cleanId = alloc.subject_id.replace(/^sb_/, '').replace(/_/g, ' ');
    name = cleanId;
  }

  // Query database subjects by code or name
  if (code || name) {
    let query = client.from('subjects').select('id, subject_code, subject_name');
    if (code && name) {
      query = query.or(`subject_code.eq.${code},subject_name.ilike.${name}`);
    } else if (code) {
      query = query.eq('subject_code', code);
    } else if (name) {
      query = query.ilike('subject_name', name);
    }
    const { data: matches } = await query;
    if (matches && matches.length > 0) {
      return matches[0].id;
    }
  }

  // Fallback: search all subjects in DB
  const { data: allSubjects } = await client.from('subjects').select('id, subject_code, subject_name');
  if (allSubjects && allSubjects.length > 0) {
    const targetStr = (alloc.subject_id || name || code || '').toLowerCase();
    const found = allSubjects.find((s: any) => 
      s.id === alloc.subject_id || 
      (s.subject_code && s.subject_code.toLowerCase() === targetStr) ||
      (s.subject_name && s.subject_name.toLowerCase() === targetStr) ||
      (name && s.subject_name && s.subject_name.toLowerCase().includes(name.toLowerCase())) ||
      (code && s.subject_code && s.subject_code.toLowerCase().includes(code.toLowerCase()))
    );
    if (found) return found.id;
  }

  throw new Error(`Unable to resolve database subject UUID for learning area "${alloc.subject_name || alloc.subject_code || alloc.subject_id}".`);
}

async function resolveClassAndStreamUUIDs(client: SupabaseClient, alloc: any): Promise<{ class_id: string | null; stream_id: string | null }> {
  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  
  let resolvedClassId: string | null = null;
  let resolvedStreamId: string | null = null;

  const rawClassId = alloc.class_id || alloc.stream_id;
  const rawStreamId = alloc.stream_id;

  if (isUUID(rawStreamId)) {
    const { data: strmData } = await client.from('streams').select('id, class_id').eq('id', rawStreamId).maybeSingle();
    if (strmData) {
      resolvedStreamId = strmData.id;
      resolvedClassId = strmData.class_id;
    }
  }

  if (!resolvedClassId && isUUID(rawClassId)) {
    const { data: clsData } = await client.from('classes').select('id').eq('id', rawClassId).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
    } else {
      const { data: strmData } = await client.from('streams').select('id, class_id').eq('id', rawClassId).maybeSingle();
      if (strmData) {
        resolvedStreamId = strmData.id;
        resolvedClassId = strmData.class_id;
      }
    }
  }

  if (!resolvedClassId) {
    const localClasses = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    const matchedClassObj = localClasses.find(c => c.id === rawClassId || c.id === rawStreamId || (c.class_name === alloc.class_name && c.stream === alloc.stream));
    if (matchedClassObj) {
      if (isUUID(matchedClassObj.id)) {
        const { data: strm } = await client.from('streams').select('id, class_id').eq('id', matchedClassObj.id).maybeSingle();
        if (strm) {
          resolvedStreamId = strm.id;
          resolvedClassId = strm.class_id;
        } else {
          const { data: cls } = await client.from('classes').select('id').eq('id', matchedClassObj.id).maybeSingle();
          if (cls) resolvedClassId = cls.id;
        }
      }

      if (!resolvedClassId && matchedClassObj.class_name) {
        const { data: clsData } = await client.from('classes').select('id').ilike('class_name', matchedClassObj.class_name).maybeSingle();
        if (clsData) {
          resolvedClassId = clsData.id;
          if (matchedClassObj.stream) {
            const { data: strmData } = await client.from('streams').select('id').eq('class_id', resolvedClassId).ilike('stream_name', matchedClassObj.stream).maybeSingle();
            if (strmData) resolvedStreamId = strmData.id;
          }
        }
      }
    }
  }

  if (!resolvedClassId && alloc.class_name) {
    const { data: clsData } = await client.from('classes').select('id').ilike('class_name', alloc.class_name).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
      if (alloc.stream) {
        const { data: strmData } = await client.from('streams').select('id').eq('class_id', resolvedClassId).ilike('stream_name', alloc.stream).maybeSingle();
        if (strmData) resolvedStreamId = strmData.id;
      }
    }
  }

  return { class_id: resolvedClassId, stream_id: resolvedStreamId };
}

export const api = {
  // --- SCHOOL ---
  getSchool: (): School => getStorage(KEYS.SCHOOL, initialSchool),
  updateSchool: async (school: School): Promise<School> => {
    setStorage(KEYS.SCHOOL, school);
    const client = createSupabaseClient();
    if (client) {
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(school.id);

        const postalVal = school.postal_code || school.address || '';
        const payload: any = {
          school_name: school.school_name || '',
          motto: school.motto || '',
          county: school.county || '',
          address: postalVal,
          email: school.email || '',
          updated_at: new Date().toISOString(),
        };

        // Check if a row already exists in school_profile table
        const { data: existing } = await client.from('school_profile').select('id').limit(1);

        if (existing && existing.length > 0) {
          const targetId = existing[0].id;
          const { data, error } = await client
            .from('school_profile')
            .update(payload)
            .eq('id', targetId)
            .select('*');

          if (error) {
            console.warn('Could not update school profile in Supabase:', error.message);
          } else if (data && data.length > 0) {
            const updatedSchool: School = { ...school, id: data[0].id };
            setStorage(KEYS.SCHOOL, updatedSchool);
            return updatedSchool;
          }
        } else {
          if (isValidUUID) {
            payload.id = school.id;
          }
          const { data, error } = await client
            .from('school_profile')
            .insert([payload])
            .select('*');

          if (error) {
            console.warn('Could not insert school profile into Supabase:', error.message);
          } else if (data && data.length > 0) {
            const insertedSchool: School = { ...school, id: data[0].id };
            setStorage(KEYS.SCHOOL, insertedSchool);
            return insertedSchool;
          }
        }
      } catch (err: any) {
        console.warn('Unexpected error updating school profile in Supabase:', err?.message || err);
      }
    }
    return school;
  },

  // --- USERS & AUTH ---
  getCurrentUser: (): User | null => {
    const raw = getStorage<User | null>(KEYS.CURRENT_USER, null);
    if (!raw) return null;
    const clean = sanitizeUser(raw);
    if (clean.name !== raw.name) {
      setStorage(KEYS.CURRENT_USER, clean);
    }
    return clean;
  },
  setCurrentUser: (user: User | null): User | null => {
    const clean = user ? sanitizeUser(user) : null;
    if (clean) {
      setStorage(KEYS.CURRENT_USER, clean);
    } else {
      setStorage(KEYS.CURRENT_USER, null);
    }
    return clean;
  },
  getUsers: (): User[] => {
    const users = getStorage(KEYS.USERS, initialUsers);
    let changed = false;
    const filtered = users.filter((u) => u && !isBlacklistedTestEmail(u.email));
    if (filtered.length !== users.length) changed = true;
    const cleanUsers = filtered.map((u) => {
      const clean = sanitizeUser(u);
      if (clean.name !== u.name) changed = true;
      return clean;
    });
    if (changed) {
      setStorage(KEYS.USERS, cleanUsers);
    }
    return cleanUsers;
  },
  syncUsersFromDatabase: (userData: any[]): void => {
    if (!userData || !Array.isArray(userData) || userData.length === 0) return;
    const existing = getStorage<User[]>(KEYS.USERS, initialUsers);
    const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();

    const mappedDBUsers: User[] = userData
      .filter((u: any) => {
        if (!u) return false;
        if (isBlacklistedTestEmail(u?.email)) return false;
        if (u.teacher_id && (delIds.has(u.teacher_id) || delIds.has(u.teacher_id.toLowerCase()))) return false;
        if (u.id && (delIds.has(u.id) || delIds.has(u.id.toLowerCase()))) return false;
        if (u.email && delEmails.has(u.email.trim().toLowerCase())) return false;
        return true;
      })
      .map((u: any) => {
        const rawRole = (u.role || '').toLowerCase();
        let normalizedRole: Role = 'class_teacher';
        if (rawRole === 'admin') {
          normalizedRole = 'admin';
        } else if (rawRole === 'subject_teacher') {
          normalizedRole = 'subject_teacher';
        } else if (rawRole === 'class_teacher') {
          normalizedRole = 'class_teacher';
        } else if (rawRole === 'teacher') {
          const teachersList = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
          const email = (u.email || '').toLowerCase();
          const matchedT = teachersList.find((t) => t.email.toLowerCase() === email || t.id === u.teacher_id);
          normalizedRole = (matchedT?.is_class_teacher || Boolean(matchedT?.class_teacher_of_id)) ? 'class_teacher' : 'subject_teacher';
        } else {
          normalizedRole = u.role as Role;
        }

        return {
          id: u.id,
          name: u.name || u.email?.split('@')[0] || 'User',
          email: (u.email || '').toLowerCase(),
          role: normalizedRole,
          teacher_id: normalizedRole === 'admin' ? undefined : (u.teacher_id || undefined),
          student_id: u.student_id || undefined,
          status: u.status || 'Active',
          force_password_change: u.force_password_change ?? false,
        };
      });

    setStorage(KEYS.USERS, mappedDBUsers);
  },
  addUser: (user: User): User => {
    const users = getStorage<User[]>(KEYS.USERS, initialUsers);
    const updated = [...users, user];
    setStorage(KEYS.USERS, updated);
    return user;
  },
  updateUser: (user: User): User => {
    const users = getStorage<User[]>(KEYS.USERS, initialUsers);
    const updated = users.map((u) =>
      u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
        ? { ...u, ...user }
        : u
    );
    setStorage(KEYS.USERS, updated);
    return user;
  },
  deleteUser: (idOrEmail: string): void => {
    const users = getStorage<User[]>(KEYS.USERS, initialUsers);
    const updated = users.filter(
      (u) =>
        u.id !== idOrEmail &&
        u.email.toLowerCase() !== idOrEmail.toLowerCase() &&
        u.teacher_id !== idOrEmail &&
        u.student_id !== idOrEmail
    );
    setStorage(KEYS.USERS, updated);
  },

  // --- LOGIN LOGS ---
  getLoginLogs: (filterQuery?: string): LoginLog[] => {
    const logs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
    if (!filterQuery) return logs;
    const q = filterQuery.toLowerCase();
    return logs.filter(
      (l) =>
        (l.user_id && l.user_id.toLowerCase() === q) ||
        (l.email && l.email.toLowerCase() === q) ||
        (l.user_name && l.user_name.toLowerCase().includes(q))
    );
  },
  addLoginLog: (log: LoginLog): LoginLog => {
    const logs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
    const updated = [log, ...logs];
    setStorage(KEYS.LOGIN_LOGS, updated);
    return log;
  },

  // --- CLASSES ---
  getClasses: (): ClassStream[] => {
    const raw = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    return sortClasses(raw.map(sanitizeClass));
  },
  addClass: (cls: ClassStream): ClassStream => {
    const clean = sanitizeClass(cls);
    const list = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses).map(sanitizeClass);
    const existingIndex = list.findIndex(
      (c) => c.id === clean.id || (c.class_name === clean.class_name && c.stream.toLowerCase() === clean.stream.toLowerCase())
    );
    let updated: ClassStream[];
    if (existingIndex >= 0) {
      updated = list.map((c, idx) => (idx === existingIndex ? clean : c));
    } else {
      updated = [...list, clean];
    }
    setStorage(KEYS.CLASSES, updated);
    if (clean.class_teacher_id) {
      api.updateClass(clean);
    } else {
      syncClassToSupabase(clean);
    }
    return clean;
  },
  updateClass: (cls: ClassStream): ClassStream => {
    const clean = sanitizeClass(cls);
    const list = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses).map(sanitizeClass);
    const updated = list.map((c) => (c.id === clean.id ? clean : c));
    setStorage(KEYS.CLASSES, updated);

    // Synchronize Teachers list
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
    let teachersChanged = false;
    const updatedTeachers = teachers.map((t) => {
      if (clean.class_teacher_id && t.id === clean.class_teacher_id) {
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: true,
          class_teacher_of_id: clean.id,
        };
      } else if (t.class_teacher_of_id === clean.id && t.id !== clean.class_teacher_id) {
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: false,
          class_teacher_of_id: undefined,
        };
      }
      return t;
    });

    if (teachersChanged) {
      setStorage(KEYS.TEACHERS, updatedTeachers);
    }

    syncClassToSupabase(clean);

    return clean;
  },
  deleteClass: (id: string): void => {
    const list = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    const target = list.find((c) => c.id === id);
    const updated = list.filter((c) => c.id !== id);
    setStorage(KEYS.CLASSES, updated);

    // Unassign class teacher and remove allocations if class is deleted
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
    let teachersChanged = false;
    const updatedTeachers = teachers.map((t) => {
      let changed = false;
      const newAllocations = (t.allocations || []).filter(a => a.class_id !== id);
      if (newAllocations.length !== (t.allocations || []).length) {
        changed = true;
      }
      if (t.class_teacher_of_id === id) {
        changed = true;
        return {
          ...t,
          is_class_teacher: false,
          class_teacher_of_id: undefined,
          allocations: newAllocations,
        };
      }
      if (changed) {
        return { ...t, allocations: newAllocations };
      }
      return t;
    });
    if (teachersChanged) {
      setStorage(KEYS.TEACHERS, updatedTeachers);
    }

    if (target) {
      syncClassToSupabase(target, true);
    }
  },

  // --- SUBJECTS ---
  getSubjects: (): Subject[] => {
    const raw = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    let hasChanges = false;
    const sanitized = raw.map((s) => {
      const clean = sanitizeSubject(s);
      if (clean.subject_code !== s.subject_code || clean.subject_name !== s.subject_name) {
        hasChanges = true;
      }
      return clean;
    });
    if (hasChanges) {
      setStorage(KEYS.SUBJECTS, sanitized);
    }
    return sanitized;
  },
  getSubjectsForGrade: (grade: string): Subject[] => {
    const all = api.getSubjects();
    return getApplicableSubjectsForGrade(grade, all);
  },
  getSubjectsForClass: (classStream: ClassStream | undefined): Subject[] => {
    const all = api.getSubjects();
    return getAllocatedSubjectsForClass(classStream, all);
  },
  getSubjectsForLevel: (level: EducationLevel): Subject[] => {
    const all = api.getSubjects();
    return all.filter((s) => s.status !== 'Archived' && s.education_level === level);
  },
  addSubject: (sb: Subject): Subject => {
    const cleanSb = sanitizeSubject(sb);
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    const updated = [...list, cleanSb];
    setStorage(KEYS.SUBJECTS, updated);
    return cleanSb;
  },
  updateSubject: (sb: Subject): Subject => {
    const cleanSb = sanitizeSubject(sb);
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    const updated = list.map((s) => (s.id === cleanSb.id ? cleanSb : s));
    setStorage(KEYS.SUBJECTS, updated);
    return cleanSb;
  },
  isSubjectInUse: (id: string): boolean => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    const target = list.find((s) => s.id === id);
    if (target && isStandardSubject(target)) return true;

    // 1. Check marks
    const marks = getStorage<Mark[]>(KEYS.MARKS, initialMarks);
    if (marks.some((m) => m && (m.subject_id === id || (target && (m.subject_id === target.subject_code || m.subject_id === target.subject_name))))) return true;

    // 2. Check classes (allocated_subject_ids)
    const classes = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    if (
      classes.some((c) => {
        if (!c) return false;
        if (c.allocated_subject_ids && (c.allocated_subject_ids.includes(id) || (target && (c.allocated_subject_ids.includes(target.subject_code) || c.allocated_subject_ids.includes(target.subject_name))))) return true;
        return false;
      })
    ) {
      return true;
    }

    // 3. Check teachers allocations
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
    if (
      teachers.some(
        (t) => t && t.allocations && t.allocations.some((a) => a && (a.subject_id === id || (target && (a.subject_id === target.subject_code || a.subject_id === target.subject_name))))
      )
    ) {
      return true;
    }

    // 4. Check subject groups
    const groups = getStorage<SubjectGroup[]>(KEYS.SUBJECT_GROUPS, initialSubjectGroups);
    if (groups.some((g) => g && g.subject_ids && (g.subject_ids.includes(id) || (target && (g.subject_ids.includes(target.subject_code) || g.subject_ids.includes(target.subject_name)))))) return true;

    return false;
  },
  deactivateSubject: (id: string): void => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    const updated = list.map((s) => (s.id === id ? { ...s, status: 'Archived' as const } : s));
    setStorage(KEYS.SUBJECTS, updated);
  },
  restoreSubject: (id: string): void => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    const updated = list.map((s) => (s.id === id ? { ...s, status: 'Active' as const } : s));
    setStorage(KEYS.SUBJECTS, updated);
  },
  deleteSubject: (id: string): { success: boolean; deactivated: boolean } => {
    const list = getStorage<Subject[]>(KEYS.SUBJECTS, initialSubjects);
    const target = list.find((s) => s.id === id);
    if ((target && isStandardSubject(target)) || api.isSubjectInUse(id)) {
      api.deactivateSubject(id);
      return { success: true, deactivated: true };
    }
    const updated = list.filter((s) => s.id !== id);
    setStorage(KEYS.SUBJECTS, updated);
    return { success: true, deactivated: false };
  },

  // --- SUBJECT GROUPS (Upper Primary) ---
  getSubjectGroups: (): SubjectGroup[] => {
    return getStorage<SubjectGroup[]>(KEYS.SUBJECT_GROUPS, initialSubjectGroups);
  },
  addSubjectGroup: (grp: SubjectGroup): SubjectGroup => {
    const list = getStorage<SubjectGroup[]>(KEYS.SUBJECT_GROUPS, initialSubjectGroups);
    const updated = [...list, grp];
    setStorage(KEYS.SUBJECT_GROUPS, updated);
    return grp;
  },
  updateSubjectGroup: (grp: SubjectGroup): SubjectGroup => {
    const list = getStorage<SubjectGroup[]>(KEYS.SUBJECT_GROUPS, initialSubjectGroups);
    const updated = list.map((g) => (g.id === grp.id ? grp : g));
    setStorage(KEYS.SUBJECT_GROUPS, updated);
    return grp;
  },
  deleteSubjectGroup: (id: string): void => {
    const list = getStorage<SubjectGroup[]>(KEYS.SUBJECT_GROUPS, initialSubjectGroups);
    const updated = list.filter((g) => g.id !== id);
    setStorage(KEYS.SUBJECT_GROUPS, updated);
  },

  // --- TEACHERS ---
  getTeachers: (): Teacher[] => {
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
    const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();
    const clean = teachers.filter(
      (t) =>
        t &&
        !isBlacklistedTestEmail(t.email) &&
        !delIds.has(t.id) &&
        (!t.id || !delIds.has(t.id.toLowerCase())) &&
        (!t.email || !delEmails.has(t.email.trim().toLowerCase()))
    );

    const uniqueTeachers: Teacher[] = [];
    for (const t of clean) {
      const existingIdx = uniqueTeachers.findIndex((ex) => areTeachersSamePerson(ex, t));
      if (existingIdx >= 0) {
        uniqueTeachers[existingIdx] = mergeTeacherObjects(uniqueTeachers[existingIdx], t);
      } else {
        uniqueTeachers.push(t);
      }
    }

    if (uniqueTeachers.length !== teachers.length) {
      setStorage(KEYS.TEACHERS, uniqueTeachers);
    }
    return uniqueTeachers;
  },
  
  deduplicateTeachersAndUsers: (): void => {
    const teachers = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers).filter((t) => t && !isBlacklistedTestEmail(t.email));
    const users = getStorage<User[]>(KEYS.USERS, initialUsers).filter((u) => u && !isBlacklistedTestEmail(u.email));
    
    // Deduplicate teachers
    const uniqueTeachers: Teacher[] = [];
    let teachersChanged = false;
    
    for (const tch of teachers) {
      const existingIdx = uniqueTeachers.findIndex((ex) => areTeachersSamePerson(ex, tch));
      if (existingIdx >= 0) {
        teachersChanged = true;
        const existing = uniqueTeachers[existingIdx];
        const merged = mergeTeacherObjects(existing, tch);
        const redundantId = tch.id === merged.id ? existing.id : tch.id;
        uniqueTeachers[existingIdx] = merged;

        // Update any users pointing to redundant teacher ID
        if (redundantId && redundantId !== merged.id) {
          const currentUsersList = getStorage<User[]>(KEYS.USERS, initialUsers);
          let usersChangedForTeacher = false;
          const updatedUsers = currentUsersList.map((u) => {
            if (u.teacher_id === redundantId) {
              usersChangedForTeacher = true;
              return { ...u, teacher_id: merged.id };
            }
            return u;
          });
          if (usersChangedForTeacher) {
            setStorage(KEYS.USERS, updatedUsers);
          }
        }
      } else {
        uniqueTeachers.push(tch);
      }
    }
    
    if (teachersChanged || teachers.length !== uniqueTeachers.length) {
      setStorage(KEYS.TEACHERS, uniqueTeachers);
    }
    
    // Deduplicate users (teachers)
    const uniqueUsersMap = new Map<string, User>();
    let usersChanged = false;
    const currentUsers = getStorage<User[]>(KEYS.USERS, initialUsers);
    
    for (const u of currentUsers) {
      const key = (u.email || '').trim().toLowerCase();
      if (uniqueUsersMap.has(key)) {
        usersChanged = true;
        const existing = uniqueUsersMap.get(key)!;
        uniqueUsersMap.set(key, existing);
      } else {
        uniqueUsersMap.set(key, u);
      }
    }
    
    if (usersChanged || currentUsers.length !== uniqueUsersMap.size) {
      setStorage(KEYS.USERS, Array.from(uniqueUsersMap.values()));
    }
  },

  addTeacher: (tch: Teacher, authUserId?: string): Teacher => {
    removeDeletedTeacherIdentifier(tch.id, tch.email, tch.user_id, authUserId);
    const list = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
    const emailLower = tch.email ? tch.email.trim().toLowerCase() : '';

    const existingIndex = list.findIndex((t) => areTeachersSamePerson(t, tch));

    let updated: Teacher[];
    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      list[existingIndex] = mergeTeacherObjects(existing, tch);
      updated = list;
    } else {
      updated = [...list, tch];
    }
    setStorage(KEYS.TEACHERS, updated);

    // Create or sync corresponding user account for teacher
    const users = getStorage<User[]>(KEYS.USERS, initialUsers);
    const existingUserIndex = users.findIndex((u) => u.teacher_id === tch.id || (emailLower && u.email.toLowerCase() === emailLower));
    const userPayload: User = {
      id: authUserId || (existingUserIndex >= 0 ? users[existingUserIndex].id : (isUUID(tch.id) ? tch.id : generateUUID())),
      name: tch.teacher_name,
      email: tch.email,
      role: tch.is_class_teacher ? 'class_teacher' : 'subject_teacher',
      teacher_id: tch.id,
      phone: tch.phone,
      username: tch.username,
      tsc_number: tch.tsc_number,
      status: tch.status || 'Active',
      force_password_change: tch.force_password_change ?? true,
      last_login: tch.last_login,
    };

    if (existingUserIndex >= 0) {
      users[existingUserIndex] = { ...users[existingUserIndex], ...userPayload };
      setStorage(KEYS.USERS, users);
    } else {
      setStorage(KEYS.USERS, [...users, userPayload]);
    }

    api.deduplicateTeachersAndUsers();
    return tch;
  },
  updateTeacher: async (tch: Teacher): Promise<Teacher> => {
    const targetEmailLower = tch.email ? tch.email.trim().toLowerCase() : '';

    // Synchronous, awaited Supabase database update FIRST if connected
    const client = getSupabaseClient();
    if (client) {
      let teacherUuid: string | null = isUUID(tch.id) ? tch.id : null;

      // 1. Resolve teacher's genuine UUID from Supabase if tch.id is non-UUID
      if (!teacherUuid && targetEmailLower) {
        try {
          const { data: dbMatch } = await client.from('teachers').select('id').eq('email', targetEmailLower).maybeSingle();
          if (dbMatch && isUUID(dbMatch.id)) {
            teacherUuid = dbMatch.id;
            tch.id = teacherUuid;
          }
        } catch (err) {
          console.warn('Could not lookup teacher UUID by email:', err);
        }
      }

      // If still not found in Supabase, insert teacher into Supabase to acquire UUID
      if (!teacherUuid && targetEmailLower) {
        try {
          const { data: insertedDb, error: insErr } = await client.from('teachers').insert([{
            teacher_name: tch.teacher_name,
            email: tch.email,
            phone: tch.phone,
            tsc_number: tch.tsc_number || null,
            is_class_teacher: tch.is_class_teacher || false,
          }]).select().single();

          if (insertedDb && isUUID(insertedDb.id)) {
            teacherUuid = insertedDb.id;
            tch.id = teacherUuid;
          } else if (insErr) {
            console.warn('Could not insert teacher into Supabase to acquire UUID:', insErr);
          }
        } catch (err) {
          console.warn('Error inserting teacher into Supabase:', err);
        }
      }

      if (teacherUuid && isUUID(teacherUuid)) {
        // Resolve allocation database UUIDs FIRST before updating records
        const rawInserts: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
        if (tch.allocations && tch.allocations.length > 0) {
          for (const alloc of tch.allocations) {
            const subjectUuid = await resolveSubjectUUID(client, alloc);
            const { class_id: classUuid, stream_id: streamUuid } = await resolveClassAndStreamUUIDs(client, alloc);

            if (subjectUuid) {
              rawInserts.push({
                subject_id: subjectUuid,
                class_id: classUuid,
                stream_id: streamUuid,
              });
            }
          }
        }

        // Deduplicate inserts
        const seenAllocationKeys = new Set<string>();
        const inserts: Array<{ subject_id: string; class_id: string | null; stream_id: string | null }> = [];
        for (const item of rawInserts) {
          const key = `${item.subject_id}_${item.class_id || 'null'}_${item.stream_id || 'null'}`;
          if (!seenAllocationKeys.has(key)) {
            seenAllocationKeys.add(key);
            inserts.push(item);
          }
        }

        // Update primary teacher record
        const { error: teacherErr } = await client.from('teachers').update({
          teacher_name: tch.teacher_name,
          email: tch.email,
          phone: tch.phone,
          tsc_number: tch.tsc_number || null,
          is_class_teacher: tch.is_class_teacher || false,
        }).eq('id', teacherUuid);

        if (teacherErr) {
          console.error('Supabase update teacher record error:', teacherErr);
          throw new Error(`Teacher details could not be saved: ${teacherErr.message}`);
        }

        if (targetEmailLower) {
          await client.from('users').update({
            name: tch.teacher_name,
            email: tch.email,
            role: tch.is_class_teacher ? 'class_teacher' : 'subject_teacher',
          }).or(`teacher_id.eq.${teacherUuid},email.eq.${targetEmailLower}`);
        }

        // Unassign previous stream class_teacher_id in DB
        await client.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', teacherUuid);

        if (tch.is_class_teacher && tch.class_teacher_of_id) {
          if (isUUID(tch.class_teacher_of_id)) {
            await client.from('streams').update({ class_teacher_id: teacherUuid }).eq('id', tch.class_teacher_of_id);
          }
        }

        // Atomic allocation update via RPC or fail-safe restoration
        const { error: rpcAllocErr } = await client.rpc('update_teacher_allocations_atomic', {
          p_teacher_id: teacherUuid,
          p_allocations: inserts,
        });

        if (rpcAllocErr) {
          if (rpcAllocErr.code === 'PGRST202') {
            const { data: existingAllocs } = await client
              .from('teacher_subjects')
              .select('subject_id, class_id, stream_id')
              .eq('teacher_id', teacherUuid);

            const { error: delAllocErr } = await client.from('teacher_subjects').delete().eq('teacher_id', teacherUuid);
            if (delAllocErr) {
              console.error('Supabase delete allocations error:', delAllocErr);
              throw new Error(`Teacher details could not be saved because existing allocations could not be updated: ${delAllocErr.message}`);
            }

            if (inserts.length > 0) {
              const fullInserts = inserts.map((i) => ({ teacher_id: teacherUuid, ...i }));
              const { error: insAllocErr } = await client.from('teacher_subjects').insert(fullInserts);
              if (insAllocErr) {
                console.error('Supabase insert allocations error, restoring original allocations:', insAllocErr);
                if (existingAllocs && existingAllocs.length > 0) {
                  await client.from('teacher_subjects').insert(existingAllocs.map((a: any) => ({ teacher_id: teacherUuid, ...a })));
                }
                throw new Error(`Teacher details could not be saved because the learning area allocation could not be stored: ${insAllocErr.message}`);
              }
            }
          } else {
            console.error('Supabase RPC update_teacher_allocations_atomic error:', rpcAllocErr);
            throw new Error(`Teacher details could not be saved because learning area allocations could not be updated: ${rpcAllocErr.message}`);
          }
        }
      }
    }

    // ONLY AFTER SUCCESSFUL DB UPDATE, commit to local state
    const list = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
    const updated = list.map((t) =>
      t.id === tch.id || (targetEmailLower && t.email && t.email.trim().toLowerCase() === targetEmailLower) ? { ...t, ...tch } : t
    );
    setStorage(KEYS.TEACHERS, updated);

    // Sync corresponding User object
    const users = getStorage<User[]>(KEYS.USERS, initialUsers);
    const userIndex = users.findIndex((u) => u.teacher_id === tch.id || (targetEmailLower && u.email.toLowerCase() === targetEmailLower));
    if (userIndex >= 0) {
      users[userIndex] = {
        ...users[userIndex],
        name: tch.teacher_name,
        email: tch.email,
        phone: tch.phone,
        username: tch.username,
        tsc_number: tch.tsc_number,
        status: tch.status,
        force_password_change: tch.force_password_change,
        last_login: tch.last_login || users[userIndex].last_login,
      };
      setStorage(KEYS.USERS, users);
    } else {
      const newUser: User = {
        id: isUUID(tch.id) ? tch.id : generateUUID(),
        name: tch.teacher_name,
        email: tch.email,
        role: tch.is_class_teacher ? 'class_teacher' : 'subject_teacher',
        teacher_id: tch.id,
        phone: tch.phone,
        username: tch.username,
        tsc_number: tch.tsc_number,
        status: tch.status || 'Active',
        force_password_change: tch.force_password_change ?? true,
        last_login: tch.last_login,
      };
      setStorage(KEYS.USERS, [...users, newUser]);
    }

    // Sync classes list if teacher is assigned or removed as class teacher
    const classesList = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    let classesChanged = false;

    const updatedClasses = classesList.map((c) => {
      if (tch.is_class_teacher && tch.class_teacher_of_id === c.id) {
        if (c.class_teacher_id !== tch.id) {
          classesChanged = true;
          return { ...c, class_teacher_id: tch.id };
        }
      } else if (c.class_teacher_id === tch.id && (!tch.is_class_teacher || tch.class_teacher_of_id !== c.id)) {
        classesChanged = true;
        return { ...c, class_teacher_id: undefined };
      }
      return c;
    });

    if (classesChanged) {
      setStorage(KEYS.CLASSES, updatedClasses);
    }

    api.deduplicateTeachersAndUsers();
    return tch;
  },
  deleteTeacher: (id: string): void => {
    const list = getStorage<Teacher[]>(KEYS.TEACHERS, initialTeachers);
    const target = list.find((t) => t.id === id || (t.email && t.email.toLowerCase() === id.toLowerCase()));

    recordDeletedTeacherIdentifier(id, target?.id, target?.email, target?.user_id);

    const targetEmailLower = target?.email ? target.email.trim().toLowerCase() : '';
    const updated = list.filter(
      (t) => t.id !== id && t.id !== target?.id && (!targetEmailLower || t.email.trim().toLowerCase() !== targetEmailLower)
    );
    setStorage(KEYS.TEACHERS, updated);

    // Remove corresponding user account(s)
    if (target) {
      if (target.email) api.deleteUser(target.email);
      if (target.user_id) api.deleteUser(target.user_id);
    }
    api.deleteUser(id);

    // Remove class teacher assignment from classes
    const classesList = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    let classesChanged = false;
    const updatedClasses = classesList.map((c) => {
      if (c.class_teacher_id === id || (target && c.class_teacher_id === target.id)) {
        classesChanged = true;
        return { ...c, class_teacher_id: undefined };
      }
      return c;
    });
    if (classesChanged) {
      setStorage(KEYS.CLASSES, updatedClasses);
    }

    // Trigger asynchronous Supabase database deletion if connected
    const client = getSupabaseClient();
    if (client) {
      const deleteId = target?.id || id;
      (async () => {
        try {
          let deleteUuid: string | null = isUUID(deleteId) ? deleteId : null;
          if (!deleteUuid && targetEmailLower) {
            const { data: dbMatch } = await client.from('teachers').select('id').eq('email', targetEmailLower).maybeSingle();
            if (dbMatch && isUUID(dbMatch.id)) {
              deleteUuid = dbMatch.id;
            }
          }

          if (deleteUuid && isUUID(deleteUuid)) {
            await client.from('teacher_subjects').delete().eq('teacher_id', deleteUuid);
            await client.from('streams').update({ class_teacher_id: null }).eq('class_teacher_id', deleteUuid);
            await client.from('teachers').delete().eq('id', deleteUuid);
            await client.from('users').delete().eq('teacher_id', deleteUuid);
          }
          if (targetEmailLower) {
            await client.from('teachers').delete().eq('email', targetEmailLower);
            await client.from('users').delete().eq('email', targetEmailLower);
          }
          if (target?.user_id && isUUID(target.user_id)) {
            await client.from('users').delete().eq('id', target.user_id);
          }
        } catch (err) {
          console.warn('Supabase deleteTeacher async error:', err);
        }
      })();
    }
    api.deduplicateTeachersAndUsers();
  },

  // --- STUDENTS ---
  getStudents: (): Student[] => {
    return getStorage<Student[]>(KEYS.STUDENTS, initialStudents);
  },

  getAllStudentsForMarks: (): Student[] => {
    const primaryList = api.getStudents();
    const allocatedList = getStorage<Student[]>(KEYS.ALLOCATED_STUDENTS, []);
    
    // Merge primary and allocated lists, avoiding duplicates
    const allStudentsMap = new Map<string, Student>();
    primaryList.forEach(s => allStudentsMap.set(s.id, s));
    allocatedList.forEach(s => allStudentsMap.set(s.id, s));
    
    return Array.from(allStudentsMap.values());
  },
  addStudent: async (std: Student): Promise<Student> => {
    const client = getSupabaseClient();
    if (client) {
      const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await resolveStudentClassAndStreamUuids(std.class_id || std.stream_id || '', client);
      const payload = {
        admission_number: std.admission_number,
        full_name: getStudentFullName(std) || std.full_name,
        gender: (std.gender === 'M' || (std.gender as string) === 'Boy' || (std.gender as string) === 'Male') ? 'M' : 'F',
        class_id: targetClassUuid,
        stream_id: targetStreamUuid,
        dob: std.dob || null,
        active: std.active ?? true,
      };

      const { data, error } = await client.from('students').insert([payload]).select('*');
      if (error) {
        console.error('Supabase addStudent error:', error);
        throw new Error(`Failed to register learner in database: ${error.message}`);
      }

      if (data && data[0]) {
        const created = data[0];
        const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
        const matchedClass = currentClasses.find((c) => c.id === created.stream_id || c.id === created.class_id);
        const grade = matchedClass ? (matchedClass.class_name as GradeName) : std.grade;
        const level = matchedClass ? matchedClass.education_level : std.education_level;

        const nameParts = (created.full_name || '').trim().split(/\s+/);
        const firstName = std.first_name || nameParts[0] || '';
        const lastName = std.last_name || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
        const secondName = std.second_name || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined);

        const newStudentObj: Student = {
          ...std,
          id: created.id,
          admission_number: created.admission_number,
          full_name: created.full_name,
          first_name: firstName,
          second_name: secondName,
          last_name: lastName,
          gender: (created.gender === 'M' || created.gender === 'Boy' || created.gender === 'Male') ? 'M' : 'F',
          class_id: created.stream_id || created.class_id || std.class_id,
          stream_id: created.stream_id || created.class_id || std.stream_id,
          active: created.active ?? true,
          grade: grade,
          education_level: level,
        };

        const list = getStorage<Student[]>(KEYS.STUDENTS, []);
        const updated = [...list.filter((s) => s.id !== newStudentObj.id), newStudentObj];
        setStorage(KEYS.STUDENTS, updated);
        return newStudentObj;
      }
    }

    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const updated = [...list, std];
    setStorage(KEYS.STUDENTS, updated);
    return std;
  },
  batchAddStudents: async (newStudents: Student[]): Promise<Student[]> => {
    const client = getSupabaseClient();
    if (client && newStudents.length > 0) {
      const payloads = [];
      for (const std of newStudents) {
        const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await resolveStudentClassAndStreamUuids(std.class_id || std.stream_id || '', client);
        payloads.push({
          admission_number: std.admission_number,
          full_name: getStudentFullName(std) || std.full_name,
          gender: (std.gender === 'M' || (std.gender as string) === 'Boy' || (std.gender as string) === 'Male') ? 'M' : 'F',
          class_id: targetClassUuid,
          stream_id: targetStreamUuid,
          dob: std.dob || null,
          active: std.active ?? true,
        });
      }

      const { data, error } = await client.from('students').insert(payloads).select('*');
      if (error) {
        console.error('Supabase batchAddStudents error:', error);
        throw new Error(`Failed to batch register learners in database: ${error.message}`);
      }

      if (data && data.length > 0) {
        const currentClasses = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
        const createdStudents: Student[] = data.map((created: any) => {
          const matchedClass = currentClasses.find((c) => c.id === created.stream_id || c.id === created.class_id);
          const grade = matchedClass ? (matchedClass.class_name as GradeName) : undefined;
          const level = matchedClass ? matchedClass.education_level : (grade ? getEducationLevelForGrade(grade) : undefined);

          const nameParts = (created.full_name || '').trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          const secondName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined;

          return {
            id: created.id,
            admission_number: created.admission_number,
            full_name: created.full_name,
            first_name: firstName,
            second_name: secondName,
            last_name: lastName,
            gender: (created.gender === 'M' || created.gender === 'Boy' || created.gender === 'Male') ? 'M' : 'F',
            class_id: created.stream_id || created.class_id || '',
            stream_id: created.stream_id || created.class_id || '',
            dob: created.dob || undefined,
            active: created.active ?? true,
            grade: grade,
            education_level: level,
          };
        });

        const list = getStorage<Student[]>(KEYS.STUDENTS, []);
        const createdIds = new Set(createdStudents.map((s) => s.id));
        const updated = [...list.filter((s) => !createdIds.has(s.id)), ...createdStudents];
        setStorage(KEYS.STUDENTS, updated);
        return createdStudents;
      }
    }

    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const updated = [...list, ...newStudents];
    setStorage(KEYS.STUDENTS, updated);
    return newStudents;
  },
  updateStudent: async (std: Student): Promise<Student> => {
    const client = getSupabaseClient();
    if (client && isUUID(std.id)) {
      const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await resolveStudentClassAndStreamUuids(std.class_id || std.stream_id || '', client);
      const payload = {
        admission_number: std.admission_number,
        full_name: getStudentFullName(std) || std.full_name,
        gender: (std.gender === 'M' || (std.gender as string) === 'Boy' || (std.gender as string) === 'Male') ? 'M' : 'F',
        class_id: targetClassUuid,
        stream_id: targetStreamUuid,
        dob: std.dob || null,
        active: std.active ?? true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await client.from('students').update(payload).eq('id', std.id);
      if (error) {
        console.error('Supabase updateStudent error:', error);
        throw new Error(`Failed to update learner in database: ${error.message}`);
      }
    }

    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const updated = list.map((s) => (s.id === std.id ? std : s));
    setStorage(KEYS.STUDENTS, updated);
    return std;
  },
  deleteStudent: async (id: string): Promise<void> => {
    const client = getSupabaseClient();
    if (client && isUUID(id)) {
      // Respect DB dependencies safely
      await client.from('marks').delete().eq('student_id', id);
      const { error } = await client.from('students').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteStudent error:', error);
        throw new Error(`Failed to delete learner from database: ${error.message}`);
      }
    }

    const list = getStorage<Student[]>(KEYS.STUDENTS, []);
    const updated = list.filter((s) => s.id !== id);
    setStorage(KEYS.STUDENTS, updated);
  },
  promoteStudents: (
    studentIds: string[],
    targetGrade: GradeName,
    targetClassId?: string,
    promotedBy?: string,
    fromYear?: number,
    fromTerm?: TermName,
    toYear?: number,
    toTerm?: TermName
  ): Student[] => {
    const students = getStorage<Student[]>(KEYS.STUDENTS, initialStudents);
    const classes = getStorage<ClassStream[]>(KEYS.CLASSES, initialClasses);
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    const dateStr = new Date().toISOString().slice(0, 10);
    const targetLevel = getEducationLevelForGrade(targetGrade);

    const fYear = fromYear ?? (activeAY ? activeAY.year : 2026);
    const fTerm = fromTerm ?? (activeTerm ? activeTerm.term_name : 'Term 3');
    const tYear = toYear ?? (fYear + 1);
    const tTerm = toTerm ?? 'Term 1';

    const updatedStudents = students.map((std) => {
      if (!studentIds.includes(std.id)) return std;

      const currentClass = classes.find((c) => c.id === std.class_id);
      const fromGrade = (std.grade || currentClass?.class_name || 'Grade 7') as GradeName;

      const promoRecord: LearnerPromotionRecord = {
        id: `prm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        student_id: std.id,
        from_grade: fromGrade,
        to_grade: targetGrade,
        from_class_id: std.class_id,
        to_class_id: targetClassId || std.class_id,
        academic_year_id: activeAY ? activeAY.id : undefined,
        date_promoted: dateStr,
        promoted_by: promotedBy || 'Admin',
        from_year: fYear,
        from_term: fTerm,
        to_year: tYear,
        to_term: tTerm,
      };

      const history = std.promotion_history || [];
      return {
        ...std,
        grade: targetGrade,
        education_level: targetLevel,
        class_id: targetClassId || std.class_id,
        stream_id: targetClassId || std.stream_id || std.class_id,
        promotion_history: [...history, promoRecord],
      };
    });

    setStorage(KEYS.STUDENTS, updatedStudents);
    return updatedStudents.filter((s) => studentIds.includes(s.id));
  },

  // --- EXAMINATIONS ---
  getExaminations: (): Examination[] => getStorage(KEYS.EXAMS, initialExaminations),
  addExamination: (ex: Examination): Examination => {
    const list = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);
    const updated = [ex, ...list];
    setStorage(KEYS.EXAMS, updated);
    return ex;
  },
  updateExaminationStatus: (
    examId: string,
    status: Examination['status'],
    currentUser?: User | null
  ): Examination => {
    const list = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);
    const targetExam = list.find((ex) => ex.id === examId);

    if (!targetExam) {
      throw new Error('Examination record not found.');
    }

    // SECURITY ENFORCEMENT: Reopening an approved examination requires Administrator role
    if (targetExam.status === 'Approved' && status !== 'Approved') {
      const actualRole = currentUser?.role;
      if (actualRole !== 'admin') {
        throw new Error('UNAUTHORIZED: Only an Administrator can reopen an approved examination.');
      }
    }

    let updatedExam: Examination | null = null;
    const updated = list.map((ex) => {
      if (ex.id === examId) {
        updatedExam = { ...ex, status };
        return updatedExam;
      }
      return ex;
    });
    setStorage(KEYS.EXAMS, updated);

    // Write Audit Log Record for Approval / Reopening
    try {
      if (targetExam.status !== status && (status === 'Approved' || targetExam.status === 'Approved')) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 8);
        const adminName = currentUser?.name || (currentUser as any)?.full_name || currentUser?.username || 'Administrator';
        const actionType = status === 'Approved' ? 'APPROVED & LOCKED EXAMINATION' : 'REOPENED EXAMINATION FOR MARKS ENTRY';

        const auditLog: LoginLog = {
          id: `log_exam_${status.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: currentUser?.id || 'admin',
          email: currentUser?.email || 'admin@school.ac.ke',
          user_name: adminName,
          role: currentUser?.role || 'admin',
          timestamp: now.toISOString(),
          date: dateStr,
          time: timeStr,
          ip_address: '127.0.0.1 (Internal System)',
          device: 'Web Client',
          browser: 'Secure Management Console',
          status: 'Success',
          reason: `${actionType}: "${targetExam.exam_name}" (ID: ${examId}) | Status transitioned from ${targetExam.status} to ${status} | Performed By: ${adminName} (${currentUser?.role || 'admin'})`,
        };

        const currentLogs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
        setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
      }
    } catch (e) {
      // ignore
    }

    return updatedExam || list[0];
  },

  deleteExamination: async (
    examId: string,
    currentUser?: User | null
  ): Promise<{
    success: boolean;
    examName: string;
    deletedMarksCount: number;
    affectedStudentsCount: number;
    message: string;
  }> => {
    const exams = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);
    const targetExam = exams.find((e) => e.id === examId);

    if (!targetExam) {
      throw new Error('Examination record not found.');
    }

    if (targetExam.status === 'Approved') {
      throw new Error(
        'Approved examinations are locked and cannot be deleted. Re-open the examination to Draft if corrections are required.'
      );
    }

    if (targetExam.status === ('Archived' as any)) {
      throw new Error(
        'Archived examinations cannot be deleted because they are historical records.'
      );
    }

    const marks = getStorage<Mark[]>(KEYS.MARKS, initialMarks);
    const deletedMarks = marks.filter((m) => m.exam_id === examId);
    const remainingMarks = marks.filter((m) => m.exam_id !== examId);

    const affectedStudentsSet = new Set(deletedMarks.map((m) => m.student_id));
    const deletedMarksCount = deletedMarks.length;
    const affectedStudentsCount = affectedStudentsSet.size;

    const remainingExams = exams.filter((e) => e.id !== examId);

    const verifications = getStorage<VerificationLog[]>(KEYS.VERIFICATIONS, []);
    const remainingVerifications = verifications.filter((v) => v.exam_id !== examId);

    // If Supabase client exists, attempt deletion from backend tables
    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUUID = uuidRegex.test(examId);

      if (isValidUUID) {
        const { error: mErr } = await client.from('marks').delete().eq('exam_id', examId);
        if (mErr && mErr.code !== '42P01' && mErr.code !== '22P02') {
          console.error('Database error deleting examination marks:', mErr);
          throw new Error(`Database error deleting examination marks: ${mErr.message}`);
        }

        const { error: rcErr } = await client.from('report_cards').delete().eq('exam_id', examId);
        if (rcErr && rcErr.code !== '42P01' && rcErr.code !== '22P02') {
          console.error('Database error deleting report cards:', rcErr);
        }

        const { error: mlErr } = await client.from('merit_lists').delete().eq('exam_id', examId);
        if (mlErr && mlErr.code !== '42P01' && mlErr.code !== '22P02') {
          console.error('Database error deleting merit lists:', mlErr);
        }

        const { error: esErr } = await client.from('examination_subjects').delete().eq('exam_id', examId);
        if (esErr && esErr.code !== '42P01' && esErr.code !== '22P02') {
          console.error('Database error deleting examination subjects:', esErr);
        }

        const { error: vErr } = await client.from('verifications').delete().eq('exam_id', examId);
        if (vErr && vErr.code !== '42P01' && vErr.code !== '22P02') {
          console.error('Database error deleting verifications:', vErr);
        }

        const { error: eErr } = await client.from('examinations').delete().eq('id', examId);
        if (eErr && eErr.code !== '42P01' && eErr.code !== '22P02') {
          console.error('Database error deleting examination:', eErr);
          throw new Error(`Database error deleting examination: ${eErr.message}`);
        }
      }
    }

    // Update localStorage records atomically
    setStorage(KEYS.EXAMS, remainingExams);
    setStorage(KEYS.MARKS, remainingMarks);
    setStorage(KEYS.VERIFICATIONS, remainingVerifications);

    // Clean report comments if present
    try {
      const commentsKey = 'cbe_report_comments';
      const comments = getStorage<LearnerReportComment[]>(commentsKey, []);
      if (comments && comments.length > 0) {
        const remainingComments = comments.filter((c) => c.exam_id !== examId);
        setStorage(commentsKey, remainingComments);
      }
    } catch (e) {
      // ignore
    }

    // Write Audit Log Record
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);
    const adminName = currentUser?.name || (currentUser as any)?.full_name || currentUser?.username || 'Administrator';

    const auditLog: LoginLog = {
      id: `log_del_exam_${Date.now()}`,
      user_id: currentUser?.id || 'admin',
      email: currentUser?.email || 'admin@school.ac.ke',
      user_name: adminName,
      role: currentUser?.role || 'admin',
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      ip_address: '127.0.0.1 (Internal System)',
      device: 'Web Client',
      browser: 'Secure Admin Console',
      status: 'Success',
      reason: `DELETED EXAMINATION: "${targetExam.exam_name}" (ID: ${examId}) | Marks Deleted: ${deletedMarksCount} | Learners Affected: ${affectedStudentsCount} | Performed By: ${adminName}`,
    };

    const currentLogs = getStorage<LoginLog[]>(KEYS.LOGIN_LOGS, []);
    setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);

    return {
      success: true,
      examName: targetExam.exam_name,
      deletedMarksCount,
      affectedStudentsCount,
      message: 'Examination deleted successfully.',
    };
  },

  // --- MARKS ---
  getMarks: (): Mark[] => getStorage(KEYS.MARKS, initialMarks),
  saveBulkMarks: (newMarks: Mark[], currentUser?: User | null): void => {
    const list = getStorage<Mark[]>(KEYS.MARKS, initialMarks);
    const exams = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);

    // Map existing marks and replace matching (student_id, subject_id, exam_id)
    const map = new Map<string, Mark>();
    list.forEach((m) => {
      const key = `${m.student_id}_${m.subject_id}_${m.exam_id}`;
      map.set(key, m);
    });

    // Check lock status for every mark being saved
    for (const m of newMarks) {
      const targetExam = exams.find((e) => e.id === m.exam_id);
      if (targetExam && targetExam.status === 'Approved') {
        throw new Error(
          `Cannot modify marks for approved examination "${targetExam.exam_name}". Examination is locked.`
        );
      }
    }

    newMarks.forEach((m) => {
      const key = `${m.student_id}_${m.subject_id}_${m.exam_id}`;
      map.set(key, m);
    });

    setStorage(KEYS.MARKS, Array.from(map.values()));
  },

  // --- GRADES ---
  getGrades: (): Grade[] => getStorage(KEYS.GRADES, initialGrades),
  updateGrades: (grades: Grade[]): Grade[] => {
    setStorage(KEYS.GRADES, grades);
    return grades;
  },

  // --- VERIFICATION LOGS ---
  getVerificationLogs: (examId?: string): VerificationLog[] => {
    const logs = getStorage<VerificationLog[]>(KEYS.VERIFICATIONS, []);
    if (examId) {
      return logs.filter((l) => l.exam_id === examId);
    }
    return logs;
  },
  addVerificationLog: (log: VerificationLog): VerificationLog => {
    const logs = getStorage<VerificationLog[]>(KEYS.VERIFICATIONS, []);
    const updated = [log, ...logs];
    setStorage(KEYS.VERIFICATIONS, updated);
    return log;
  },

  // --- ACADEMIC YEARS & TERMS ---
  getAcademicYears: (): AcademicYear[] => getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears),
  addAcademicYear: (ay: AcademicYear): AcademicYear => {
    const list = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    let updatedList = list;
    if (ay.status === 'Active') {
      updatedList = list.map((y) => ({ ...y, status: y.status === 'Active' ? ('Closed' as const) : y.status }));
    }
    const updated = [...updatedList, ay];
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return ay;
  },
  updateAcademicYear: (ay: AcademicYear): AcademicYear => {
    const list = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const updated = list.map((y) => {
      if (y.id === ay.id) {
        return ay;
      }
      if (ay.status === 'Active' && y.status === 'Active') {
        return { ...y, status: 'Closed' as const };
      }
      return y;
    });
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return ay;
  },
  setActiveAcademicYear: (id: string): AcademicYear => {
    const list = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    let targetYear: AcademicYear = list[0];
    const updated = list.map((y) => {
      if (y.id === id) {
        targetYear = { ...y, status: 'Active' as const, updated_at: new Date().toISOString() };
        return targetYear;
      }
      return { ...y, status: y.status === 'Active' ? ('Closed' as const) : y.status };
    });
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return targetYear;
  },
  getActiveAcademicYear: (): AcademicYear => {
    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const active = years.find((y) => y.status === 'Active');
    return active || years.find((y) => y.year === 2026) || years[0] || initialAcademicYears[1];
  },

  // --- SCHOOL TERMS ---
  getSchoolTerms: (academicYearId?: string): SchoolTerm[] => {
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    if (academicYearId) {
      return terms.filter((t) => t.academic_year_id === academicYearId || t.year.toString() === academicYearId);
    }
    return terms;
  },
  addSchoolTerm: (term: SchoolTerm): SchoolTerm => {
    const list = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    let updatedList = list;
    if (term.status === 'Active') {
      updatedList = list.map((t) =>
        t.academic_year_id === term.academic_year_id && t.status === 'Active'
          ? { ...t, status: 'Closed' as const }
          : t
      );
    }
    const updated = [...updatedList, term];
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return term;
  },
  updateSchoolTerm: (term: SchoolTerm): SchoolTerm => {
    const list = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const updated = list.map((t) => {
      if (t.id === term.id) {
        return term;
      }
      if (term.status === 'Active' && t.academic_year_id === term.academic_year_id && t.status === 'Active') {
        return { ...t, status: 'Closed' as const };
      }
      return t;
    });
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return term;
  },
  setActiveTerm: (termId: string): SchoolTerm => {
    const list = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const target = list.find((t) => t.id === termId);
    if (!target) return list[0];

    const updated = list.map((t) => {
      if (t.id === termId) {
        return { ...t, status: 'Active' as const, updated_at: new Date().toISOString() };
      }
      if (t.academic_year_id === target.academic_year_id && t.status === 'Active') {
        return { ...t, status: 'Closed' as const };
      }
      return t;
    });
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return { ...target, status: 'Active' };
  },
  getActiveTerm: (): SchoolTerm => {
    const activeYear = api.getActiveAcademicYear();
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const activeTerm =
      terms.find((t) => t.academic_year_id === activeYear.id && t.status === 'Active') ||
      terms.find((t) => t.year === activeYear.year && t.status === 'Active') ||
      terms.find((t) => t.status === 'Active') ||
      terms.find((t) => t.term_name === 'Term 2') ||
      terms[0];
    return activeTerm;
  },

  checkAcademicYearCanBeDeletedSync: (id: string): boolean => {
    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear || targetYear.status === 'Active') return false;

    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const linkedTerms = terms.filter((t) => t.academic_year_id === id || t.year === targetYear.year);
    if (linkedTerms.length > 0) return false;

    const exams = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);
    const linkedExams = exams.filter((e) => e.academic_year_id === id || e.year === targetYear.year);
    if (linkedExams.length > 0) return false;

    const students = getStorage<Student[]>(KEYS.STUDENTS, initialStudents);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) => p.academic_year_id === id || p.from_year === targetYear.year || p.to_year === targetYear.year
      )
    );
    if (hasStudentPromo) return false;

    return true;
  },

  checkAcademicYearCanBeDeleted: async (id: string): Promise<{ canDelete: boolean; reason?: string }> => {
    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear) {
      return { canDelete: false, reason: 'Academic year record not found.' };
    }
    if (targetYear.status === 'Active') {
      return { canDelete: false, reason: 'This academic year is currently ACTIVE and cannot be deleted.' };
    }

    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const linkedTerms = terms.filter((t) => t.academic_year_id === id || t.year === targetYear.year);
    if (linkedTerms.length > 0) {
      return { canDelete: false, reason: 'This academic year contains school terms and cannot be deleted.' };
    }

    const exams = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);
    const linkedExams = exams.filter((e) => e.academic_year_id === id || e.year === targetYear.year);
    if (linkedExams.length > 0) {
      return { canDelete: false, reason: 'This academic year contains academic records and cannot be deleted.' };
    }

    const students = getStorage<Student[]>(KEYS.STUDENTS, initialStudents);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) => p.academic_year_id === id || p.from_year === targetYear.year || p.to_year === targetYear.year
      )
    );
    if (hasStudentPromo) {
      return { canDelete: false, reason: 'This academic year contains academic records and cannot be deleted.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { data: dbExams, error: exErr } = await client
            .from('examinations')
            .select('id')
            .or(`academic_year_id.eq.${id},year.eq.${targetYear.year}`)
            .limit(1);
          if (!exErr && dbExams && dbExams.length > 0) {
            return { canDelete: false, reason: 'This academic year contains academic records and cannot be deleted.' };
          }
        } catch (err) {
          console.warn('Supabase check error for academic year:', err);
        }
      }
    }

    return { canDelete: true };
  },

  deleteAcademicYear: async (id: string): Promise<{ success: boolean; message: string }> => {
    const check = await api.checkAcademicYearCanBeDeleted(id);
    if (!check.canDelete) {
      return { success: false, message: check.reason || 'This academic year contains academic records and cannot be deleted.' };
    }

    const years = getStorage<AcademicYear[]>(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear) {
      return { success: false, message: 'Academic year record not found.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { error } = await client.from('academic_years').delete().eq('id', id);
          if (error && error.code !== '42P01' && error.code !== '22P02') {
            console.error('Database error deleting academic year:', error);
            return { success: false, message: `Database error deleting academic year: ${error.message}` };
          }
        } catch (err: any) {
          console.warn('Supabase delete academic year error:', err);
        }
      }
    }

    const updated = years.filter((y) => y.id !== id);
    setStorage(KEYS.ACADEMIC_YEARS, updated);

    return { success: true, message: `Academic Year ${targetYear.year} deleted successfully.` };
  },

  checkSchoolTermCanBeDeletedSync: (id: string): boolean => {
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm || targetTerm.status === 'Active' || targetTerm.status === 'Archived') return false;

    const exams = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);
    const linkedExams = exams.filter(
      (e) =>
        e.term_id === id ||
        (e.term === targetTerm.term_name && (e.academic_year_id === targetTerm.academic_year_id || e.year === targetTerm.year))
    );
    if (linkedExams.length > 0) return false;

    const students = getStorage<Student[]>(KEYS.STUDENTS, initialStudents);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) =>
          (p.from_term === targetTerm.term_name && p.from_year === targetTerm.year) ||
          (p.to_term === targetTerm.term_name && p.to_year === targetTerm.year)
      )
    );
    if (hasStudentPromo) return false;

    return true;
  },

  checkSchoolTermCanBeDeleted: async (id: string): Promise<{ canDelete: boolean; reason?: string }> => {
    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm) {
      return { canDelete: false, reason: 'Term record not found.' };
    }
    if (targetTerm.status === 'Active') {
      return { canDelete: false, reason: 'This term is currently ACTIVE and cannot be deleted.' };
    }
    if (targetTerm.status === 'Archived') {
      return { canDelete: false, reason: 'Archived terms cannot be directly deleted.' };
    }

    const exams = getStorage<Examination[]>(KEYS.EXAMS, initialExaminations);
    const linkedExams = exams.filter(
      (e) =>
        e.term_id === id ||
        (e.term === targetTerm.term_name && (e.academic_year_id === targetTerm.academic_year_id || e.year === targetTerm.year))
    );
    if (linkedExams.length > 0) {
      return { canDelete: false, reason: 'This term contains academic records and cannot be deleted.' };
    }

    const students = getStorage<Student[]>(KEYS.STUDENTS, initialStudents);
    const hasStudentPromo = students.some((s) =>
      s.promotion_history?.some(
        (p) =>
          (p.from_term === targetTerm.term_name && p.from_year === targetTerm.year) ||
          (p.to_term === targetTerm.term_name && p.to_year === targetTerm.year)
      )
    );
    if (hasStudentPromo) {
      return { canDelete: false, reason: 'This term contains academic records and cannot be deleted.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { data: dbExams, error: exErr } = await client
            .from('examinations')
            .select('id')
            .eq('term_id', id)
            .limit(1);
          if (!exErr && dbExams && dbExams.length > 0) {
            return { canDelete: false, reason: 'This term contains academic records and cannot be deleted.' };
          }
        } catch (err) {
          console.warn('Supabase check error for term:', err);
        }
      }
    }

    return { canDelete: true };
  },

  deleteSchoolTerm: async (id: string): Promise<{ success: boolean; message: string }> => {
    const check = await api.checkSchoolTermCanBeDeleted(id);
    if (!check.canDelete) {
      return { success: false, message: check.reason || 'This term contains academic records and cannot be deleted.' };
    }

    const terms = getStorage<SchoolTerm[]>(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm) {
      return { success: false, message: 'Term record not found.' };
    }

    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { error } = await client.from('school_terms').delete().eq('id', id);
          if (error && error.code !== '42P01' && error.code !== '22P02') {
            console.error('Database error deleting school term:', error);
            return { success: false, message: `Database error deleting school term: ${error.message}` };
          }
        } catch (err: any) {
          console.warn('Supabase delete school term error:', err);
        }
      }
    }

    const updated = terms.filter((t) => t.id !== id);
    setStorage(KEYS.SCHOOL_TERMS, updated);

    return { success: true, message: `${targetTerm.term_name} (${targetTerm.year}) deleted successfully.` };
  },

  // --- RESET ALL DATA ---
  resetToDefaultSeed: (): void => {
    Object.keys(memoryStorage).forEach((key) => delete memoryStorage[key]);
    initDatabase();
  },
};

export const db = api;
