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
  AcademicYear,
  SchoolTerm,
} from '../types';

export const initialAcademicYears: AcademicYear[] = [
  { id: 'ay_2025', year: 2025, status: 'Archived', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-12-31T00:00:00Z' },
  { id: 'ay_2026', year: 2026, status: 'Active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-05-06T00:00:00Z' },
  { id: 'ay_2027', year: 2027, status: 'Upcoming', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' },
];

export const initialTerms: SchoolTerm[] = [
  { id: 't_2025_1', academic_year_id: 'ay_2025', year: 2025, term_name: 'Term 1', opening_date: '2025-01-08', closing_date: '2025-04-11', status: 'Archived' },
  { id: 't_2025_2', academic_year_id: 'ay_2025', year: 2025, term_name: 'Term 2', opening_date: '2025-05-05', closing_date: '2025-08-08', status: 'Archived' },
  { id: 't_2025_3', academic_year_id: 'ay_2025', year: 2025, term_name: 'Term 3', opening_date: '2025-09-01', closing_date: '2025-11-21', status: 'Archived' },
  { id: 't_2026_1', academic_year_id: 'ay_2026', year: 2026, term_name: 'Term 1', opening_date: '2026-01-06', closing_date: '2026-04-02', mid_term_opening_date: '2026-02-25', mid_term_closing_date: '2026-03-01', status: 'Closed' },
  { id: 't_2026_2', academic_year_id: 'ay_2026', year: 2026, term_name: 'Term 2', opening_date: '2026-04-27', closing_date: '2026-07-31', mid_term_opening_date: '2026-06-24', mid_term_closing_date: '2026-06-28', status: 'Active' },
  { id: 't_2026_3', academic_year_id: 'ay_2026', year: 2026, term_name: 'Term 3', opening_date: '2026-08-24', closing_date: '2026-10-23', status: 'Upcoming' },
];

export const initialSchool: School = {
  id: '00000000-0000-0000-0000-000000000001',
  school_name: 'CBE Management System',
  motto: 'Strive for Excellence',
  county: 'Kenya',
  postal_code: 'P.O. Box 100-00100',
  address: 'Kenya',
  email: 'info@school.ac.ke',
};

export const initialGrades: Grade[] = [
  {
    id: 'gr_ee1',
    grade_code: 'EE1',
    performance_level: 'EE',
    minimum_score: 90,
    maximum_score: 100,
    points: 8,
    remarks: 'Outstanding Performance',
    descriptor: 'Exceeding Expectations',
    grade: 'EE1',
    minimum_marks: 90,
    maximum_marks: 100,
  },
  {
    id: 'gr_ee2',
    grade_code: 'EE2',
    performance_level: 'EE',
    minimum_score: 75,
    maximum_score: 89,
    points: 7,
    remarks: 'Excellent Performance',
    descriptor: 'Exceeding Expectations',
    grade: 'EE2',
    minimum_marks: 75,
    maximum_marks: 89,
  },
  {
    id: 'gr_me1',
    grade_code: 'ME1',
    performance_level: 'ME',
    minimum_score: 58,
    maximum_score: 74,
    points: 6,
    remarks: 'Good Performance',
    descriptor: 'Meeting Expectations',
    grade: 'ME1',
    minimum_marks: 58,
    maximum_marks: 74,
  },
  {
    id: 'gr_me2',
    grade_code: 'ME2',
    performance_level: 'ME',
    minimum_score: 41,
    maximum_score: 57,
    points: 5,
    remarks: 'Satisfactory Performance',
    descriptor: 'Meeting Expectations',
    grade: 'ME2',
    minimum_marks: 41,
    maximum_marks: 57,
  },
  {
    id: 'gr_ae1',
    grade_code: 'AE1',
    performance_level: 'AE',
    minimum_score: 31,
    maximum_score: 40,
    points: 4,
    remarks: 'Developing Competency',
    descriptor: 'Approaching Expectations',
    grade: 'AE1',
    minimum_marks: 31,
    maximum_marks: 40,
  },
  {
    id: 'gr_ae2',
    grade_code: 'AE2',
    performance_level: 'AE',
    minimum_score: 21,
    maximum_score: 30,
    points: 3,
    remarks: 'Needs More Practice',
    descriptor: 'Approaching Expectations',
    grade: 'AE2',
    minimum_marks: 21,
    maximum_marks: 30,
  },
  {
    id: 'gr_be1',
    grade_code: 'BE1',
    performance_level: 'BE',
    minimum_score: 11,
    maximum_score: 20,
    points: 2,
    remarks: 'Requires Intervention',
    descriptor: 'Below Expectations',
    grade: 'BE1',
    minimum_marks: 11,
    maximum_marks: 20,
  },
  {
    id: 'gr_be2',
    grade_code: 'BE2',
    performance_level: 'BE',
    minimum_score: 0,
    maximum_score: 10,
    points: 1,
    remarks: 'Immediate Support Required',
    descriptor: 'Below Expectations',
    grade: 'BE2',
    minimum_marks: 0,
    maximum_marks: 10,
  },
];

export const initialSubjects: Subject[] = [
  // --- PRE-PRIMARY (PP1 & PP2) ---
  { id: 'sb_pp_lang', subject_name: 'Language Activities', subject_code: 'PP-LANG', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_math', subject_name: 'Mathematical Activities', subject_code: 'PP-MATH', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_env', subject_name: 'Environmental Activities', subject_code: 'PP-ENV', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_psy', subject_name: 'Psychomotor & Creative Activities', subject_code: 'PP-PCA', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_re', subject_name: 'Christian Religious Education Activities', subject_code: 'PP-CRE', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },

  // --- LOWER PRIMARY (Grade 1 - 3) ---
  { id: 'sb_lp_lit', subject_name: 'Literacy Activities', subject_code: 'LP-LIT', category: 'Activity', department: 'Languages', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_eng', subject_name: 'English Language Activities', subject_code: 'LP-ENG', category: 'Activity', department: 'Languages', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_kis', subject_name: 'Kiswahili Language Activities / Kenya Sign Language', subject_code: 'LP-KSL', category: 'Activity', department: 'Languages', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_mat', subject_name: 'Mathematical Activities', subject_code: 'LP-MATH', category: 'Activity', department: 'STEM', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_env', subject_name: 'Environmental Activities', subject_code: 'LP-ENV', category: 'Activity', department: 'Humanities', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_hng', subject_name: 'Hygiene & Nutrition Activities', subject_code: 'LP-HN', category: 'Activity', department: 'Applied Sciences', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_re', subject_name: 'Christian Religious Education Activities', subject_code: 'LP-CRE', category: 'Activity', department: 'Humanities', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_crt', subject_name: 'Movement & Creative Activities', subject_code: 'LP-MCA', category: 'Activity', department: 'Technical & Arts', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },

  // --- UPPER PRIMARY (Grade 4 - 6) ---
  { id: 'sb_up_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', department: 'Languages', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_kis', subject_name: 'Kiswahili', subject_code: 'KISW', category: 'Core', department: 'Languages', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_mat', subject_name: 'Mathematics', subject_code: 'MATHS', category: 'Core', department: 'STEM', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_sci', subject_name: 'Science & Technology', subject_code: 'SCT', category: 'Core', department: 'STEM', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_agr', subject_name: 'Agriculture', subject_code: 'AGR', category: 'Core', department: 'Applied Sciences', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_sst', subject_name: 'Social Studies', subject_code: 'SS', category: 'Core', department: 'Humanities', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_crt', subject_name: 'Creative Arts', subject_code: 'CA', category: 'Core', department: 'Technical & Arts', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_re', subject_name: 'Christian Religious Education', subject_code: 'CRE', category: 'Core', department: 'Humanities', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },

  // --- JUNIOR SCHOOL (Grade 7 - 9) ---
  { id: 'sb_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', department: 'Languages', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', department: 'Languages', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_mat', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', department: 'STEM', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_sci', subject_name: 'Integrated Science', subject_code: 'INT-SCI', category: 'Core', department: 'STEM', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_cas', subject_name: 'Creative Arts and Sports', subject_code: 'CAS', category: 'Core', department: 'Technical & Arts', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_sst', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core', department: 'Humanities', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_cre', subject_name: 'Christian Religious Education', subject_code: 'CRE', category: 'Core', department: 'Humanities', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_agn', subject_name: 'Agriculture', subject_code: 'AGN', category: 'Core', department: 'Applied Sciences', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_pts', subject_name: 'Pre-Technical Studies', subject_code: 'PRE-TECH', category: 'Core', department: 'Technical & Arts', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
];

export function isStandardSubject(sb: Subject | string | null | undefined): boolean {
  if (!sb) return false;
  const idStr = typeof sb === 'string' ? sb : sb.id;
  const codeStr = (typeof sb === 'string' ? '' : sb.subject_code || '').toUpperCase().trim();
  const nameStr = (typeof sb === 'string' ? '' : sb.subject_name || '').toLowerCase().trim();

  if (typeof sb !== 'string') {
    if ((sb as any).is_system === true || (sb as any).is_custom === false) {
      return true;
    }
  }

  return initialSubjects.some((isb) => {
    if (isb.id === idStr) return true;
    if (codeStr && isb.subject_code.toUpperCase().trim() === codeStr) return true;
    if (nameStr && isb.subject_name.toLowerCase().trim() === nameStr) return true;
    return false;
  });
}

export const initialClasses: ClassStream[] = [
  // Pre-Primary
  { id: 'cls_pp1_b', class_name: 'PP1', stream: 'Blue', capacity: 30, education_level: 'Pre-Primary', status: 'Active', allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re'] },
  { id: 'cls_pp2_b', class_name: 'PP2', stream: 'Blue', capacity: 30, education_level: 'Pre-Primary', status: 'Active', allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re'] },
  
  // Lower Primary
  { id: 'cls_g1_b', class_name: 'Grade 1', stream: 'Blue', capacity: 35, education_level: 'Lower Primary', status: 'Active', allocated_subject_ids: ['sb_lp_lit', 'sb_lp_eng', 'sb_lp_kis', 'sb_lp_mat', 'sb_lp_env', 'sb_lp_hng', 'sb_lp_re', 'sb_lp_crt'] },
  { id: 'cls_g2_b', class_name: 'Grade 2', stream: 'Blue', capacity: 35, education_level: 'Lower Primary', status: 'Active', allocated_subject_ids: ['sb_lp_lit', 'sb_lp_eng', 'sb_lp_kis', 'sb_lp_mat', 'sb_lp_env', 'sb_lp_hng', 'sb_lp_re', 'sb_lp_crt'] },
  { id: 'cls_g3_b', class_name: 'Grade 3', stream: 'Blue', capacity: 35, education_level: 'Lower Primary', status: 'Active', allocated_subject_ids: ['sb_lp_lit', 'sb_lp_eng', 'sb_lp_kis', 'sb_lp_mat', 'sb_lp_env', 'sb_lp_hng', 'sb_lp_re', 'sb_lp_crt'] },
  
  // Upper Primary
  { id: 'cls_g4_b', class_name: 'Grade 4', stream: 'Blue', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_kis', 'sb_up_mat', 'sb_up_sci', 'sb_up_agr', 'sb_up_sst', 'sb_up_crt', 'sb_up_re'] },
  { id: 'cls_g5_b', class_name: 'Grade 5', stream: 'Blue', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_kis', 'sb_up_mat', 'sb_up_sci', 'sb_up_agr', 'sb_up_sst', 'sb_up_crt', 'sb_up_re'] },
  { id: 'cls_g5_r', class_name: 'Grade 5', stream: 'Red', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_kis', 'sb_up_mat', 'sb_up_sci', 'sb_up_agr', 'sb_up_sst', 'sb_up_crt', 'sb_up_re'] },
  { id: 'cls_g6_b', class_name: 'Grade 6', stream: 'Blue', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_kis', 'sb_up_mat', 'sb_up_sci', 'sb_up_agr', 'sb_up_sst', 'sb_up_crt', 'sb_up_re'] },

  // Junior School
  { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', capacity: 45, class_teacher_id: 'tch_01', education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_7w', class_name: 'Grade 7', stream: 'West', capacity: 45, education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', capacity: 40, class_teacher_id: 'tch_02', education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_9a', class_name: 'Grade 9', stream: 'Alpha', capacity: 38, education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
];

export const initialTeachers: Teacher[] = [
  {
    id: 'tch_01',
    user_id: 'usr_tch_01',
    teacher_name: 'Madam Grace Wanjiku',
    username: 'gwanjiku',
    status: 'Active',
    phone: '+254 722 111 222',
    email: 'grace.wanjiku@school.ac.ke',
    is_class_teacher: true,
    class_teacher_of_id: 'cls_7e',
    allocations: [
      { id: 'alloc_01', education_level: 'Junior School', class_id: 'cls_7e', subject_id: 'sb_eng' },
      { id: 'alloc_02', education_level: 'Junior School', class_id: 'cls_7w', subject_id: 'sb_cas' },
    ],
  },
  {
    id: 'tch_02',
    user_id: 'usr_tch_02',
    teacher_name: 'Mr. David Otieno',
    username: 'dotieno',
    status: 'Active',
    phone: '+254 733 333 444',
    email: 'david.otieno@school.ac.ke',
    is_class_teacher: true,
    class_teacher_of_id: 'cls_8e',
    allocations: [
      { id: 'alloc_03', education_level: 'Junior School', class_id: 'cls_8e', subject_id: 'sb_mat' },
      { id: 'alloc_04', education_level: 'Junior School', class_id: 'cls_8w', subject_id: 'sb_pts' },
    ],
  },
  {
    id: 'tch_03',
    user_id: 'usr_tch_03',
    teacher_name: 'Madam Faith Kiprop',
    username: 'fkiprop',
    status: 'Active',
    phone: '+254 711 555 666',
    email: 'faith.kiprop@school.ac.ke',
    is_class_teacher: false,
    allocations: [
      { id: 'alloc_05', education_level: 'Junior School', class_id: 'cls_7e', subject_id: 'sb_sci' },
      { id: 'alloc_06', education_level: 'Junior School', class_id: 'cls_9a', subject_id: 'sb_agn' },
    ],
  },
];

export const initialUsers: User[] = [
  {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@cbe.ac.ke',
    role: 'admin',
  },
  {
    id: 'usr_tch_01',
    name: 'Madam Grace Wanjiku (Class Teacher)',
    email: 'grace@cbe.ac.ke',
    role: 'class_teacher',
    teacher_id: 'tch_01',
  },
  {
    id: 'usr_tch_02',
    name: 'Mr. David Otieno (Subject Teacher)',
    email: 'david@cbe.ac.ke',
    role: 'subject_teacher',
    teacher_id: 'tch_02',
  },
];

export const initialStudents: Student[] = [
  // Junior School (Grade 7 & 8)
  { id: 'std_01', admission_number: 'ADM-2024-001', full_name: 'Brian Ayiecha', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', dob: '2011-05-14', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_02', admission_number: 'ADM-2024-002', full_name: 'Amina Mohamed', gender: 'F', class_id: 'cls_7e', stream_id: 'cls_7e', dob: '2011-08-22', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_03', admission_number: 'ADM-2024-003', full_name: 'Kevin Mutua', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', dob: '2011-03-10', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_04', admission_number: 'ADM-2024-004', full_name: 'Joy Cherop', gender: 'F', class_id: 'cls_7e', stream_id: 'cls_7e', dob: '2011-11-05', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_05', admission_number: 'ADM-2024-005', full_name: 'Emmanuel Ochieng', gender: 'M', class_id: 'cls_7e', stream_id: 'cls_7e', dob: '2011-01-30', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_06', admission_number: 'ADM-2024-006', full_name: 'Stacy Njeri', gender: 'F', class_id: 'cls_7e', stream_id: 'cls_7e', dob: '2011-07-18', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  
  { id: 'std_07', admission_number: 'ADM-2024-007', full_name: 'Daniel Kipchirchir', gender: 'M', class_id: 'cls_7w', stream_id: 'cls_7w', dob: '2011-04-12', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_08', admission_number: 'ADM-2024-008', full_name: 'Mercy Akinyi', gender: 'F', class_id: 'cls_7w', stream_id: 'cls_7w', dob: '2011-09-02', active: true, education_level: 'Junior School', grade: 'Grade 7' },
  { id: 'std_09', admission_number: 'ADM-2024-009', full_name: 'Cynthia Mbao', gender: 'F', class_id: 'cls_8e', stream_id: 'cls_8e', dob: '2010-02-14', active: true, education_level: 'Junior School', grade: 'Grade 8' },
  { id: 'std_10', admission_number: 'ADM-2024-010', full_name: 'Victor Kiptoo', gender: 'M', class_id: 'cls_8e', stream_id: 'cls_8e', dob: '2010-06-25', active: true, education_level: 'Junior School', grade: 'Grade 8' },

  // Pre-Primary Sample
  { id: 'std_11', admission_number: 'ADM-2025-101', full_name: 'Baraka Kamau', gender: 'M', class_id: 'cls_pp2_b', stream_id: 'cls_pp2_b', dob: '2020-03-15', active: true, education_level: 'Pre-Primary', grade: 'PP2' },

  // Lower Primary Sample
  { id: 'std_12', admission_number: 'ADM-2025-201', full_name: 'Zawadi Mwangi', gender: 'F', class_id: 'cls_g2_b', stream_id: 'cls_g2_b', dob: '2018-09-10', active: true, education_level: 'Lower Primary', grade: 'Grade 2' },

  // Upper Primary Sample
  { id: 'std_13', admission_number: 'ADM-2025-501', full_name: 'Ethan Wambua', gender: 'M', class_id: 'cls_g5_b', stream_id: 'cls_g5_b', dob: '2015-11-20', active: true, education_level: 'Upper Primary', grade: 'Grade 5' },
];

export const initialExaminations: Examination[] = [
  {
    id: 'ex_01',
    exam_name: 'CAT 1 - Term 1 2026',
    term: 'Term 1',
    year: 2026,
    status: 'Approved',
    exam_type: 'CAT',
    max_marks: 100,
    start_date: '2026-02-10',
    end_date: '2026-02-14',
  },
  {
    id: 'ex_02',
    exam_name: 'MID-TERM EXAM - Term 1 2026',
    term: 'Term 1',
    year: 2026,
    status: 'Provisional',
    exam_type: 'Mid-Term',
    max_marks: 100,
    start_date: '2026-03-15',
    end_date: '2026-03-20',
  },
  {
    id: 'ex_03',
    exam_name: 'END OF TERM 1 2026 EXAMINATION',
    term: 'Term 1',
    year: 2026,
    status: 'Draft',
    exam_type: 'End-Term',
    max_marks: 100,
    start_date: '2026-04-01',
    end_date: '2026-04-10',
  },
];

// Sample realistic marks for ex_01 (Approved) and ex_02 (Provisional)
export const initialMarks: Mark[] = [
  // Student 1: Brian Ayiecha (Top performer in Grade 7 East)
  { id: 'mk_01_eng', student_id: 'std_01', subject_id: 'sb_eng', exam_id: 'ex_01', marks: 88 },
  { id: 'mk_01_kis', student_id: 'std_01', subject_id: 'sb_kis', exam_id: 'ex_01', marks: 85 },
  { id: 'mk_01_mat', student_id: 'std_01', subject_id: 'sb_mat', exam_id: 'ex_01', marks: 92 },
  { id: 'mk_01_sci', student_id: 'std_01', subject_id: 'sb_sci', exam_id: 'ex_01', marks: 84 },
  { id: 'mk_01_sst', student_id: 'std_01', subject_id: 'sb_sst', exam_id: 'ex_01', marks: 80 },
  { id: 'mk_01_cre', student_id: 'std_01', subject_id: 'sb_cre', exam_id: 'ex_01', marks: 90 },
  { id: 'mk_01_agn', student_id: 'std_01', subject_id: 'sb_agn', exam_id: 'ex_01', marks: 86 },
  { id: 'mk_01_cas', student_id: 'std_01', subject_id: 'sb_cas', exam_id: 'ex_01', marks: 89 },
  { id: 'mk_01_pts', student_id: 'std_01', subject_id: 'sb_pts', exam_id: 'ex_01', marks: 91 },

  // Mid term ex_02 for std_01
  { id: 'mk_01_eng_2', student_id: 'std_01', subject_id: 'sb_eng', exam_id: 'ex_02', marks: 90 },
  { id: 'mk_01_kis_2', student_id: 'std_01', subject_id: 'sb_kis', exam_id: 'ex_02', marks: 87 },
  { id: 'mk_01_mat_2', student_id: 'std_01', subject_id: 'sb_mat', exam_id: 'ex_02', marks: 95 },
  { id: 'mk_01_sci_2', student_id: 'std_01', subject_id: 'sb_sci', exam_id: 'ex_02', marks: 88 },
  { id: 'mk_01_sst_2', student_id: 'std_01', subject_id: 'sb_sst', exam_id: 'ex_02', marks: 82 },
  { id: 'mk_01_cre_2', student_id: 'std_01', subject_id: 'sb_cre', exam_id: 'ex_02', marks: 91 },

  // Student 2: Amina Mohamed
  { id: 'mk_02_eng', student_id: 'std_02', subject_id: 'sb_eng', exam_id: 'ex_01', marks: 82 },
  { id: 'mk_02_kis', student_id: 'std_02', subject_id: 'sb_kis', exam_id: 'ex_01', marks: 88 },
  { id: 'mk_02_mat', student_id: 'std_02', subject_id: 'sb_mat', exam_id: 'ex_01', marks: 78 },
  { id: 'mk_02_sci', student_id: 'std_02', subject_id: 'sb_sci', exam_id: 'ex_01', marks: 75 },
  { id: 'mk_02_sst', student_id: 'std_02', subject_id: 'sb_sst', exam_id: 'ex_01', marks: 85 },
  { id: 'mk_02_cre', student_id: 'std_02', subject_id: 'sb_cre', exam_id: 'ex_01', marks: 88 },
  { id: 'mk_02_agn', student_id: 'std_02', subject_id: 'sb_agn', exam_id: 'ex_01', marks: 80 },
  { id: 'mk_02_cas', student_id: 'std_02', subject_id: 'sb_cas', exam_id: 'ex_01', marks: 82 },
  { id: 'mk_02_pts', student_id: 'std_02', subject_id: 'sb_pts', exam_id: 'ex_01', marks: 79 },

  // Student 3: Kevin Mutua
  { id: 'mk_03_eng', student_id: 'std_03', subject_id: 'sb_eng', exam_id: 'ex_01', marks: 70 },
  { id: 'mk_03_kis', student_id: 'std_03', subject_id: 'sb_kis', exam_id: 'ex_01', marks: 68 },
  { id: 'mk_03_mat', student_id: 'std_03', subject_id: 'sb_mat', exam_id: 'ex_01', marks: 74 },
  { id: 'mk_03_sci', student_id: 'std_03', subject_id: 'sb_sci', exam_id: 'ex_01', marks: 72 },
  { id: 'mk_03_sst', student_id: 'std_03', subject_id: 'sb_sst', exam_id: 'ex_01', marks: 66 },
  { id: 'mk_03_cre', student_id: 'std_03', subject_id: 'sb_cre', exam_id: 'ex_01', marks: 75 },
  { id: 'mk_03_agn', student_id: 'std_03', subject_id: 'sb_agn', exam_id: 'ex_01', marks: 69 },
  { id: 'mk_03_cas', student_id: 'std_03', subject_id: 'sb_cas', exam_id: 'ex_01', marks: 71 },
  { id: 'mk_03_pts', student_id: 'std_03', subject_id: 'sb_pts', exam_id: 'ex_01', marks: 73 },

  // Student 4: Joy Cherop
  { id: 'mk_04_eng', student_id: 'std_04', subject_id: 'sb_eng', exam_id: 'ex_01', marks: 60 },
  { id: 'mk_04_kis', student_id: 'std_04', subject_id: 'sb_kis', exam_id: 'ex_01', marks: 58 },
  { id: 'mk_04_mat', student_id: 'std_04', subject_id: 'sb_mat', exam_id: 'ex_01', marks: 62 },
  { id: 'mk_04_sci', student_id: 'std_04', subject_id: 'sb_sci', exam_id: 'ex_01', marks: 55 },
  { id: 'mk_04_sst', student_id: 'std_04', subject_id: 'sb_sst', exam_id: 'ex_01', marks: 64 },
  { id: 'mk_04_cre', student_id: 'std_04', subject_id: 'sb_cre', exam_id: 'ex_01', marks: 67 },
  { id: 'mk_04_agn', student_id: 'std_04', subject_id: 'sb_agn', exam_id: 'ex_01', marks: 59 },
  { id: 'mk_04_cas', student_id: 'std_04', subject_id: 'sb_cas', exam_id: 'ex_01', marks: 63 },
  { id: 'mk_04_pts', student_id: 'std_04', subject_id: 'sb_pts', exam_id: 'ex_01', marks: 61 },

  // Student 5: Emmanuel Ochieng
  { id: 'mk_05_eng', student_id: 'std_05', subject_id: 'sb_eng', exam_id: 'ex_01', marks: 48 },
  { id: 'mk_05_kis', student_id: 'std_05', subject_id: 'sb_kis', exam_id: 'ex_01', marks: 52 },
  { id: 'mk_05_mat', student_id: 'std_05', subject_id: 'sb_mat', exam_id: 'ex_01', marks: 45 },
  { id: 'mk_05_sci', student_id: 'std_05', subject_id: 'sb_sci', exam_id: 'ex_01', marks: 42 },
  { id: 'mk_05_sst', student_id: 'std_05', subject_id: 'sb_sst', exam_id: 'ex_01', marks: 50 },
  { id: 'mk_05_cre', student_id: 'std_05', subject_id: 'sb_cre', exam_id: 'ex_01', marks: 56 },
  { id: 'mk_05_agn', student_id: 'std_05', subject_id: 'sb_agn', exam_id: 'ex_01', marks: 47 },
  { id: 'mk_05_cas', student_id: 'std_05', subject_id: 'sb_cas', exam_id: 'ex_01', marks: 51 },
  { id: 'mk_05_pts', student_id: 'std_05', subject_id: 'sb_pts', exam_id: 'ex_01', marks: 44 },

  // Student 6: Stacy Njeri
  { id: 'mk_06_eng', student_id: 'std_06', subject_id: 'sb_eng', exam_id: 'ex_01', marks: 78 },
  { id: 'mk_06_kis', student_id: 'std_06', subject_id: 'sb_kis', exam_id: 'ex_01', marks: 82 },
  { id: 'mk_06_mat', student_id: 'std_06', subject_id: 'sb_mat', exam_id: 'ex_01', marks: 72 },
  { id: 'mk_06_sci', student_id: 'std_06', subject_id: 'sb_sci', exam_id: 'ex_01', marks: 76 },
  { id: 'mk_06_sst', student_id: 'std_06', subject_id: 'sb_sst', exam_id: 'ex_01', marks: 81 },
  { id: 'mk_06_cre', student_id: 'std_06', subject_id: 'sb_cre', exam_id: 'ex_01', marks: 84 },
  { id: 'mk_06_agn', student_id: 'std_06', subject_id: 'sb_agn', exam_id: 'ex_01', marks: 79 },
  { id: 'mk_06_cas', student_id: 'std_06', subject_id: 'sb_cas', exam_id: 'ex_01', marks: 80 },
  { id: 'mk_06_pts', student_id: 'std_06', subject_id: 'sb_pts', exam_id: 'ex_01', marks: 77 },
];
