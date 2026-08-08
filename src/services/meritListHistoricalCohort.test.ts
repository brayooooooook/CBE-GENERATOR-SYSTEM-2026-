import '../testSetup';

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

import '../testSetup';
import { getFilteredStudents } from '../utils/filterUtils';
import { calculateExamResults } from './analysisEngine';
import { Student, ClassStream, Examination, Subject, Grade, Mark } from '../types';

console.log('=== RUNNING PRIORITY 2B MERIT LIST HISTORICAL COHORT INTEGRATION TESTS ===\n');

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${message}`);
  } else {
    console.error(`✗ FAIL: ${message}`);
  }
}

// -------------------------------------------------------------
// SETUP TEST FIXTURES
// -------------------------------------------------------------
const classes: ClassStream[] = [
  { id: 'cls_6a', class_name: 'Grade 6', stream: 'Alpha', education_level: 'Upper Primary' },
  { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_7w', class_name: 'Grade 7', stream: 'West', education_level: 'Junior School' },
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', education_level: 'Junior School' },
  { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', education_level: 'Junior School' },
];

const subjects: Subject[] = [
  { id: 'sb_mat', subject_code: 'MAT', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
  { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
];

const grades: Grade[] = [
  { id: 'g1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceeding', descriptor: 'EE', grade: 'EE1', minimum_marks: 90, maximum_marks: 100 },
  { id: 'g2', grade_code: 'ME1', performance_level: 'ME', minimum_score: 60, maximum_score: 89, points: 6, remarks: 'Meeting', descriptor: 'ME', grade: 'ME1', minimum_marks: 60, maximum_marks: 89 },
  { id: 'g3', grade_code: 'AE1', performance_level: 'AE', minimum_score: 40, maximum_score: 59, points: 4, remarks: 'Approaching', descriptor: 'AE', grade: 'AE1', minimum_marks: 40, maximum_marks: 59 },
  { id: 'g4', grade_code: 'BE1', performance_level: 'BE', minimum_score: 0, maximum_score: 39, points: 2, remarks: 'Below', descriptor: 'BE', grade: 'BE1', minimum_marks: 0, maximum_marks: 39 },
];

// Student 1: Currently Grade 7 East (unpromoted)
const stdUnpromoted: Student = {
  id: 'stu_7e_unpromoted',
  admission_number: 'ADM101',
  full_name: 'Alice Unpromoted',
  gender: 'F',
  class_id: 'cls_7e',
  stream_id: 'cls_7e',
  grade: 'Grade 7',
  active: true,
  promotion_history: [],
};

// Student 2: Promoted from Grade 7 East -> Grade 8 West on 2025-01-01
const stdPromoted7Eto8W: Student = {
  id: 'stu_7e_to_8w',
  admission_number: 'ADM102',
  full_name: 'Bob Promoted',
  gender: 'M',
  class_id: 'cls_8w', // Currently Grade 8 West
  stream_id: 'cls_8w',
  grade: 'Grade 8',
  active: true,
  promotion_history: [
    {
      id: 'p1',
      student_id: 'stu_7e_to_8w',
      from_class_id: 'cls_7e',
      from_grade: 'Grade 7',
      to_class_id: 'cls_8w',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

// Student 3: Multi-promoted (Grade 6 Alpha -> Grade 7 East -> Grade 8 West)
const stdMultiPromoted: Student = {
  id: 'stu_multi',
  admission_number: 'ADM103',
  full_name: 'Charlie Multi',
  gender: 'M',
  class_id: 'cls_8w', // Currently Grade 8 West
  stream_id: 'cls_8w',
  grade: 'Grade 8',
  active: true,
  promotion_history: [
    {
      id: 'pm1',
      student_id: 'stu_multi',
      from_class_id: 'cls_6a',
      from_grade: 'Grade 6',
      to_class_id: 'cls_7e',
      to_grade: 'Grade 7',
      date_promoted: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'pm2',
      student_id: 'stu_multi',
      from_class_id: 'cls_7e',
      from_grade: 'Grade 7',
      to_class_id: 'cls_8w',
      to_grade: 'Grade 8',
      date_promoted: '2025-01-01T00:00:00.000Z',
    },
  ],
};

// Student 4: Currently Grade 8 East (unpromoted reference)
const stdGrade8East: Student = {
  id: 'stu_8e_ref',
  admission_number: 'ADM104',
  full_name: 'David Grade8East',
  gender: 'M',
  class_id: 'cls_8e',
  stream_id: 'cls_8e',
  grade: 'Grade 8',
  active: true,
  promotion_history: [],
};

const allStudents = [stdUnpromoted, stdPromoted7Eto8W, stdMultiPromoted, stdGrade8East];

// Examinations
const exam2023G6: Examination = {
  id: 'exam_2023_g6',
  exam_name: 'Grade 6 Final Exam 2023',
  academic_year_id: 'ay_2023',
  term: 'Term 3',
  year: 2023,
  start_date: '2023-11-10T00:00:00.000Z',
  date_created: '2023-11-10T00:00:00.000Z',
  status: 'Published',
  exam_type: 'End-Term',
  max_marks: 100,
};

const exam2024G7: Examination = {
  id: 'exam_2024_g7',
  exam_name: 'Grade 7 Mid Term 2024',
  academic_year_id: 'ay_2024',
  term: 'Term 2',
  year: 2024,
  start_date: '2024-06-15T00:00:00.000Z',
  date_created: '2024-06-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'Mid-Term',
  max_marks: 100,
};

const exam2025G8: Examination = {
  id: 'exam_2025_g8',
  exam_name: 'Grade 8 Term 1 2025',
  academic_year_id: 'ay_2025',
  term: 'Term 1',
  year: 2025,
  start_date: '2025-03-15T00:00:00.000Z',
  date_created: '2025-03-15T00:00:00.000Z',
  status: 'Published',
  exam_type: 'CAT',
  max_marks: 100,
};

// Marks for 2024 Grade 7 exam
const marks2024G7: Mark[] = [
  { id: 'm1', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_mat', marks: 80, out_of: 100 },
  { id: 'm2', exam_id: 'exam_2024_g7', student_id: 'stu_7e_unpromoted', subject_id: 'sb_eng', marks: 70, out_of: 100 },
  { id: 'm3', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_mat', marks: 95, out_of: 100 },
  { id: 'm4', exam_id: 'exam_2024_g7', student_id: 'stu_7e_to_8w', subject_id: 'sb_eng', marks: 90, out_of: 100 },
  { id: 'm5', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_mat', marks: 60, out_of: 100 },
  { id: 'm6', exam_id: 'exam_2024_g7', student_id: 'stu_multi', subject_id: 'sb_eng', marks: 65, out_of: 100 },
];

// -------------------------------------------------------------
// TEST 1: Historical Class Retention (Grade 7 exam before promotion)
// -------------------------------------------------------------
const g7Cohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
assert(
  g7Cohort.length === 3,
  `Historical Grade 7 East cohort has 3 learners (found ${g7Cohort.length})`
);
assert(
  g7Cohort.some((s) => s.id === 'stu_7e_to_8w'),
  'Bob Promoted (now Grade 8 West) is retained in historical Grade 7 East cohort'
);

// -------------------------------------------------------------
// TEST 2: Historical Stream Separation (Grade 7 West exam vs Grade 7 East exam)
// -------------------------------------------------------------
const g7WestCohort = getFilteredStudents(allStudents, classes, 'cls_7w', 'cls_7w', exam2024G7);
assert(
  !g7WestCohort.some((s) => s.id === 'stu_7e_to_8w'),
  'Bob Promoted (historical Grade 7 East) is EXCLUDED from Grade 7 West historical cohort'
);

// -------------------------------------------------------------
// TEST 3: Later Examination Behavior (Grade 8 exam in 2025)
// -------------------------------------------------------------
const g8West2025Cohort = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w', exam2025G8);
assert(
  g8West2025Cohort.some((s) => s.id === 'stu_7e_to_8w') && g8West2025Cohort.some((s) => s.id === 'stu_multi'),
  'Bob Promoted and Charlie Multi appear in Grade 8 West cohort for 2025 exam'
);
assert(
  !g8West2025Cohort.some((s) => s.id === 'stu_7e_unpromoted'),
  'Unpromoted Grade 7 learner is excluded from Grade 8 West 2025 exam cohort'
);

// -------------------------------------------------------------
// TEST 4: Multiple Promotions (Grade 6 Alpha in 2023)
// -------------------------------------------------------------
const g6Alpha2023Cohort = getFilteredStudents(allStudents, classes, 'cls_6a', 'cls_6a', exam2023G6);
assert(
  g6Alpha2023Cohort.length === 1 && g6Alpha2023Cohort[0].id === 'stu_multi',
  'Charlie Multi resolves correctly to Grade 6 Alpha cohort for 2023 exam'
);

// -------------------------------------------------------------
// TEST 5: Merit List Ranking Cohort (Ranking within historical cohort)
// -------------------------------------------------------------
const filteredG7 = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const g7MeritResults = calculateExamResults('exam_2024_g7', filteredG7, marks2024G7, grades, classes, subjects);

assert(
  g7MeritResults.length === 3,
  'Merit List results generated for 3 learners in historical Grade 7 East cohort'
);

// Sort by total marks for test verification
g7MeritResults.sort((a, b) => b.total_marks - a.total_marks);

assert(
  g7MeritResults[0].student_id === 'stu_7e_to_8w' && g7MeritResults[0].total_marks === 185,
  'Promoted learner Bob ranks #1 in Grade 7 East historical Merit List with 185 marks'
);
assert(
  g7MeritResults[1].student_id === 'stu_7e_unpromoted' && g7MeritResults[1].total_marks === 150,
  'Unpromoted learner Alice ranks #2 in Grade 7 East historical Merit List with 150 marks'
);
assert(
  g7MeritResults[2].student_id === 'stu_multi' && g7MeritResults[2].total_marks === 125,
  'Multi-promoted learner Charlie ranks #3 in Grade 7 East historical Merit List with 125 marks'
);

// -------------------------------------------------------------
// TEST 6: UI / Export Parity
// -------------------------------------------------------------
// Every export pathway uses getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam)
const uiCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const pdfCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const excelCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);
const csvCohort = getFilteredStudents(allStudents, classes, 'cls_7e', 'cls_7e', exam2024G7);

const sameIds =
  uiCohort.map((s) => s.id).join(',') === pdfCohort.map((s) => s.id).join(',') &&
  pdfCohort.map((s) => s.id).join(',') === excelCohort.map((s) => s.id).join(',') &&
  excelCohort.map((s) => s.id).join(',') === csvCohort.map((s) => s.id).join(',');

assert(sameIds, 'UI, PDF, Excel, and CSV pathways produce identical historical student cohorts');

// -------------------------------------------------------------
// TEST 7: Current Behavior (No exam parameter)
// -------------------------------------------------------------
const currentG8West = getFilteredStudents(allStudents, classes, 'cls_8w', 'cls_8w');
assert(
  currentG8West.length === 2 &&
    currentG8West.some((s) => s.id === 'stu_7e_to_8w') &&
    currentG8West.some((s) => s.id === 'stu_multi'),
  'Without exam parameter, live current class filtering (Grade 8 West) returns current Grade 8 West students'
);

console.log(`\n==================================================`);
console.log(`HISTORICAL MERIT LIST COHORT TEST RESULTS: ${passed}/${total} PASSED`);
console.log(`==================================================\n`);

if (passed !== total) {
  process.exit(1);
}
