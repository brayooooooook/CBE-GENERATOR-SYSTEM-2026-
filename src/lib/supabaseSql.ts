// CBE GENERATOR SYSTEM - SPLIT POSTGRESQL SCHEMAS

// Part 1: Base Core Entities
export const SUPABASE_PART1 = `-- PART 1: EXTENSIONS & BASE ENTITIES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SCHOOL PROFILE
CREATE TABLE IF NOT EXISTS public.school_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name TEXT NOT NULL,
  county TEXT NOT NULL,
  address TEXT,
  email TEXT,
  motto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'class_teacher', 'subject_teacher')),
  teacher_id UUID,
  student_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ADMINISTRATORS
CREATE TABLE IF NOT EXISTS public.administrators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  designation TEXT DEFAULT 'Administrator',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name TEXT NOT NULL,
  grade_level INTEGER NOT NULL DEFAULT 7,
  capacity INTEGER DEFAULT 40,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`;

// Part 2: Staff, Students, Streams & Subjects
export const SUPABASE_PART2 = `-- PART 2: STAFF, ACADEMIC STRUCTURE & STUDENTS

-- 5. TEACHERS
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  teacher_name TEXT NOT NULL,
  tsc_number TEXT UNIQUE,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  is_class_teacher BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. STREAMS
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_name TEXT NOT NULL,
  class_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  capacity INTEGER DEFAULT 40,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender CHAR(1) CHECK (gender IN ('M', 'F')),
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  dob DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. SUBJECTS
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_name TEXT NOT NULL,
  subject_code TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'Core',
  department TEXT,
  learning_area TEXT,
  education_level TEXT,
  applicable_grades TEXT[],
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TEACHER SUBJECTS
CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(teacher_id, subject_id, class_id, stream_id)
);`;

// Part 3: Examinations, Marks & Report Cards
export const SUPABASE_PART3 = `-- PART 3: EXAMINATIONS, MARKS & REPORT CARDS

-- 10. EXAMINATIONS
CREATE TABLE IF NOT EXISTS public.examinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_name TEXT NOT NULL,
  term TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Provisional', 'Approved', 'Archived')),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('CAT', 'Mid-Term', 'End-Term', 'Custom')),
  max_marks INTEGER DEFAULT 100,
  weightage NUMERIC(5,2) DEFAULT 100.0,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. EXAMINATION SUBJECTS
CREATE TABLE IF NOT EXISTS public.examination_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  max_score NUMERIC(5,2) DEFAULT 100.0,
  pass_mark NUMERIC(5,2) DEFAULT 40.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(exam_id, subject_id)
);

-- 12. MARKS
CREATE TABLE IF NOT EXISTS public.marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  marks NUMERIC(5,2) CHECK (marks >= 0 AND marks <= 100),
  entered_by_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, subject_id, exam_id)
);

-- 13. REPORT CARDS
CREATE TABLE IF NOT EXISTS public.report_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  total_marks NUMERIC(7,2) NOT NULL,
  average_mark NUMERIC(5,2) NOT NULL,
  overall_grade TEXT NOT NULL,
  mean_grade_code TEXT,
  total_points INTEGER DEFAULT 0,
  class_rank INTEGER,
  stream_rank INTEGER,
  class_teacher_remarks TEXT,
  principal_remarks TEXT,
  attendance_present INTEGER DEFAULT 0,
  attendance_total INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, exam_id)
);`;

