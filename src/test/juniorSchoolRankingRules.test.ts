import './setupLocalStorage';
import { calculateExamResults, CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Student, Subject, Mark, ClassStream } from '../types';

console.log('--- JUNIOR SCHOOL RANKING RULES COMPLIANCE TESTS ---');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    failCount++;
  }
}

const subjects: Subject[] = Array.from({ length: 9 }, (_, i) => ({
  id: `sb_${i + 1}`,
  subject_code: `SUB${i + 1}`,
  subject_name: `Subject ${i + 1}`,
  category: 'Core',
  education_level: 'Junior School',
  applicable_grades: ['Grade 8'],
  status: 'Active',
}));

const class8A: ClassStream = {
  id: 'cls_8a',
  class_name: 'Grade 8',
  stream: 'Blue',
  allocated_subject_ids: subjects.map((s) => s.id),
};

const class8B: ClassStream = {
  id: 'cls_8b',
  class_name: 'Grade 8',
  stream: 'Red',
  allocated_subject_ids: subjects.map((s) => s.id),
};

const classes = [class8A, class8B];

// TEST 1: Ranks learners strictly by Total Marks descending with competition ranking for ties
{
  const totalMarksList = [754, 734, 700, 690, 680, 670, 660, 650, 646, 646, 624];
  const students: Student[] = totalMarksList.map((tm, idx) => ({
    id: `std_${idx + 1}`,
    admission_number: `ADM-0${idx + 1}`,
    full_name: `Student ${idx + 1}`,
    grade: 'Grade 8',
    class_id: 'cls_8a',
    gender: 'M',
    active: true,
  }));

  const marks: Mark[] = [];
  students.forEach((std, idx) => {
    const tm = totalMarksList[idx];
    const baseMark = Math.floor(tm / 9);
    let remainder = tm % 9;
    subjects.forEach((sb, sIdx) => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      const score = baseMark + extra;
      marks.push({
        id: `m_${idx}_${sIdx}`,
        exam_id: 'ex1',
        student_id: std.id,
        subject_id: sb.id,
        marks: score,
        raw_score: score,
        out_of: 100,
      });
    });
  });

  const results = calculateExamResults('ex1', students, marks, CBE_8_POINT_GRADES, classes, subjects);

  const res1 = results.find((r) => r.student_id === 'std_1')!;
  const res2 = results.find((r) => r.student_id === 'std_2')!;
  const res9 = results.find((r) => r.student_id === 'std_9')!;
  const res10 = results.find((r) => r.student_id === 'std_10')!;
  const res11 = results.find((r) => r.student_id === 'std_11')!;

  assert(res1.position === 1, 'Learner with 754 Total Marks receives position 1', `Got ${res1.position}`);
  assert(res2.position === 2, 'Learner with 734 Total Marks receives position 2', `Got ${res2.position}`);
  assert(res9.position === 9, 'First learner with 646 Total Marks receives position 9', `Got ${res9.position}`);
  assert(res10.position === 9, 'Second learner with 646 Total Marks receives position 9', `Got ${res10.position}`);
  assert(res11.position === 11, 'Learner after 646 tie receives position 11 (competition ranking)', `Got ${res11.position}`);
}

// TEST 2: Equal Total Marks are NOT separated using Average Points or Total Points
{
  const stdA: Student = { id: 'std_a', admission_number: 'A1', full_name: 'Learner A', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };
  const stdB: Student = { id: 'std_b', admission_number: 'B1', full_name: 'Learner B', grade: 'Grade 8', class_id: 'cls_8a', gender: 'F', active: true };

  const testMarks: Mark[] = [];
  subjects.forEach((sb, i) => {
    let scoreA = 50;
    if (i === 0) scoreA = 90;
    if (i === 1) scoreA = 10;
    testMarks.push({ id: `ma_${i}`, exam_id: 'ex2', student_id: 'std_a', subject_id: sb.id, marks: scoreA, raw_score: scoreA, out_of: 100 });
    testMarks.push({ id: `mb_${i}`, exam_id: 'ex2', student_id: 'std_b', subject_id: sb.id, marks: 50, raw_score: 50, out_of: 100 });
  });

  const results = calculateExamResults('ex2', [stdA, stdB], testMarks, CBE_8_POINT_GRADES, classes, subjects);
  const resA = results.find((r) => r.student_id === 'std_a')!;
  const resB = results.find((r) => r.student_id === 'std_b')!;

  assert(resA.total_marks === 450 && resB.total_marks === 450, 'Both learners have equal Total Marks (450)');
  assert(resA.average_points !== resB.average_points, 'Learners have differing Average Points');
  assert(resA.position === 1 && resB.position === 1, 'Both learners receive position 1 despite different Average Points', `A=${resA.position}, B=${resB.position}`);
}

// TEST 3: CBE Level continues to use Average Marks
{
  const stdC: Student = { id: 'std_c', admission_number: 'C1', full_name: 'Learner C', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };
  const testMarks: Mark[] = subjects.map((sb, i) => ({
    id: `mc_${i}`, exam_id: 'ex3', student_id: 'std_c', subject_id: sb.id, marks: 77, raw_score: 77, out_of: 100
  }));

  const results = calculateExamResults('ex3', [stdC], testMarks, CBE_8_POINT_GRADES, classes, subjects);
  const resC = results.find((r) => r.student_id === 'std_c')!;

  assert(resC.average === 77.0, 'Average mark is 77.0');
  assert(resC.performance_level === 'EE' && resC.grade_code === 'EE2', 'CBE Level is correctly evaluated as EE (EE2)', `Got ${resC.grade_code}`);
}

// TEST 4: Stream Position follows Total Marks competition ranking rule
{
  const std1: Student = { id: 'std_s1', admission_number: 'S1', full_name: 'Stream Learner 1', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };
  const std2: Student = { id: 'std_s2', admission_number: 'S2', full_name: 'Stream Learner 2', grade: 'Grade 8', class_id: 'cls_8a', gender: 'F', active: true };
  const std3: Student = { id: 'std_s3', admission_number: 'S3', full_name: 'Stream Learner 3', grade: 'Grade 8', class_id: 'cls_8a', gender: 'M', active: true };

  const testMarks: Mark[] = [];
  subjects.forEach((sb) => {
    testMarks.push({ id: `ms1_${sb.id}`, exam_id: 'ex4', student_id: 'std_s1', subject_id: sb.id, marks: 80, raw_score: 80, out_of: 100 });
    testMarks.push({ id: `ms2_${sb.id}`, exam_id: 'ex4', student_id: 'std_s2', subject_id: sb.id, marks: 80, raw_score: 80, out_of: 100 });
    testMarks.push({ id: `ms3_${sb.id}`, exam_id: 'ex4', student_id: 'std_s3', subject_id: sb.id, marks: 60, raw_score: 60, out_of: 100 });
  });

  const results = calculateExamResults('ex4', [std1, std2, std3], testMarks, CBE_8_POINT_GRADES, classes, subjects);
  const res1 = results.find((r) => r.student_id === 'std_s1')!;
  const res2 = results.find((r) => r.student_id === 'std_s2')!;
  const res3 = results.find((r) => r.student_id === 'std_s3')!;

  assert(res1.stream_position === 1 && res2.stream_position === 1, 'Both tied learners receive stream position 1', `s1=${res1.stream_position}, s2=${res2.stream_position}`);
  assert(res3.stream_position === 3, 'Next learner receives stream position 3', `s3=${res3.stream_position}`);
}

console.log(`\nSUMMARY: Passed ${passCount}, Failed ${failCount}`);
if (failCount > 0) {
  process.exit(1);
}
