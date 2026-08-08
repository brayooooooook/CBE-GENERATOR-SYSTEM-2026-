import { Subject, SubjectGroup, Grade, getEducationLevelForGrade, getApplicableSubjectsForGrade } from '../types';
import { api } from '../lib/storage';
import { getGradeForMark } from '../services/analysisEngine';
import { evaluateMark } from './markUtils';

export interface DynamicSubjectColumn {
  id: string;
  subject_code: string;
  subject_name: string;
  is_group: boolean;
  subject_ids: string[];
  display_order: number;
}

export interface CalculatedGroupResult {
  column: DynamicSubjectColumn;
  total_marks: number;
  percentage: number | null;
  grade_code: string;
  points: number;
  performance_level: string;
  status: 'Normal' | 'X' | 'Y' | 'Blank';
  displayText: string; // e.g. "75 | ME" or "X" or "84"
  assessed_count: number;
}

/**
 * Resolves dynamic subject columns for a given grade or education level.
 * Checks for active Subject Groups configured for that education level.
 * If active groups exist for the education level, returns group columns.
 * Otherwise, falls back to standard individual applicable subjects for that level.
 */
export function getDynamicSubjectColumnsForGrade(
  grade: string,
  allSubjects: Subject[] = [],
  customGroups?: SubjectGroup[]
): DynamicSubjectColumn[] {
  const eduLevel = getEducationLevelForGrade(grade);

  const groups = customGroups || api.getSubjectGroups();
  const activeLevelGroups = (groups || [])
    .filter((g) => g.education_level === eduLevel && g.is_active !== false)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  if (activeLevelGroups.length > 0) {
    return activeLevelGroups.map((g) => ({
      id: g.id,
      subject_code: g.group_code,
      subject_name: g.group_name,
      is_group: true,
      subject_ids: g.subject_ids || [],
      display_order: g.display_order || 1,
    }));
  }

  // Standard applicable subjects for un-grouped education levels
  const stdSubjects = getApplicableSubjectsForGrade(grade, allSubjects);
  return stdSubjects.map((s, idx) => ({
    id: s.id,
    subject_code: s.subject_code,
    subject_name: s.subject_name,
    is_group: false,
    subject_ids: [s.id],
    display_order: idx + 1,
  }));
}

/**
 * Calculates a single student's performance score for a given subject column (group or single subject).
 */
export function calculateColumnScore(
  column: DynamicSubjectColumn,
  studentId: string,
  studentMarks: { subject_id: string; marks: number | string; student_id: string }[],
  grades: Grade[]
): CalculatedGroupResult {
  const memberSubjectIds = column.subject_ids || [];

  let totalMarksSum = 0;
  let sumPercentage = 0;
  let assessedCount = 0;
  let xCount = 0;
  let yCount = 0;
  let totalMemberCount = memberSubjectIds.length;

  memberSubjectIds.forEach((subId) => {
    const markObj = studentMarks.find((m) => m.student_id === studentId && m.subject_id === subId);
    const markInfo = evaluateMark(markObj as any);

    if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      assessedCount++;
      totalMarksSum += Math.round(markInfo.percentage);
      sumPercentage += markInfo.percentage;
    } else if (markInfo.status === 'X') {
      xCount++;
    } else if (markInfo.status === 'Y') {
      yCount++;
    }
  });

  if (assessedCount > 0) {
    const avgPercentage = sumPercentage / assessedCount;
    const roundedAvg = Math.round(avgPercentage * 10) / 10;
    const gr = getGradeForMark(roundedAvg, grades);

    const grCode = (gr as any).grade_code || (gr as any).code || 'ME';
    const grLevel = (gr as any).performance_level || (gr as any).name || grCode;

    return {
      column,
      total_marks: totalMarksSum,
      percentage: roundedAvg,
      grade_code: grCode,
      points: gr.points,
      performance_level: grLevel,
      status: 'Normal',
      displayText: `${Math.round(roundedAvg)} ${grCode}`,
      assessed_count: assessedCount,
    };
  }

  if (xCount > 0 && xCount >= totalMemberCount - yCount) {
    return {
      column,
      total_marks: 0,
      percentage: null,
      grade_code: 'X',
      points: 0,
      performance_level: 'Absent',
      status: 'X',
      displayText: 'X',
      assessed_count: 0,
    };
  }

  if (yCount > 0) {
    return {
      column,
      total_marks: 0,
      percentage: null,
      grade_code: 'Y',
      points: 0,
      performance_level: 'Irregularity',
      status: 'Y',
      displayText: 'Y',
      assessed_count: 0,
    };
  }

  return {
    column,
    total_marks: 0,
    percentage: null,
    grade_code: '-',
    points: 0,
    performance_level: 'Not Evaluated',
    status: 'Blank',
    displayText: '-',
    assessed_count: 0,
  };
}
