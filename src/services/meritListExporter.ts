import rawJsPDF from 'jspdf';
const jsPDF = (rawJsPDF as any).jsPDF || rawJsPDF;
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { savePdf, saveFile } from '../utils/fileDownloader';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Grade,
  Teacher,
  getEducationLevelForGrade,
  getApplicableSubjectsForGrade,
  getStreamOrderIndex,
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  CBE_8_POINT_GRADES,
  getLearnerReportSubjects,
  validateCalculationData,
} from './analysisEngine';
import { getFilteredStudents, getClassStreamLabel, formatStandardExamCode } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, formatPercentage, getAbbreviatedLevel, getShortRemark } from '../utils/markUtils';

export interface MeritListData {
  school: School;
  exam?: Examination;
  comparisonExamId?: string;
  selectedClassId: string;
  selectedStreamId?: string;
  classes: ClassStream[];
  teachers?: Teacher[];
  students: Student[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  generatedBy?: string;
}

export interface MeritListClassTeacherInfo {
  isAllStreams: boolean;
  specificTeacherName?: string;
  streamTeachers: Array<{ streamName: string; teacherName: string }>;
  summaryText: string;
}

export function resolveMeritListClassTeachers(
  classes: ClassStream[] = [],
  teachers: Teacher[] = [],
  selectedClassId: string = 'all',
  selectedStreamId?: string,
  targetGrade?: string,
  targetStudents: Student[] = []
): MeritListClassTeacherInfo {
  const isStreamAll =
    !selectedStreamId ||
    selectedStreamId === 'all' ||
    selectedStreamId === 'All Streams';

  const getTeacherForClassStream = (cs?: ClassStream | null): string => {
    if (!cs) return 'NOT ASSIGNED';
    if (cs.class_teacher_id) {
      const byId = teachers.find((t) => t.id === cs.class_teacher_id);
      if (byId && byId.teacher_name) return byId.teacher_name.trim();
    }
    const byOfId = teachers.find(
      (t) =>
        t.is_class_teacher &&
        (t.class_teacher_of_id === cs.stream_id ||
          t.class_teacher_of_id === cs.id ||
          (cs.stream_id && t.class_teacher_of_id === cs.stream_id))
    );
    if (byOfId && byOfId.teacher_name) return byOfId.teacher_name.trim();

    return 'NOT ASSIGNED';
  };

  // Case 1: Specific Stream Selected
  if (!isStreamAll) {
    const targetStream =
      classes.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId) ||
      classes.find(
        (c) =>
          c.stream &&
          c.stream.toLowerCase() === (selectedStreamId || '').toLowerCase() &&
          (!targetGrade || (c.class_name || '').toLowerCase() === targetGrade.toLowerCase())
      ) ||
      classes.find(
        (c) => c.stream && c.stream.toLowerCase() === (selectedStreamId || '').toLowerCase()
      );

    const teacherName = getTeacherForClassStream(targetStream);
    const streamName = targetStream?.stream || selectedStreamId || '';
    return {
      isAllStreams: false,
      specificTeacherName: teacherName,
      streamTeachers: [
        {
          streamName,
          teacherName,
        },
      ],
      summaryText: teacherName,
    };
  }

  // Case 2: All Streams Selected
  let relevantStreams = classes.filter((c) => {
    if (selectedClassId && selectedClassId !== 'all') {
      return (
        c.id === selectedClassId ||
        (targetGrade && (c.class_name || '').toLowerCase() === targetGrade.toLowerCase())
      );
    }
    if (targetGrade) {
      return (c.class_name || '').toLowerCase() === targetGrade.toLowerCase();
    }
    return true;
  });

  if (relevantStreams.length === 0 && targetStudents.length > 0) {
    const studentStreamNames = Array.from(
      new Set(
        targetStudents
          .map((s) => s.stream_id || (s as any).stream_name || '')
          .filter(Boolean)
      )
    );
    relevantStreams = classes.filter(
      (c) =>
        studentStreamNames.includes(c.stream_id || '') ||
        studentStreamNames.includes(c.id) ||
        studentStreamNames.includes(c.stream)
    );
  }

  const seenStreams = new Set<string>();
  const uniqueStreams: ClassStream[] = [];
  for (const cs of relevantStreams) {
    const key = (cs.stream_id || cs.stream || cs.id).toLowerCase();
    if (!seenStreams.has(key)) {
      seenStreams.add(key);
      uniqueStreams.push(cs);
    }
  }

  uniqueStreams.sort((a, b) => {
    const idxA = getStreamOrderIndex(a.stream);
    const idxB = getStreamOrderIndex(b.stream);
    if (idxA !== idxB) return idxA - idxB;
    return (a.stream || '').localeCompare(b.stream || '');
  });

  const streamTeachers = uniqueStreams.map((cs) => {
    const streamName = (cs.stream || 'DEFAULT').toUpperCase();
    const teacherName = getTeacherForClassStream(cs);
    return {
      streamName,
      teacherName,
    };
  });

  const summaryText =
    streamTeachers.length > 0
      ? streamTeachers.map((st) => `${st.streamName} — ${st.teacherName}`).join(' | ')
      : 'NOT ASSIGNED';

  return {
    isAllStreams: true,
    streamTeachers,
    summaryText,
  };
}


function populateComparisonResults(
  results: any[],
  comparisonExamId: string | undefined,
  allStudents: any[],
  marks: any[],
  grades: any[],
  classes: any[],
  allSubjects: any[]
) {
  if (!comparisonExamId) return;
  const comparisonMap = new Map();
  const compResults = calculateExamResults(comparisonExamId, allStudents, marks, grades, classes, allSubjects);
  compResults.forEach(r => comparisonMap.set(r.student_id, r));

  results.forEach(r => {
    const prev = comparisonMap.get(r.student_id);
    if (prev) {
      r.previous_position = prev.position;
      r.previous_class_position = prev.class_position || prev.stream_position;
    } else {
      r.previous_position = null;
      r.previous_class_position = null;
    }
  });
}

// Convert image URL to base64 for jsPDF
async function getBase64ImageFromUrl(imageUrl?: string | null): Promise<string | null> {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) return null;
  if (imageUrl.startsWith('data:image/')) return imageUrl;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2500);
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 100;
          canvas.height = img.height || 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      img.src = imageUrl;
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// Helper functions for standardized CBE Subject Codes & Full Names
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
  if (!code) return 'SUBJ';
  if (code.startsWith('PP-') || code.startsWith('LP-')) return code;
  if (['ENG', 'KISW', 'MATHS', 'SCT', 'SS', 'AGR', 'CA', 'CRE'].includes(code)) return code;
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
    // Official Standard Order:
    'ENG': 1,
    'ENGLISH': 1,

    'KIS': 2,
    'KISW': 2,
    'KISWAHILI': 2,

    'MATH': 3,
    'MAT': 3,
    'MATHEMATICS': 3,
    'MATHS': 3,

    'SCT': 4,
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

    'SS': 6,
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

function getSubjectFullName(sb: { subject_code: string; subject_name: string }): string {
  const code = getShortCbeCode(sb.subject_code, sb.subject_name);
  let name = sb.subject_name || '';

  if (code === 'PRE TECH' && !name.toLowerCase().includes('pre')) {
    name = 'Pre-Technical Studies';
  } else if (code === 'ENG' && !name) {
    name = 'English';
  } else if (code === 'KIS' && !name) {
    name = 'Kiswahili';
  } else if (code === 'MAT' && !name) {
    name = 'Mathematics';
  } else if (code === 'SCI' && !name) {
    name = 'Integrated Science';
  } else if (code === 'SST' && !name) {
    name = 'Social Studies';
  } else if ((code === 'CAS' || code === 'CA') && (!name || name === 'Creative Arts' || name === 'Creative Arts & Sports')) {
    name = 'Creative Arts and Sports';
  } else if (code === 'CRE' && (!name || name === 'CRE' || name.includes('Religious'))) {
    name = 'Christian Religious Education';
  } else if ((code === 'AGN' || code === 'AGR') && (!name || name === 'Agriculture' || name === 'Agriculture & Nutrition')) {
    name = 'Agriculture and Nutrition';
  }

  const cleanName = name.trim();
  if (cleanName.toUpperCase().startsWith(`${code} -`)) {
    return cleanName;
  }
  return `${code} - ${cleanName}`;
}

