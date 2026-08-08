import {
  Student,
  Subject,
  Mark,
  Grade,
  Result,
  ExamAnalysisSummary,
  ClassStream,
  getApplicableSubjectsForGrade,
  getAllocatedSubjectsForClass,
  extractGradeName,
  getEducationLevelForGrade,
  Teacher
} from '../types';
import { api } from '../lib/storage';
import { getLearnerClassAtExamTime } from './historicalContextResolver';

/**
 * Authoritative KNEC CBE Tie Inspector
 * Returns true if two learners share equal qualifying totals for merit ranking:
 * Average Points, Total Points, Total Marks, and Mean Score / Average Percentage.
 */
export function isMeritTie(
  a: { average_points?: number; total_points?: number; total_marks?: number; average?: number; mean_percentage?: number },
  b: { average_points?: number; total_points?: number; total_marks?: number; average?: number; mean_percentage?: number }
): boolean {
  if (!a || !b) return false;
  
  // 1. Average Points comparison (rounded to 2 decimal places to prevent floating point inaccuracy)
  const aAvgPts = Math.round((a.average_points ?? 0) * 100);
  const bAvgPts = Math.round((b.average_points ?? 0) * 100);
  if (aAvgPts !== bAvgPts) return false;

  // 2. Total Points comparison (rounded to 2 decimal places)
  const aTotPts = Math.round((a.total_points ?? 0) * 100);
  const bTotPts = Math.round((b.total_points ?? 0) * 100);
  if (aTotPts !== bTotPts) return false;

  // 3. Total Marks comparison
  const aTotMarks = Math.round(a.total_marks ?? 0);
  const bTotMarks = Math.round(b.total_marks ?? 0);
  if (aTotMarks !== bTotMarks) return false;

  // 4. Mean Percentage / Average Score (rounded to 1 decimal place)
  const aAvg = Math.round((a.average ?? a.mean_percentage ?? 0) * 10);
  const bAvg = Math.round((b.average ?? b.mean_percentage ?? 0) * 10);
  return aAvg === bAvg;
}

/**
 * Centralized Authoritative Competition Ranking Helper (1, 1, 3 method)
 * Applies KNEC CBE standard competition ranking across any list of sorted items.
 * Tied items according to `isTieFn` share identical rank, and subsequent ranks skip accordingly.
 */
export function applyCompetitionRanking<T>(
  items: T[],
  isTieFn: (a: T, b: T) => boolean,
  setRankFn: (item: T, rank: number) => void
): T[] {
  let currentRank = 1;
  items.forEach((item, index) => {
    if (index > 0) {
      const prevItem = items[index - 1];
      if (!isTieFn(item, prevItem)) {
        currentRank = index + 1;
      }
    } else {
      currentRank = 1;
    }
    setRankFn(item, currentRank);
  });
  return items;
}

