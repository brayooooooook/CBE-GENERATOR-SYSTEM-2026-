import type { Examination, Mark, User } from '../types';

// Mock localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
  };
}

async function runLockVerificationTests() {
  const { api } = await import('../lib/storage');
  console.log('====================================================');
  console.log('STARTING LOCK MARKS ENTRY REGRESSION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Set up mock users
  const adminUser: User = {
    id: 'usr_admin_test',
    username: 'admin_test',
    role: 'admin',
    name: 'Administrator Test',
    email: 'admin@school.ac.ke',
  };

  const subjectTeacherUser: User = {
    id: 'usr_teacher_test',
    username: 'teacher_test',
    role: 'subject_teacher',
    name: 'Subject Teacher Test',
    email: 'teacher@school.ac.ke',
  };

  const classTeacherUser: User = {
    id: 'usr_classteacher_test',
    username: 'classteacher_test',
    role: 'class_teacher',
    name: 'Class Teacher Test',
    email: 'classteacher@school.ac.ke',
  };

  // Get initial state
  const initialExams = api.getExaminations();
  const initialMarks = api.getMarks();

  // Create two test examinations
  const testExam1: Examination = {
    id: `exam_test_lock_1_${Date.now()}`,
    exam_name: 'Test Mid-Term Exam 2026',
    term: 'Term 1',
    year: 2026,
    class_id: 'cls_grade7_a',
    date_created: '2026-03-01',
    status: 'Open',
    exam_type: 'Mid-Term',
    max_marks: 100,
  };

  const testExam2: Examination = {
    id: `exam_test_lock_2_${Date.now()}`,
    exam_name: 'Test End-Term Exam 2026',
    term: 'Term 1',
    year: 2026,
    class_id: 'cls_grade7_a',
    date_created: '2026-03-01',
    status: 'Open',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  api.addExamination(testExam1);
  api.addExamination(testExam2);

  const sampleMark1: Mark = {
    id: `mk_test_std1_${testExam1.id}`,
    student_id: 'std_7a_001',
    subject_id: 'sb_mat',
    exam_id: testExam1.id,
    marks: 85,
    raw_score: 85,
    out_of: 100,
    special_status: 'Normal',
    updated_at: new Date().toISOString(),
  };

  const sampleMark2: Mark = {
    id: `mk_test_std1_${testExam2.id}`,
    student_id: 'std_7a_001',
    subject_id: 'sb_mat',
    exam_id: testExam2.id,
    marks: 78,
    raw_score: 78,
    out_of: 100,
    special_status: 'Normal',
    updated_at: new Date().toISOString(),
  };

  // TEST 1 — BEFORE APPROVAL
  try {
    api.saveBulkMarks([sampleMark1], subjectTeacherUser);
    const saved = api.getMarks().find((m) => m.id === sampleMark1.id);
    assert(
      saved !== undefined && saved.marks === 85,
      'TEST 1: Authorised user can enter/edit marks before examination approval.'
    );
  } catch (e: any) {
    assert(false, `TEST 1 Failed: ${e.message}`);
  }

  // TEST 2 — APPROVAL
  try {
    api.updateExaminationStatus(testExam1.id, 'Approved', adminUser);
    const updatedExam = api.getExaminations().find((e) => e.id === testExam1.id);
    assert(
      updatedExam?.status === 'Approved',
      'TEST 2: Administrator approves examination; status transitions to Approved.'
    );
  } catch (e: any) {
    assert(false, `TEST 2 Failed: ${e.message}`);
  }

  // TEST 3 — TEACHER AFTER APPROVAL (New Mark)
  try {
    const newMarkAttempt: Mark = {
      id: `mk_test_std2_${testExam1.id}`,
      student_id: 'std_7a_002',
      subject_id: 'sb_mat',
      exam_id: testExam1.id,
      marks: 90,
      raw_score: 90,
      out_of: 100,
      special_status: 'Normal',
      updated_at: new Date().toISOString(),
    };
    api.saveBulkMarks([newMarkAttempt], subjectTeacherUser);
    assert(false, 'TEST 3: Subject Teacher should NOT be allowed to enter new mark for approved exam.');
  } catch (e: any) {
    assert(
      e.message.includes('locked') || e.message.includes('approved'),
      `TEST 3: Subject Teacher entering new mark denied: ${e.message}`
    );
  }

  // TEST 4 — TEACHER EDIT AFTER APPROVAL (Edit Mark)
  try {
    const editMarkAttempt: Mark = {
      ...sampleMark1,
      marks: 99,
      raw_score: 99,
    };
    api.saveBulkMarks([editMarkAttempt], subjectTeacherUser);
    assert(false, 'TEST 4: Subject Teacher should NOT be allowed to edit existing mark for approved exam.');
  } catch (e: any) {
    assert(
      e.message.includes('locked') || e.message.includes('approved'),
      `TEST 4: Subject Teacher editing mark denied: ${e.message}`
    );
  }

  // TEST 5 — CLASS TEACHER AFTER APPROVAL
  try {
    const classTeacherEditAttempt: Mark = {
      ...sampleMark1,
      marks: 92,
      raw_score: 92,
    };
    api.saveBulkMarks([classTeacherEditAttempt], classTeacherUser);
    assert(false, 'TEST 5: Class Teacher should NOT be allowed to modify mark for approved exam.');
  } catch (e: any) {
    assert(
      e.message.includes('locked') || e.message.includes('approved'),
      `TEST 5: Class Teacher editing mark denied: ${e.message}`
    );
  }

  // TEST 6 — ADMINISTRATOR AFTER APPROVAL
  try {
    const adminEditAttempt: Mark = {
      ...sampleMark1,
      marks: 100,
      raw_score: 100,
    };
    api.saveBulkMarks([adminEditAttempt], adminUser);
    assert(false, 'TEST 6: Administrator should NOT accidentally modify marks without explicit reopening.');
  } catch (e: any) {
    assert(
      e.message.includes('locked') || e.message.includes('approved'),
      `TEST 6: Administrator modification on locked exam blocked without reopening: ${e.message}`
    );
  }

  // TEST 9 — UNAUTHORISED REOPEN (Tested before Admin Reopen to verify security)
  try {
    api.updateExaminationStatus(testExam1.id, 'Draft', subjectTeacherUser);
    assert(false, 'TEST 9: Subject Teacher should NOT be allowed to reopen approved examination.');
  } catch (e: any) {
    assert(
      e.message.includes('UNAUTHORIZED') || e.message.includes('Administrator'),
      `TEST 9: Unauthorised teacher reopen attempt denied: ${e.message}`
    );
  }

  // TEST 11 — EXISTING MARKS REMAIN UNCHANGED AFTER APPROVAL
  const markAfterApproval = api.getMarks().find((m) => m.id === sampleMark1.id);
  assert(
    markAfterApproval?.marks === 85,
    'TEST 11: Existing marks remain completely unchanged upon approval.'
  );

  // TEST 7 — ADMINISTRATOR REOPEN
  try {
    api.updateExaminationStatus(testExam1.id, 'Draft', adminUser);
    const reopenedExam = api.getExaminations().find((e) => e.id === testExam1.id);
    assert(
      reopenedExam?.status === 'Draft',
      'TEST 7: Administrator explicitly reopens examination to Draft status.'
    );
  } catch (e: any) {
    assert(false, `TEST 7 Failed: ${e.message}`);
  }

  // TEST 12 — EXISTING MARKS REMAIN UNCHANGED AFTER REOPEN
  const markAfterReopen = api.getMarks().find((m) => m.id === sampleMark1.id);
  assert(
    markAfterReopen?.marks === 85,
    'TEST 12: Existing marks remain completely unchanged after reopening.'
  );

  // TEST 8 — TEACHER AFTER REOPEN
  try {
    const teacherEditAfterReopen: Mark = {
      ...sampleMark1,
      marks: 88,
      raw_score: 88,
    };
    api.saveBulkMarks([teacherEditAfterReopen], subjectTeacherUser);
    const updated = api.getMarks().find((m) => m.id === sampleMark1.id);
    assert(
      updated?.marks === 88,
      'TEST 8: Authorised teacher can edit marks after Administrator reopens examination.'
    );
  } catch (e: any) {
    assert(false, `TEST 8 Failed: ${e.message}`);
  }

  // TEST 10 — DIRECT / BACKEND BYPASS ATTEMPT
  // Re-lock exam1 first
  api.updateExaminationStatus(testExam1.id, 'Approved', adminUser);
  try {
    api.saveBulkMarks(
      [
        {
          id: `mk_bypass_${testExam1.id}`,
          student_id: 'std_7a_003',
          subject_id: 'sb_mat',
          exam_id: testExam1.id,
          marks: 50,
          raw_score: 50,
          out_of: 100,
          special_status: 'Normal',
          updated_at: new Date().toISOString(),
        },
      ],
      null
    );
    assert(false, 'TEST 10: Direct backend call to saveBulkMarks for approved exam should be blocked.');
  } catch (e: any) {
    assert(
      e.message.includes('locked') || e.message.includes('approved'),
      `TEST 10: Direct backend bypass attempt blocked: ${e.message}`
    );
  }

  // TEST 13 — MULTIPLE EXAMINATIONS
  try {
    api.saveBulkMarks([sampleMark2], subjectTeacherUser);
    const saved2 = api.getMarks().find((m) => m.id === sampleMark2.id);
    assert(
      saved2 !== undefined && saved2.marks === 78,
      'TEST 13: Locking Exam 1 does NOT affect marks entry for unlocked Exam 2.'
    );
  } catch (e: any) {
    assert(false, `TEST 13 Failed: ${e.message}`);
  }

  // TEST 14 — HISTORICAL EXAMINATION & CALCULATIONS
  const exam1Final = api.getExaminations().find((e) => e.id === testExam1.id);
  const exam2Final = api.getExaminations().find((e) => e.id === testExam2.id);
  assert(
    exam1Final?.status === 'Approved' && exam2Final?.status === 'Open',
    'TEST 14: Locking exam retains exact exam statuses without altering historical data or other exams.'
  );

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLockVerificationTests();