// --- 1. GENERATE MERIT LIST PDF ---
export async function downloadMeritListPDF(data: MeritListData): Promise<void> {
  const {
    school,
    exam,
    selectedClassId,
    selectedStreamId = 'all',
    classes = [],
    teachers = [],
    students = [],
    subjects = [],
    marks = [],
    grades = [],
    generatedBy = 'Administrator',
  } = data;

  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);
  const firstTargetStudent = targetStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;
  const targetClass = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstTargetStudent?.class_id))
  );
  const targetGrade = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstTargetStudent?.grade || '';
  const eduLevel = getEducationLevelForGrade(targetGrade);

  if (eduLevel === 'Pre-Primary' || eduLevel === 'Lower Primary' || eduLevel === 'Upper Primary') {
    return generatePrimaryMeritListPDF(data, eduLevel);
  }

  const examId = exam?.id || '';
  const streamNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);
  const rawCohortSubjects = targetClass ? getLearnerReportSubjects(firstTargetStudent || {} as any, targetClass, subjects, teachers || []) : [];
  let cohortSubjects = sortSubjectsByStandardOrder(rawCohortSubjects);

  if (cohortSubjects.length === 0) {
    const fallbackSubjects = getApplicableSubjectsForGrade(targetGrade || 'Grade 7', subjects);
    cohortSubjects = sortSubjectsByStandardOrder(fallbackSubjects);
  }

  if (cohortSubjects.length === 0 && subjects.length > 0) {
    const jsSubjects = subjects.filter(
      (s) => s.status !== 'Archived' && ((s.education_level as string) === 'Junior School' || (s.education_level as string) === 'Junior Secondary')
    );
    cohortSubjects = sortSubjectsByStandardOrder(jsSubjects);
  }

  // Calculate results for target students
  const results = calculateExamResults(examId, targetStudents, marks, grades, classes, cohortSubjects);
  populateComparisonResults(results, data.comparisonExamId, students, marks, grades, classes, subjects);

  // Validate calculation engine output
  const validation = validateCalculationData(results, marks, grades, cohortSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  // Sort learners for display by authoritative position ascending (complete learners first), with total_marks descending as fallback
  results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));

  const assessedResults = results.filter((r) => (r.subject_count || 0) > 0);
  const assessedStudentIds = new Set(assessedResults.map((r) => r.student_id));
  const assessedStudents = targetStudents.filter((s) => assessedStudentIds.has(s.id));
  const countAssessed = assessedResults.length;
  const totalLearners = targetStudents.length;

  // Class Mean Mark = average percentage score across assessed learners ONLY
  const totalStudentAverages = assessedResults.reduce((acc, r) => acc + r.average, 0);
  const overallClassAverageNum = countAssessed > 0 ? totalStudentAverages / countAssessed : 0;
  const overallClassAverage = formatPercentage(overallClassAverageNum, true);

  // Mean Points = average points across assessed learners ONLY
  const totalStudentAvgPoints = assessedResults.reduce((acc, r) => acc + (r.average_points || (r.subject_count > 0 ? r.total_points / r.subject_count : 0)), 0);
  const meanPointsNum = countAssessed > 0 ? totalStudentAvgPoints / countAssessed : 0;
  const meanPoints = meanPointsNum.toFixed(2);

  // Standard 9 CBE Subjects
  const defaultSubjectCodes = ['ENG', 'KIS', 'MATH', 'INT SCI', 'CAS', 'SST', 'CRE', 'AGN', 'PRE-TECH'];

  // Resolve active subjects matching target cohort
  const activeSubjects = cohortSubjects;
  const subjectCodes = activeSubjects.length > 0
    ? activeSubjects.map((sb) => {
        const short = getShortCbeCode(sb.subject_code, sb.subject_name);
        if (short === 'PRE TECH') return 'PRE-TECH';
        if (short === 'INT-SCI') return 'INT SCI';
        if (short === 'MAT') return 'MATH';
        if (short === 'AGR' || short === 'AGRI') return 'AGN';
        if (short === 'C.R.E') return 'CRE';
        return short;
      })
    : defaultSubjectCodes;

  const formattedSubjectHeaders = subjectCodes;

  // Calculate Subject Statistics for Footer Table & track assessed status using evaluateMark
  const subjectStatsMap: Record<string, { avg: number; avgPts: number; gradeCode: string; isAssessed: boolean }> = {};
  activeSubjects.forEach((sb, idx) => {
    const code = formattedSubjectHeaders[idx] || sb.subject_code;
    const subjMarks = marks.filter((m) => String(m.exam_id) === String(examId) && String(m.subject_id) === String(sb.id));
    
    // Filter only normal, valid numerical marks for target assessed students
    const validSubjMarks = subjMarks
      .filter((m) => assessedStudentIds.has(m.student_id))
      .map((m) => ({ student_id: m.student_id, info: evaluateMark(m) }))
      .filter((item) => item.info.status === 'Normal' && item.info.percentage !== null);

    const count = validSubjMarks.length;
    if (count > 0) {
      const sumPct = validSubjMarks.reduce((acc, item) => acc + item.info.percentage!, 0);
      const avgPct = Math.round(sumPct / count);
      const gr = getGradeForMark(avgPct, grades);

      const ptsSum = validSubjMarks.reduce((acc, item) => {
        const g = getGradeForMark(item.info.percentage!, grades);
        return acc + g.points;
      }, 0);
      const avgPts = parseFloat((ptsSum / count).toFixed(2));

      subjectStatsMap[code] = {
        avg: avgPct,
        avgPts: avgPts,
        gradeCode: gr.grade_code || 'ME1',
        isAssessed: true,
      };
    } else {
      subjectStatsMap[code] = {
        avg: 0,
        avgPts: 0,
        gradeCode: '',
        isAssessed: false,
      };
    }
  });

  // Calculate raw average total marks obtained and maximum possible marks
  const totalClassRawObtained = assessedResults.reduce((acc, r) => acc + (r.total_marks || 0), 0);
  const totalClassMaxPossible = assessedResults.reduce((acc, r) => acc + (r.total_max_marks || (r.subject_count * 100)), 0);

  const avgTotalObtained = countAssessed > 0 ? Math.round(totalClassRawObtained / countAssessed) : 0;
  const avgTotalMax = countAssessed > 0 ? Math.round(totalClassMaxPossible / countAssessed) : 100;

  const classAvgScoreSum = `${formatPercentage(overallClassAverageNum, true)} (Mean Total: ${avgTotalObtained} / ${avgTotalMax})`;

  // Initialize A4 Landscape Document (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  const marginTop = 12;
  const marginBottom = 12;
  const contentWidth = pageWidth - marginX * 2; // 277mm

  // Base64 Logo fetch
  const base64Logo = school.logo_url ? await getBase64ImageFromUrl(school.logo_url) : null;

  // Dates
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // Column Headers matching exact spec
  const tableHeadTitles = [
    'S.NO',
    'ADM NO.',
    'LEARNER NAME',
    'STREAM',
    'STR. POS.',
    'OVR POS',
    'PRV STR POS',
    'PRV OVR POS',
    ...formattedSubjectHeaders,
    'SUB. ENTRY',
    'TOTAL MARKS',
    'AVG MARKS',
    'TOTAL PTS',
    'AVG PTS',
    'CBE LEVEL',
    'GRADE CODE',
  ];

  // Build Table Rows
  const tableRows = results.map((r, idx) => {
    const std = targetStudents.find((s) => s.id === r.student_id);
    const histCtx = std && exam ? getLearnerClassAtExamTime(std, exam, classes) : null;
    const cls = classes.find((c) => c.id === (histCtx?.class_id || std?.class_id));
    const streamStr = histCtx
      ? (histCtx.historical_context_resolved ? (histCtx.stream_name || cls?.stream || '-') : '-')
      : (cls?.stream ? cls.stream : '-');
    const isComplete = r.is_complete !== false;
    const overallPos = isComplete && r.position ? `${r.position}` : '-';
    const streamRank = isComplete && (r.class_position || r.position) ? `${r.class_position || r.position}` : '-';

    // Previous positions
    const prevOvrPos = isComplete && (r as any).previous_position ? `${(r as any).previous_position}` : '-';
    const prevStrPos = isComplete && (r as any).previous_class_position ? `${(r as any).previous_class_position}` : '-';

    // Subject cells format: "MARK CBE_CODE" e.g. "82 EE2" or "X" / "Y" / "-"
    const subjectCells = activeSubjects.length > 0
      ? activeSubjects.map((sb, sbIdx) => {
          const code = formattedSubjectHeaders[sbIdx] || getShortCbeCode(sb.subject_code, sb.subject_name);
          const stStats = subjectStatsMap[code];

          // If subject was not assessed in the examination, leave cell blank
          if (stStats && !stStats.isAssessed) {
            return '';
          }

          const stdMark = marks.find(
            (m) => String(m.student_id) === String(r.student_id) && String(m.subject_id) === String(sb.id) && String(m.exam_id) === String(examId)
          );
          const markInfo = evaluateMark(stdMark);

          if (markInfo.status === 'X') {
            return 'X';
          }
          if (markInfo.status === 'Y') {
            return 'Y';
          }
          if (markInfo.status === 'Blank' || markInfo.percentage === null) {
            return '-';
          }

          const displayedPct = Math.round(markInfo.percentage);
          const gr = getGradeForMark(markInfo.percentage, grades);
          return `${displayedPct} ${gr.grade_code || 'ME1'}`;
        })
      : formattedSubjectHeaders.map(() => '-');

    const subEntry = activeSubjects.filter((sb) => {
      const m = marks.find(
        (mk) => String(mk.student_id) === String(r.student_id) && String(mk.subject_id) === String(sb.id) && String(mk.exam_id) === String(examId)
      );
      const info = evaluateMark(m);
      return info.status === 'Normal' && info.percentage !== null;
    }).length;

    const isAssessed = subEntry > 0;
    const assessedCnt = isAssessed ? subEntry : 1;
    const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
      ? r.average_points
      : (r.total_points / assessedCnt);
    const avgPts = isComplete && isAssessed ? avgPtsNum.toFixed(2) : '-';
    const overallLevelObj = getGradeForMark(r.average, grades);

    const cbeLevel = isComplete
      ? (overallLevelObj.performance_level || 'ME')
      : isAssessed
      ? (overallLevelObj.performance_level || 'ME')
      : '-';

    const gradeCode = isComplete
      ? (overallLevelObj.grade_code || 'ME1')
      : isAssessed
      ? `Prov (${overallLevelObj.grade_code || 'ME1'})`
      : 'Pending';

    return [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN LEARNER').toUpperCase(),
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      `${subEntry}`,
      isAssessed ? `${Math.round(r.total_marks)}` : '-',
      isComplete && isAssessed ? formatPercentage(r.average, true) : isAssessed ? `${formatPercentage(r.average, true)} (P)` : '-',
      isComplete && isAssessed ? `${r.total_points}` : '-',
      avgPts,
      cbeLevel,
      gradeCode,
    ];
  });

  // Proportional Column Widths matching official template geometry (277mm printable width)
  const numSubjs = formattedSubjectHeaders.length || 1;
  const sumMetaW = 100; // 6 + 14 + 38 + 10 + 8 + 8 + 8 + 8 = 100mm (reclaimed 5mm allocated to LEARNER NAME)
  const sumSummaryW = 73;
  const availSubjW = (contentWidth - sumMetaW - sumSummaryW) / numSubjs;

  const columnStyles: Record<number, any> = {
    0: { cellWidth: 6, halign: 'center', fontStyle: 'normal' },
    1: { cellWidth: 14, halign: 'left', fontStyle: 'normal' },
    2: { cellWidth: 38, halign: 'left', fontStyle: 'normal' },
    3: { cellWidth: 10, halign: 'center', fontStyle: 'normal' },
    4: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    5: { cellWidth: 8, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    6: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    7: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
  };

  const startSubjIdx = 8;
  for (let i = 0; i < numSubjs; i++) {
    columnStyles[startSubjIdx + i] = { cellWidth: availSubjW, halign: 'center', fontStyle: 'normal' };
  }

  const startSummIdx = startSubjIdx + numSubjs;
  columnStyles[startSummIdx]     = { cellWidth: 7, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 1] = { cellWidth: 11, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 2] = { cellWidth: 11, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
  columnStyles[startSummIdx + 3] = { cellWidth: 10, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 4] = { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
  columnStyles[startSummIdx + 5] = { cellWidth: 10, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 6] = { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };

  const subjectColIndices = Array.from({ length: numSubjs }, (_, k) => startSubjIdx + k);
  // ONLY rotate vertical titles (Positions and Summary columns), NOT Subject or metadata titles
  const rotatedHeaderIndices = [4, 5, 6, 7, startSummIdx, startSummIdx + 1, startSummIdx + 2, startSummIdx + 3, startSummIdx + 4, startSummIdx + 5, startSummIdx + 6];

  // Function to Render Official Document Header (FIRST PAGE ONLY) - NO SCHOOL LOGO FOR JUNIOR SCHOOL MERIT LIST
  const renderDocumentHeader = () => {
    const textLeft = marginX;

    // Line 1: School Name (Emerald Teal)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 135, 103);
    const schoolNameStr = (school.school_name || 'MUCHORWE JUNIOR SCHOOL').toUpperCase();
    doc.text(schoolNameStr, textLeft, 10);

    // Line 2: Report Title (Black)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text("REPORT: STUDENTS' PERFORMANCE MERIT LIST", textLeft, 15.5);

    // Line 3: Metadata Line (Left Aligned)
    const metaY = 21.0;
    doc.setFontSize(8);

    const classNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);
    const termStr = String(exam?.term || 'Term 2');
    const yearStr = String(exam?.year || '2026');
    const examNameStr = (exam?.exam_name || 'ENDTERM 2').toUpperCase();
    const examCodeStr = formatStandardExamCode(targetGrade || classNameStr, exam);

    const teacherInfo = resolveMeritListClassTeachers(
      classes,
      teachers,
      selectedClassId,
      selectedStreamId,
      targetGrade,
      targetStudents
    );

    const isAllStreams = teacherInfo.isAllStreams;

    if (!isAllStreams) {
      // Specific Stream Selected (Single Metadata Line at Y = 20.0)
      const metaY = 20.0;
      doc.setFontSize(7.8);

      let curX = textLeft;
      const itemGap = 4.5;

      const renderItem = (label: string, value: string, underline = false) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(label, curX, metaY);
        curX += doc.getTextWidth(label) + 1.0;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 85, 204);
        doc.text(value, curX, metaY);
        const valW = doc.getTextWidth(value);
        if (underline) {
          doc.setDrawColor(0, 85, 204);
          doc.setLineWidth(0.3);
          doc.line(curX, metaY + 0.6, curX + valW, metaY + 0.6);
        }
        curX += valW + itemGap;
      };

      const streamDisplay =
        classes.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId)?.stream ||
        streamNameStr;

      renderItem('CLASS:', (targetGrade || 'Grade 8').toUpperCase(), true);
      renderItem('STREAM:', streamDisplay.toUpperCase());
      renderItem('CLASS TEACHER:', teacherInfo.specificTeacherName || 'NOT ASSIGNED');
      renderItem('TERM:', termStr);
      renderItem('YEAR:', yearStr);
      renderItem('EXAM NAME:', examNameStr);
      renderItem('EXAM CODE:', examCodeStr);
    } else {
      // All Streams Selected (2 Metadata Lines)
      // Line 1: Basic Exam & Class Metadata (at Y = 19.0)
      const metaY1 = 19.0;
      doc.setFontSize(7.8);

      let curX = textLeft;
      const itemGap = 5.0;

      const renderItem1 = (label: string, value: string, underline = false) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(label, curX, metaY1);
        curX += doc.getTextWidth(label) + 1.0;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 85, 204);
        doc.text(value, curX, metaY1);
        const valW = doc.getTextWidth(value);
        if (underline) {
          doc.setDrawColor(0, 85, 204);
          doc.setLineWidth(0.3);
          doc.line(curX, metaY1 + 0.6, curX + valW, metaY1 + 0.6);
        }
        curX += valW + itemGap;
      };

      renderItem1('CLASS:', (targetGrade || 'Grade 8').toUpperCase(), true);
      renderItem1('STREAM:', 'ALL STREAMS');
      renderItem1('TERM:', termStr);
      renderItem1('YEAR:', yearStr);
      renderItem1('EXAM NAME:', examNameStr);
      renderItem1('EXAM CODE:', examCodeStr);

      // Line 2: Stream-Specific Teachers Metadata (at Y = 23.5)
      const metaY2 = 23.5;
      let curX2 = textLeft;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('CLASS TEACHERS:', curX2, metaY2);
      curX2 += doc.getTextWidth('CLASS TEACHERS:') + 1.2;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 85, 204);
      doc.text(teacherInfo.summaryText, curX2, metaY2);
    }
  };

  const teacherInfoJS = resolveMeritListClassTeachers(
    classes,
    teachers,
    selectedClassId,
    selectedStreamId,
    targetGrade,
    targetStudents
  );

  // Run autoTable for Main Student Matrix
  autoTable(doc, {
    startY: teacherInfoJS.isAllStreams ? 27 : 24, // Page 1 starts below official header
    margin: { left: marginX, right: marginX, top: marginTop, bottom: marginBottom },
    head: [tableHeadTitles],
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage', // Repeat ONLY table headers on new pages
    styles: {
      fontSize: 7.2,
      cellPadding: { top: 0.5, bottom: 0.5, left: 0.3, right: 0.3 },
      textColor: [0, 0, 0],
      lineColor: [100, 100, 100],
      lineWidth: 0.18,
      fillColor: [255, 255, 255],
      valign: 'middle',
      halign: 'center',
      minCellHeight: 5.5,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: numSubjs > 11 ? Math.max(5.0, 7.0 - (numSubjs - 11) * 0.3) : 7.0,
      lineColor: [100, 100, 100],
      lineWidth: 0.18,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 18,
    },
    columnStyles: columnStyles,
    didDrawPage: (d) => {
      // Document Header appears ONLY ONCE on the first page
      if (d.pageNumber === 1) {
        renderDocumentHeader();
      }
    },
    willDrawCell: (d) => {
      // Clear default text for rotated headers and subject cells
      if (d.section === 'head' && rotatedHeaderIndices.includes(d.column.index)) {
        d.cell.text = [];
      }
      if (d.section === 'body' && subjectColIndices.includes(d.column.index)) {
        d.cell.text = [];
      }
    },
    didDrawCell: (d) => {
      // 1. Render Rotated Header Titles (90 degrees counter-clockwise)
      if (d.section === 'head' && rotatedHeaderIndices.includes(d.column.index)) {
        const cell = d.cell;
        const title = tableHeadTitles[d.column.index];
        if (title) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(0, 0, 0);
          const x = cell.x + cell.width / 2 + 1.1;
          const y = cell.y + cell.height - 1.8;
          doc.text(title, x, y, { angle: 90 });
        }
      }

      // 2. Render Single-Line Subject Cells: "84 EE2" (Mark + Space + Grade Code)
      if (d.section === 'body' && subjectColIndices.includes(d.column.index)) {
        const cell = d.cell;
        const rowData = tableRows[d.row.index];
        if (!rowData) return;
        const rawVal = String(rowData[d.column.index] || '').trim();
        const centerX = cell.x + cell.width / 2;
        const centerY = cell.y + cell.height / 2;

        if (!rawVal) {
          return;
        }

        if (rawVal.includes(' ')) {
          const spaceIdx = rawVal.indexOf(' ');
          const markStr = rawVal.substring(0, spaceIdx);
          const gradeCodeStr = rawVal.substring(spaceIdx + 1);

          let subjFontSize = 7.2;
          if (availSubjW < 10) {
            subjFontSize = Math.min(7.2, Math.max(4.2, (availSubjW - 0.4) / 1.15));
          }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(subjFontSize);

          let markW = doc.getTextWidth(markStr);
          let spaceW = doc.getTextWidth(' ');
          let gradeW = doc.getTextWidth(gradeCodeStr);
          let totalW = markW + spaceW + gradeW;

          if (totalW > cell.width - 0.4 && totalW > 0) {
            subjFontSize = Math.max(3.8, subjFontSize * ((cell.width - 0.4) / totalW));
            doc.setFontSize(subjFontSize);
            markW = doc.getTextWidth(markStr);
            spaceW = doc.getTextWidth(' ');
            gradeW = doc.getTextWidth(gradeCodeStr);
            totalW = markW + spaceW + gradeW;
          }

          const startX = centerX - totalW / 2;
          const yPos = centerY + 0.7; // Vertical centering offset

          // Mark in normal font weight black
          doc.setTextColor(0, 0, 0);
          doc.text(markStr, startX, yPos);

          // Grade code in normal font weight blue
          if (gradeCodeStr && gradeCodeStr !== '-') {
            doc.setTextColor(0, 85, 204);
            doc.text(gradeCodeStr, startX + markW + spaceW, yPos);
          } else if (gradeCodeStr === '-') {
            doc.setTextColor(140, 140, 140);
            doc.text('-', startX + markW + spaceW, yPos);
          }
        } else {
          let subjFontSize = 7.2;
          if (availSubjW < 10) {
            subjFontSize = Math.min(7.2, Math.max(4.2, (availSubjW - 0.4) / 1.15));
          }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(subjFontSize);
          let textW = doc.getTextWidth(rawVal);
          if (textW > cell.width - 0.4 && textW > 0) {
            subjFontSize = Math.max(3.8, subjFontSize * ((cell.width - 0.4) / textW));
            doc.setFontSize(subjFontSize);
          }
          if (rawVal === 'X' || rawVal === 'Y') {
            doc.setTextColor(220, 38, 38);
          } else {
            doc.setTextColor(0, 0, 0);
          }
          doc.text(rawVal, centerX, centerY + 0.7, { align: 'center' });
        }
      }
    },
  });

  // @ts-ignore
  let finalY = (doc as any).lastAutoTable.finalY + 5;

  // Check if summary section fits on current page (needs ~35mm space)
  if (finalY + 35 > pageHeight - marginBottom) {
    doc.addPage();
    finalY = marginTop + 4;
  }

  // --- FOOTER / SUMMARY SECTION (LAST PAGE ONLY) ---
  const summarySubjHeaders = formattedSubjectHeaders.map((hdr) => {
    const upper = (hdr || '').toUpperCase().trim();
    if (upper === 'MATH' || upper === 'MAT' || upper === 'MATHEMATICS') return 'MAT';
    if (upper === 'INT SCI' || upper === 'INT-SCI' || upper === 'INT/SC' || upper === 'INT.SC' || upper === 'INT/SCI' || upper === 'SCI') return 'INT/SCI';
    if (upper === 'CRE' || upper === 'C.R.E') return 'C.R.E';
    if (upper === 'AGR' || upper === 'AGRI' || upper === 'AGRIC' || upper === 'AGN') return 'AGN';
    if (upper === 'CA' || upper === 'CAS') return 'CAS';
    if (upper === 'PRE-TECH' || upper === 'PRE TECH' || upper === 'PTS') return 'PRE TECH';
    return upper;
  });

  const summaryHead = [['SUBJECT', ...summarySubjHeaders, 'CLASS AVG']];

  const summaryRowMarks = [
    'AVG. MARKS',
    ...formattedSubjectHeaders.map((code) => {
      const st = subjectStatsMap[code];
      return st && st.isAssessed ? formatPercentage(st.avg, true) : '';
    }),
    formatPercentage(overallClassAverageNum, true),
  ];

  const summaryRowPoints = [
    'AVG. POINTS',
    ...formattedSubjectHeaders.map((code) => {
      const st = subjectStatsMap[code];
      return st && st.isAssessed ? `${st.avgPts.toFixed(2)} ${st.gradeCode}` : '';
    }),
    `${meanPointsNum.toFixed(2)} ${getGradeForMark(overallClassAverageNum, grades).grade_code || 'ME1'}`,
  ];

  // Align summary table columns with main table
  const summaryColStyles: Record<number, any> = {
    0: { cellWidth: sumMetaW, fontStyle: 'bold', halign: 'left' },
  };
  for (let i = 0; i < numSubjs; i++) {
    summaryColStyles[i + 1] = { cellWidth: availSubjW, halign: 'center' };
  }
  summaryColStyles[numSubjs + 1] = { cellWidth: sumSummaryW, fontStyle: 'bold', halign: 'center' };

  autoTable(doc, {
    startY: finalY,
    margin: { left: marginX, right: marginX },
    head: summaryHead,
    body: [summaryRowMarks, summaryRowPoints],
    theme: 'grid',
    styles: {
      fontSize: 5.8,
      cellPadding: 0.8,
      textColor: [0, 0, 0],
      lineColor: [100, 100, 100],
      lineWidth: 0.18,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 5.8,
      lineColor: [100, 100, 100],
      lineWidth: 0.18,
      halign: 'center',
    },
    columnStyles: summaryColStyles,
    willDrawCell: (d) => {
      if (d.section === 'body' && d.row.index === 1 && d.column.index > 0) {
        d.cell.text = [];
      }
    },
    didDrawCell: (d) => {
      // Draw AVG. POINTS row with grade code in blue
      if (d.section === 'body' && d.row.index === 1 && d.column.index > 0) {
        const cell = d.cell;
        const val = summaryRowPoints[d.column.index] ? String(summaryRowPoints[d.column.index]) : '';
        if (val.includes(' ')) {
          const spaceIdx = val.indexOf(' ');
          const ptsStr = val.substring(0, spaceIdx);
          const grStr = val.substring(spaceIdx + 1);

          const centerY = cell.y + cell.height / 2;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          const ptsW = doc.getTextWidth(ptsStr);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          const spW = doc.getTextWidth(' ');
          const grW = doc.getTextWidth(grStr);
          const totW = ptsW + spW + grW;

          const startX = cell.x + (cell.width - totW) / 2;
          const textY = centerY + 0.6;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          doc.setTextColor(0, 0, 0);
          doc.text(ptsStr, startX, textY);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(0, 85, 204);
          doc.text(grStr, startX + ptsW + spW, textY);
        }
      }
    },
  });

  // @ts-ignore
  let summaryY = (doc as any).lastAutoTable.finalY + 5;

  // Prominently displayed overall metrics
  const avgTotalObtainedVal = countAssessed > 0 ? totalClassRawObtained / countAssessed : 0;
  const classAvgMarksValStr = avgTotalObtainedVal > 0 ? String(Math.round(avgTotalObtainedVal)) : formatPercentage(overallClassAverageNum, true);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(0, 0, 0);
  const prominentText = `CLASS AVERAGE MARKS: ${classAvgMarksValStr}`;
  doc.text(prominentText, pageWidth / 2, summaryY, { align: 'center' });

  summaryY += 4.5;

  // Calculation Notes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(60, 60, 60);
  doc.text('• Student position assigned using Total Marks', marginX + 4, summaryY);
  summaryY += 3.5;
  doc.text('• Student performance level calculated using student average marks', marginX + 4, summaryY);

  // Footer & Page Numbers on ALL pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 5;

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.15);
    doc.line(marginX, footerY - 2.5, marginX + contentWidth, footerY - 2.5);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Report generated on: ${dateStr}: at ${timeStr}  Page ${i}/${totalPages}`,
      marginX + contentWidth,
      footerY,
      { align: 'right' }
    );
  }

  // Save PDF file
  const fileName = `CBE_Merit_List_${streamNameStr.replace(/\s+/g, '_')}_${(exam?.exam_name || 'Exam').replace(/\s+/g, '_')}.pdf`;
  await savePdf(doc, fileName);
}

// --- 1B. GENERATE PRE-PRIMARY, LOWER & UPPER PRIMARY MERIT LIST PDF ---
async function generatePrimaryMeritListPDF(data: MeritListData, eduLevel: 'Pre-Primary' | 'Lower Primary' | 'Upper Primary'): Promise<void> {
  const {
    school,
    exam,
    selectedClassId,
    selectedStreamId = 'all',
    classes = [],
    teachers = [],
    students = [],
    subjects = [],
    marks = [],
    grades = [],
  } = data;

  const examId = exam?.id || '';
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);
  const streamNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);

  const firstTargetStudent = targetStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;
  const targetClass = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstTargetStudent?.class_id))
  );
  const targetGrade = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstTargetStudent?.grade || (eduLevel === 'Pre-Primary' ? 'PP1' : eduLevel === 'Lower Primary' ? 'Grade 2' : 'Grade 5');

  const sortPrimarySubjects = (subjs: Subject[]) => {
    if (eduLevel === 'Pre-Primary') {
      const ppOrderMap: Record<string, number> = {
        'PP-MATH': 1,
        'PP-PCA': 2,
        'PP-CRE': 3,
        'PP-ENV': 4,
        'PP-LANG': 5,
      };
      return [...subjs].sort((a, b) => {
        const cA = (a.subject_code || '').toUpperCase().trim();
        const cB = (b.subject_code || '').toUpperCase().trim();
        const posA = ppOrderMap[cA] ?? 99;
        const posB = ppOrderMap[cB] ?? 99;
        if (posA !== posB) return posA - posB;
        return (a.subject_name || '').localeCompare(b.subject_name || '');
      });
    }
    return sortSubjectsByStandardOrder(subjs);
  };

  const rawActiveSubjects = targetClass ? getLearnerReportSubjects(firstTargetStudent || {} as any, targetClass, subjects, teachers || []) : [];
  let activeSubjects = sortPrimarySubjects(rawActiveSubjects);

  if (activeSubjects.length === 0) {
    const fallbackSubjects = getApplicableSubjectsForGrade(targetGrade, subjects);
    activeSubjects = sortPrimarySubjects(fallbackSubjects);
  }

  const results = calculateExamResults(examId, targetStudents, marks, grades, classes, activeSubjects);
  populateComparisonResults(results, data.comparisonExamId, students, marks, grades, classes, subjects);

  const validation = validateCalculationData(results, marks, grades, activeSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  // Sort learners for display by authoritative position ascending (complete learners first), with total_marks descending as fallback
  results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));

  const subjectHeaders = activeSubjects.map((sb) => {
    if (eduLevel === 'Pre-Primary' || eduLevel === 'Lower Primary') {
      return (sb.subject_code || '').toUpperCase().trim();
    }
    return getShortCbeCode(sb.subject_code, sb.subject_name);
  });

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 7;
  const contentWidth = pageWidth - marginX * 2; // 283mm

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const tableHeadTitles = [
    'SERIAL NO',
    'ADM NO',
    'LEARNER NAME',
    'STREAM',
    'STR. POS.',
    'OVR POS',
    'PRV STR POS',
    'PRV OVR POS',
    ...subjectHeaders,
    'TOTAL MARKS',
    'AVG %',
    'TOTAL PTS',
    'AVG PTS',
    'CBE LEVEL',
    'GRADE CODE',
  ];

  const tableRows = results.map((r, idx) => {
    const std = targetStudents.find((s) => s.id === r.student_id);
    const histCtx = std && exam ? getLearnerClassAtExamTime(std, exam, classes) : null;
    const cls = classes.find((c) => c.id === (histCtx?.class_id || std?.class_id));
    const streamStr = histCtx
      ? (histCtx.historical_context_resolved ? (histCtx.stream_name || cls?.stream || '-') : '-')
      : (cls?.stream ? cls.stream : '-');
    const isComplete = r.is_complete !== false;
    const overallPos = isComplete && r.position ? `${r.position}` : '-';
    const streamRank = isComplete && (r.class_position || r.position) ? `${r.class_position || r.position}` : '-';

    const prevOvrPos = isComplete && (r as any).previous_position ? `${(r as any).previous_position}` : '-';
    const prevStrPos = isComplete && (r as any).previous_class_position ? `${(r as any).previous_class_position}` : '-';

    const subjectCells = activeSubjects.map((sb) => {
      const stdMark = marks.find(
        (m) => String(m.student_id) === String(r.student_id) && String(m.subject_id) === String(sb.id) && String(m.exam_id) === String(examId)
      );
      const markInfo = evaluateMark(stdMark);
      if (markInfo.status === 'X') return 'X';
      if (markInfo.status === 'Y') return 'Y';
      if (markInfo.status === 'Blank' || markInfo.percentage === null) return '-';

      const roundedVal = Math.round(markInfo.percentage);
      const gr = getGradeForMark(markInfo.percentage, grades);
      return `${roundedVal} ${gr.grade_code || 'ME1'}`;
    });

    const subEntry = activeSubjects.filter((sb) => {
      const m = marks.find(
        (mk) => String(mk.student_id) === String(r.student_id) && String(mk.subject_id) === String(sb.id) && String(mk.exam_id) === String(examId)
      );
      const info = evaluateMark(m);
      return info.status === 'Normal' && info.percentage !== null;
    }).length;

    const isAssessed = subEntry > 0;
    const assessedCnt = isAssessed ? subEntry : 1;
    const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
      ? r.average_points
      : (r.total_points / assessedCnt);
    const avgPts = isComplete && isAssessed ? avgPtsNum.toFixed(2) : '-';

    const overallLevelObj = getGradeForMark(r.average, grades);

    const cbeLevel = isComplete
      ? (overallLevelObj.performance_level || 'ME')
      : isAssessed
      ? (overallLevelObj.performance_level || 'ME')
      : '-';

    const gradeCode = isComplete
      ? (overallLevelObj.grade_code || 'ME1')
      : isAssessed
      ? `Prov (${overallLevelObj.grade_code || 'ME1'})`
      : 'Pending';

    return [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN').toUpperCase(),
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      isAssessed ? `${Math.round(r.total_marks)}` : '-',
      isComplete && isAssessed ? formatPercentage(r.average, true) : isAssessed ? `${formatPercentage(r.average, true)} (P)` : '-',
      isComplete && isAssessed ? `${r.total_points}` : '-',
      avgPts,
      cbeLevel,
      gradeCode,
    ];
  });

  const numSubjs = activeSubjects.length || 1;
  const sumMetaW = 113; // 7 + 15 + 47 + 12 + 8 + 8 + 8 + 8 = 113mm (reclaimed 5mm allocated to LEARNER NAME)
  const sumSummaryW = 72;
  const availableSubjWidth = (contentWidth - sumMetaW - sumSummaryW) / numSubjs;

  const columnStyles: Record<number, any> = {
    0: { cellWidth: 7, halign: 'center', fontStyle: 'normal' },
    1: { cellWidth: 15, halign: 'left', fontStyle: 'normal' },
    2: { cellWidth: 47, halign: 'left', fontStyle: 'normal' },
    3: { cellWidth: 12, halign: 'center', fontStyle: 'normal' },
    4: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    5: { cellWidth: 8, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    6: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    7: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
  };

  const startSubjIdx = 8;
  for (let i = 0; i < numSubjs; i++) {
    columnStyles[startSubjIdx + i] = { cellWidth: availableSubjWidth, halign: 'center', fontStyle: 'normal' };
  }

  const startSummIdx = startSubjIdx + numSubjs;
  columnStyles[startSummIdx]     = { cellWidth: 13, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 1] = { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
  columnStyles[startSummIdx + 2] = { cellWidth: 11, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 3] = { cellWidth: 11, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
  columnStyles[startSummIdx + 4] = { cellWidth: 11, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 5] = { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };

  const subjectColIndices = Array.from({ length: numSubjs }, (_, k) => startSubjIdx + k);
  const rotatedHeaderIndices = [4, 5, 6, 7, startSummIdx, startSummIdx + 1, startSummIdx + 2, startSummIdx + 3, startSummIdx + 4, startSummIdx + 5];

  const teacherInfo = resolveMeritListClassTeachers(
    classes,
    teachers,
    selectedClassId,
    selectedStreamId,
    targetGrade,
    targetStudents
  );

  const renderDocumentHeader = (_pageNo: number) => {
    const topY = 4;
    const headerH = 24;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(marginX, topY, contentWidth, headerH);

    const textLeft = marginX + 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 135, 103);
    const schoolNameStr = (school.school_name || 'School Name Not Configured').toUpperCase();
    doc.text(schoolNameStr, textLeft, topY + 5.2);

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.15);
    doc.line(textLeft, topY + 6.8, marginX + contentWidth - 3.5, topY + 6.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("REPORT: STUDENTS' PERFORMANCE MERIT LIST", textLeft, topY + 11.0);

    doc.line(textLeft, topY + 12.6, marginX + contentWidth - 3.5, topY + 12.6);

    const classNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);
    const termStr = String(exam?.term || 'Term 2');
    const yearStr = String(exam?.year || '2026');
    const examNameStr = (exam?.exam_name || 'MID-TERM ASSESSMENT').toUpperCase();
    const examCodeStr = formatStandardExamCode(targetGrade || classNameStr, exam);

    const streamDisplay =
      classes.find((c) => c.stream_id === selectedStreamId || c.id === selectedStreamId)?.stream ||
      streamNameStr;

    if (!teacherInfo.isAllStreams) {
      // Specific Stream Selected (Single Metadata Line at topY + 18.0)
      const metaY = topY + 18.0;
      doc.setFontSize(7.2);

      let curX = textLeft;
      const itemGap = 4.5;

      const renderItem = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(label, curX, metaY);
        curX += doc.getTextWidth(label) + 1.0;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 85, 204);
        doc.text(value, curX, metaY);
        curX += doc.getTextWidth(value) + itemGap;
      };

      renderItem('CLASS: ', targetGrade);
      renderItem('STREAM: ', streamDisplay);
      renderItem('CLASS TEACHER: ', teacherInfo.specificTeacherName || 'NOT ASSIGNED');
      renderItem('TERM: ', termStr);
      renderItem('YEAR: ', yearStr);
      renderItem('EXAM NAME: ', examNameStr);
      renderItem('EXAM CODE: ', examCodeStr);
    } else {
      // All Streams Selected (2 Metadata Lines)
      // Line 1: Basic Exam & Class Metadata (at topY + 16.5)
      const metaY1 = topY + 16.5;
      doc.setFontSize(7.2);

      let curX = textLeft;
      const itemGap = 5.0;

      const renderItem1 = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(label, curX, metaY1);
        curX += doc.getTextWidth(label) + 1.0;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 85, 204);
        doc.text(value, curX, metaY1);
        curX += doc.getTextWidth(value) + itemGap;
      };

      renderItem1('CLASS: ', targetGrade);
      renderItem1('STREAM: ', 'All Streams');
      renderItem1('TERM: ', termStr);
      renderItem1('YEAR: ', yearStr);
      renderItem1('EXAM NAME: ', examNameStr);
      renderItem1('EXAM CODE: ', examCodeStr);

      // Line 2: Stream-Specific Teachers Metadata (at topY + 21.2)
      const metaY2 = topY + 21.2;
      let curX2 = textLeft;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('CLASS TEACHERS: ', curX2, metaY2);
      curX2 += doc.getTextWidth('CLASS TEACHERS: ') + 1.2;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 85, 204);
      doc.text(teacherInfo.summaryText, curX2, metaY2);
    }
  };

  autoTable(doc, {
    startY: 30,
    margin: { left: marginX, right: marginX, top: 12, bottom: 12 },
    head: [tableHeadTitles],
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      fontSize: 7.2,
      cellPadding: { top: 0.5, bottom: 0.5, left: 0.3, right: 0.3 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      fillColor: [255, 255, 255],
      valign: 'middle',
      halign: 'center',
      minCellHeight: 5.5,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: numSubjs > 11 ? Math.max(5.0, 7.0 - (numSubjs - 11) * 0.3) : 7.0,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 18,
    },
    columnStyles: columnStyles,
    didDrawPage: (d) => {
      if (d.pageNumber === 1) {
        renderDocumentHeader(d.pageNumber);
      }
    },
    willDrawCell: (d) => {
      if (d.section === 'head' && rotatedHeaderIndices.includes(d.column.index)) {
        d.cell.text = [];
      }
      if (d.section === 'body' && subjectColIndices.includes(d.column.index)) {
        d.cell.text = [];
      }
    },
    didDrawCell: (d) => {
      // 1. Render Rotated Header Titles (90 degrees counter-clockwise)
      if (d.section === 'head' && rotatedHeaderIndices.includes(d.column.index)) {
        const cell = d.cell;
        const title = tableHeadTitles[d.column.index];
        if (title) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(0, 0, 0);
          const x = cell.x + cell.width / 2 + 1.1;
          const y = cell.y + cell.height - 1.8;
          doc.text(title, x, y, { angle: 90 });
        }
      }

      // 2. Render Single-Line Subject Cells: "MARK CBE_LEVEL"
      if (d.section === 'body' && subjectColIndices.includes(d.column.index)) {
        const cell = d.cell;
        const rowData = tableRows[d.row.index];
        if (!rowData) return;
        const rawVal = String(rowData[d.column.index] || '').trim();
        const centerX = cell.x + cell.width / 2;
        const centerY = cell.y + cell.height / 2;

        if (!rawVal) {
          return;
        }

        if (rawVal.includes(' ')) {
          const spaceIdx = rawVal.indexOf(' ');
          const markStr = rawVal.substring(0, spaceIdx);
          const gradeCodeStr = rawVal.substring(spaceIdx + 1);

          let subjFontSize = 7.2;
          if (availableSubjWidth < 10) {
            subjFontSize = Math.min(7.2, Math.max(4.2, (availableSubjWidth - 0.4) / 1.15));
          }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(subjFontSize);

          let markW = doc.getTextWidth(markStr);
          let spaceW = doc.getTextWidth(' ');
          let gradeW = doc.getTextWidth(gradeCodeStr);
          let totalW = markW + spaceW + gradeW;

          if (totalW > cell.width - 0.4 && totalW > 0) {
            subjFontSize = Math.max(3.8, subjFontSize * ((cell.width - 0.4) / totalW));
            doc.setFontSize(subjFontSize);
            markW = doc.getTextWidth(markStr);
            spaceW = doc.getTextWidth(' ');
            gradeW = doc.getTextWidth(gradeCodeStr);
            totalW = markW + spaceW + gradeW;
          }

          const startX = centerX - totalW / 2;
          const yPos = centerY + 0.7;

          // Mark in normal font weight black
          doc.setTextColor(0, 0, 0);
          doc.text(markStr, startX, yPos);

          // Grade code in normal font weight blue
          if (gradeCodeStr && gradeCodeStr !== '-') {
            doc.setTextColor(0, 85, 204);
            doc.text(gradeCodeStr, startX + markW + spaceW, yPos);
          } else if (gradeCodeStr === '-') {
            doc.setTextColor(140, 140, 140);
            doc.text('-', startX + markW + spaceW, yPos);
          }
        } else {
          let subjFontSize = 7.2;
          if (availableSubjWidth < 10) {
            subjFontSize = Math.min(7.2, Math.max(4.2, (availableSubjWidth - 0.4) / 1.15));
          }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(subjFontSize);
          let textW = doc.getTextWidth(rawVal);
          if (textW > cell.width - 0.4 && textW > 0) {
            subjFontSize = Math.max(3.8, subjFontSize * ((cell.width - 0.4) / textW));
            doc.setFontSize(subjFontSize);
          }
          if (rawVal === 'X' || rawVal === 'Y') {
            doc.setTextColor(220, 38, 38);
          } else {
            doc.setTextColor(0, 0, 0);
          }
          doc.text(rawVal, centerX, centerY + 0.7, { align: 'center' });
        }
      }
    },
  });

  // =========================================================================
  // --- END-OF-REPORT ANALYSIS SECTION (PHASES 1 - 5) ---
  // =========================================================================

  // 1. Calculations & Metrics for End-of-Report Sections
  const assessedResults = results.filter((r) => {
    const stdMarks = marks.filter((m) => String(m.student_id) === String(r.student_id) && String(m.exam_id) === String(examId));
    return stdMarks.some((m) => {
      const info = evaluateMark(m);
      return info.status === 'Normal' && info.percentage !== null;
    });
  });

  const assessedStudentIds = new Set(assessedResults.map((r) => r.student_id));
  const countAssessed = assessedResults.length;
  const totalLearners = targetStudents.length;
  const countUnassessed = totalLearners - countAssessed;

  // Class Mean Mark = average percentage score across assessed learners ONLY
  const totalStudentAverages = assessedResults.reduce((acc, r) => acc + r.average, 0);
  const overallClassAverageNum = countAssessed > 0 ? totalStudentAverages / countAssessed : 0;

  // Class Average (Marks) = sum of total marks obtained by all assessed learners ÷ number of assessed learners
  const totalAssessedMarksSum = assessedResults.reduce((acc, r) => acc + (r.total_marks || 0), 0);
  const classAverageTotalMarksNum = countAssessed > 0 ? totalAssessedMarksSum / countAssessed : 0;
  const maxPossibleClassMarks = activeSubjects.length * 100;

  // Mean Points = average points across assessed learners ONLY
  const totalStudentAvgPoints = assessedResults.reduce(
    (acc, r) => acc + (r.average_points !== undefined && r.average_points !== null && r.average_points > 0 ? r.average_points : (r.subject_count > 0 ? r.total_points / r.subject_count : 0)),
    0
  );
  const meanPointsNum = countAssessed > 0 ? totalStudentAvgPoints / countAssessed : 0;

  // Highest / Lowest Total Marks among assessed learners
  const assessedTotals = assessedResults.map((r) => Math.round(r.total_marks));
  const highestTotalMarks = assessedTotals.length > 0 ? Math.max(...assessedTotals) : null;
  const lowestTotalMarks = assessedTotals.length > 0 ? Math.min(...assessedTotals) : null;

  // CBE Performance Distribution counts among assessed learners
  let eeCount = 0;
  let meCount = 0;
  let aeCount = 0;
  let beCount = 0;

  assessedResults.forEach((r) => {
    const gr = getGradeForMark(r.average, grades);
    const lvl = (gr.performance_level || '').toUpperCase().trim();
    if (lvl === 'EE') eeCount++;
    else if (lvl === 'ME') meCount++;
    else if (lvl === 'AE') aeCount++;
    else if (lvl === 'BE') beCount++;
  });

  // Calculate Subject/Learning-Area Performance Rows
  const learningAreaAnalysisRows = activeSubjects.map((sb) => {
    const subjCode = eduLevel === 'Pre-Primary' || eduLevel === 'Lower Primary'
      ? (sb.subject_code || '').toUpperCase().trim()
      : getShortCbeCode(sb.subject_code, sb.subject_name);
    const subjName = sb.subject_name || subjCode;
    const learningAreaLabel = subjName && subjName.toUpperCase() !== subjCode.toUpperCase()
      ? `${subjCode} - ${subjName}`
      : subjCode;

    const subjMarks = marks.filter(
      (m) => String(m.exam_id) === String(examId) && String(m.subject_id) === String(sb.id)
    );

    const validSubjMarks = subjMarks
      .filter((m) => assessedStudentIds.has(m.student_id))
      .map((m) => ({ student_id: m.student_id, info: evaluateMark(m) }))
      .filter((item) => item.info.status === 'Normal' && item.info.percentage !== null);

    const count = validSubjMarks.length;
    let avgPctStr = '-';
    let avgPtsStr = '-';
    let perfLevelStr = '-';

    if (count > 0) {
      const sumPct = validSubjMarks.reduce((acc, item) => acc + item.info.percentage!, 0);
      const avgPct = Math.round(sumPct / count);
      const gr = getGradeForMark(avgPct, grades);

      const ptsSum = validSubjMarks.reduce((acc, item) => {
        const g = getGradeForMark(item.info.percentage!, grades);
        return acc + g.points;
      }, 0);
      const avgPts = parseFloat((ptsSum / count).toFixed(2));

      avgPctStr = formatPercentage(avgPct, true);
      avgPtsStr = `${avgPts.toFixed(1)}`;
      perfLevelStr = gr.performance_level || 'ME';
    }

    return [learningAreaLabel, `${count}`, avgPctStr, avgPtsStr, perfLevelStr];
  });

  // -------------------------------------------------------------------------
  // Page Position Tracking & Section Rendering
  // -------------------------------------------------------------------------
  const maxContentY = 196; // Leave space above 202.5mm footer line
  let currentY = (doc as any).lastAutoTable.finalY + 5;

  // SECTION 1: LEARNING-AREA PERFORMANCE ANALYSIS
  const sec1Height = 5 + (activeSubjects.length + 1) * 5.2 + 3;
  if (currentY + sec1Height > maxContentY) {
    doc.addPage();
    currentY = 12;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 135, 103);
  doc.text('LEARNING-AREA PERFORMANCE ANALYSIS', marginX, currentY + 2.5);

  autoTable(doc, {
    startY: currentY + 4,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [['LEARNING AREA', 'ASSESSED', 'AVERAGE %', 'AVG POINTS', 'PERFORMANCE']],
    body: learningAreaAnalysisRows,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: { top: 0.7, bottom: 0.7, left: 1.2, right: 1.2 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 4.8,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 6.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 105, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 45, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
      3: { cellWidth: 45, halign: 'center' },
      4: { cellWidth: 53, halign: 'center', fontStyle: 'bold', textColor: [0, 135, 103] },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // SECTION 2 & SECTION 3: CLASS PERFORMANCE SUMMARY & CBE PERFORMANCE DISTRIBUTION (Side-by-Side)
  const sec23Height = 5 + 9 * 4.8 + 3; // ~51mm
  if (currentY + sec23Height > maxContentY) {
    doc.addPage();
    currentY = 12;
  }

  const leftTableWidth = 137;
  const rightTableStartX = marginX + 143;
  const rightTableWidth = contentWidth - 143; // 140mm

  // Section 2 Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 135, 103);
  doc.text('CLASS PERFORMANCE SUMMARY', marginX, currentY + 2.5);

  // Section 3 Header
  doc.text('CBE PERFORMANCE DISTRIBUTION', rightTableStartX, currentY + 2.5);

  const summaryRows = [
    ['Total Learners', `${totalLearners}`],
    ['Assessed Learners', `${countAssessed}`],
    ['Unassessed Learners', `${countUnassessed}`],
    ['Class Average (Marks)', countAssessed > 0 ? `${classAverageTotalMarksNum.toFixed(1)} / ${maxPossibleClassMarks}` : '--'],
    ['Class Average (%)', countAssessed > 0 ? formatPercentage(overallClassAverageNum, true) : '--'],
    ['Mean Points', countAssessed > 0 ? `${meanPointsNum.toFixed(2)} (${getGradeForMark(overallClassAverageNum, grades).grade_code || 'ME1'})` : '--'],
    ['Highest Total', highestTotalMarks !== null ? `${highestTotalMarks}` : '--'],
    ['Lowest Assessed Total', lowestTotalMarks !== null ? `${lowestTotalMarks}` : '--'],
  ];

  const distributionRows = [
    ['EE - Exceeding Expectations', `${eeCount}`, countAssessed > 0 ? formatPercentage((eeCount / countAssessed) * 100, true) : '0%'],
    ['ME - Meeting Expectations', `${meCount}`, countAssessed > 0 ? formatPercentage((meCount / countAssessed) * 100, true) : '0%'],
    ['AE - Approaching Expectations', `${aeCount}`, countAssessed > 0 ? formatPercentage((aeCount / countAssessed) * 100, true) : '0%'],
    ['BE - Below Expectations', `${beCount}`, countAssessed > 0 ? formatPercentage((beCount / countAssessed) * 100, true) : '0%'],
  ];

  // Render Table 2 (Class Performance Summary)
  autoTable(doc, {
    startY: currentY + 4,
    margin: { left: marginX },
    tableWidth: leftTableWidth,
    head: [['INDICATOR', 'RESULT']],
    body: summaryRows,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: { top: 0.6, bottom: 0.6, left: 1.2, right: 1.2 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 4.5,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 6.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 80, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 57, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    },
  });

  const table2FinalY = (doc as any).lastAutoTable.finalY;

  // Render Table 3 (CBE Performance Distribution)
  autoTable(doc, {
    startY: currentY + 4,
    margin: { left: rightTableStartX },
    tableWidth: rightTableWidth,
    head: [['PERFORMANCE LEVEL', 'LEARNERS', 'PERCENTAGE']],
    body: distributionRows,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: { top: 0.6, bottom: 0.6, left: 1.2, right: 1.2 },
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 4.5,
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 6.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 38, halign: 'center', fontStyle: 'bold', textColor: [0, 135, 103] },
    },
  });

  const table3FinalY = (doc as any).lastAutoTable.finalY;
  currentY = Math.max(table2FinalY, table3FinalY) + 5;

  // SECTION 4: RESULT / CALCULATION NOTES
  const sec4Height = 4 + 6 * 3.3 + 2; // ~26mm
  if (currentY + sec4Height > maxContentY) {
    doc.addPage();
    currentY = 12;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 135, 103);
  doc.text('RESULT / CALCULATION NOTES', marginX, currentY + 2.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(60, 60, 60);

  const notesList = [
    '• Student position is assigned using Total Marks.',
    '• Student performance level is calculated using the applicable student average marks.',
    '• Genuine zero marks are treated as assessed results.',
    '• Blank marks indicate unassessed learning areas.',
    '• "X" indicates absence.',
    '• "Y" indicates an irregularity.',
  ];

  let noteY = currentY + 6.2;
  notesList.forEach((note) => {
    doc.text(note, marginX + 2, noteY);
    noteY += 3.2;
  });

  // SECTION 5: FOOTER & PAGE NUMBERS ON ALL PAGES
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 5;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.15);
    doc.line(marginX, footerY - 2.5, marginX + contentWidth, footerY - 2.5);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Report generated on: ${dateStr} at ${timeStr}    Page ${i}/${totalPages}`,
      marginX + contentWidth,
      footerY,
      { align: 'right' }
    );
  }

  const fileName = `CBC_${eduLevel.replace(/\s+/g, '_')}_Merit_List_${targetGrade.replace(/\s+/g, '_')}_${streamNameStr.replace(/\s+/g, '_')}.pdf`;
  await savePdf(doc, fileName);
}

