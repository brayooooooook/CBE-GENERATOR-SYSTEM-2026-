export type Role = 'admin' | 'class_teacher' | 'subject_teacher';

export function canonicalizeRole(roleInput: string | null | undefined): Role {
  if (!roleInput || typeof roleInput !== 'string') return 'class_teacher';
  const cleaned = roleInput.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (cleaned === 'admin' || cleaned === 'administrator') return 'admin';
  if (cleaned === 'class_teacher' || cleaned === 'classteacher' || cleaned === 'class') return 'class_teacher';
  if (cleaned === 'subject_teacher' || cleaned === 'subjectteacher' || cleaned === 'subject') return 'subject_teacher';
  return 'class_teacher';
}

export type EducationLevel = 'Pre-Primary' | 'Lower Primary' | 'Upper Primary' | 'Junior School';

export type GradeName =
  | 'PP1'
  | 'PP2'
  | 'Grade 1'
  | 'Grade 2'
  | 'Grade 3'
  | 'Grade 4'
  | 'Grade 5'
  | 'Grade 6'
  | 'Grade 7'
  | 'Grade 8'
  | 'Grade 9';

export const ALL_EDUCATION_LEVELS: EducationLevel[] = [
  'Pre-Primary',
  'Lower Primary',
  'Upper Primary',
  'Junior School',
];

export const ALL_GRADES: GradeName[] = [
  'PP1',
  'PP2',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
];

export const LEVEL_TO_GRADES: Record<EducationLevel, GradeName[]> = {
  'Pre-Primary': ['PP1', 'PP2'],
  'Lower Primary': ['Grade 1', 'Grade 2', 'Grade 3'],
  'Upper Primary': ['Grade 4', 'Grade 5', 'Grade 6'],
  'Junior School': ['Grade 7', 'Grade 8', 'Grade 9'],
};

export function getEducationLevelForGrade(grade: string): EducationLevel {
  if (grade === 'PP1' || grade === 'PP2') return 'Pre-Primary';
  if (grade === 'Grade 1' || grade === 'Grade 2' || grade === 'Grade 3') return 'Lower Primary';
  if (grade === 'Grade 4' || grade === 'Grade 5' || grade === 'Grade 6') return 'Upper Primary';
  return 'Junior School';
}

export const GRADE_ORDER_MAP: Record<string, number> = {
  'PP1': 0,
  'Pre-Primary 1': 0,
  'PP 1': 0,
  'PP2': 1,
  'Pre-Primary 2': 1,
  'PP 2': 1,
  'Grade 1': 2,
  'G1': 2,
  'Grade 2': 3,
  'G2': 3,
  'Grade 3': 4,
  'G3': 4,
  'Grade 4': 5,
  'G4': 5,
  'Grade 5': 6,
  'G5': 6,
  'Grade 6': 7,
  'G6': 7,
  'Grade 7': 8,
  'G7': 8,
  'Grade 8': 9,
  'G8': 9,
  'Grade 9': 10,
  'G9': 10,
  'Grade 10': 11,
  'G10': 11,
};

export function getGradeOrderIndex(gradeName: string | undefined | null): number {
  if (!gradeName) return 999;
  const trimmed = String(gradeName).trim();
  if (GRADE_ORDER_MAP[trimmed] !== undefined) {
    return GRADE_ORDER_MAP[trimmed];
  }
  const lower = trimmed.toLowerCase();
  for (const key in GRADE_ORDER_MAP) {
    if (key.toLowerCase() === lower) {
      return GRADE_ORDER_MAP[key];
    }
  }
  const numMatch = trimmed.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    if (lower.includes('pp') || lower.includes('pre')) {
      return num - 1;
    }
    return num + 1;
  }
  return 999;
}

export const PREFERRED_STREAMS: string[] = [
  'Blue', 'Green', 'Red', 'Yellow', 'White', 'Gold', 'Silver',
  'East', 'West', 'North', 'South',
  'Alpha', 'Beta', 'Gamma', 'Delta',
  'A', 'B', 'C', 'D', 'E', 'F'
];

export function getStreamOrderIndex(streamName: string | undefined | null): number {
  if (!streamName) return 0;
  const trimmed = String(streamName).trim();
  const idx = PREFERRED_STREAMS.findIndex(s => s.toLowerCase() === trimmed.toLowerCase());
  return idx !== -1 ? idx : 500;
}