export const CBE_8_POINT_GRADES: Grade[] = [
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

/**
 * Find matching grade configuration based on numerical score (0-100%)
 */
export function getGradeForMark(mark: number, grades: Grade[] = []): Grade {
  const safeGrades = grades && grades.length > 0 ? grades : CBE_8_POINT_GRADES;
  const sortedGrades = [...safeGrades].sort((a, b) => {
    const minA = a.minimum_score ?? a.minimum_marks ?? 0;
    const minB = b.minimum_score ?? b.minimum_marks ?? 0;
    return minB - minA;
  });

  const roundedMark = Math.round(mark);

  for (const g of sortedGrades) {
    const min = g.minimum_score ?? g.minimum_marks ?? 0;
    if (roundedMark >= min) {
      return g;
    }
  }

  // Fallback BE2
  return CBE_8_POINT_GRADES[7];
}

export function getLearnerReportSubjects(
  student: Student,
  classObj: ClassStream | undefined,
  subjects: Subject[],
  teachers?: Teacher[]
): Subject[] {
  if (classObj) {
    if (classObj.allocated_subject_ids && classObj.allocated_subject_ids.length > 0) {
      return getAllocatedSubjectsForClass(classObj, subjects);
    }
  }
  const stdGrade = classObj?.class_name || student?.grade || '';
  return getApplicableSubjectsForGrade(stdGrade, subjects);
}

import { evaluateMark, formatPercentage } from '../utils/markUtils';

/**
 * Calculates results & positions for all students in an examination using KNEC CBE 8-Point engine
 */
export function calculateExamResults(
  examId: string,
  students: Student[] = [],
  marksList: Mark[] = [],
  grades: Grade[] = [],
  classes: ClassStream[] = [],
  subjects: Subject[] = []
): Result[] {
  const safeStudents = students || [];
  const safeMarksList = marksList || [];
  const safeGrades = grades || [];
  const safeClasses = classes || [];
  const safeSubjects = subjects || [];

  // Filter marks for this specific exam
  const examMarks = safeMarksList.filter((m) => m.exam_id === examId);

  const studentTotals: {
    student_id: string;
    total_marks: number;
    total_max_marks: number;
    subject_count: number;
    average: number;
    total_points: number;
    average_points: number;
    overallGradeObj: Grade;
    is_complete: boolean;
    missing_subjects_count: number;
  }[] = [];

  safeStudents.forEach((std) => {
    // Resolve student's class & grade for this exam (supporting historical exam context)
    let stdClass = safeClasses.find((c) => c.id === std.class_id);
    const examObj = (typeof api !== 'undefined' && api.getExaminations)
      ? api.getExaminations().find((e) => e.id === examId)
      : undefined;

    let stdContextGrade: string = std.grade;
    if (examObj) {
      const examContext = getLearnerClassAtExamTime(std, examObj, safeClasses);
      if (examContext) {
        if (examContext.class_id) {
          const histClass = safeClasses.find((c) => c.id === examContext.class_id);
          if (histClass) {
            stdClass = histClass;
          }
        }
        if (examContext.grade) {
          stdContextGrade = examContext.grade;
        }
      }
    }

    const effectiveStudent: Student = stdContextGrade !== std.grade ? { ...std, grade: stdContextGrade as any } : std;

    // Master subject pool
    const poolSubjects = safeSubjects.length > 0
      ? safeSubjects
      : (typeof api !== 'undefined' && api.getSubjects ? api.getSubjects() : []);

    // Resolve subjects allocated or applicable specifically to this learner
    const learnerAllocatedSubjects = getLearnerReportSubjects(
      effectiveStudent,
      stdClass,
      poolSubjects,
      typeof api !== 'undefined' && api.getTeachers ? api.getTeachers() : []
    );

    // If caller provided a specific safeSubjects list, intersect learner's allocated subjects with safeSubjects
    // so caller's pre-filtering is respected while unallocated school subjects are excluded from completeness check.
    let applicableSubjects: Subject[];
    if (safeSubjects.length > 0) {
      const safeSubjectIdSet = new Set(safeSubjects.map((s) => String(s.id)));
      const filteredAllocated = learnerAllocatedSubjects.filter((s) => safeSubjectIdSet.has(String(s.id)));
      applicableSubjects = filteredAllocated.length > 0 ? filteredAllocated : learnerAllocatedSubjects;
    } else {
      applicableSubjects = learnerAllocatedSubjects;
    }

    const validSubjectIds =
      applicableSubjects.length > 0
        ? new Set(applicableSubjects.map((s) => String(s.id)))
        : null;

    // Filter marks belonging to student & valid subjects
    const stdMarks = examMarks.filter(
      (m) =>
        String(m.student_id) === String(std.id) &&
        (!validSubjectIds || validSubjectIds.has(String(m.subject_id)))
    );

    let assessedSubjectCount = 0;
    let sumRawScore = 0;
    let sumOutOf = 0;
    let sumPercentage = 0;
    let sumPctRoundedTotal = 0;
    let sumPoints = 0;
    let hasMissingMark = false; // X or unentered mark for applicable subject causes provisional status
    let missingCount = 0;
    let irregularityCount = 0;

    applicableSubjects.forEach((sb) => {
      const markObj = stdMarks.find((m) => String(m.subject_id) === String(sb.id));
      const markInfo = evaluateMark(markObj);

      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        assessedSubjectCount++;
        sumRawScore += markInfo.rawScore!;
        sumOutOf += markInfo.outOf;
        sumPercentage += markInfo.percentage;
        sumPctRoundedTotal += Math.round(markInfo.percentage);
        const gr = getGradeForMark(markInfo.percentage, safeGrades);
        sumPoints += gr.points;
      } else if (markInfo.status === 'Y') {
        // Examination Irregularity: excluded from score/average calculation, not treated as missing X
        irregularityCount++;
      } else {
        // Missing Assessment ('X' or unentered/blank for an applicable curriculum subject)
        hasMissingMark = true;
        missingCount++;
      }
    });

    // If no explicit applicable subjects found, process whatever marks std has
    if (applicableSubjects.length === 0 && stdMarks.length > 0) {
      stdMarks.forEach((m) => {
        const markInfo = evaluateMark(m);
        if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
          assessedSubjectCount++;
          sumRawScore += markInfo.rawScore!;
          sumOutOf += markInfo.outOf;
          sumPercentage += markInfo.percentage;
          sumPctRoundedTotal += Math.round(markInfo.percentage);
          const gr = getGradeForMark(markInfo.percentage, safeGrades);
          sumPoints += gr.points;
        } else if (markInfo.status === 'Y') {
          irregularityCount++;
        } else {
          hasMissingMark = true;
          missingCount++;
        }
      });
    }

    // A report is COMPLETE if there are NO missing marks ('X' or unentered applicable subjects), NO irregularities ('Y'),
    // and at least 1 subject has been assessed.
    const expectedSubjectCount = applicableSubjects.length > 0 ? applicableSubjects.length : 1;
    const isComplete = !hasMissingMark && irregularityCount === 0 && assessedSubjectCount > 0;
    const totalMissingCount = missingCount;

    const rawGrade = effectiveStudent.grade || stdClass?.class_name || '';
    const gradeKey = extractGradeName(rawGrade) || rawGrade || '';
    const stdEduLevel = getEducationLevelForGrade(gradeKey);
    const isJuniorSchool = stdEduLevel === 'Junior School';

    const totalMarks = isJuniorSchool ? sumPctRoundedTotal : Math.round(sumRawScore);
    const totalMaxMarks = isJuniorSchool ? assessedSubjectCount * 100 : (sumOutOf > 0 ? sumOutOf : assessedSubjectCount * 100);
    const avgMarks = assessedSubjectCount > 0
      ? (isJuniorSchool ? Math.round((totalMarks / assessedSubjectCount) * 10) / 10 : Math.round((sumPercentage / assessedSubjectCount) * 10) / 10)
      : 0;
    const avgPoints = assessedSubjectCount > 0 ? Math.round((sumPoints / assessedSubjectCount) * 100) / 100 : 0;
    const overallGradeObj = getGradeForMark(avgMarks, safeGrades);

    studentTotals.push({
      student_id: std.id,
      total_marks: totalMarks,
      total_max_marks: totalMaxMarks,
      subject_count: assessedSubjectCount,
      average: avgMarks,
      total_points: sumPoints,
      average_points: avgPoints,
      overallGradeObj,
      is_complete: isComplete,
      missing_subjects_count: totalMissingCount,
    });
  });

  // Separate complete students from incomplete students
  const completeTotals = studentTotals.filter((s) => s.is_complete);
  const incompleteTotals = studentTotals.filter((s) => !s.is_complete);

  // Helper to resolve normalized grade name for a student (e.g. "Grade 8", "Grade 7")
  const getStudentGradeKey = (studentId: string): string => {
    const std = safeStudents.find((s) => s.id === studentId);
    if (!std) return 'Unassigned';
    const stdClass = safeClasses.find((c) => c.id === std.class_id);
    const rawGrade = std.grade || stdClass?.class_name || '';
    return extractGradeName(rawGrade) || rawGrade || 'Unassigned';
  };

  // Group complete students by Grade first to prevent cross-grade competition
  const gradeGroups = new Map<string, typeof completeTotals>();
  completeTotals.forEach((item) => {
    const gradeKey = getStudentGradeKey(item.student_id);
    if (!gradeGroups.has(gradeKey)) {
      gradeGroups.set(gradeKey, []);
    }
    gradeGroups.get(gradeKey)!.push(item);
  });

  const finalResults: Result[] = [];

  // Step 1 & Step 2: Rank per Grade first (Overall Position), then per Stream (Stream Position)
  gradeGroups.forEach((gradeCohort, gradeKey) => {
    const isJuniorSchool = getEducationLevelForGrade(gradeKey) === 'Junior School';

    // Step 1: Sort Grade cohort descending
    if (isJuniorSchool) {
      // Junior School primary ranking criterion: TOTAL MARKS descending
      gradeCohort.sort((a, b) => b.total_marks - a.total_marks);
    } else {
      // Non-Junior School ranking criterion: Average Points -> Total Points -> Mean Score %
      gradeCohort.sort((a, b) => {
        if (b.average_points !== a.average_points) {
          return b.average_points - a.average_points;
        }
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        return b.average - a.average;
      });
    }

    const isCohortTie = (a: any, b: any) => {
      if (isJuniorSchool) {
        return Math.round(a.total_marks ?? 0) === Math.round(b.total_marks ?? 0);
      }
      return isMeritTie(a, b);
    };

    // Calculate Overall Position (Grade Position) within this Grade cohort with competition ranking (1, 1, 3 pattern)
    const gradeResultsWithOverallRank: {
      item: (typeof completeTotals)[0];
      overallRank: number;
      class_id: string;
    }[] = [];

    applyCompetitionRanking(gradeCohort, isCohortTie, (item, rank) => {
      const studentObj = safeStudents.find((s) => s.id === item.student_id);
      gradeResultsWithOverallRank.push({
        item,
        overallRank: rank,
        class_id: studentObj?.class_id || 'unassigned',
      });
    });

    // Step 2: Split Grade cohort into Streams (grouped by class_id)
    const streamGroups = new Map<string, typeof gradeResultsWithOverallRank>();
    gradeResultsWithOverallRank.forEach((entry) => {
      const classId = entry.class_id;
      if (!streamGroups.has(classId)) {
        streamGroups.set(classId, []);
      }
      streamGroups.get(classId)!.push(entry);
    });

    // Calculate Stream Position within each stream cohort with competition ranking (1, 1, 3 pattern)
    streamGroups.forEach((streamCohort) => {
      if (isJuniorSchool) {
        streamCohort.sort((a, b) => b.item.total_marks - a.item.total_marks);
      } else {
        streamCohort.sort((a, b) => {
          if (b.item.average_points !== a.item.average_points) {
            return b.item.average_points - a.item.average_points;
          }
          if (b.item.total_points !== a.item.total_points) {
            return b.item.total_points - a.item.total_points;
          }
          return b.item.average - a.item.average;
        });
      }

      applyCompetitionRanking(
        streamCohort,
        (a, b) => isCohortTie(a.item, b.item),
        (entry, streamRank) => {
          const { item, overallRank } = entry;
          const code = item.overallGradeObj.grade_code || item.overallGradeObj.grade || 'ME1';
          const level = item.overallGradeObj.performance_level || 'ME';

          finalResults.push({
            id: `res_${examId}_${item.student_id}`,
            student_id: item.student_id,
            exam_id: examId,
            total_marks: item.total_marks,
            total_max_marks: item.total_max_marks,
            subject_count: item.subject_count,
            average: item.average,
            total_points: item.total_points,
            average_points: item.average_points,
            grade_code: code,
            performance_level: level,
            grade: code,
            points: item.overallGradeObj.points,
            position: overallRank,        // Grade Position (Overall Position within Grade)
            class_position: streamRank,   // Stream Position
            stream_position: streamRank,  // Stream Position
            remarks: item.overallGradeObj.remarks,
            is_complete: true,
            status: 'Complete',
            missing_subjects_count: item.missing_subjects_count,
          });
        }
      );
    });
  });

  // Append incomplete/provisional students (students with missing marks / X / incomplete assessment)
  // Provisional students are explicitly NOT ranked (positions set to 0)
  incompleteTotals.forEach((item) => {
    const code = item.overallGradeObj.grade_code || item.overallGradeObj.grade || 'ME1';
    const level = item.overallGradeObj.performance_level || 'ME';

    finalResults.push({
      id: `res_${examId}_${item.student_id}`,
      student_id: item.student_id,
      exam_id: examId,
      total_marks: item.total_marks,
      total_max_marks: item.total_max_marks,
      subject_count: item.subject_count,
      average: item.average, // provisional average
      total_points: item.total_points,
      average_points: item.average_points,
      grade_code: code,
      performance_level: level,
      grade: code,
      points: item.overallGradeObj.points,
      position: 0,
      class_position: 0,
      stream_position: 0,
      remarks: item.subject_count > 0 ? 'Provisional Assessment (Partial Subjects Entered)' : 'Incomplete Assessment (Pending Marks)',
      is_complete: false,
      status: 'Provisional',
      missing_subjects_count: item.missing_subjects_count,
    });
  });

  return finalResults;
}

