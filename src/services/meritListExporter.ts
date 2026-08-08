import rawJsPDF from 'jspdf';
const jsPDF = (rawJsPDF as any).jsPDF || rawJsPDF;
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import fileSaver from 'file-saver';
const saveAs = typeof fileSaver === 'function' ? fileSaver : (fileSaver as any)?.saveAs || fileSaver;
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
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  CBE_8_POINT_GRADES,
  getLearnerReportSubjects,
  validateCalculationData,
} from './analysisEngine';
import { getFilteredStudents, getClassStreamLabel } from '../utils/filterUtils';
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


function populateComparisonResults(
  results: any[],
  comparisonExamId: string | undefined,
  targetStudents: any[],
  marks: any[],
  grades: any[],
  classes: any[],
  cohortSubjects: any[]
) {
  if (!comparisonExamId) return;
  const comparisonMap = new Map();
  const compResults = calculateExamResults(comparisonExamId, targetStudents, marks, grades, classes, cohortSubjects);
  compResults.forEach(r => comparisonMap.set(r.student_id, r));

  results.forEach(r => {
    const prev = comparisonMap.get(r.student_id);
    if (prev) {
      r.previous_position = prev.position;
      r.previous_class_position = prev.class_position || prev.stream_position;
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

  if (eduLevel === 'Lower Primary' || eduLevel === 'Upper Primary') {
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
  populateComparisonResults(results, data.comparisonExamId, targetStudents, marks, grades, classes, cohortSubjects);

  // Validate calculation engine output
  const validation = validateCalculationData(results, marks, grades, cohortSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  // Sort by Junior School Total Marks rule or standard Primary rule
  if (eduLevel === 'Junior School') {
    results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));
  } else {
    results.sort((a, b) => {
      if ((b.average_points || 0) !== (a.average_points || 0)) {
        return (b.average_points || 0) - (a.average_points || 0);
      }
      if ((b.total_points || 0) !== (a.total_points || 0)) {
        return (b.total_points || 0) - (a.total_points || 0);
      }
      return (b.average || 0) - (a.average || 0);
    });
  }

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
      const avgPct = parseFloat((sumPct / count).toFixed(1));
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
    'ASS NO',
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
    }).length || r.subject_count || 1;

    const assessedCnt = subEntry || 1;
    const avgPtsNum = assessedCnt > 0
      ? (r.average_points !== undefined && r.average_points !== null && r.average_points > 0
          ? r.average_points
          : (r.total_points / assessedCnt))
      : 0;
    const avgPts = avgPtsNum.toFixed(2);
    const overallLevelObj = getGradeForMark(r.average, grades);

    return [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN LEARNER').toUpperCase(),
      (std as any)?.assessment_number || (std as any)?.ass_no || '-',
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      `${subEntry}`,
      `${r.total_marks}`,
      isComplete ? formatPercentage(r.average, true) : `${formatPercentage(r.average, true)} (P)`,
      `${r.total_points}`,
      avgPts,
      overallLevelObj.performance_level || 'ME',
      isComplete ? (overallLevelObj.grade_code || 'ME1') : `Prov (${overallLevelObj.grade_code || 'ME1'})`,
    ];
  });

  // Proportional Column Widths matching official template geometry (283mm printable width)
  const numSubjs = formattedSubjectHeaders.length || 1;
  const sumMetaW = 105;
  const sumSummaryW = 73;
  const availSubjW = (contentWidth - sumMetaW - sumSummaryW) / numSubjs;

  const columnStyles: Record<number, any> = {
    0: { cellWidth: 6, halign: 'center', fontStyle: 'normal' },
    1: { cellWidth: 14, halign: 'left', fontStyle: 'normal' },
    2: { cellWidth: 33, halign: 'left', fontStyle: 'normal' },
    3: { cellWidth: 10, halign: 'center', fontStyle: 'normal' },
    4: { cellWidth: 10, halign: 'center', fontStyle: 'normal' },
    5: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    6: { cellWidth: 8, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    7: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    8: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
  };

  const startSubjIdx = 9;
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
  const rotatedHeaderIndices = [5, 6, 7, 8, startSummIdx, startSummIdx + 1, startSummIdx + 2, startSummIdx + 3, startSummIdx + 4, startSummIdx + 5, startSummIdx + 6];

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
    const termStr = String(exam?.term || '2');
    const yearStr = String(exam?.year || '2026');
    const examNameStr = (exam?.exam_name || 'ENDTERM 2').toUpperCase();
    const examCodeStr = ((exam as any)?.exam_code || (exam as any)?.code || `${classNameStr.replace(/\s+/g, '')}T${termStr}${yearStr}`).toUpperCase();

    let curX = textLeft;
    const itemGap = 5;

    // CLASS
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CLASS:', curX, metaY);
    curX += doc.getTextWidth('CLASS:') + 1.2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 85, 204);
    doc.text(classNameStr.toUpperCase(), curX, metaY);
    const clsW = doc.getTextWidth(classNameStr.toUpperCase());
    doc.setDrawColor(0, 85, 204);
    doc.setLineWidth(0.3);
    doc.line(curX, metaY + 0.6, curX + clsW, metaY + 0.6);
    curX += clsW + itemGap;

    // TERM
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TERM:', curX, metaY);
    curX += doc.getTextWidth('TERM:') + 1.2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 85, 204);
    doc.text(termStr, curX, metaY);
    curX += doc.getTextWidth(termStr) + itemGap;

    // YEAR
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('YEAR:', curX, metaY);
    curX += doc.getTextWidth('YEAR:') + 1.2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 85, 204);
    doc.text(yearStr, curX, metaY);
    curX += doc.getTextWidth(yearStr) + itemGap;

    // EXAM NAME
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('EXAM NAME:', curX, metaY);
    curX += doc.getTextWidth('EXAM NAME:') + 1.2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 85, 204);
    doc.text(examNameStr, curX, metaY);
    curX += doc.getTextWidth(examNameStr) + itemGap;

    // EXAM CODE
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('EXAM CODE:', curX, metaY);
    curX += doc.getTextWidth('EXAM CODE:') + 1.2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 85, 204);
    doc.text(examCodeStr, curX, metaY);
  };

  // Run autoTable for Main Student Matrix
  autoTable(doc, {
    startY: 24, // Page 1 starts below official header
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
  const classAvgMarksValStr = avgTotalObtainedVal > 0 ? avgTotalObtainedVal.toFixed(1) : formatPercentage(overallClassAverageNum, true);

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
  doc.save(fileName);
}

// --- 1B. GENERATE LOWER & UPPER PRIMARY MERIT LIST PDF ---
async function generatePrimaryMeritListPDF(data: MeritListData, eduLevel: 'Lower Primary' | 'Upper Primary'): Promise<void> {
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
  const targetGrade = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstTargetStudent?.grade || (eduLevel === 'Lower Primary' ? 'Grade 2' : 'Grade 5');

  const rawActiveSubjects = targetClass ? getLearnerReportSubjects(firstTargetStudent || {} as any, targetClass, subjects, teachers || []) : [];
  const activeSubjects = sortSubjectsByStandardOrder(rawActiveSubjects);
  const results = calculateExamResults(examId, targetStudents, marks, grades, classes, activeSubjects);
  populateComparisonResults(results, data.comparisonExamId, targetStudents, marks, grades, classes, activeSubjects);

  const validation = validateCalculationData(results, marks, grades, activeSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  if ((eduLevel as string) === 'Junior School') {
    results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));
  } else {
    results.sort((a, b) => {
      if ((b.average_points || 0) !== (a.average_points || 0)) {
        return (b.average_points || 0) - (a.average_points || 0);
      }
      if ((b.total_points || 0) !== (a.total_points || 0)) {
        return (b.total_points || 0) - (a.total_points || 0);
      }
      return (b.average || 0) - (a.average || 0);
    });
  }

  const assessedResults = results.filter((r) => (r.subject_count || 0) > 0);
  const assessedStudentIds = new Set(assessedResults.map((r) => r.student_id));
  const totalLearners = targetStudents.length;
  const numberAssessed = assessedResults.length;

  const totalClassScoreSum = assessedResults.reduce((acc, r) => acc + r.total_marks, 0);
  const classMeanMarksNum = numberAssessed > 0 ? totalClassScoreSum / numberAssessed : 0;
  const classMeanMarks = formatPercentage(classMeanMarksNum);

  const totalStudentAverages = assessedResults.reduce((acc, r) => acc + r.average, 0);
  const classMeanPercNum = numberAssessed > 0 ? totalStudentAverages / numberAssessed : 0;
  const classMeanPercentage = formatPercentage(classMeanPercNum);

  const totalStudentPoints = assessedResults.reduce((acc, r) => acc + (r.total_points || 0), 0);
  const classMeanPointsNum = numberAssessed > 0 ? (totalStudentPoints / (numberAssessed * (activeSubjects.length || 1))) : 0;
  const classMeanPoints = classMeanPointsNum.toFixed(2);

  const highestTotalMarks = results[0]?.total_marks || 0;
  const lowestTotalMarks = results[results.length - 1]?.total_marks || 0;

  const topStudentObj = results[0] ? targetStudents.find((s) => s.id === results[0].student_id) : null;
  const bestLearnerStr = topStudentObj ? `${topStudentObj.full_name} (${results[0].total_marks} Marks / ${formatPercentage(results[0].average, true)})` : '-';

  let bestStreamStr = '-';
  if (selectedClassId === 'all') {
    const streamMap = new Map<string, { total: number; count: number; name: string }>();
    results.forEach((r) => {
      const std = targetStudents.find((s) => s.id === r.student_id);
      const histCtx = std && exam ? getLearnerClassAtExamTime(std, exam, classes) : null;
      const classId = histCtx?.class_id || std?.class_id;
      if (classId) {
        const cls = classes.find((c) => c.id === classId);
        const name = cls ? `${cls.class_name} ${cls.stream}` : 'Stream';
        const cur = streamMap.get(classId) || { total: 0, count: 0, name };
        cur.total += r.total_marks;
        cur.count += 1;
        streamMap.set(classId, cur);
      }
    });
    let bestAvg = -1;
    streamMap.forEach((val) => {
      const avg = val.count > 0 ? val.total / val.count : 0;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestStreamStr = `${val.name} (${formatPercentage(avg)} Marks Avg)`;
      }
    });
  } else {
    bestStreamStr = streamNameStr;
  }

  const subjectHeaders = activeSubjects.map((sb) => getShortCbeCode(sb.subject_code, sb.subject_name));

  const subjectStatsList = activeSubjects.map((sb) => {
    const subjMarks = marks.filter((m) => String(m.exam_id) === String(examId) && String(m.subject_id) === String(sb.id));
    const validTargetSubjMarks = subjMarks
      .filter((m) => assessedStudentIds.has(m.student_id))
      .map((m) => ({ mark: m, eval: evaluateMark(m) }))
      .filter(({ eval: ev }) => ev.status === 'Normal' && ev.percentage !== null);

    const sum = validTargetSubjMarks.reduce((acc, item) => acc + item.eval.percentage!, 0);
    const count = validTargetSubjMarks.length;
    const avg = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
    const gr = getGradeForMark(avg, grades);
    return {
      id: sb.id,
      code: getShortCbeCode(sb.subject_code, sb.subject_name),
      name: sb.subject_name,
      avg: avg,
      avgPts: gr.points,
      gradeCode: gr.grade_code || gr.grade || 'ME1',
      overallLevel: gr.performance_level || 'ME',
    };
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

  const base64Logo = school.logo_url ? await getBase64ImageFromUrl(school.logo_url) : null;
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const tableHeadTitles = [
    'SERIAL NO',
    'ADM NO',
    'LEARNER NAME',
    'ASS NO',
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
    }).length || r.subject_count || 1;

    const assessedCnt = subEntry || 1;
    const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
      ? r.average_points
      : (r.total_points / assessedCnt);
    const avgPts = isComplete ? avgPtsNum.toFixed(2) : '-';

    const overallLevelObj = getGradeForMark(r.average, grades);

    return [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN').toUpperCase(),
      (std as any)?.assessment_number || (std as any)?.ass_no || '-',
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      `${r.total_marks}`,
      isComplete ? formatPercentage(r.average, true) : `${formatPercentage(r.average, true)} (P)`,
      isComplete ? `${r.total_points}` : '-',
      avgPts,
      overallLevelObj.performance_level || 'ME',
      isComplete ? (overallLevelObj.grade_code || 'ME1') : `Prov (${overallLevelObj.grade_code || 'ME1'})`,
    ];
  });

  const numSubjs = activeSubjects.length || 1;
  const sumMetaW = 115;
  const sumSummaryW = 66;
  const availableSubjWidth = (contentWidth - sumMetaW - sumSummaryW) / numSubjs;

  const columnStyles: Record<number, any> = {
    0: { cellWidth: 7, halign: 'center', fontStyle: 'normal' },
    1: { cellWidth: 18, halign: 'left', fontStyle: 'normal' }, // ADM No - left-aligned
    2: { cellWidth: 36, halign: 'left', fontStyle: 'normal' }, // Student Name - NORMAL font weight
    3: { cellWidth: 10, halign: 'center', fontStyle: 'normal' },
    4: { cellWidth: 11, halign: 'center', fontStyle: 'normal' },
    5: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    6: { cellWidth: 9, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    7: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
    8: { cellWidth: 8, halign: 'center', fontStyle: 'normal' },
  };

  const startSubjIdx = 9;
  for (let i = 0; i < numSubjs; i++) {
    columnStyles[startSubjIdx + i] = { cellWidth: availableSubjWidth, halign: 'center', fontStyle: 'normal' };
  }

  const startSummIdx = startSubjIdx + numSubjs;
  columnStyles[startSummIdx]     = { cellWidth: 8, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 1] = { cellWidth: 13, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
  columnStyles[startSummIdx + 2] = { cellWidth: 13, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 3] = { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
  columnStyles[startSummIdx + 4] = { cellWidth: 10, halign: 'center', fontStyle: 'normal' };
  columnStyles[startSummIdx + 5] = { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };

  const subjectColIndices = Array.from({ length: numSubjs }, (_, k) => startSubjIdx + k);
  const rotatedHeaderIndices = [5, 6, 7, 8, startSummIdx, startSummIdx + 1, startSummIdx + 2, startSummIdx + 3, startSummIdx + 4, startSummIdx + 5];

  const renderDocumentHeader = (pageNo: number) => {
    const headerH = 23;
    const topY = 5;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(marginX, topY, contentWidth, headerH);

    const logoX = marginX + 2;
    const logoY = topY + 1.5;
    const logoSize = 20;

    if (base64Logo) {
      try {
        doc.addImage(base64Logo, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch {
        doc.setFillColor(0, 135, 103);
        doc.circle(logoX + 10, logoY + 10, 9.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('CBE', logoX + 10, logoY + 12.5, { align: 'center' });
      }
    } else {
      doc.setFillColor(0, 135, 103);
      doc.circle(logoX + 10, logoY + 10, 9.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('CBE', logoX + 10, logoY + 12.5, { align: 'center' });
    }

    const textLeft = marginX + 25;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 135, 103);
    const schoolNameStr = (school.school_name || 'School Name Not Configured').toUpperCase();
    doc.text(schoolNameStr, textLeft, topY + 5.8);

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.15);
    doc.line(textLeft, topY + 7.5, marginX + contentWidth - 2, topY + 7.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("REPORT: STUDENTS' PERFORMANCE MERIT LIST", textLeft, topY + 12.0);

    doc.line(textLeft, topY + 13.6, marginX + contentWidth - 2, topY + 13.6);

    const metaY = topY + 18.2;
    doc.setFontSize(7.2);

    const classNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);
    const termStr = String(exam?.term || 'Term 2');
    const yearStr = String(exam?.year || '2026');
    const examNameStr = (exam?.exam_name || 'MID-TERM ASSESSMENT').toUpperCase();
    const examCodeStr = ((exam as any)?.exam_code || (exam as any)?.code || `${classNameStr.replace(/\s+/g, '')}T${termStr}${yearStr}`).toUpperCase();

    const renderLabelVal = (lbl: string, val: string, xPos: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(lbl, xPos, metaY);
      const lblWidth = doc.getTextWidth(lbl);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 85, 204);
      doc.text(val, xPos + lblWidth + 1, metaY);
    };

    renderLabelVal('CLASS: ', targetGrade, textLeft);
    renderLabelVal('STREAM: ', streamNameStr, textLeft + 35);
    renderLabelVal('TERM: ', termStr, textLeft + 76);
    renderLabelVal('YEAR: ', yearStr, textLeft + 104);
    renderLabelVal('EXAM NAME: ', examNameStr, textLeft + 128);
    renderLabelVal('EXAM CODE: ', examCodeStr, textLeft + 192);
  };

  autoTable(doc, {
    startY: 30,
    margin: { left: marginX, right: marginX, top: 30, bottom: 12 },
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
      renderDocumentHeader(d.pageNumber);
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

      // 2. Render Single-Line Subject Cells
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

  // @ts-ignore
  let finalY = (doc as any).lastAutoTable.finalY + 6;
  if (finalY > 145) {
    doc.addPage();
    renderDocumentHeader(doc.getNumberOfPages());
    finalY = 32;
  }

  // --- FOOTER: CLASS SUMMARY SECTION ---
  const subjSummaryHead = [['Learning Area', 'Code', 'Class Average (%)', 'Average Points', 'Overall Level']];
  const subjSummaryBody = subjectStatsList.map((s) => [
    s.name,
    s.code,
    formatPercentage(s.avg, true),
    `${s.avgPts.toFixed(2)}`,
    s.gradeCode,
  ]);

  autoTable(doc, {
    startY: finalY,
    margin: { left: marginX, right: marginX + 130 },
    head: subjSummaryHead,
    body: subjSummaryBody,
    theme: 'grid',
    styles: {
      fontSize: 5.8,
      cellPadding: 0.8,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 5.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 55, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 26, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
    },
  });

  const summaryBoxX = marginX + 152;
  const summaryBoxW = 131;
  const summaryBoxY = finalY;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(summaryBoxX, summaryBoxY, summaryBoxW, 45);

  doc.setFillColor(240, 240, 240);
  doc.rect(summaryBoxX, summaryBoxY, summaryBoxW, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text('CLASS PERFORMANCE SUMMARY', summaryBoxX + summaryBoxW / 2, summaryBoxY + 3.8, { align: 'center' });

  doc.line(summaryBoxX, summaryBoxY + 5.5, summaryBoxX + summaryBoxW, summaryBoxY + 5.5);

  const summItems = [
    { label: 'Total Learners:', val: `${totalLearners}` },
    { label: 'Number Assessed:', val: `${numberAssessed}` },
    { label: 'Class Mean Marks:', val: `${classMeanMarks}` },
    { label: 'Class Mean Percentage:', val: formatPercentage(classMeanPercNum, true) },
    { label: 'Class Mean Points:', val: `${classMeanPoints}` },
    { label: 'Highest Total Marks:', val: `${highestTotalMarks}` },
    { label: 'Lowest Total Marks:', val: `${lowestTotalMarks}` },
    { label: 'Best Learner:', val: bestLearnerStr },
    { label: 'Best Stream:', val: bestStreamStr },
  ];

  let itemY = summaryBoxY + 9;
  summItems.forEach((it) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(0, 0, 0);
    doc.text(it.label, summaryBoxX + 3, itemY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 85, 204);
    doc.text(it.val, summaryBoxX + 40, itemY);
    itemY += 3.8;
  });

  const notesY = summaryBoxY + 47;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(60, 60, 60);
  doc.text('Notes:', marginX, notesY);
  doc.text('• Student positions are determined using Total Marks.', marginX + 10, notesY);
  doc.text("• Overall Performance Level is calculated using the learner's Average Mark.", marginX + 75, notesY);

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
  doc.save(fileName);
}

function currentClassLabel(classes: ClassStream[], classId: string): string {
  if (!classId || classId === 'all') return 'Grade 8';
  const cls = classes.find((c) => c.id === classId);
  return cls ? cls.class_name : 'Grade 8';
}




// --- 2. GENERATE MERIT LIST EXCEL (.xlsx) ---
export function downloadMeritListExcel(data: MeritListData): void {
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
  populateComparisonResults(results, data.comparisonExamId, targetStudents, marks, grades, classes, activeSubjects);

  const validation = validateCalculationData(results, marks, grades, activeSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  const eduLevel = getEducationLevelForGrade(targetGrade);
  if (eduLevel === 'Junior School') {
    results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));
  } else {
    results.sort((a, b) => {
      if ((b.average_points || 0) !== (a.average_points || 0)) {
        return (b.average_points || 0) - (a.average_points || 0);
      }
      if ((b.total_points || 0) !== (a.total_points || 0)) {
        return (b.total_points || 0) - (a.total_points || 0);
      }
      return (b.average || 0) - (a.average || 0);
    });
  }

  const wb = XLSX.utils.book_new();

  // Header Rows
  const sheetData: any[][] = [
    [(school.school_name || 'School Name Not Configured').toUpperCase()],
    [`STUDENTS' PERFORMANCE MERIT LIST - ${exam?.exam_name || 'Assessment'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`],
    [`Class/Stream: ${streamNameStr}`, `Date Generated: ${new Date().toLocaleDateString()}`, `Generated By: ${generatedBy}`],
    [], // Empty row
  ];

  const subjectHeaders = activeSubjects.map((sb) => getShortCbeCode(sb.subject_code, sb.subject_name));

  // Table Column Headers matching Merit List & PDF
  const headers = [
    'SERIAL NO',
    'ADM NO',
    'LEARNER NAME',
    'ASS NO',
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
    }).length || r.subject_count || 1;

    const assessedCnt = subEntry || 1;
    const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
      ? r.average_points
      : (r.total_points / assessedCnt);
    const avgPts = isComplete ? avgPtsNum.toFixed(2) : '-';

    const overallLevelObj = getGradeForMark(r.average, grades);

    const row: any[] = [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN').toUpperCase(),
      (std as any)?.assessment_number || (std as any)?.ass_no || '-',
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      r.total_marks,
      isComplete ? formatPercentage(r.average, true) : `${formatPercentage(r.average, true)} (P)`,
      isComplete ? r.total_points : '-',
      avgPts,
      overallLevelObj.performance_level || 'ME',
      isComplete ? (overallLevelObj.grade_code || 'ME1') : `Prov (${overallLevelObj.grade_code || 'ME1'})`,
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
    const avg = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
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
  XLSX.writeFile(wb, fileName);
}

// --- 3. GENERATE MERIT LIST CSV (.csv) ---
export function downloadMeritListCSV(data: MeritListData): void {
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
  const rawActiveSubjects = targetClass ? getLearnerReportSubjects(firstTargetStudent || {} as any, targetClass, subjects, teachers || []) : [];
  const activeSubjects = sortSubjectsByStandardOrder(rawActiveSubjects);

  const results = calculateExamResults(examId, targetStudents, marks, grades, classes, activeSubjects);
  populateComparisonResults(results, data.comparisonExamId, targetStudents, marks, grades, classes, activeSubjects);

  const validation = validateCalculationData(results, marks, grades, activeSubjects);
  if (!validation.isValid) {
    console.error('Calculation Validation Errors:', validation.errors);
    throw new Error(`Calculation Engine Validation Failed:\n${validation.errors.join('\n')}`);
  }

  const csvEduLevel = getEducationLevelForGrade(targetGrade);
  if (csvEduLevel === 'Junior School') {
    results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));
  } else {
    results.sort((a, b) => {
      if ((b.average_points || 0) !== (a.average_points || 0)) {
        return (b.average_points || 0) - (a.average_points || 0);
      }
      if ((b.total_points || 0) !== (a.total_points || 0)) {
        return (b.total_points || 0) - (a.total_points || 0);
      }
      return (b.average || 0) - (a.average || 0);
    });
  }

  const csvRows: string[] = [];

  // Header
  csvRows.push(`"${school.school_name || 'School Name Not Configured'}"`);
  csvRows.push(`"STUDENTS' PERFORMANCE MERIT LIST - ${exam?.exam_name || 'Assessment'}"`);
  csvRows.push(`"Stream: ${streamNameStr}","Date: ${new Date().toLocaleDateString()}"`);
  csvRows.push('');

  const subjectHeaders = activeSubjects.map((sb) => getShortCbeCode(sb.subject_code, sb.subject_name));

  const headers = [
    'SERIAL NO',
    'ADM NO',
    'LEARNER NAME',
    'ASS NO',
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
    }).length || r.subject_count || 1;

    const assessedCnt = subEntry || 1;
    const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
      ? r.average_points
      : (r.total_points / assessedCnt);
    const avgPts = isComplete ? avgPtsNum.toFixed(2) : '-';

    const overallLevelObj = getGradeForMark(r.average, grades);

    const row: (string | number)[] = [
      `${idx + 1}`,
      std?.admission_number || '-',
      (std?.full_name || 'UNKNOWN').toUpperCase(),
      (std as any)?.assessment_number || (std as any)?.ass_no || '-',
      streamStr !== '-' ? streamStr.toUpperCase() : '-',
      streamRank,
      overallPos,
      prevStrPos,
      prevOvrPos,
      ...subjectCells,
      Math.round(r.total_marks),
      isComplete ? formatPercentage(r.average, true) : `${formatPercentage(r.average, true)} (P)`,
      isComplete ? r.total_points : '-',
      avgPts,
      overallLevelObj.performance_level || 'ME',
      isComplete ? (overallLevelObj.grade_code || 'ME1') : `Prov (${overallLevelObj.grade_code || 'ME1'})`,
    ];

    csvRows.push(row.map((cell) => `"${cell}"`).join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const fileName = `Merit_List_${streamNameStr.replace(/\s+/g, '_')}.csv`;
  saveAs(blob, fileName);
}