export function compareGradeAndStream(
  aGrade: string = '',
  aStream: string = '',
  bGrade: string = '',
  bStream: string = ''
): number {
  const gradeDiff = getGradeOrderIndex(aGrade) - getGradeOrderIndex(bGrade);
  if (gradeDiff !== 0) return gradeDiff;
  const streamDiff = getStreamOrderIndex(aStream) - getStreamOrderIndex(bStream);
  if (streamDiff !== 0) return streamDiff;
  return aStream.localeCompare(bStream);
}

export function sortClasses<T extends ClassStream>(classList: T[]): T[] {
  if (!classList || classList.length <= 1) return classList || [];
  return [...classList].sort((a, b) =>
    compareGradeAndStream(a.class_name, a.stream, b.class_name, b.stream)
  );
}

export function sortGrades<T extends string>(grades: T[]): T[] {
  if (!grades || grades.length <= 1) return grades || [];
  return [...grades].sort((a, b) => getGradeOrderIndex(a) - getGradeOrderIndex(b));
}

export interface School {
  id: string;
  school_name: string;
  county: string;
  address?: string;
  postal_code?: string;
  email: string;
  motto?: string;
  // Optional backward compatibility properties
  school_code?: string;
  sub_county?: string;
  physical_address?: string;
  phone?: string;
  website?: string;
  logo_url?: string;
  stamp_url?: string;
  principal_name?: string;
  registration_number?: string;
}

export type AccountStatus = 'Active' | 'Disabled' | 'Locked';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teacher_id?: string;
  student_id?: string;
  tsc_number?: string;
  phone?: string;
  username?: string;
  status?: AccountStatus;
  force_password_change?: boolean;
  temporary_password?: string;
  last_login?: string;
}

export interface TeacherAllocation {
  id: string;
  education_level: EducationLevel;
  class_id: string;
  subject_id: string;
  class_name?: string;
  stream?: string;
  subject_name?: string;
  subject_code?: string;
}

export interface Teacher {
  id: string;
  user_id?: string;
  teacher_name: string;
  phone: string;
  email: string;
  username?: string;
  tsc_number?: string;
  status?: AccountStatus;
  force_password_change?: boolean;
  temporary_password?: string;
  last_login?: string;
  is_class_teacher?: boolean;
  class_teacher_of_id?: string;
  allocations: TeacherAllocation[];
}

export interface LoginLog {
  id: string;
  user_id?: string;
  email: string;
  user_name?: string;
  role?: Role;
  timestamp: string;
  date: string;
  time: string;
  ip_address: string;
  device: string;
  browser: string;
  status: 'Success' | 'Failed';
  reason?: string;
}

export interface SubjectGroup {
  id: string;
  group_name: string;
  group_code: string;
  education_level: EducationLevel;
  display_order: number;
  is_active: boolean;
  subject_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SubjectGroupMember {
  id: string;
  group_id: string;
  subject_id: string;
}

export interface ClassStream {
  id: string;
  class_name: string; // e.g., "PP1", "Grade 1", "Grade 7"
  stream: string;     // e.g., "Blue", "Gold", "East", "A"
  capacity?: number;
  class_teacher_id?: string;
  education_level?: EducationLevel;
  status?: 'Active' | 'Inactive';
  allocated_subject_ids?: string[];
}

export interface LearnerPromotionRecord {
  id: string;
  student_id: string;
  from_grade: GradeName;
  to_grade: GradeName;
  from_class_id?: string;
  to_class_id?: string;
  academic_year_id?: string;
  date_promoted: string;
  promoted_by?: string;
  from_year?: number;
  from_term?: TermName;
  to_year?: number;
  to_term?: TermName;
}

export interface Student {
  id: string;
  admission_number: string;
  full_name: string;
  first_name?: string;
  second_name?: string;
  last_name?: string;
  gender: 'M' | 'F';
  class_id: string;
  stream_id?: string;
  dob?: string;
  active: boolean;
  education_level?: EducationLevel;
  grade?: GradeName;
  promotion_history?: LearnerPromotionRecord[];
}

export function getStudentFullName(student?: Partial<Student> | null): string {
  if (!student) return '';
  if (student.first_name || student.last_name) {
    const parts = [student.first_name, student.second_name, student.last_name]
      .filter((n): n is string => Boolean(n && n.trim()))
      .map((n) => n.trim());
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }
  return student.full_name || '';
}

export interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
  category: 'Core' | 'Elective' | 'Optional' | 'Activity';
  department?: string;
  education_level?: EducationLevel;
  applicable_grades?: GradeName[];
  status?: 'Active' | 'Archived';
}