function currentClassLabel(classes: ClassStream[], classId: string): string {
  if (!classId || classId === 'all') return 'Grade 8';
  const cls = classes.find((c) => c.id === classId);
  return cls ? cls.class_name : 'Grade 8';
}




// --- 2. GENERATE MERIT LIST EXCEL (.xlsx) ---
export async function downloadMeritListExcel(data: MeritListData): Promise<void> {
  const {
    school,
    exam,
    selectedClassId,
    selectedStreamId = 'all',
    classes = [],
    teachers = [],
    students = [],
    subjects = [],
    marks = [],
    grades = [],
    generatedBy = 'Administrator',
  } = data;

  const examId = exam?.id || '';
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);
  const streamNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);

  // Determine applicable subjects for target cohort grade
  const firstTargetStudent = targetStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;
  const targetClass = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstTargetStudent?.class_id))
  );
  const targetGrade = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstTargetStudent?.grade || '';
  const rawActiveSubjects = targetClass ? getLearnerReportSubjects(firstTargetStudent || {} as any, targetClass, subjects, teachers || []) : [];
  const activeSubjects = sortSubjectsByStandardOrder(rawActiveSubjects);

  // Calculate results matching Merit List & PDF
  const results = calculateExamResults(examId, targetStudents, marks, grades, classes, activeSubjects);
  populateComparisonResults(results, data.comparisonExamId, students, marks, grades, classes, subjects);

  const validation = validateCalculationData(results, marks, grades, activeSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  // Sort learners for display by authoritative position ascending (complete learners first), with total_marks descending as fallback
  results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));

  const wb = XLSX.utils.book_new();

  const examCodeStr = formatStandardExamCode(targetGrade || streamNameStr, exam);

  // Header Rows
  const sheetData: any[][] = [
    [(school.school_name || 'School Name Not Configured').toUpperCase()],
    [`STUDENTS' PERFORMANCE MERIT LIST - ${exam?.exam_name || 'Assessment'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`],
    [`Class/Stream: ${streamNameStr}`, `Exam Code: ${examCodeStr}`, `Date Generated: ${new Date().toLocaleDateString()}`, `Generated By: ${generatedBy}`],
    [], // Empty row
  ];

  const subjectHeaders = activeSubjects.map((sb) => getShortCbeCode(sb.subject_code, sb.subject_name));

  // Table Column Headers matching Merit List & PDF
  const headers = [
    'SERIAL NO',
    'ADM NO',
    'LEARNER NAME',
    'STREAM',
    'STR. POS.',
    'OVR POS',
    'PRV STR POS',
    'PRV OVR POS',
    ...subjectHeaders,
    'TOTAL MARKS',
    'AVG %',
    'TOTAL PTS',
    'AVG PTS',
    'CBE LEVEL',
    'GRADE CODE',
  ];

  sheetData.push(headers);

  // Student Rows
  results.forEach((r, idx) => {
    const std = targetStudents.find((s) => s.id === r.student_id);
    const histCtx = std && exam ? getLearnerClassAtExamTime(std, exam, classes) : null;
    const cls = classes.find((c) => c.id === (histCtx?.class_id || std?.class_id));
    const streamStr = histCtx
      ? (histCtx.historical_context_resolved ? (histCtx.stream_name || cls?.stream || '-') : '-')
      : (cls?.stream ? cls.stream : '-');
    const isComplete = r.is_complete !== false;

    const overallPos = isComplete && r.position ? `${r.position}` : '-';
    const streamRank = isComplete && (r.class_position || r.position) ? `${r.class_position || r.position}` : '-';
    const prevOvrPos = isComplete && (r as any).previous_position ? `${(r as any).previous_position}` : '-';
    const prevStrPos = isComplete && (r as any).previous_class_position ? `${(r as any).previous_class_position}` : '-';

    const subjectCells = activeSubjects.map((sb, sbIdx) => {
      const code = subjectHeaders[sbIdx] || getShortCbeCode(sb.subject_code, sb.subject_name);
      const stdMark = marks.find(
        (m) => String(m.student_id) === String(r.student_id) && String(m.subject_id) === String(sb.id) && String(m.exam_id) === String(examId)
      );
      const markInfo = evaluateMark(stdMark);
      if (markInfo.status === 'X') return `${code}: X`;
      if (markInfo.status === 'Y') return `${code}: Y`;
      if (markInfo.status === 'Blank' || markInfo.percentage === null) return '';

      const roundedVal = Math.round(markInfo.percentage);
      const gr = getGradeForMark(markInfo.percentage, grades);
      return `${code}: ${roundedVal} ${gr.grade_code || 'ME1'}`;
    });

    const subEntry = activeSubjects.filter((sb) => {
      const m = marks.find(
        (mk) => String(mk.student_id) === String(r.student_id) && String(mk.subject_id) === String(sb.id) && String(mk.exam_id) === String(examId)
      );
      const info = evaluateMark(m);
      return info.status === 'Normal' && info.percentage !== null;
    }).length;

    const isAssessed = subEntry > 0;
    const assessedCnt = isAssessed ? subEntry : 1;
    const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
      ? r.average_points
      : (r.total_points / assessedCnt);
    const avgPts = isComplete && isAssessed ? avgPtsNum.toFixed(2) : '-';

    const overallLevelObj = getGradeForMark(r.average, grades);

    const cbeLevel = isComplete
      ? (overallLevelObj.performance_level || 'ME')
      : isAssessed
      ? (overallLevelObj.performance_level || 'ME')
      : '-';

    const gradeCode = isComplete
      ? (overallLevelObj.grade_code || 'ME1')
      : isAssessed
      ? `Prov (${overallLevelObj.grade_code || 'ME1'})`
      : 'Pending';

    const row: any[] = [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN').toUpperCase(),
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      isAssessed ? r.total_marks : '-',
      isComplete && isAssessed ? formatPercentage(r.average, true) : isAssessed ? `${formatPercentage(r.average, true)} (P)` : '-',
      isComplete && isAssessed ? r.total_points : '-',
      avgPts,
      cbeLevel,
      gradeCode,
    ];
    sheetData.push(row);
  });

  sheetData.push([]); // Empty row

  // Subject Analysis Section
  sheetData.push(['SUBJECT PERFORMANCE ANALYSIS']);
  sheetData.push(['Subject Code', 'Subject Name', 'Class Average (%)', 'Performance Level', 'Grade Code', 'Avg Points']);

  const subjectStats = activeSubjects.map((sb) => {
    const targetSubjMarks = marks.filter(
      (m) =>
        m.exam_id === examId &&
        m.subject_id === sb.id &&
        targetStudents.some((s) => s.id === m.student_id)
    );
    let sum = 0;
    let count = 0;
    targetSubjMarks.forEach((m) => {
      const markInfo = evaluateMark(m);
      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        sum += markInfo.percentage;
        count++;
      }
    });
    const avg = count > 0 ? Math.round(sum / count) : 0;
    const gr = getGradeForMark(avg, grades);
    return {
      code: sb.subject_code,
      name: sb.subject_name,
      avg,
      level: gr.performance_level,
      grade_code: gr.grade_code,
      points: gr.points,
    };
  });

  subjectStats.sort((a, b) => b.avg - a.avg);

  subjectStats.forEach((sb) => {
    sheetData.push([sb.code, sb.name, formatPercentage(sb.avg, true), sb.level, sb.grade_code, sb.points]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Merit List');

  const fileName = `Merit_List_${streamNameStr.replace(/\s+/g, '_')}.xlsx`;
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  if (isNative) {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await saveFile(wbout, fileName, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Share ${fileName}`,
    });
  } else {
    XLSX.writeFile(wb, fileName);
  }
}

// --- 3. GENERATE MERIT LIST CSV (.csv) ---
export async function downloadMeritListCSV(data: MeritListData): Promise<void> {
  const {
    school,
    exam,
    selectedClassId,
    selectedStreamId = 'all',
    classes = [],
    teachers = [],
    students = [],
    subjects = [],
    marks = [],
    grades = [],
  } = data;

  const examId = exam?.id || '';
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);
  const streamNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);

  const firstTargetStudent = targetStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;
  const targetClass = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstTargetStudent?.class_id))
  );
  const targetGrade = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstTargetStudent?.grade || '';
  const eduLevel = getEducationLevelForGrade(targetGrade);

  const sortPrimarySubjects = (subjs: Subject[]) => {
    if (eduLevel === 'Pre-Primary') {
      const ppOrderMap: Record<string, number> = {
        'PP-MATH': 1,
        'PP-PCA': 2,
        'PP-CRE': 3,
        'PP-ENV': 4,
        'PP-LANG': 5,
      };
      return [...subjs].sort((a, b) => {
        const cA = (a.subject_code || '').toUpperCase().trim();
        const cB = (b.subject_code || '').toUpperCase().trim();
        const posA = ppOrderMap[cA] ?? 99;
        const posB = ppOrderMap[cB] ?? 99;
        if (posA !== posB) return posA - posB;
        return (a.subject_name || '').localeCompare(b.subject_name || '');
      });
    }
    return sortSubjectsByStandardOrder(subjs);
  };

  const rawActiveSubjects = targetClass ? getLearnerReportSubjects(firstTargetStudent || {} as any, targetClass, subjects, teachers || []) : [];
  let activeSubjects = sortPrimarySubjects(rawActiveSubjects);

  if (activeSubjects.length === 0) {
    const fallbackSubjects = getApplicableSubjectsForGrade(targetGrade, subjects);
    activeSubjects = sortPrimarySubjects(fallbackSubjects);
  }

  const results = calculateExamResults(examId, targetStudents, marks, grades, classes, activeSubjects);
  populateComparisonResults(results, data.comparisonExamId, students, marks, grades, classes, subjects);

  const validation = validateCalculationData(results, marks, grades, activeSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  // Sort learners for display by authoritative position ascending (complete learners first), with total_marks descending as fallback
  results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));

  const csvRows: string[] = [];

  const examCodeStr = formatStandardExamCode(targetGrade || streamNameStr, exam);

  // Header
  csvRows.push(`"${school.school_name || 'School Name Not Configured'}"`);
  csvRows.push(`"STUDENTS' PERFORMANCE MERIT LIST - ${exam?.exam_name || 'Assessment'}"`);
  csvRows.push(`"Class/Stream: ${streamNameStr}","Exam Code: ${examCodeStr}","Date: ${new Date().toLocaleDateString()}"`);
  csvRows.push('');

  const subjectHeaders = activeSubjects.map((sb) => {
    if (eduLevel === 'Pre-Primary') {
      return (sb.subject_code || '').toUpperCase().trim();
    }
    return getShortCbeCode(sb.subject_code, sb.subject_name);
  });

  const headers = [
    'SERIAL NO',
    'ADM NO',
    'LEARNER NAME',
    'STREAM',
    'STR. POS.',
    'OVR POS',
    'PRV STR POS',
    'PRV OVR POS',
    ...subjectHeaders,
    'TOTAL MARKS',
    'AVG %',
    'TOTAL PTS',
    'AVG PTS',
    'CBE LEVEL',
    'GRADE CODE',
  ];

  csvRows.push(headers.map((h) => `"${h}"`).join(','));

  results.forEach((r, idx) => {
    const std = targetStudents.find((s) => s.id === r.student_id);
    const histCtx = std && exam ? getLearnerClassAtExamTime(std, exam, classes) : null;
    const cls = classes.find((c) => c.id === (histCtx?.class_id || std?.class_id));
    const streamStr = histCtx
      ? (histCtx.historical_context_resolved ? (histCtx.stream_name || cls?.stream || '-') : '-')
      : (cls?.stream ? cls.stream : '-');
    const isComplete = r.is_complete !== false;

    const overallPos = isComplete && r.position ? `${r.position}` : '-';
    const streamRank = isComplete && (r.class_position || r.position) ? `${r.class_position || r.position}` : '-';
    const prevOvrPos = isComplete && (r as any).previous_position ? `${(r as any).previous_position}` : '-';
    const prevStrPos = isComplete && (r as any).previous_class_position ? `${(r as any).previous_class_position}` : '-';

    const subjectCells = activeSubjects.map((sb, sbIdx) => {
      const code = subjectHeaders[sbIdx] || (eduLevel === 'Pre-Primary' ? (sb.subject_code || '').toUpperCase().trim() : getShortCbeCode(sb.subject_code, sb.subject_name));
      const stdMark = marks.find(
        (m) => String(m.student_id) === String(r.student_id) && String(m.subject_id) === String(sb.id) && String(m.exam_id) === String(examId)
      );
      const markInfo = evaluateMark(stdMark);
      if (markInfo.status === 'X') return `${code}: X`;
      if (markInfo.status === 'Y') return `${code}: Y`;
      if (markInfo.status === 'Blank' || markInfo.percentage === null) return '';

      const roundedVal = Math.round(markInfo.percentage);
      const gr = getGradeForMark(markInfo.percentage, grades);
      return `${code}: ${roundedVal} ${gr.grade_code || 'ME1'}`;
    });

    const subEntry = activeSubjects.filter((sb) => {
      const m = marks.find(
        (mk) => String(mk.student_id) === String(r.student_id) && String(mk.subject_id) === String(sb.id) && String(mk.exam_id) === String(examId)
      );
      const info = evaluateMark(m);
      return info.status === 'Normal' && info.percentage !== null;
    }).length;

    const isAssessed = subEntry > 0;
    const assessedCnt = isAssessed ? subEntry : 1;
    const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
      ? r.average_points
      : (r.total_points / assessedCnt);
    const avgPts = isComplete && isAssessed ? avgPtsNum.toFixed(2) : '-';

    const overallLevelObj = getGradeForMark(r.average, grades);

    const cbeLevel = isComplete
      ? (overallLevelObj.performance_level || 'ME')
      : isAssessed
      ? (overallLevelObj.performance_level || 'ME')
      : '-';

    const gradeCode = isComplete
      ? (overallLevelObj.grade_code || 'ME1')
      : isAssessed
      ? `Prov (${overallLevelObj.grade_code || 'ME1'})`
      : 'Pending';

    const row: (string | number)[] = [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN').toUpperCase(),
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      isAssessed ? Math.round(r.total_marks) : '-',
      isComplete && isAssessed ? formatPercentage(r.average, true) : isAssessed ? `${formatPercentage(r.average, true)} (P)` : '-',
      isComplete && isAssessed ? r.total_points : '-',
      avgPts,
      cbeLevel,
      gradeCode,
    ];

    csvRows.push(row.map((cell) => `"${cell}"`).join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const fileName = `Merit_List_${streamNameStr.replace(/\s+/g, '_')}.csv`;
  await saveFile(blob, fileName, { mimeType: 'text/csv;charset=utf-8;' });
}