/**
 * Calculates grade-wide subject rank for a student in a specific subject and exam.
 * Ranks are calculated across all learners in the same grade (regardless of stream).
 * Denominator is the total number of learners in that grade who were assessed in that subject for the selected examination.
 * Returns formatted string like "1/92" or "X" if not assessed.
 */
export function calculateSubjectRank(
  student: Student,
  subjectId: string,
  examId: string,
  allStudents: Student[] = [],
  classes: ClassStream[] = [],
  marks: Mark[] = []
): string {
  if (!student || !subjectId || !examId) return '-';

  const safeStudents = allStudents || [];
  const safeClasses = classes || [];
  const safeMarks = marks || [];

  // 1. Identify student's grade name
  const studentClass = safeClasses.find((c) => c.id === student.class_id);
  const gradeName = student.grade || (studentClass ? studentClass.class_name : student.class_id);

  if (!gradeName) {
    return '-';
  }

  // 2. Find all class_ids belonging to the same grade
  const matchingClassIds = new Set(
    safeClasses
      .filter((c) => c.class_name.toLowerCase() === gradeName.toLowerCase())
      .map((c) => c.id)
  );

  // 3. Find all students in this grade cohort across all streams
  const gradeStudents = safeStudents.filter((s) => {
    if (matchingClassIds.has(s.class_id)) return true;
    const sClass = safeClasses.find((c) => c.id === s.class_id);
    const sGradeName = sClass ? sClass.class_name : s.class_id;
    return sGradeName?.toLowerCase() === gradeName.toLowerCase();
  });

  const gradeStudentIds = new Set(gradeStudents.map((s) => s.id));

  // Check target student's mark status first
  const studentMarkObj = safeMarks.find((m) => m.exam_id === examId && m.subject_id === subjectId && m.student_id === student.id);
  const studentInfo = evaluateMark(studentMarkObj);

  if (studentInfo.status === 'X') return 'X';
  if (studentInfo.status === 'Y') return 'Y';
  if (studentInfo.status === 'Blank' || studentInfo.percentage === null) return '-';

  // Filter marks with Normal status
  const validMarks = safeMarks
    .filter((m) => m.exam_id === examId && m.subject_id === subjectId && gradeStudentIds.has(m.student_id))
    .map((m) => ({ student_id: m.student_id, info: evaluateMark(m) }))
    .filter((item) => item.info.status === 'Normal' && item.info.percentage !== null);

  const totalAssessed = validMarks.length;
  if (totalAssessed === 0) return '-';

  // Sort descending by percentage
  validMarks.sort((a, b) => b.info.percentage! - a.info.percentage!);

  let studentRank = 1;
  for (let i = 0; i < validMarks.length; i++) {
    if (i > 0 && validMarks[i].info.percentage! < validMarks[i - 1].info.percentage!) {
      studentRank = i + 1;
    }
    if (validMarks[i].student_id === student.id) {
      break;
    }
  }

  return `${studentRank}/${totalAssessed}`;
}