export function extractGradeName(gradeStr: string): string {
  if (!gradeStr) return '';
  const s = gradeStr.trim();
  const match = s.match(/(PP1|PP2|Grade\s*\d+)/i);
  if (match) {
    const raw = match[0];
    if (raw.toLowerCase().startsWith('grade')) {
      const num = raw.replace(/\D/g, '');
      return `Grade ${num}`;
    }
    return raw.toUpperCase();
  }
  return s;
}

export function getShortCbeCode(code: string, name?: string): string {
  const upperCode = (code || '').toUpperCase().trim();
  const upperName = (name || '').toUpperCase().trim();

  if (
    upperCode === 'PRE TECH' ||
    upperCode === 'PRE-TECH' ||
    upperCode === 'PTS' ||
    upperCode.includes('PRE TECH') ||
    upperCode.includes('PRE-TECH') ||
    upperName.includes('PRE-TECH') ||
    upperName.includes('PRE TECH') ||
    upperName.includes('PRE TECHNICAL')
  ) {
    return 'PRE TECH';
  }
  if (upperCode === 'ENG' || upperName.includes('ENGLISH')) return 'ENG';
  if (upperCode === 'KIS' || upperName.includes('KISWAHILI')) return 'KIS';
  if (upperCode === 'MATH' || upperCode === 'MAT' || upperName.includes('MATH')) return 'MATH';
  if (
    upperCode === 'INT-SCI' ||
    upperCode === 'INT SCI' ||
    upperCode === 'SCI' ||
    upperCode === 'INT/SC' ||
    upperCode.includes('INT') ||
    upperName.includes('INTEGRATED') ||
    upperName.includes('SCIENCE')
  ) {
    return 'INT-SCI';
  }
  if (
    upperCode === 'CAS' ||
    upperCode === 'CA' ||
    upperCode === 'CREAT UP' ||
    upperName.includes('CREATIVE') ||
    upperName.includes('SPORTS')
  ) {
    return 'CAS';
  }
  if (upperCode === 'SST' || upperName.includes('SOCIAL')) return 'SST';
  if (
    upperCode === 'CRE' ||
    upperCode === 'C.R.E' ||
    upperCode === 'RE' ||
    upperCode === 'RE ACT' ||
    upperCode === 'RE LP' ||
    upperCode === 'RE UP' ||
    upperName.includes('CHRISTIAN') ||
    upperName.includes('RELIGIOUS')
  ) {
    return 'CRE';
  }
  if (
    upperCode === 'AGN' ||
    upperCode === 'AGR' ||
    upperCode === 'AGRIC' ||
    upperCode === 'AGRI' ||
    upperName.includes('AGRICULT') ||
    upperName.includes('NUTRITION')
  ) {
    return 'AGN';
  }
  if (upperCode === 'IRE' || upperCode === 'I.R.E' || upperName.includes('ISLAMIC')) return 'IRE';
  if (upperCode === 'HRE' || upperCode === 'H.R.E' || upperName.includes('HINDU')) return 'HRE';

  return upperCode || 'SUBJ';
}

export function getMeritListDisplayCode(code: string, name?: string): string {
  const shortCode = getShortCbeCode(code, name);
  if (shortCode === 'INT-SCI' || shortCode === 'SCI' || shortCode === 'INT/SC' || shortCode === 'INT SCI') return 'INT/SCI';
  if (shortCode === 'PRE TECH' || shortCode === 'PTS' || shortCode === 'PRE-TECH') return 'PRE-TECH';
  if (shortCode === 'MATH' || shortCode === 'MAT') return 'MAT';
  if (shortCode === 'AGR' || shortCode === 'AGRI' || shortCode === 'AGN') return 'AGN';
  if (shortCode === 'CA' || shortCode === 'CAS') return 'CAS';
  if (shortCode === 'CRE' || shortCode === 'C.R.E') return 'C.R.E';
  return shortCode;
}

