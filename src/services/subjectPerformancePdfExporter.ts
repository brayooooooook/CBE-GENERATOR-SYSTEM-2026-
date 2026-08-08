import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
} from '../types';
import { getGradeForMark, CBE_8_POINT_GRADES, applyCompetitionRanking } from './analysisEngine';
import { getFilteredStudents } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, formatPercentage, getAbbreviatedLevel, getShortRemark } from '../utils/markUtils';

export interface SubjectPerformancePDFOptions {
  school: School;
  exam: Examination;
  subject: Subject;
  selectedClassId: string;
  selectedStreamId: string;
  students: Student[];
  marks: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  allExams?: Examination[];
  generatedBy?: string;
}

// Helper to convert image URL to Base64
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
          canvas.width = img.width || 120;
          canvas.height = img.height || 120;
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

// Generate Canvas Bar Chart for Performance Level Distribution
function generatePerformanceLevelChartCanvas(levelCounts: Record<string, number>, total: number): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title & border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Performance Level Distribution (CBE 8-Point Scale)', 25, 36);

    const levels = ['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2'];
    const levelColors: Record<string, string> = {
      EE1: '#059669',
      EE2: '#10B981',
      ME1: '#2563EB',
      ME2: '#3B82F6',
      AE1: '#D97706',
      AE2: '#F59E0B',
      BE1: '#DC2626',
      BE2: '#EF4444',
    };

    const maxCount = Math.max(1, ...Object.values(levelCounts));
    const startX = 50;
    const startY = 190;
    const chartHeight = 120;
    const barWidth = 65;
    const gap = 25;

    // Draw grid lines
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = startY - (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(startX - 10, y);
      ctx.lineTo(startX + levels.length * (barWidth + gap), y);
      ctx.stroke();

      const valLabel = Math.round((maxCount / 4) * i);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(valLabel.toString(), startX - 15, y + 4);
    }

    // Draw bars
    levels.forEach((lvl, idx) => {
      const count = levelCounts[lvl] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const bHeight = maxCount > 0 ? (count / maxCount) * chartHeight : 0;
      const x = startX + idx * (barWidth + gap);
      const y = startY - bHeight;

      // Bar shadow / border
      ctx.fillStyle = levelColors[lvl] || '#3B82F6';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, bHeight, [4, 4, 0, 0]) : ctx.fillRect(x, y, barWidth, bHeight);
      ctx.fill();

      // Count & Pct text above bar
      if (count > 0) {
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${count} (${pct}%)`, x + barWidth / 2, y - 6);
      }

      // X Label below bar
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lvl, x + barWidth / 2, startY + 20);
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Failed to render performance level canvas:', err);
    return null;
  }
}

// Generate Canvas Line Chart for Historical Performance Trend
function generateYearTrendChartCanvas(trendData: Array<{ examName: string; meanPoints: number }>): string | null {
  if (!trendData || trendData.length < 2) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Frame
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Historical Subject Performance Trend (Mean Points across Exams)', 25, 32);

    const startX = 70;
    const startY = 160;
    const chartWidth = 680;
    const chartHeight = 100;

    // Y axis range (1 to 8 CBE Points)
    const minY = 1;
    const maxY = 8;

    // Grid lines
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    for (let p = 1; p <= 8; p += 2) {
      const y = startY - ((p - minY) / (maxY - minY)) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${p} Pts`, startX - 10, y + 3);
    }

    const pointsCount = trendData.length;
    const stepX = chartWidth / Math.max(1, pointsCount - 1);

    const coords: Array<{ x: number; y: number; name: string; pts: number }> = [];

    trendData.forEach((item, idx) => {
      const x = startX + idx * stepX;
      const ptsClamped = Math.max(1, Math.min(8, item.meanPoints));
      const y = startY - ((ptsClamped - minY) / (maxY - minY)) * chartHeight;
      coords.push({ x, y, name: item.examName, pts: item.meanPoints });
    });

    // Draw connecting trend line
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3;
    ctx.beginPath();
    coords.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Draw dots & labels
    coords.forEach((pt) => {
      // Dot
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      // Value label
      ctx.fillStyle = '#1E3A8A';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pt.pts.toFixed(2)} Pts`, pt.x, pt.y - 10);

      // Exam Name label below
      ctx.fillStyle = '#475569';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const labelShort = pt.name.length > 15 ? pt.name.slice(0, 13) + '..' : pt.name;
      ctx.fillText(labelShort, pt.x, startY + 18);
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Failed to render trend canvas:', err);
    return null;
  }
}

export async function exportSubjectPerformanceAnalysisPDF(
  options: SubjectPerformancePDFOptions
): Promise<void> {
  const {
    school,
    exam,
    subject,
    selectedClassId = 'all',
    selectedStreamId = 'all',
    students = [],
    marks = [],
    grades = [],
    classes = [],
    teachers = [],
    allExams = [],
    generatedBy = 'Administrator',
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoBase64 = await getBase64ImageFromUrl(school.logo_url);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Filter target students matching selected class & stream (historical exam context aware)
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

  // Identify target class & grade details using historical context if available
  const firstTargetStudent = targetStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;

  const targetClassObj = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstTargetStudent?.class_id))
  ) || (selectedClassId !== 'all' ? classes.find((c) => c.class_name.toLowerCase() === selectedClassId.toLowerCase()) : undefined);

  const targetStreamObj = classes.find((c) => c.id === selectedStreamId);

  const classNameStr = targetClassObj ? targetClassObj.class_name : selectedClassId !== 'all' ? selectedClassId : 'All Classes';
  const streamNameStr = targetStreamObj ? `${targetStreamObj.class_name} - ${targetStreamObj.stream}` : selectedStreamId !== 'all' ? selectedStreamId : 'All Streams';

  // Grade level (e.g., Grade 7)
  const targetGradeName = targetClassObj?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstTargetStudent?.grade || selectedClassId || 'Grade 7';

  // Filter entire grade cohort (for Overall Grade Position, historical exam context aware)
  const gradeCohortStudents = getFilteredStudents(students, classes, targetGradeName, 'all', exam);

  // Assigned Subject Teacher
  const assignedTeacher = teachers.find((t) =>
    (t.allocations || []).some(a => a.subject_id === subject.id && (selectedClassId === 'all' || a.class_id === selectedClassId))
  ) || teachers.find((t) => (t.allocations || []).some(a => a.subject_id === subject.id));

  const teacherNameStr = assignedTeacher
    ? (assignedTeacher as any).teacher_name || (assignedTeacher as any).name || (assignedTeacher as any).full_name
    : 'Not Assigned';

  // 2. Compute marks & rankings
  // Grade cohort calculation map (for overall rank)
  const gradeCohortMarksMap = new Map<string, { numericVal: number | null; displayStr: string; status: string }>();
  gradeCohortStudents.forEach((st) => {
    const mObj = marks.find((m) => m.student_id === st.id && m.exam_id === exam.id && m.subject_id === subject.id);
    const evalResult = evaluateMark(mObj);
    gradeCohortMarksMap.set(st.id, {
      numericVal: evalResult.status === 'Normal' ? evalResult.percentage : null,
      displayStr: evalResult.displayPercentage || evalResult.displayScore || '-',
      status: evalResult.status,
    });
  });

  // Rank grade cohort (descending numeric marks)
  const sortedGradeCohort = Array.from(gradeCohortMarksMap.entries())
    .filter(([, data]) => data.numericVal !== null)
    .sort((a, b) => (b[1].numericVal as number) - (a[1].numericVal as number));

  const overallRanksMap = new Map<string, string>();
  applyCompetitionRanking(
    sortedGradeCohort,
    (a, b) => Math.round(((a[1].numericVal as number) || 0) * 10) === Math.round(((b[1].numericVal as number) || 0) * 10),
    (entry, rank) => {
      overallRanksMap.set(entry[0], `${rank}/${sortedGradeCohort.length}`);
    }
  );

  // Rank stream cohort (descending numeric marks)
  const streamMarksMap = new Map<string, { numericVal: number | null; displayStr: string; status: string }>();
  targetStudents.forEach((st) => {
    const mObj = marks.find((m) => m.student_id === st.id && m.exam_id === exam.id && m.subject_id === subject.id);
    const evalResult = evaluateMark(mObj);
    streamMarksMap.set(st.id, {
      numericVal: evalResult.status === 'Normal' ? evalResult.percentage : null,
      displayStr: evalResult.displayPercentage || evalResult.displayScore || '-',
      status: evalResult.status,
    });
  });

  const sortedStreamCohort = Array.from(streamMarksMap.entries())
    .filter(([, data]) => data.numericVal !== null)
    .sort((a, b) => (b[1].numericVal as number) - (a[1].numericVal as number));

  const streamRanksMap = new Map<string, string>();
  applyCompetitionRanking(
    sortedStreamCohort,
    (a, b) => Math.round(((a[1].numericVal as number) || 0) * 10) === Math.round(((b[1].numericVal as number) || 0) * 10),
    (entry, rank) => {
      streamRanksMap.set(entry[0], `${rank}/${sortedStreamCohort.length}`);
    }
  );

  // Complete list of processed learners for target cohort
  interface EvaluatedLearnerRow {
    student: Student;
    numericVal: number | null;
    displayMark: string;
    gradeObj: Grade;
    gradeCode: string;
    points: number;
    performanceLevel: string;
    overallRankStr: string;
    streamRankStr: string;
    remarks: string;
    isProvisional: boolean;
  }

  const completeLearners: EvaluatedLearnerRow[] = [];
  const provisionalLearners: EvaluatedLearnerRow[] = [];

  targetStudents.forEach((st) => {
    const markData = streamMarksMap.get(st.id);
    const isNormal = markData?.status === 'Normal' && markData.numericVal !== null;

    if (isNormal && markData.numericVal !== null) {
      const numScore = markData.numericVal;
      const gr = getGradeForMark(numScore, grades);
      const grCode = gr.grade_code || gr.grade || 'ME2';
      const pts = gr.points ?? 5;
      const perfLvl = gr.descriptor || gr.performance_level || 'Meeting Expectations';
      const ovRank = overallRanksMap.get(st.id) || `-/${sortedGradeCohort.length}`;
      const stRank = streamRanksMap.get(st.id) || `-/${sortedStreamCohort.length}`;

      completeLearners.push({
        student: st,
        numericVal: numScore,
        displayMark: formatPercentage(numScore, true),
        gradeObj: gr,
        gradeCode: grCode,
        points: pts,
        performanceLevel: perfLvl,
        overallRankStr: ovRank,
        streamRankStr: stRank,
        remarks: gr.remarks || perfLvl,
        isProvisional: false,
      });
    } else {
      const dispStr = markData?.displayStr || '-';
      provisionalLearners.push({
        student: st,
        numericVal: null,
        displayMark: dispStr,
        gradeObj: { grade_code: dispStr, performance_level: 'Provisional', points: 0 } as unknown as Grade,
        gradeCode: dispStr,
        points: 0,
        performanceLevel: markData?.status === 'Absent' ? 'Absent' : markData?.status === 'Irregularity' ? 'Irregularity' : 'Pending',
        overallRankStr: '-',
        streamRankStr: '-',
        remarks: markData?.status === 'Absent' ? 'Absent from Exam' : markData?.status === 'Irregularity' ? 'Exam Irregularity' : 'Marks Pending',
        isProvisional: true,
      });
    }
  });

  // Sort complete learners descending by score
  completeLearners.sort((a, b) => (b.numericVal || 0) - (a.numericVal || 0));

  // Combine so complete learners appear before provisional learners
  const allProcessedRows = [...completeLearners, ...provisionalLearners];

  // 3. Compute Summary Statistics & Level Distribution
  const validNumericScores = completeLearners.map((r) => r.numericVal as number);
  const totalEntered = targetStudents.length;
  const totalComplete = completeLearners.length;
  const totalProvisional = provisionalLearners.length;

  const sumMarks = validNumericScores.reduce((a, b) => a + b, 0);
  const avgMarkNum = totalComplete > 0 ? sumMarks / totalComplete : 0;
  const avgGradeObj = getGradeForMark(avgMarkNum, grades);
  const avgGradeCode = avgGradeObj.grade_code || avgGradeObj.grade || 'ME2';
  const avgPerfLevel = avgGradeObj.descriptor || avgGradeObj.performance_level || 'Meeting Expectations';

  const sumPoints = completeLearners.reduce((a, b) => a + b.points, 0);
  const avgPointsNum = totalComplete > 0 ? sumPoints / totalComplete : 0;

  const highestMarkNum = validNumericScores.length > 0 ? Math.max(...validNumericScores) : 0;
  const lowestMarkNum = validNumericScores.length > 0 ? Math.min(...validNumericScores) : 0;

  // Pass rate: percentage achieving ME2 or higher (points >= 5 or grade code in EE1, EE2, ME1, ME2)
  const passCount = completeLearners.filter((r) => r.points >= 5 || ['EE1', 'EE2', 'ME1', 'ME2'].includes(r.gradeCode)).length;
  const passRateNum = totalComplete > 0 ? (passCount / totalComplete) * 100 : 0;

  // 8-Point CBE level counts
  const levelCounts: Record<string, number> = {
    EE1: 0,
    EE2: 0,
    ME1: 0,
    ME2: 0,
    AE1: 0,
    AE2: 0,
    BE1: 0,
    BE2: 0,
  };

  completeLearners.forEach((r) => {
    const code = r.gradeCode.toUpperCase();
    if (levelCounts[code] !== undefined) {
      levelCounts[code]++;
    } else if (code.startsWith('EE')) levelCounts['EE2']++;
    else if (code.startsWith('ME')) levelCounts['ME2']++;
    else if (code.startsWith('AE')) levelCounts['AE2']++;
    else if (code.startsWith('BE')) levelCounts['BE2']++;
  });

  // Statistical calculations (Mean, Median, Mode, Highest, Lowest, Range, Std Dev)
  const meanStat = avgMarkNum.toFixed(2);
  let medianStat = '0.00';
  if (validNumericScores.length > 0) {
    const sortedVals = [...validNumericScores].sort((a, b) => a - b);
    const mid = Math.floor(sortedVals.length / 2);
    if (sortedVals.length % 2 !== 0) {
      medianStat = sortedVals[mid].toFixed(2);
    } else {
      medianStat = ((sortedVals[mid - 1] + sortedVals[mid]) / 2).toFixed(2);
    }
  }

  // Mode
  let modeStat = 'N/A';
  if (validNumericScores.length > 0) {
    const freqMap: Record<number, number> = {};
    let maxFreq = 0;
    validNumericScores.forEach((v) => {
      freqMap[v] = (freqMap[v] || 0) + 1;
      if (freqMap[v] > maxFreq) maxFreq = freqMap[v];
    });
    if (maxFreq > 1) {
      const modes = Object.keys(freqMap)
        .filter((k) => freqMap[Number(k)] === maxFreq)
        .map((k) => `${k}%`);
      modeStat = modes.slice(0, 3).join(', ');
    } else {
      modeStat = `${validNumericScores[0]}%`;
    }
  }

  const highestStat = `${highestMarkNum}%`;
  const lowestStat = `${lowestMarkNum}%`;
  const rangeStat = `${highestMarkNum - lowestMarkNum}%`;

  let stdDevStat = '0.00';
  if (validNumericScores.length > 1) {
    const variance = validNumericScores.reduce((acc, val) => acc + Math.pow(val - avgMarkNum, 2), 0) / validNumericScores.length;
    stdDevStat = Math.sqrt(variance).toFixed(2);
  }

  // 4. Historical Trend Data collection across allExams
  const trendData: Array<{ examName: string; meanPoints: number }> = [];
  if (allExams && allExams.length > 1) {
    // Sort exams by date / year / term
    const sortedExams = [...allExams].sort((a, b) => (a.year - b.year) || (a.term.localeCompare(b.term)));
    sortedExams.forEach((ex) => {
      let exSumPts = 0;
      let exValidCount = 0;

      targetStudents.forEach((st) => {
        const mObj = marks.find((m) => m.student_id === st.id && m.exam_id === ex.id && m.subject_id === subject.id);
        const evalRes = evaluateMark(mObj);
        if (evalRes.status === 'Normal' && evalRes.percentage !== null) {
          const gr = getGradeForMark(evalRes.percentage, grades);
          exSumPts += gr.points ?? 5;
          exValidCount++;
        }
      });

      if (exValidCount > 0) {
        trendData.push({
          examName: ex.exam_name,
          meanPoints: Math.round((exSumPts / exValidCount) * 100) / 100,
        });
      }
    });
  }

  // Helper function to render header on PDF
  function drawPDFHeader() {
    doc.setLineWidth(0.4);
    doc.setDrawColor(15, 23, 42); // Navy border
    doc.rect(8, 8, pageWidth - 16, 26);

    let leftMargin = 12;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'JPEG', 11, 10, 22, 22);
        leftMargin = 36;
      } catch {
        leftMargin = 12;
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text((school.school_name || 'Ministry of Education CBE System').toUpperCase(), leftMargin, 15);

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('SUBJECT PERFORMANCE ANALYSIS REPORT', leftMargin, 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`CBE Generator System • Learning Area: ${subject.subject_name} (${subject.subject_code})`, leftMargin, 26);
    doc.text(`County: ${school.county || 'N/A'} • School Code: ${school.school_code || 'N/A'}`, leftMargin, 31);
  }

  // Draw Page 1 Header
  drawPDFHeader();

  // 5. Render Meta Details Table (Below Title)
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const metaDataBody = [
    [
      { content: 'Examination:', styles: { fontStyle: 'bold' } },
      `${exam.exam_name}`,
      { content: 'Academic Year:', styles: { fontStyle: 'bold' } },
      `${exam.year}`,
      { content: 'Term:', styles: { fontStyle: 'bold' } },
      `${exam.term}`,
    ],
    [
      { content: 'Class:', styles: { fontStyle: 'bold' } },
      `${classNameStr}`,
      { content: 'Stream:', styles: { fontStyle: 'bold' } },
      `${streamNameStr}`,
      { content: 'Learning Area:', styles: { fontStyle: 'bold' } },
      `${subject.subject_name} (${subject.subject_code})`,
    ],
    [
      { content: 'Subject Teacher:', styles: { fontStyle: 'bold' } },
      `${teacherNameStr}`,
      { content: 'Date Generated:', styles: { fontStyle: 'bold' } },
      `${dateStr}`,
      { content: 'Time Generated:', styles: { fontStyle: 'bold' } },
      `${timeStr}`,
    ],
  ];

  autoTable(doc, {
    startY: 37,
    margin: { left: 8, right: 8 },
    body: metaDataBody as any,
    theme: 'plain',
    styles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 26, halign: 'left' },
      1: { cellWidth: 38, halign: 'left' },
      2: { cellWidth: 26, halign: 'left' },
      3: { cellWidth: 32, halign: 'left' },
      4: { cellWidth: 26, halign: 'left' },
      5: { cellWidth: 46, halign: 'left' },
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 4;

  // 6. Summary Statistics Cards
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. SUMMARY STATISTICS', 8, currentY);
  currentY += 3;

  const statsGridData = [
    ['Total Learners Entered', `${totalEntered}`, 'Average Marks (%)', formatPercentage(avgMarkNum, true)],
    ['Average Points', `${avgPointsNum.toFixed(2)} Pts`, 'Average Grade', `${avgGradeCode}`],
    ['Performance Level', `${avgPerfLevel}`, 'Highest Mark', formatPercentage(highestMarkNum, true)],
    ['Lowest Mark', formatPercentage(lowestMarkNum, true), 'Pass Rate (%)', formatPercentage(passRateNum, true)],
    ['Complete Learners', `${totalComplete}`, 'Provisional Learners', `${totalProvisional}`],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 8, right: 8 },
    body: statsGridData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 1.8 },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      1: { halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 49 },
      2: { halign: 'left', fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      3: { halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 49 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 7. Performance Level Distribution Table & Chart
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. PERFORMANCE LEVEL DISTRIBUTION (CBE 8-POINT SCALE)', 8, currentY);
  currentY += 3;

  const perfLevelTableBody = [
    ['EE1 (Exceeding Expectations 1)', `${levelCounts['EE1']}`, totalComplete > 0 ? formatPercentage((levelCounts['EE1'] / totalComplete) * 100, true) : '0%'],
    ['EE2 (Exceeding Expectations 2)', `${levelCounts['EE2']}`, totalComplete > 0 ? formatPercentage((levelCounts['EE2'] / totalComplete) * 100, true) : '0%'],
    ['ME1 (Meeting Expectations 1)', `${levelCounts['ME1']}`, totalComplete > 0 ? formatPercentage((levelCounts['ME1'] / totalComplete) * 100, true) : '0%'],
    ['ME2 (Meeting Expectations 2)', `${levelCounts['ME2']}`, totalComplete > 0 ? formatPercentage((levelCounts['ME2'] / totalComplete) * 100, true) : '0%'],
    ['AE1 (Approaching Expectations 1)', `${levelCounts['AE1']}`, totalComplete > 0 ? formatPercentage((levelCounts['AE1'] / totalComplete) * 100, true) : '0%'],
    ['AE2 (Approaching Expectations 2)', `${levelCounts['AE2']}`, totalComplete > 0 ? formatPercentage((levelCounts['AE2'] / totalComplete) * 100, true) : '0%'],
    ['BE1 (Below Expectations 1)', `${levelCounts['BE1']}`, totalComplete > 0 ? formatPercentage((levelCounts['BE1'] / totalComplete) * 100, true) : '0%'],
    ['BE2 (Below Expectations 2)', `${levelCounts['BE2']}`, totalComplete > 0 ? formatPercentage((levelCounts['BE2'] / totalComplete) * 100, true) : '0%'],
    [{ content: 'TOTAL ASSESSED LEARNERS', styles: { fontStyle: 'bold' } }, `${totalComplete}`, '100%'],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 8, right: 8 },
    head: [['Performance Level', 'Learners', 'Percentage']],
    body: perfLevelTableBody as any,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 1.5 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 104 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 45 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 45 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Add Chart Image for Distribution
  const levelChartBase64 = generatePerformanceLevelChartCanvas(levelCounts, totalComplete);
  if (levelChartBase64) {
    if (currentY + 50 > pageHeight - 15) {
      doc.addPage();
      drawPDFHeader();
      currentY = 40;
    }
    doc.addImage(levelChartBase64, 'PNG', 8, currentY, 194, 52);
    currentY += 56;
  }

  // 8. Historical Performance Trend Section (Hidden automatically if < 2 historical exams)
  const trendChartBase64 = generateYearTrendChartCanvas(trendData);
  if (trendChartBase64) {
    if (currentY + 50 > pageHeight - 15) {
      doc.addPage();
      drawPDFHeader();
      currentY = 40;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3. YEAR PERFORMANCE TREND', 8, currentY);
    currentY += 3;

    doc.addImage(trendChartBase64, 'PNG', 8, currentY, 194, 48);
    currentY += 52;
  }

  // 9. Statistical Analysis Table
  if (currentY + 45 > pageHeight - 15) {
    doc.addPage();
    drawPDFHeader();
    currentY = 40;
  }

  const sectionNumStats = trendChartBase64 ? '4' : '3';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${sectionNumStats}. STATISTICAL ANALYSIS`, 8, currentY);
  currentY += 3;

  const statsTableBody = [
    ['Mean Score', formatPercentage(avgMarkNum, true), 'Highest Score', formatPercentage(highestMarkNum, true)],
    ['Median Score', formatPercentage(parseFloat(medianStat), true), 'Lowest Score', formatPercentage(lowestMarkNum, true)],
    ['Mode Score', `${modeStat}`, 'Score Range', `${rangeStat}`],
    ['Standard Deviation', `${stdDevStat}`, 'Assessed Sample Size', `${totalComplete} Learners`],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 8, right: 8 },
    body: statsTableBody,
    theme: 'grid',
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 1.6 },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 49 },
      2: { halign: 'left', fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 49 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 10. Student Performance Table
  if (currentY + 50 > pageHeight - 15) {
    doc.addPage();
    drawPDFHeader();
    currentY = 40;
  }

  const sectionNumStudents = trendChartBase64 ? '5' : '4';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${sectionNumStudents}. STUDENT PERFORMANCE ROSTER (${allProcessedRows.length} LEARNERS)`, 8, currentY);
  currentY += 3;

  const studentTableHead = [
    ['No.', 'Adm No.', 'Student Name', 'Marks (%)', 'Grade', 'Points', 'Level', 'Grade Pos.', 'Stream Pos.', 'Remarks'],
  ];

  const studentTableBody = allProcessedRows.map((row, idx) => [
    idx + 1,
    row.student.admission_number || '-',
    row.student.full_name, // NOT bold as required
    row.displayMark,
    row.gradeCode,
    row.isProvisional ? '-' : row.points,
    getAbbreviatedLevel(row.performanceLevel, row.gradeCode),
    row.overallRankStr,
    row.streamRankStr,
    getShortRemark(row.remarks, row.gradeCode),
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 8, right: 8, top: 35, bottom: 12 },
    head: studentTableHead,
    body: studentTableBody,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      fontSize: 8,
      cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 },
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
      minCellHeight: 5,
    },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', valign: 'middle', minCellHeight: 6 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 20 },
      2: { halign: 'left', fontStyle: 'normal', cellWidth: 44 }, // Student Name left aligned & NOT bold
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 11 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 12 }, // Abbreviated Level: EE, ME, AE, BE
      7: { halign: 'center', cellWidth: 17 },
      8: { halign: 'center', cellWidth: 17 },
      9: { halign: 'left', cellWidth: 27 }, // Short remarks
    },
    didDrawPage: (data) => {
      // Repeat Header on new pages if table spills over
      if (data.pageNumber > 1) {
        drawPDFHeader();
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 11. Teacher Remarks & Classroom Observations
  if (currentY + 45 > pageHeight - 15) {
    doc.addPage();
    drawPDFHeader();
    currentY = 40;
  }

  const sectionNumRemarks = trendChartBase64 ? '6' : '5';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${sectionNumRemarks}. TEACHER REMARKS & CLASSROOM OBSERVATIONS`, 8, currentY);
  currentY += 3;

  // Find strongest and weakest levels
  let strongestLevel = 'EE1';
  let maxLvlCount = -1;
  let weakestLevel = 'BE2';
  let minLvlCount = 9999;

  Object.entries(levelCounts).forEach(([lvl, count]) => {
    if (count > maxLvlCount) {
      maxLvlCount = count;
      strongestLevel = lvl;
    }
    if (count < minLvlCount && count > 0) {
      minLvlCount = count;
      weakestLevel = lvl;
    }
  });

  const meetingExpCount = levelCounts['EE1'] + levelCounts['EE2'] + levelCounts['ME1'] + levelCounts['ME2'];
  const meetingExpPct = totalComplete > 0 ? Math.round((meetingExpCount / totalComplete) * 100) : 0;
  const interventionCount = levelCounts['BE1'] + levelCounts['BE2'];
  const interventionPct = totalComplete > 0 ? Math.round((interventionCount / totalComplete) * 100) : 0;

  const remarksBody = [
    [
      { content: 'Strongest Level Concentration:', styles: { fontStyle: 'bold' } },
      `${strongestLevel} (${maxLvlCount > 0 ? maxLvlCount : 0} learners)`,
      { content: 'Weakest Level Concentration:', styles: { fontStyle: 'bold' } },
      `${weakestLevel} (${minLvlCount < 9999 ? minLvlCount : 0} learners)`,
    ],
    [
      { content: 'Learners Meeting/Exceeding Expectations:', styles: { fontStyle: 'bold' } },
      `${meetingExpCount} of ${totalComplete} (${meetingExpPct}%)`,
      { content: 'Learners Requiring Targeted Intervention:', styles: { fontStyle: 'bold' } },
      `${interventionCount} of ${totalComplete} (${interventionPct}%)`,
    ],
    [
      { content: 'Overall Class Performance Summary:', styles: { fontStyle: 'bold' } },
      {
        content: `In ${subject.subject_name} (${subject.subject_code}) for ${classNameStr} (${streamNameStr}) in ${exam.exam_name}, the overall class mean is ${avgMarkNum.toFixed(2)}% (${avgGradeCode} - ${avgPerfLevel}) with a pass rate of ${passRateNum.toFixed(1)}%. ${meetingExpCount} learners are meeting or exceeding learning targets. ${interventionCount > 0 ? `${interventionCount} learners require immediate academic intervention and remedial support.` : 'All learners demonstrate satisfactory performance.'}`,
        colSpan: 3,
        styles: { fontStyle: 'normal' },
      },
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 8, right: 8 },
    body: remarksBody as any,
    theme: 'grid',
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 1.8 },
    columnStyles: {
      0: { halign: 'left', fillColor: [248, 250, 252], cellWidth: 50 },
      1: { halign: 'left', cellWidth: 47 },
      2: { halign: 'left', fillColor: [248, 250, 252], cellWidth: 50 },
      3: { halign: 'left', cellWidth: 47 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Signatures box
  if (currentY + 25 > pageHeight - 15) {
    doc.addPage();
    drawPDFHeader();
    currentY = 40;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  doc.text('Subject Teacher Signature: ______________________', 10, currentY + 10);
  doc.text('Head of Institution Signature: ______________________', 110, currentY + 10);
  doc.text('Date: ____ / ____ / ________', 10, currentY + 16);
  doc.text('Official School Stamp', 110, currentY + 16);

  // 12. Footers and Page Numbers Loop
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);

    const footerLeft = 'Prepared by: CBE Generator System';
    const footerCenter = `Generated on: ${dateStr} at ${timeStr}`;
    const footerRight = `Page ${i} of ${totalPages}`;

    doc.text(footerLeft, 8, pageHeight - 6);
    doc.text(footerCenter, pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.text(footerRight, pageWidth - 8, pageHeight - 6, { align: 'right' });
  }

  // Save PDF file
  const fileName = `Subject_Performance_Analysis_${subject.subject_code}_${classNameStr.replace(/\s+/g, '_')}_${exam.exam_name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