/**
 * Generate full analytical summary for an examination
 */
export function generateExamAnalysisSummary(
  examId: string,
  examName: string,
  students: Student[] = [],
  subjects: Subject[] = [],
  marksList: Mark[] = [],
  grades: Grade[] = []
): ExamAnalysisSummary {
  const safeStudents = students || [];
  const safeSubjects = subjects || [];
  const safeMarksList = marksList || [];
  const safeGrades = grades || [];
  const safeClasses = typeof api !== 'undefined' ? api.getClasses() : [];

  // Determine applicable subjects for the students cohort
  let applicableSubjects: Subject[] = safeSubjects;
  if (safeStudents.length > 0 && safeSubjects.length > 0) {
    const studentGrades = Array.from(
      new Set(safeStudents.map((s) => s.grade || '').filter(Boolean))
    );
    if (studentGrades.length === 1) {
      // Find a student and their class for this grade to accurately determine subjects
      const sampleStudent = safeStudents.find(s => (s.grade || '') === studentGrades[0]);
      const sampleClass = safeClasses.find(c => c.id === sampleStudent?.class_id);
      
      applicableSubjects = sampleStudent ? getLearnerReportSubjects(sampleStudent, sampleClass, safeSubjects, typeof api !== 'undefined' ? api.getTeachers() : []) : [];
    } else if (studentGrades.length > 1) {
      const applicableSet = new Set<string>();
      studentGrades.forEach((g) => {
        const sampleStudent = safeStudents.find(s => (s.grade || '') === g);
        const sampleClass = safeClasses.find(c => c.id === sampleStudent?.class_id);
        if (sampleStudent) {
            getLearnerReportSubjects(sampleStudent, sampleClass, safeSubjects, typeof api !== 'undefined' ? api.getTeachers() : []).forEach((sb) => applicableSet.add(sb.id));
        }
      });
      applicableSubjects = safeSubjects.filter((sb) => applicableSet.has(sb.id));
    }
  }

  const results = calculateExamResults(examId, safeStudents, safeMarksList, safeGrades);
  const examMarks = safeMarksList.filter((m) => {
    if (m.exam_id !== examId) return false;
    const evaluated = evaluateMark(m);
    return evaluated.status === 'Normal' && evaluated.percentage !== null;
  });

  if (results.length === 0) {
    return {
      exam_id: examId,
      exam_name: examName,
      total_students: 0,
      mean_score: 0,
      mean_points: 0,
      mean_grade_code: 'BE2',
      mean_performance_level: 'BE',
      highest_score: 0,
      lowest_score: 0,
      subject_summaries: [],
      grade_counts: {},
      level_counts: { EE: 0, ME: 0, AE: 0, BE: 0 },
      top_performers: [],
      weak_subjects: [],
      strong_subjects: [],
    };
  }

  const assessedResults = results.filter((r) => (r.subject_count || 0) > 0);
  const countAssessed = assessedResults.length;

  const totalMeanScore =
    countAssessed > 0
      ? assessedResults.reduce((sum, r) => sum + r.average, 0) / countAssessed
      : 0;
  const roundedMeanScore = Math.round(totalMeanScore * 10) / 10;

  const totalMeanPoints =
    countAssessed > 0
      ? assessedResults.reduce((sum, r) => sum + r.average_points, 0) / countAssessed
      : 0;
  const roundedMeanPoints = Math.round(totalMeanPoints * 100) / 100;

  const overallGradeObj = getGradeForMark(roundedMeanScore, grades);

  const highestScore = Math.max(...results.map((r) => r.average));
  const lowestScore = Math.min(...results.map((r) => r.average));

  // Grade code distribution (EE1..BE2) & level counts (EE, ME, AE, BE)
  const gradeCounts: Record<string, number> = {};
  const levelCounts: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };

  grades.forEach((g) => {
    const code = g.grade_code || g.grade;
    if (code) gradeCounts[code] = 0;
  });

  results.forEach((r) => {
    const code = r.grade_code || r.grade;
    gradeCounts[code] = (gradeCounts[code] || 0) + 1;

    const level = r.performance_level || 'ME';
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  });

  // Subject Summaries (only for applicable subjects)
  const subjectSummaries = applicableSubjects.map((sb) => {
    const sbMarks = examMarks.filter((m) => m.subject_id === sb.id);
    if (sbMarks.length === 0) {
      return {
        subject_id: sb.id,
        subject_name: sb.subject_name,
        subject_code: sb.subject_code,
        mean_score: 0,
        mean_points: 0,
        highest: 0,
        lowest: 0,
        pass_rate: 0,
      };
    }

    const sbValues = sbMarks.map((m) => {
      const evaluated = evaluateMark(m);
      return evaluated.percentage!;
    });
    const sum = sbValues.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / sbValues.length) * 10) / 10;

    const totalPts = sbValues.reduce(
      (acc, val) => acc + getGradeForMark(val, grades).points,
      0
    );
    const meanPts = Math.round((totalPts / sbValues.length) * 100) / 100;

    const highest = Math.max(...sbValues);
    const lowest = Math.min(...sbValues);

    // Pass rate = % meeting or exceeding expectations (>= 41% or ME/EE)
    const passes = sbValues.filter((v) => v >= 41).length;
    const passRate = Math.round((passes / sbValues.length) * 100);

    return {
      subject_id: sb.id,
      subject_name: sb.subject_name,
      subject_code: sb.subject_code,
      mean_score: mean,
      mean_points: meanPts,
      highest,
      lowest,
      pass_rate: passRate,
    };
  });

  // Top Performers (Top 5)
  const sortedResults = [...results].sort((a, b) => a.position - b.position);
  const topPerformers = sortedResults.slice(0, 5).map((r) => {
    const std = students.find((s) => s.id === r.student_id);
    return {
      student_id: r.student_id,
      student_name: std?.full_name || 'Unknown',
      admission_number: std?.admission_number || '-',
      class_name: std?.class_id || 'Grade 7',
      total_marks: r.total_marks,
      average: r.average,
      total_points: r.total_points,
      average_points: r.average_points,
      grade_code: r.grade_code,
      performance_level: r.performance_level,
      position: r.position,
    };
  });

  // Strong subjects (top 3 mean scores)
  const sortedSubjects = [...subjectSummaries]
    .filter((s) => s.mean_score > 0)
    .sort((a, b) => b.mean_score - a.mean_score);

  const strongSubjects = sortedSubjects.slice(0, 3).map((s) => `${s.subject_name} (${formatPercentage(s.mean_score, true)})`);
  const weakSubjects = [...sortedSubjects].reverse().slice(0, 3).map((s) => `${s.subject_name} (${formatPercentage(s.mean_score, true)})`);

  return {
    exam_id: examId,
    exam_name: examName,
    total_students: results.length,
    mean_score: roundedMeanScore,
    mean_points: roundedMeanPoints,
    mean_grade_code: overallGradeObj.grade_code || overallGradeObj.grade || 'ME1',
    mean_performance_level: overallGradeObj.performance_level || 'ME',
    highest_score: highestScore,
    lowest_score: lowestScore,
    subject_summaries: subjectSummaries,
    grade_counts: gradeCounts,
    level_counts: levelCounts,
    top_performers: topPerformers,
    weak_subjects: weakSubjects,
    strong_subjects: strongSubjects,
  };
}