export function sortSubjectsByStandardOrder<T extends Record<string, any>>(subjects: T[]): T[] {
  if (!subjects || subjects.length <= 1) return subjects || [];

  const orderMap: Record<string, number> = {
    // Official Junior School Standard Order:
    // 1. ENG -> 2. KIS -> 3. MATH -> 4. INT-SCI -> 5. CAS -> 6. SST -> 7. CRE -> 8. AGN -> 9. PRE TECH
    'ENG': 1,
    'ENGLISH': 1,

    'KIS': 2,
    'KISWAHILI': 2,

    'MATH': 3,
    'MAT': 3,
    'MATHEMATICS': 3,
    'MATHS': 3,

    'INT-SCI': 4,
    'INT SCI': 4,
    'SCI': 4,
    'INT/SC': 4,
    'INTEGRATED SCIENCE': 4,

    'CAS': 5,
    'CA': 5,
    'CREATIVE ARTS AND SPORTS': 5,
    'CREATIVE ARTS & SPORTS': 5,
    'CREATIVE ARTS': 5,
    'CREAT UP': 5,

    'SST': 6,
    'SOCIAL STUDIES': 6,

    'CRE': 7,
    'C.R.E': 7,
    'CHRISTIAN RELIGIOUS EDUCATION': 7,

    'AGN': 8,
    'AGR': 8,
    'AGRI': 8,
    'AGRIC': 8,
    'AGRICULTURE AND NUTRITION': 8,
    'AGRICULTURE & NUTRITION': 8,
    'AGRICULTURE': 8,

    'PRE TECH': 9,
    'PRE-TECH': 9,
    'PTS': 9,
    'PRE-TECHNICAL STUDIES': 9,
  };

  return [...subjects].sort((a, b) => {
    const codeA = getShortCbeCode(a.subject_code || '', a.subject_name || '');
    const codeB = getShortCbeCode(b.subject_code || '', b.subject_name || '');

    const posA = orderMap[codeA] ?? (orderMap[(a.subject_code || '').toUpperCase()] ?? 99);
    const posB = orderMap[codeB] ?? (orderMap[(b.subject_code || '').toUpperCase()] ?? 99);

    if (posA !== posB) return posA - posB;
    return (a.subject_code || a.subject_name || '').localeCompare(b.subject_code || b.subject_name || '');
  });
}

export function getApplicableSubjectsForGrade(
  gradeInput: string,
  subjects: Subject[] = []
): Subject[] {
  if (!subjects || subjects.length === 0) return [];
  const normalizedGrade = extractGradeName(gradeInput) || gradeInput;
  const eduLevel = getEducationLevelForGrade(normalizedGrade || gradeInput);

  const filtered = (subjects || []).filter((s) => {
    if (s.status === 'Archived') return false;

    if (s.applicable_grades && s.applicable_grades.length > 0) {
      return s.applicable_grades.includes(normalizedGrade as GradeName);
    }

    if (s.education_level) {
      return s.education_level === eduLevel;
    }

    return false;
  });

  return sortSubjectsByStandardOrder(filtered);
}

export function getAllocatedSubjectsForClass(
  classStream: ClassStream | undefined,
  subjects: Subject[] = []
): Subject[] {
  if (!classStream || !subjects || subjects.length === 0) return [];
  
  // If the class has explicit allocations, return those allocated subjects directly (preserving archived historical subjects)
  if (classStream.allocated_subject_ids && classStream.allocated_subject_ids.length > 0) {
    const allocated = subjects.filter((s) => classStream.allocated_subject_ids!.includes(s.id));
    if (allocated.length > 0) {
      return sortSubjectsByStandardOrder(allocated);
    }
  }
  
  // Fall back to returning active applicable subjects for this class's grade level
  return getApplicableSubjectsForGrade(classStream.class_name, subjects);
}

export type AcademicYearStatus = 'Upcoming' | 'Active' | 'Closed' | 'Archived' | 'Locked';
export type TermStatus = 'Upcoming' | 'Active' | 'Closed' | 'Archived' | 'Locked';
export type TermName = 'Term 1' | 'Term 2' | 'Term 3';

export interface AcademicYear {
  id: string;
  year: number;
  status: AcademicYearStatus;
  created_at?: string;
  updated_at?: string;
}

export interface SchoolTerm {
  id: string;
  academic_year_id: string;
  year: number;
  term_name: TermName;
  opening_date: string;
  closing_date: string;
  mid_term_opening_date?: string;
  mid_term_closing_date?: string;
  status: TermStatus;
  created_at?: string;
  updated_at?: string;
}

