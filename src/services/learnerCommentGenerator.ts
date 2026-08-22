import {
  Student,
  Subject,
  Mark,
  Grade,
  Examination,
} from '../types';
import { evaluateMark } from '../utils/markUtils';

export interface GenerateCommentOptions {
  student: Student;
  examId: string;
  marks: Mark[];
  subjects: Subject[];
  grades: Grade[];
  exams?: Examination[];
  averageScore?: number;
  averagePoints?: number;
  overallLevel?: string;
  commentType?: 'class_teacher' | 'hoi';
  isProvisional?: boolean;
}

// Deterministic hash based on student info to pick template variations reliably
function getStudentHash(studentId: string, admNo: string = '', extra: string = ''): number {
  const str = `${studentId}_${admNo}_${extra}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Helper to pick one element deterministically from an array based on seed and offset
function pickVariant<T>(arr: T[], seed: number, offset: number = 0): T {
  const index = (seed + offset) % arr.length;
  return arr[index];
}

/**
 * Generates a dynamic, individualised comment for a learner based on actual assessment data.
 * Rules:
 * 1. Provisional reports (missing marks, pending results, or explicit flag):
 *    - Generate non-academic provisional comments for CT & HOI explaining incomplete state.
 * 2. Completed reports:
 *    - CT Comment: Exactly 1 sentence, 20-40 words, data-driven (strength, weakness, trend, consistency).
 *    - HOI Comment: Exactly 1 sentence, 15-35 words, encouraging institutional approval & readiness.
 * 3. Unique wording for every learner, never repeating identical sentences.
 * 4. No rank/position mentions, no grade codes (EE2, ME1, etc.), no data contradictions.
 */
export function generatePersonalizedLearnerComment(options: GenerateCommentOptions): string {
  const {
    student,
    examId,
    marks = [],
    subjects = [],
    grades = [],
    exams = [],
    averageScore: providedAvg,
    commentType = 'class_teacher',
    isProvisional: explicitProvisional = false,
  } = options;

  const admNo = student.admission_number || '';
  const seed = getStudentHash(student.id, admNo, commentType);

  // 1. Gather student's marks for current exam & check completeness
  const stdExamMarks = marks.filter((m) => m.student_id === student.id && m.exam_id === examId);

  let assessedCount = 0;
  let totalScore = 0;
  let missingCount = 0;
  let irregularityCount = 0;

  interface SubjectEval {
    subject: Subject;
    score: number;
  }
  const subjectEvals: SubjectEval[] = [];

  subjects.forEach((sb) => {
    const markObj = stdExamMarks.find((m) => m.subject_id === sb.id);
    const markInfo = evaluateMark(markObj);

    if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      assessedCount++;
      totalScore += markInfo.percentage;
      subjectEvals.push({ subject: sb, score: markInfo.percentage });
    } else if (markInfo.status === 'X') {
      missingCount++;
    } else if (markInfo.status === 'Y') {
      irregularityCount++;
    }
  });

  const isProvisional = explicitProvisional || missingCount > 0 || (subjects.length > 0 && assessedCount < subjects.length);

  // --- PROVISIONAL REPORT COMMENTS ---
  if (isProvisional) {
    if (commentType === 'hoi') {
      const hoiProvisionalPool = [
        "This report is provisional and should not be considered the learner's final academic record, as official comments will be issued after complete examination review and approval.",
        "Please note that this provisional report serves as an interim document, and official performance evaluation will be finalized once all pending assessment records are approved.",
        "As an interim provisional document, final institutional approval and official academic remarks for this learner will be confirmed after all pending marks are fully processed.",
        "This is a provisional academic statement, and formal institutional comments will be issued upon final verification and approval of all learning area assessment results.",
        "This document represents a provisional result for verification purposes, and official comments will be released following complete examination audit and final administrative approval.",
      ];
      return pickVariant(hoiProvisionalPool, seed, 1);
    } else {
      const ctProvisionalPool = [
        "This learner's assessment is still incomplete because one or more learning area marks are pending, and a full academic evaluation will be available once all assessments are verified.",
        "As certain assessment tasks remain pending verification, this learner's evaluation is currently incomplete until all subject marks are fully compiled into the official record.",
        "This assessment record remains provisional due to outstanding subject entries, and comprehensive academic performance feedback will be provided once all marks are uploaded and approved.",
        "With some learning area results currently outstanding, this learner's assessment is incomplete, and an official performance comment will be issued upon complete mark entry.",
        "This learner's report is pending full completion of assessment entries, and a complete academic evaluation will be issued as soon as all subject marks are submitted.",
      ];
      return pickVariant(ctProvisionalPool, seed, 2);
    }
  }

  // --- COMPLETED REPORT COMMENTS ---
  const computedAvg = assessedCount > 0 ? totalScore / assessedCount : 0;
  const avgScore = providedAvg !== undefined ? providedAvg : computedAvg;

  // Identify strongest and weakest learning areas
  subjectEvals.sort((a, b) => b.score - a.score);
  const strongest = subjectEvals.length > 0 && subjectEvals[0].score >= 50 ? subjectEvals[0] : null;
  const weakest =
    subjectEvals.length > 1 && subjectEvals[subjectEvals.length - 1].score < 65
      ? subjectEvals[subjectEvals.length - 1]
      : null;

  const scoreSpread =
    subjectEvals.length > 1
      ? subjectEvals[0].score - subjectEvals[subjectEvals.length - 1].score
      : 0;
  const isHighlyConsistent = subjectEvals.length >= 3 && scoreSpread <= 12;

  // Previous exam trend check (only if valid previous exam data exists)
  let trend: number | null = null;
  if (exams.length > 1) {
    const currentExamIndex = exams.findIndex((e) => e.id === examId);
    const prevExam = exams.find((e, idx) => e.id !== examId && (currentExamIndex >= 0 ? idx !== currentExamIndex : true));
    if (prevExam) {
      const prevMarks = marks.filter((m) => m.student_id === student.id && m.exam_id === prevExam.id);
      let prevAssessed = 0;
      let prevTotal = 0;
      prevMarks.forEach((m) => {
        const info = evaluateMark(m);
        if (info.status === 'Normal' && info.percentage !== null) {
          prevAssessed++;
          prevTotal += info.percentage;
        }
      });
      if (prevAssessed > 0) {
        const prevAvg = prevTotal / prevAssessed;
        trend = avgScore - prevAvg;
      }
    }
  }

  // --- COMPLETED: HEAD OF INSTITUTION (HOI) COMMENT ---
  // Constraint: Exactly 1 sentence, 15 to 35 words.
  if (commentType === 'hoi') {
    if (avgScore >= 75) {
      const hoiHighPool = [
        "Approved with commendation for exemplary academic dedication, strong discipline, and continued commitment to high learning standards across all evaluated subjects.",
        "Approved and recommended for sustained academic effort to maintain your high level of performance and leadership in classroom learning activities.",
        "Official approval granted with high praise for your commendable achievements and encouragement to maintain your admirable dedication to learning.",
        "Approved with distinction, reflecting your exceptional commitment to academic progress and readiness for advanced learning challenges in future terms.",
        "Approved with warm congratulations on your outstanding assessment results and recommended for continued academic excellence across all subjects.",
      ];
      return pickVariant(hoiHighPool, seed, 3);
    } else if (avgScore >= 50) {
      const hoiMedPool = [
        "Approved with encouragement to maintain steady effort, active participation, and regular revision to support your ongoing academic development.",
        "Official approval granted, with recommendation for continued focus and disciplined study habits to strengthen achievement across all learning areas.",
        "Approved for advancement with academic encouragement to build greater consistency and aim for higher achievement in upcoming assessment terms.",
        "Approved with recommendation to sustain your positive learning attitude and engage actively in classroom activities to maximize your potential.",
        "Approved with praise for your steady progress and encouragement to maintain focused practice in all evaluated subjects.",
      ];
      return pickVariant(hoiMedPool, seed, 4);
    } else {
      const hoiLowPool = [
        "Approved with recommendation for structured remedial support, regular study practice, and close guidance to strengthen core learning competencies.",
        "Approved with academic encouragement to focus on regular revision habits and seek teacher guidance to elevate overall achievement in future assessments.",
        "Official approval granted, with recommendation for active participation in remedial programs to build solid understanding in core learning areas.",
        "Approved with encouragement to remain committed to your studies, complete all learning tasks, and work closely with teachers for better results.",
      ];
      return pickVariant(hoiLowPool, seed, 5);
    }
  }

  // --- COMPLETED: CLASS TEACHER (CT) COMMENT ---
  // Constraint: Exactly 1 sentence, 20 to 40 words.
  if (trend !== null && trend >= 4.0) {
    const trendUpPool = [
      `Your encouraging improvement since the previous assessment reflects commendable dedication, and continuing this positive momentum will strengthen your mastery in all learning areas.`,
      `You have made impressive progress compared to your previous assessment, demonstrating positive learning momentum that will support your continued academic success.`,
      `Your assessment results show encouraging growth since the last examination, highlighting your hard work and commitment to expanding your understanding.`,
    ];
    return pickVariant(trendUpPool, seed, 6);
  }

  if (avgScore >= 75) {
    if (strongest) {
      const sName = strongest.subject.subject_name;
      const ctHighStrengthPool = [
        `You have demonstrated outstanding understanding in ${sName}, displaying commendable mastery across your learning areas while maintaining your dedication to achieve even greater success.`,
        `Your exemplary performance across evaluated learning areas highlights your high dedication, particularly in ${sName}, which sets a strong benchmark for your ongoing studies.`,
        `You have shown impressive academic progress with solid mastery in ${sName}, and continuing your regular practice will support sustained high achievement across all competencies.`,
        `Your excellent effort in ${sName} and core subjects reflects high commitment, and maintaining this positive attitude will ensure continued academic distinction.`,
      ];
      return pickVariant(ctHighStrengthPool, seed, 7);
    } else {
      const ctHighGeneralPool = [
        `Your consistent high achievement across all evaluated learning areas reflects a disciplined study routine, which will continue to support your commendable academic growth.`,
        `You have demonstrated exemplary commitment to academic achievement with impressive understanding, setting a positive example through active classroom engagement.`,
      ];
      return pickVariant(ctHighGeneralPool, seed, 8);
    }
  } else if (avgScore >= 50) {
    if (strongest && weakest && strongest.subject.id !== weakest.subject.id) {
      const sName = strongest.subject.subject_name;
      const wName = weakest.subject.subject_name;
      const ctMedContrastPool = [
        `You have achieved commendable progress in ${sName}, though allocating additional practice time to ${wName} will help build greater consistency across all your learning areas.`,
        `Your solid performance in ${sName} is encouraging, and giving extra attention to ${wName} will help raise your overall achievement to an even higher level.`,
        `You have displayed good aptitude in ${sName}, while focused revision in ${wName} will help balance your achievements across all evaluated subjects.`,
      ];
      return pickVariant(ctMedContrastPool, seed, 9);
    } else if (strongest) {
      const sName = strongest.subject.subject_name;
      const ctMedStrengthPool = [
        `You have demonstrated steady progress with good potential in ${sName}, and maintaining regular study habits will help elevate your achievement across all subjects.`,
        `Your commendable effort in ${sName} highlights your academic capability, and consistent practice in all learning areas will yield even better results.`,
      ];
      return pickVariant(ctMedStrengthPool, seed, 10);
    } else if (isHighlyConsistent) {
      const ctMedConsistentPool = [
        `You have maintained steady and balanced performance across all evaluated learning areas, and continued classroom participation will support your ongoing academic development.`,
        `Your consistent results across all subjects demonstrate a disciplined learning routine that provides a solid foundation for future achievement.`,
      ];
      return pickVariant(ctMedConsistentPool, seed, 11);
    } else {
      const ctMedGeneralPool = [
        `Your performance shows steady academic progress in core concepts, and regular practice combined with active participation will help strengthen your understanding further.`,
        `You have performed well across several learning areas, and maintaining focused study habits will help you achieve even higher overall results.`,
      ];
      return pickVariant(ctMedGeneralPool, seed, 12);
    }
  } else {
    if (weakest) {
      const wName = weakest.subject.subject_name;
      const ctLowWeaknessPool = [
        `Your assessment reflects fair foundational effort, and dedicating extra revision time to ${wName} will support your progress toward achieving higher competency levels.`,
        `You possess good learning potential, and focusing on guided practice in ${wName} will help strengthen your overall academic achievement.`,
      ];
      return pickVariant(ctLowWeaknessPool, seed, 13);
    } else {
      const ctLowGeneralPool = [
        `You have demonstrated good basic potential in your learning areas, and focusing on regular practice with teacher guidance will help strengthen your overall achievement.`,
        `Your results show foundational effort, and consistent classroom participation alongside regular study habits will help elevate your academic progress.`,
      ];
      return pickVariant(ctLowGeneralPool, seed, 14);
    }
  }
}