export interface CalculationValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateCalculationData(
  results: Result[],
  marks: Mark[],
  grades: Grade[],
  subjects: Subject[]
): CalculationValidationResult {
  const errors: string[] = [];

  // Check 1: Validate each result
  results.forEach((r, idx) => {
    // Check percentage bounds
    if (typeof r.average !== 'number' || isNaN(r.average) || r.average < 0 || r.average > 100) {
      errors.push(`Student result #${idx + 1} (${r.student_id}): average percentage ${r.average} is out of bounds [0, 100].`);
    }

    // Check total obtained <= total maximum
    if (typeof r.total_marks === 'number' && typeof r.total_max_marks === 'number' && r.total_max_marks > 0) {
      if (r.total_marks > r.total_max_marks) {
        errors.push(`Student result #${idx + 1} (${r.student_id}): total marks obtained (${r.total_marks}) exceeds maximum (${r.total_max_marks}).`);
      }
    }

    // Check CBE level corresponds to percentage
    if (typeof r.average === 'number' && !isNaN(r.average)) {
      const expectedGrade = getGradeForMark(r.average, grades);
      const actualCode = (r.grade_code || r.grade || '').toUpperCase();
      const expectedCode = (expectedGrade.grade_code || expectedGrade.grade || '').toUpperCase();

      if (r.is_complete !== false && actualCode && actualCode !== 'PENDING' && actualCode !== expectedCode) {
        errors.push(`Student result #${idx + 1} (${r.student_id}): CBE level '${actualCode}' does not correspond to calculated average ${r.average}% (expected '${expectedCode}').`);
      }

      if (r.is_complete !== false && typeof r.points === 'number' && r.points !== expectedGrade.points) {
        errors.push(`Student result #${idx + 1} (${r.student_id}): points '${r.points}' do not correspond to CBE level '${expectedCode}' (expected ${expectedGrade.points}).`);
      }
    }
  });

  // Check 2: Audit individual marks for 9/100 test case & special statuses X/Y
  marks.forEach((m) => {
    const markInfo = evaluateMark(m);

    // Special status check: X and Y must not produce numerical percentage
    if (markInfo.status === 'X' || markInfo.status === 'Y') {
      if (markInfo.percentage !== null) {
        errors.push(`Special status mark '${markInfo.status}' for student ${m.student_id} produced a non-null numerical percentage: ${markInfo.percentage}.`);
      }
    }

    // Explicit 9/100 test case check
    if (markInfo.status === 'Normal' && markInfo.rawScore === 9 && markInfo.outOf === 100) {
      if (markInfo.percentage !== 9) {
        errors.push(`Test case failure: raw mark 9/100 produced percentage ${markInfo.percentage}% instead of 9%.`);
      }
      const gr = getGradeForMark(markInfo.percentage!, grades);
      if (gr.grade_code !== 'BE2') {
        errors.push(`Test case failure: raw mark 9/100 produced CBE level '${gr.grade_code}' instead of 'BE2'.`);
      }
      if (gr.points !== 1) {
        errors.push(`Test case failure: raw mark 9/100 produced points '${gr.points}' instead of 1.`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