export type ExamType = 'CAT' | 'Mid-Term' | 'End-Term' | 'Custom';
export type ExamStatus = 'Draft' | 'Open' | 'Verification' | 'Published' | 'Approved' | 'Provisional';

export interface Examination {
  id: string;
  exam_name: string;
  term: TermName;
  year: number;
  academic_year_id?: string;
  term_id?: string;
  class_id?: string; // Target class ID or 'all'
  date_created?: string;
  status: ExamStatus;
  exam_type: ExamType;
  max_marks: number; // default 100
  start_date?: string;
  end_date?: string;
}

export type SubjectStatus = 'Normal' | 'X' | 'Y' | 'Blank';

export interface Mark {
  id: string;
  student_id: string;
  subject_id: string;
  exam_id: string;
  marks: number; // 0 to 100 percentage score or raw mark
  raw_score?: number | null;
  out_of?: number; // Maximum score for this subject assessment, default 100
  special_status?: SubjectStatus; // 'Normal' | 'X' | 'Y' | 'Blank'
  irregularity_reason?: string; // Reason for Y status (e.g. Absent, Malpractice, Withheld, Medical Absence, Exempted)
  entered_by_teacher_id?: string;
  updated_at?: string;
}

export interface Grade {
  id: string;
  grade_code: string;        // e.g. "EE1", "EE2", "ME1", "ME2", "AE1", "AE2", "BE1", "BE2"
  performance_level: 'EE' | 'ME' | 'AE' | 'BE';
  minimum_score: number;     // 90, 75, 58, 41, 31, 21, 11, 1
  maximum_score: number;     // 100, 89, 74, 57, 40, 30, 20, 10
  points: number;            // 8, 7, 6, 5, 4, 3, 2, 1
  remarks: string;           // e.g. "Exceptional", "Good", "Needs Support", "Intervention Required"
  descriptor: string;        // e.g. "Exceeding Expectations"
  
  // Backward compatibility fields
  grade?: string;
  minimum_marks?: number;
  maximum_marks?: number;
}

export interface Result {
  id: string;
  student_id: string;
  exam_id: string;
  total_marks: number;
  total_max_marks?: number;
  subject_count: number;
  average: number;
  total_points: number;
  average_points: number;
  grade_code: string;
  performance_level: string;
  grade: string;
  points: number;
  position: number;           // Overall rank (0 if incomplete)
  class_position?: number;    // Stream/class rank (0 if incomplete)
  stream_position?: number;
  remarks?: string;
  is_complete?: boolean;
  status?: 'Complete' | 'Incomplete Assessment' | 'Provisional';
  missing_subjects_count?: number;
}

export interface VerificationLog {
  id: string;
  exam_id: string;
  action: 'Submitted' | 'Verified' | 'Approved' | 'Unlocked' | 'Rejected';
  performed_by_name: string;
  timestamp: string;
  notes?: string;
}

export interface ExamAnalysisSummary {
  exam_id: string;
  exam_name: string;
  total_students: number;
  mean_score: number;
  mean_points: number;
  mean_grade_code: string;
  mean_performance_level: string;
  highest_score: number;
  lowest_score: number;
  subject_summaries: {
    subject_id: string;
    subject_name: string;
    subject_code: string;
    mean_score: number;
    mean_points: number;
    highest: number;
    lowest: number;
    pass_rate: number; // % meeting expectations (ME/EE)
  }[];
  grade_counts: Record<string, number>;
  level_counts: Record<string, number>;
  top_performers: {
    student_id: string;
    student_name: string;
    admission_number: string;
    class_name: string;
    total_marks: number;
    average: number;
    total_points: number;
    average_points: number;
    grade_code: string;
    performance_level: string;
    position: number;
  }[];
  weak_subjects: string[];
  strong_subjects: string[];
}

export interface LearnerReportComment {
  id?: string;
  student_id: string;
  exam_id: string;
  class_teacher_comment?: string;
  class_teacher_name?: string;
  class_teacher_signature_date?: string;
  hoi_comment?: string;
  hoi_name?: string;
  hoi_signature_date?: string;
  next_term_opening_date?: string;
  is_approved?: boolean;
  subject_comments?: Record<string, string>;
}