// Part 4: Rankings, Attendance, Audits, Indexes & RLS
export const SUPABASE_PART4 = `-- PART 4: MERIT LISTS, ATTENDANCE, AUDIT LOGS, INDEXES & RLS

-- 14. MERIT LISTS
CREATE TABLE IF NOT EXISTS public.merit_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES public.examinations(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  total_score NUMERIC(7,2) NOT NULL,
  average_score NUMERIC(5,2) NOT NULL,
  overall_grade TEXT NOT NULL,
  overall_points INTEGER DEFAULT 0,
  rank_position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(exam_id, student_id)
);

-- 15. ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Excused')),
  remarks TEXT,
  recorded_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, attendance_date)
);

-- 16. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_email TEXT,
  action_type TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_stream ON public.students(stream_id);
CREATE INDEX IF NOT EXISTS idx_marks_student_exam ON public.marks(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON public.marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_student_exam ON public.report_cards(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_merit_lists_exam ON public.merit_lists(exam_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

-- GRANT SCHEMA AND TABLE PERMISSIONS (REMEDIATED BASE PRIVILEGES)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Anon role: Only allow reading public school profile
GRANT SELECT ON public.school_profile TO anon;

-- Authenticated role: Specific DML table and sequence permissions for logged-in users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Service Role: Full administrative backend access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.school_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merit_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS FOR SAFE RLS EVALUATION (SECURITY DEFINER to prevent RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_id
  FROM public.users
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_teacher_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_id() TO authenticated, service_role;

-- ATOMIC TEACHER DELETION RPC FUNCTION
CREATE OR REPLACE FUNCTION public.delete_teacher_atomic(
  p_teacher_id TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID := NULL;
  v_user_id UUID := NULL;
  v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
  v_found_teacher_id UUID;
  v_found_user_id UUID;
  v_found_email TEXT;
BEGIN
  IF p_teacher_id IS NOT NULL AND p_teacher_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_teacher_id := p_teacher_id::UUID;
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_user_id := p_user_id::UUID;
  END IF;

  -- 1. Locate teacher and user records
  IF v_teacher_id IS NOT NULL THEN
    SELECT id, user_id, email INTO v_found_teacher_id, v_found_user_id, v_found_email
    FROM public.teachers
    WHERE id = v_teacher_id;
  END IF;

  IF v_found_teacher_id IS NULL AND v_email <> '' THEN
    SELECT id, user_id, email INTO v_found_teacher_id, v_found_user_id, v_found_email
    FROM public.teachers
    WHERE LOWER(email) = v_email;
  END IF;

  IF v_found_teacher_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT id, user_id, email INTO v_found_teacher_id, v_found_user_id, v_found_email
    FROM public.teachers
    WHERE user_id = v_user_id;
  END IF;

  IF v_found_user_id IS NULL AND v_found_teacher_id IS NOT NULL THEN
    SELECT id, email INTO v_found_user_id, v_found_email
    FROM public.users
    WHERE teacher_id = v_found_teacher_id;
  END IF;

  IF v_found_user_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT id, email INTO v_found_user_id, v_found_email
    FROM public.users
    WHERE id = v_user_id;
  END IF;

  IF v_found_user_id IS NULL AND v_email <> '' THEN
    SELECT id, email INTO v_found_user_id, v_found_email
    FROM public.users
    WHERE LOWER(email) = v_email;
  END IF;

  -- Idempotency check: if no record is found in teachers or users
  IF v_found_teacher_id IS NULL AND v_found_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_deleted', true,
      'message', 'Teacher account already deleted or does not exist.'
    );
  END IF;

  -- 2. Delete teacher_subjects allocations
  IF v_found_teacher_id IS NOT NULL THEN
    DELETE FROM public.teacher_subjects WHERE teacher_id = v_found_teacher_id;
  END IF;

  -- 3. Clear class_teacher_id on streams and classes
  IF v_found_teacher_id IS NOT NULL THEN
    UPDATE public.streams SET class_teacher_id = NULL WHERE class_teacher_id = v_found_teacher_id;
    UPDATE public.classes SET class_teacher_id = NULL WHERE class_teacher_id = v_found_teacher_id;
  END IF;

  -- 4. Delete from public.teachers
  IF v_found_teacher_id IS NOT NULL THEN
    DELETE FROM public.teachers WHERE id = v_found_teacher_id;
  END IF;
  IF v_found_email IS NOT NULL AND v_found_email <> '' THEN
    DELETE FROM public.teachers WHERE LOWER(email) = v_found_email;
  END IF;

  -- 5. Delete from public.users
  IF v_found_user_id IS NOT NULL THEN
    DELETE FROM public.users WHERE id = v_found_user_id;
  END IF;
  IF v_found_teacher_id IS NOT NULL THEN
    DELETE FROM public.users WHERE teacher_id = v_found_teacher_id;
  END IF;
  IF v_found_email IS NOT NULL AND v_found_email <> '' THEN
    DELETE FROM public.users WHERE LOWER(email) = v_found_email;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_deleted', false,
    'teacher_id', v_found_teacher_id,
    'user_id', v_found_user_id,
    'email', COALESCE(v_found_email, v_email)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_teacher_atomic(TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_teacher_atomic(TEXT, TEXT, TEXT) TO service_role;

-- ATOMIC TEACHER ALLOCATION UPDATE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.update_teacher_allocations_atomic(
  p_teacher_id TEXT,
  p_allocations JSONB DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_inserted_count INT := 0;
BEGIN
  -- 1. Validate p_teacher_id UUID format
  IF p_teacher_id IS NULL OR NOT (p_teacher_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Invalid teacher_id UUID format: %', p_teacher_id;
  END IF;

  v_teacher_id := p_teacher_id::UUID;

  -- 2. Verify teacher exists
  IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id) THEN
    RAISE EXCEPTION 'Teacher with ID % does not exist.', v_teacher_id;
  END IF;

  -- 3. Delete existing allocations for this teacher
  DELETE FROM public.teacher_subjects WHERE teacher_id = v_teacher_id;

  -- 4. Insert complete replacement allocation set if provided
  IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations) = 'array' AND jsonb_array_length(p_allocations) > 0 THEN
    INSERT INTO public.teacher_subjects (teacher_id, subject_id, class_id, stream_id)
    SELECT DISTINCT
      v_teacher_id,
      (elem->>'subject_id')::UUID,
      CASE WHEN (elem->>'class_id') IS NOT NULL AND (elem->>'class_id') <> '' THEN (elem->>'class_id')::UUID ELSE NULL END,
      CASE WHEN (elem->>'stream_id') IS NOT NULL AND (elem->>'stream_id') <> '' THEN (elem->>'stream_id')::UUID ELSE NULL END
    FROM jsonb_array_elements(p_allocations) AS elem;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_teacher_id,
    'inserted_count', v_inserted_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_teacher_allocations_atomic(TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_teacher_allocations_atomic(TEXT, JSONB) TO service_role, authenticated;

-- PERMISSIVE RLS POLICIES FOR FULL SYSTEM OPERATION
DROP POLICY IF EXISTS "Full access school_profile" ON public.school_profile;
CREATE POLICY "Public read school_profile" ON public.school_profile FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "Admin write school_profile" ON public.school_profile FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access users" ON public.users;
DROP POLICY IF EXISTS "Users select policy" ON public.users;
DROP POLICY IF EXISTS "Users insert policy" ON public.users;
DROP POLICY IF EXISTS "Users update policy" ON public.users;
DROP POLICY IF EXISTS "Users delete policy" ON public.users;

CREATE POLICY "Users select policy" ON public.users FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "Users insert policy" ON public.users FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
  OR (id = auth.uid() AND role != 'admin')
);

CREATE POLICY "Users update policy" ON public.users FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR id = auth.uid()
) WITH CHECK (
  public.is_admin()
  OR (
    id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND (teacher_id IS NOT DISTINCT FROM (SELECT teacher_id FROM public.users WHERE id = auth.uid()))
    AND (student_id IS NOT DISTINCT FROM (SELECT student_id FROM public.users WHERE id = auth.uid()))
  )
);

CREATE POLICY "Users delete policy" ON public.users FOR DELETE TO authenticated USING (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access administrators" ON public.administrators;
DROP POLICY IF EXISTS "Administrators select policy" ON public.administrators;
DROP POLICY IF EXISTS "Administrators write policy" ON public.administrators;

CREATE POLICY "Administrators select policy" ON public.administrators FOR SELECT TO authenticated USING (
  public.is_admin()
);
CREATE POLICY "Administrators write policy" ON public.administrators FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers select policy" ON public.teachers;
DROP POLICY IF EXISTS "Teachers insert policy" ON public.teachers;
DROP POLICY IF EXISTS "Teachers update policy" ON public.teachers;
DROP POLICY IF EXISTS "Teachers delete policy" ON public.teachers;

CREATE POLICY "Teachers select policy" ON public.teachers FOR SELECT TO authenticated USING (
  public.is_admin()
  OR user_id = auth.uid()
  OR id = public.get_my_teacher_id()
);

CREATE POLICY "Teachers insert policy" ON public.teachers FOR INSERT TO authenticated WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Teachers update policy" ON public.teachers FOR UPDATE TO authenticated USING (
  public.is_admin()
  OR user_id = auth.uid()
) WITH CHECK (
  public.is_admin()
  OR (
    user_id = auth.uid()
    AND is_class_teacher = (SELECT is_class_teacher FROM public.teachers WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Teachers delete policy" ON public.teachers FOR DELETE TO authenticated USING (
  public.is_admin()
);

DROP POLICY IF EXISTS "Full access students" ON public.students;
DROP POLICY IF EXISTS "Admin full access students" ON public.students;
DROP POLICY IF EXISTS "Teacher select assigned students" ON public.students;
DROP POLICY IF EXISTS "Teacher insert primary students" ON public.students;
DROP POLICY IF EXISTS "Teacher update primary students" ON public.students;
DROP POLICY IF EXISTS "Teacher delete primary students" ON public.students;

CREATE POLICY "Admin full access students" ON public.students FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

CREATE POLICY "Class Teacher select roster" ON public.students FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
      )
    )
  )
);

CREATE POLICY "Class Teacher insert roster" ON public.students FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
      )
    )
  )
);

CREATE POLICY "Class Teacher update roster" ON public.students FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
      )
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'class_teacher')
  AND EXISTS (
    SELECT 1 FROM public.teachers t 
    JOIN public.users u ON (u.teacher_id = t.id OR t.user_id = u.id)
    WHERE u.id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.streams st 
      WHERE st.class_teacher_id = t.id 
      AND (
        st.id = students.stream_id 
        OR (students.stream_id IS NULL AND st.class_id = students.class_id)
      )
    )
  )
);

-- Secure view for subject teachers to access their allocated students for marks entry
CREATE OR REPLACE VIEW public.allocated_students WITH (security_invoker = true) AS
SELECT s.id, s.admission_number, s.full_name, s.gender, s.class_id, s.stream_id, s.active, s.education_level, s.grade
FROM public.students s
WHERE EXISTS (
  SELECT 1 FROM public.users u
  JOIN public.teacher_subjects ts ON ts.teacher_id = u.teacher_id
  WHERE u.id = auth.uid() AND (u.role = 'subject_teacher' OR u.role = 'class_teacher')
  AND (
    (ts.class_id = s.class_id AND ts.stream_id IS NULL) OR 
    (ts.stream_id = s.stream_id AND ts.class_id IS NULL) OR
    (ts.class_id = s.class_id AND ts.stream_id = s.stream_id)
  )
);

GRANT SELECT ON public.allocated_students TO authenticated;

DROP POLICY IF EXISTS "Full access classes" ON public.classes;
DROP POLICY IF EXISTS "Classes select policy" ON public.classes;
DROP POLICY IF EXISTS "Classes write policy" ON public.classes;
CREATE POLICY "Classes select policy" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Classes write policy" ON public.classes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Full access streams" ON public.streams;
DROP POLICY IF EXISTS "Streams select policy" ON public.streams;
DROP POLICY IF EXISTS "Streams write policy" ON public.streams;
CREATE POLICY "Streams select policy" ON public.streams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Streams write policy" ON public.streams FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Full access subjects" ON public.subjects;
DROP POLICY IF EXISTS "Subjects select policy" ON public.subjects;
DROP POLICY IF EXISTS "Subjects write policy" ON public.subjects;
CREATE POLICY "Subjects select policy" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Subjects write policy" ON public.subjects FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Full access teacher_subjects" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Teacher_subjects select policy" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Teacher_subjects write policy" ON public.teacher_subjects;
CREATE POLICY "Teacher_subjects select policy" ON public.teacher_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teacher_subjects write policy" ON public.teacher_subjects FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Full access examinations" ON public.examinations;
DROP POLICY IF EXISTS "Examinations select policy" ON public.examinations;
DROP POLICY IF EXISTS "Examinations write policy" ON public.examinations;

CREATE POLICY "Examinations select policy" ON public.examinations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Examinations write policy" ON public.examinations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Full access examination_subjects" ON public.examination_subjects;
DROP POLICY IF EXISTS "Examination_subjects select policy" ON public.examination_subjects;
DROP POLICY IF EXISTS "Examination_subjects write policy" ON public.examination_subjects;

CREATE POLICY "Examination_subjects select policy" ON public.examination_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Examination_subjects write policy" ON public.examination_subjects FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Full access marks" ON public.marks;
DROP POLICY IF EXISTS "Marks select policy" ON public.marks;
DROP POLICY IF EXISTS "Marks write policy" ON public.marks;

CREATE POLICY "Marks select policy" ON public.marks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Marks write policy" ON public.marks FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.examinations e
      WHERE e.id = marks.exam_id
        AND e.status NOT IN ('Approved', 'Archived')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
        JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
        WHERE s.id = marks.student_id
          AND ts.subject_id = marks.subject_id
          AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
          AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.streams st ON st.id = s.stream_id
        JOIN public.teachers t ON st.class_teacher_id = t.id
        WHERE s.id = marks.student_id
          AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.examinations e
      WHERE e.id = marks.exam_id
        AND e.status NOT IN ('Approved', 'Archived')
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.teachers t ON (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
        JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
        WHERE s.id = marks.student_id
          AND ts.subject_id = marks.subject_id
          AND (ts.class_id IS NULL OR ts.class_id = s.class_id)
          AND (ts.stream_id IS NULL OR ts.stream_id = s.stream_id)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.streams st ON st.id = s.stream_id
        JOIN public.teachers t ON st.class_teacher_id = t.id
        WHERE s.id = marks.student_id
          AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
      )
    )
  )
);

DROP POLICY IF EXISTS "Full access report_cards" ON public.report_cards;
DROP POLICY IF EXISTS "Report_cards select policy" ON public.report_cards;
DROP POLICY IF EXISTS "Report_cards write policy" ON public.report_cards;

CREATE POLICY "Report_cards select policy" ON public.report_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Report_cards write policy" ON public.report_cards FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = report_cards.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = report_cards.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Full access merit_lists" ON public.merit_lists;
DROP POLICY IF EXISTS "Merit_lists select policy" ON public.merit_lists;
DROP POLICY IF EXISTS "Merit_lists write policy" ON public.merit_lists;

CREATE POLICY "Merit_lists select policy" ON public.merit_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Merit_lists write policy" ON public.merit_lists FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Full access attendance" ON public.attendance;
DROP POLICY IF EXISTS "Attendance select policy" ON public.attendance;
DROP POLICY IF EXISTS "Attendance write policy" ON public.attendance;

CREATE POLICY "Attendance select policy" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Attendance write policy" ON public.attendance FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = attendance.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = attendance.recorded_by
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.streams st ON st.id = s.stream_id
    JOIN public.teachers t ON st.class_teacher_id = t.id
    WHERE s.id = attendance.student_id
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
  OR
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = attendance.recorded_by
      AND (t.user_id = auth.uid() OR t.id = (SELECT u.teacher_id FROM public.users u WHERE u.id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Full access audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit_logs select policy" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit_logs insert policy" ON public.audit_logs;

CREATE POLICY "Audit_logs select policy" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.is_admin()
);
CREATE POLICY "Audit_logs insert policy" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  OR public.is_admin()
);

-- Final privileges grant for all created tables and sequences (REMEDIATED)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.school_profile TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
`;

export const SUPABASE_SQL_SCHEMA = `${SUPABASE_PART1}\n\n${SUPABASE_PART2}\n\n${SUPABASE_PART3}\n\n${SUPABASE_PART4}`;
