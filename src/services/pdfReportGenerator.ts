import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Grade,
  Teacher,
  LearnerReportComment,
  getApplicableSubjectsForGrade,
  getEducationLevelForGrade,
  EducationLevel,
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  calculateSubjectRank,
  getLearnerReportSubjects,
} from './analysisEngine';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, formatPercentage } from '../utils/markUtils';

export function resolvePDFLearnerContext(student: Student, exam: Examination | undefined, classes: ClassStream[]) {
  const examContext = exam ? getLearnerClassAtExamTime(student, exam, classes) : null;
  const isHistoricalContext = examContext?.is_historical === true;

  let targetClass = (classes || []).find((c) => c.id === student.class_id);
  if (isHistoricalContext) {
    if (examContext.historical_context_resolved && examContext.class_id) {
      targetClass = (classes || []).find((c) => c.id === examContext.class_id) || ({
        id: examContext.class_id,
        class_name: examContext.class_name,
        stream: examContext.stream_name,
        education_level: getEducationLevelForGrade(examContext.grade),
      } as ClassStream);
    } else {
      targetClass = undefined;
    }
  }

  const targetClassId = isHistoricalContext
    ? (examContext?.class_id || '')
    : (student.class_id || '');

  const classNameStr = isHistoricalContext
    ? (examContext?.full_class_name || 'Unknown Grade')
    : (targetClass
        ? `${targetClass.class_name} - ${targetClass.stream}`
        : student.class_id || student.grade || 'Grade 7');

  const studentGrade = isHistoricalContext
    ? (examContext?.grade || 'Unknown Grade')
    : (student.grade || targetClass?.class_name || '');

  const effectiveStudent: Student = isHistoricalContext
    ? { ...student, class_id: targetClassId, grade: studentGrade as Student['grade'] }
    : student;

  return {
    examContext,
    isHistoricalContext,
    targetClass,
    targetClassId,
    classNameStr,
    studentGrade,
    effectiveStudent,
  };
}
import { stripSurroundingQuotes } from '../utils/filterUtils';
import { generatePersonalizedLearnerComment } from './learnerCommentGenerator';

export interface PDFReportData {
  student: Student;
  school: School;
  exam?: Examination;
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  allStudents: Student[];
  savedRemarks?: LearnerReportComment;
}

// Helper to convert image URL to base64 data URL for jsPDF
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

// Draw Common Header Banner for all Report Cards
async function drawReportHeader(
  doc: jsPDF,
  school: School,
  title: string,
  subtitle: string,
  currentY: number
): Promise<number> {
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  // Top Dark Banner
  doc.setFillColor(15, 23, 42); // Navy (#0F172A)
  doc.rect(marginX, currentY, contentWidth, 2.5, 'F');
  currentY += 5;

  // School Logo & Header
  let logoBase64: string | null = null;
  if (school.logo_url) {
    logoBase64 = await getBase64ImageFromUrl(school.logo_url);
  }

  const logoWidth = 16;
  const logoHeight = 16;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', marginX + 2, currentY, logoWidth, logoHeight);
    } catch {
      doc.setFillColor(217, 119, 6);
      doc.circle(marginX + 9, currentY + 8, 7, 'F');
    }
  } else {
    doc.setFillColor(217, 119, 6); // Amber
    doc.circle(marginX + 9, currentY + 8, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CBE', marginX + 9, currentY + 9.5, { align: 'center' });
  }

  // School Name
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text((school.school_name || 'School Name Not Configured').toUpperCase(), pageWidth / 2, currentY + 5, { align: 'center' });

  let textYOffset = 5;

  if (school.motto) {
    textYOffset += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`"${school.motto}"`, pageWidth / 2, currentY + textYOffset, { align: 'center' });
  }

  const contactDetails = [
    school.phone ? `Tel: ${school.phone}` : null,
  ].filter(Boolean).join(' | ');

  if (contactDetails) {
    textYOffset += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(contactDetails, pageWidth / 2, currentY + textYOffset, { align: 'center' });
  }

  currentY += Math.max(16, textYOffset + 6);

  // Level Title Badge Bar
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), pageWidth / 2, currentY + 4.5, { align: 'center' });

  currentY += 9.5;
  return currentY;
}

// -------------------------------------------------------------
// 1. PRE-PRIMARY REPORT CARD PDF GENERATOR (PP1 - PP2)
// -------------------------------------------------------------
async function generatePrePrimaryReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const { targetClass, targetClassId, classNameStr, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);
  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examId = exam?.id || '';

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency & Growth Evaluation', currentY);

  // Learner Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');

  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(student.full_name.toUpperCase(), marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8.5);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADE / LEVEL:', marginX + 88, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(`${exam?.exam_name || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Pre-Primary Development Progress Banner
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(marginX, currentY, contentWidth, 9, 1, 1, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('LEARNING AREA PERFORMANCE & COMPETENCY EVALUATION', marginX + 4, currentY + 6);

  currentY += 13;

  // Table of Learning Areas
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark);

    let level = 'X';
    let descStr = 'Missing Assessment (X)';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades);
      level = gr.performance_level;
      const descMap: Record<string, string> = {
        EE: 'Exceeding Expectations - Demonstrates exceptional skill and independent initiative',
        ME: 'Meeting Expectations - Displays target competency consistently with minor guidance',
        AE: 'Approaching Expectations - Developing skill; requires regular practice',
        BE: 'Below Expectations - Requires structured guidance and continuous support',
      };
      descStr = descMap[level] || 'Evaluation in progress';
      defaultSubjComment = gr.remarks || 'Good progress';
    } else if (markInfo.status === 'Y') {
      level = 'Y';
      descStr = `Examination Irregularity (${markInfo.irregularityReason || 'Absent'})`;
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjTeacher = teachers.find(
      (t) => (t.allocations || []).some(a => a.subject_id === sb.id && a.class_id === student.class_id)
    );
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';
    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_code, sb.subject_name, level, descStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Code', 'Learning Area Activity', 'Competency', 'Level Indicator & Progress Description', 'Teacher Observation', 'Teacher']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 45, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 54, fontSize: 7 },
      4: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      5: { halign: 'left', cellWidth: 22, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 2) {
        const val = cellData.cell.raw as string;
        if (val === 'EE') cellData.cell.styles.textColor = [5, 150, 105];
        else if (val === 'ME') cellData.cell.styles.textColor = [30, 64, 175];
        else if (val === 'AE') cellData.cell.styles.textColor = [217, 119, 6];
        else if (val === 'BE') cellData.cell.styles.textColor = [225, 29, 72];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Development Summary Table (Motor, Social-Emotional, Language, Creative)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 26, 1, 1, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('EARLY CHILDHOOD DEVELOPMENT & PSYCHOMOTOR INDICATORS', marginX + 4, currentY + 4.5);

  const devIndicators = [
    { domain: 'Motor & Physical Development:', text: 'Excellent fine and gross motor skills, active physical participation and coordination.' },
    { domain: 'Social-Emotional Growth:', text: 'Interacts harmoniously with peers, shares learning tools, and demonstrates good manners.' },
    { domain: 'Language & Communication:', text: 'Expresses thoughts clearly, listens attentively during story time and group activities.' },
    { domain: 'Creative & Artistic Skills:', text: 'Shows enthusiastic engagement in music, drawing, color identification, and role play.' },
  ];

  devIndicators.forEach((dev, idx) => {
    const yPos = currentY + 9 + idx * 4.5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(dev.domain, marginX + 4, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(dev.text, marginX + 54, yPos);
  });

  currentY += 31;

  // Teacher Remarks & HOI Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Headteacher';

  const defaultCtComment = 'The learner shows positive engagement and good developmental progress.';
  const defaultHoiComment = 'Commendable growth across learning areas. Keep encouraging the learner.';

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // CT Remarks Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(ctComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 20;

  // HOI Remarks Box
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text(`HEADTEACHER'S REMARKS (Headteacher: ${hoiName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(hoiComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 21;

  // Signatures Section
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Headteacher & Official Seal', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 18, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.5, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.label, x + sigColW / 2, currentY + 13.5, { align: 'center' });
  });

  currentY += 23;

  // Footer
  const footerY = Math.max(currentY + 5, 278);
  const nextTermDate = savedRemarks?.next_term_opening_date || '12th September 2026';
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, footerY - 2.5, contentWidth, 0.4, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${currentDateStr}`, pageWidth / 2, footerY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('PRE-PRIMARY REPORTING SYSTEM', marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// 2. LOWER PRIMARY REPORT CARD PDF GENERATOR (Grades 1 - 3)
// -------------------------------------------------------------
async function generateLowerPrimaryReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], allStudents = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const examId = exam?.id || '';
  const { targetClass, targetClassId, classNameStr, studentGrade, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examResults = calculateExamResults(examId, allStudents, marks, grades, classes, subjects);
  const studentResult = examResults.find((r) => r.student_id === student.id);
  const isAssessmentComplete = studentResult ? studentResult.is_complete !== false : false;

  const totalMarks = studentResult?.total_marks || 0;
  const averageScore = studentResult?.average || 0;
  const totalPoints = isAssessmentComplete ? (studentResult?.total_points || 0) : 0;
  const overallLevel = isAssessmentComplete ? (studentResult?.performance_level || 'ME') : 'Pending';
  const overallGradeCode = isAssessmentComplete ? (studentResult?.grade_code || studentResult?.grade || 'ME1') : 'Pending';
  const overallRank = isAssessmentComplete && studentResult?.position ? `#${studentResult.position}` : 'Not Ranked';
  const streamRank = isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `#${studentResult.class_position || studentResult.position}` : 'Not Ranked';
  const totalAssessedStudents = examResults.filter(r => r.is_complete !== false).length || 1;
  const streamStudentsCount = targetClassId ? (allStudents.filter((s) => s.class_id === targetClassId).length || 1) : 1;

  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 8;

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency-Based Education (CBE)', currentY);

  // Details Grid
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');

  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(student.full_name.toUpperCase(), marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8.5);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADE & STREAM:', marginX + 88, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(`${exam?.exam_name || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Performance Summary Box
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'F');
  const colW = contentWidth / 6;

  const metrics = [
    { label: 'TOTAL SCORE', val: `${totalMarks} / ${maxPossibleMarks}` },
    { label: 'AVERAGE (%)', val: formatPercentage(averageScore, true) },
    { label: 'CBE LEVEL', val: isAssessmentComplete ? `${overallLevel} (${overallGradeCode})` : 'Pending' },
    { label: 'TOTAL POINTS', val: isAssessmentComplete ? `${totalPoints} / ${maxPossiblePoints}` : '-' },
    { label: 'STREAM RANK', val: isAssessmentComplete && streamRank !== 'Not Ranked' ? `${streamRank} of ${streamStudentsCount}` : streamRank },
    { label: 'OVERALL RANK', val: isAssessmentComplete && overallRank !== 'Not Ranked' ? `${overallRank} of ${totalAssessedStudents}` : overallRank },
  ];

  metrics.forEach((m, idx) => {
    const startX = marginX + idx * colW;
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(m.label, startX + colW / 2, currentY + 4.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    if (idx === 1) doc.setTextColor(251, 191, 36);
    if (idx === 2) doc.setTextColor(52, 211, 153);
    doc.text(m.val, startX + colW / 2, currentY + 11, { align: 'center' });
  });

  currentY += 21;

  // Performance Table
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark);

    let scoreDisplay = 'X';
    let pctDisplay = 'X';
    let levelDisplay = 'X';
    let codeDisplay = 'X';
    let pointsDisplay = 'X';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades);
      const roundedScore = Math.round(markInfo.percentage);
      scoreDisplay = `${roundedScore}/100`;
      pctDisplay = formatPercentage(roundedScore, true);
      levelDisplay = gr.performance_level;
      codeDisplay = gr.grade_code || gr.grade || '-';
      pointsDisplay = `${gr.points}`;
      defaultSubjComment = gr.remarks || 'Good Progress';
    } else if (markInfo.status === 'Y') {
      scoreDisplay = 'Y';
      pctDisplay = 'Y';
      levelDisplay = 'Y';
      codeDisplay = 'Y';
      pointsDisplay = 'Y';
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjectRankStr = markInfo.status === 'Normal' ? calculateSubjectRank(effectiveStudent, sb.id, examId, allStudents, classes, marks) : '-';
    const subjTeacher = targetClassId ? teachers.find((t) => (t.allocations || []).some(a => a.subject_id === sb.id && a.class_id === targetClassId)) : undefined;
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';

    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_code, sb.subject_name, scoreDisplay, pctDisplay, levelDisplay, codeDisplay, pointsDisplay, subjectRankStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Code', 'Learning Area / Subject', 'Score', '%', 'CBE Level', 'Code', 'Points', 'Rank', 'Subject Teacher Comment', 'Teacher']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.0, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 11, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      8: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      9: { halign: 'left', cellWidth: 24, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 4) {
        const val = cellData.cell.raw as string;
        if (val === 'EE') cellData.cell.styles.textColor = [5, 150, 105];
        else if (val === 'ME') cellData.cell.styles.textColor = [30, 64, 175];
        else if (val === 'AE') cellData.cell.styles.textColor = [217, 119, 6];
        else if (val === 'BE') cellData.cell.styles.textColor = [225, 29, 72];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const defaultCtComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'class_teacher',
    isProvisional: !isAssessmentComplete,
  });
  const defaultHoiComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'hoi',
    isProvisional: !isAssessmentComplete,
  });

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // CT Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`CLASS TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(ctComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 20;

  // HOI Box
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text(`HEAD OF INSTITUTION'S REMARKS (HOI: ${hoiName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(hoiComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 21;

  // Grading Key
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 20, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CBE 8-POINT ACHIEVEMENT SCALE GRADING KEY', marginX + 3, currentY + 4.5);

  const gradeKeyItems = [
    { code: 'EE1', range: '90–100%', pts: '8 Pts', color: [5, 150, 105] },
    { code: 'EE2', range: '75–89%', pts: '7 Pts', color: [5, 150, 105] },
    { code: 'ME1', range: '58–74%', pts: '6 Pts', color: [30, 64, 175] },
    { code: 'ME2', range: '41–57%', pts: '5 Pts', color: [30, 64, 175] },
    { code: 'AE1', range: '31–40%', pts: '4 Pts', color: [217, 119, 6] },
    { code: 'AE2', range: '21–30%', pts: '3 Pts', color: [217, 119, 6] },
    { code: 'BE1', range: '11–20%', pts: '2 Pts', color: [225, 29, 72] },
    { code: 'BE2', range: '0–10%', pts: '1 Pt', color: [225, 29, 72] },
  ];

  const keyColW = contentWidth / 4;
  gradeKeyItems.forEach((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    const x = marginX + col * keyColW + 3;
    const y = currentY + 9.5 + row * 6;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.code}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${item.range} (${item.pts})`, x + 7, y);
  });

  currentY += 24;

  // Signatures
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Head of Institution & Stamp', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 18, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.5, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.label, x + sigColW / 2, currentY + 13.5, { align: 'center' });
  });

  currentY += 23;

  // Footer
  const footerY = Math.max(currentY + 5, 278);
  const nextTermDate = savedRemarks?.next_term_opening_date || '12th September 2026';
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, footerY - 2.5, contentWidth, 0.4, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${currentDateStr}`, pageWidth / 2, footerY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('CBE REPORTING SYSTEM', marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// 3. UPPER PRIMARY REPORT CARD PDF GENERATOR (Grades 4 - 6)
// -------------------------------------------------------------
async function generateUpperPrimaryReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], allStudents = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const examId = exam?.id || '';
  const { targetClass, targetClassId, classNameStr, studentGrade, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examResults = calculateExamResults(examId, allStudents, marks, grades, classes, subjects);
  const studentResult = examResults.find((r) => r.student_id === student.id);
  const isAssessmentComplete = studentResult ? studentResult.is_complete !== false : false;

  const totalMarks = studentResult?.total_marks || 0;
  const averageScore = studentResult?.average || 0;
  const totalPoints = isAssessmentComplete ? (studentResult?.total_points || 0) : 0;
  const overallLevel = isAssessmentComplete ? (studentResult?.performance_level || 'ME') : 'Pending';
  const overallGradeCode = isAssessmentComplete ? (studentResult?.grade_code || studentResult?.grade || 'ME1') : 'Pending';
  const overallRank = isAssessmentComplete && studentResult?.position ? `#${studentResult.position}` : 'Not Ranked';
  const streamRank = isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `#${studentResult.class_position || studentResult.position}` : 'Not Ranked';
  const totalAssessedStudents = examResults.filter(r => r.is_complete !== false).length || 1;
  const streamStudentsCount = targetClassId ? (allStudents.filter((s) => s.class_id === targetClassId).length || 1) : 1;

  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 8;

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency-Based Education (CBE)', currentY);

  // Details Grid
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');

  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(student.full_name.toUpperCase(), marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8.5);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADE & STREAM:', marginX + 88, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(`${exam?.exam_name || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Summary Card
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'F');
  const colW = contentWidth / 6;

  const metrics = [
    { label: 'TOTAL SCORE', val: `${totalMarks} / ${maxPossibleMarks}` },
    { label: 'AVERAGE (%)', val: formatPercentage(averageScore, true) },
    { label: 'CBE LEVEL', val: isAssessmentComplete ? `${overallLevel} (${overallGradeCode})` : 'Pending' },
    { label: 'TOTAL POINTS', val: isAssessmentComplete ? `${totalPoints} / ${maxPossiblePoints}` : '-' },
    { label: 'STREAM RANK', val: isAssessmentComplete && streamRank !== 'Not Ranked' ? `${streamRank} of ${streamStudentsCount}` : streamRank },
    { label: 'OVERALL RANK', val: isAssessmentComplete && overallRank !== 'Not Ranked' ? `${overallRank} of ${totalAssessedStudents}` : overallRank },
  ];

  metrics.forEach((m, idx) => {
    const startX = marginX + idx * colW;
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(m.label, startX + colW / 2, currentY + 4.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    if (idx === 1) doc.setTextColor(251, 191, 36);
    if (idx === 2) doc.setTextColor(52, 211, 153);
    doc.text(m.val, startX + colW / 2, currentY + 11, { align: 'center' });
  });

  currentY += 21;

  // Performance Table
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark);

    let scoreDisplay = 'X';
    let pctDisplay = 'X';
    let levelDisplay = 'X';
    let codeDisplay = 'X';
    let pointsDisplay = 'X';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades);
      const roundedScore = Math.round(markInfo.percentage);
      scoreDisplay = `${roundedScore}/100`;
      pctDisplay = formatPercentage(roundedScore, true);
      levelDisplay = gr.performance_level;
      codeDisplay = gr.grade_code || gr.grade || '-';
      pointsDisplay = `${gr.points}`;
      defaultSubjComment = gr.remarks || 'Good Progress';
    } else if (markInfo.status === 'Y') {
      scoreDisplay = 'Y';
      pctDisplay = 'Y';
      levelDisplay = 'Y';
      codeDisplay = 'Y';
      pointsDisplay = 'Y';
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjectRankStr = markInfo.status === 'Normal' ? calculateSubjectRank(effectiveStudent, sb.id, examId, allStudents, classes, marks) : '-';
    const subjTeacher = targetClassId ? teachers.find((t) => (t.allocations || []).some(a => a.subject_id === sb.id && a.class_id === targetClassId)) : undefined;
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';

    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_code, sb.subject_name, scoreDisplay, pctDisplay, levelDisplay, codeDisplay, pointsDisplay, subjectRankStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Code', 'Learning Area / Subject', 'Score', '%', 'CBE Level', 'Code', 'Points', 'Rank', 'Subject Teacher Comment', 'Teacher']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.0, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 11, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      8: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      9: { halign: 'left', cellWidth: 24, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 4) {
        const val = cellData.cell.raw as string;
        if (val === 'EE') cellData.cell.styles.textColor = [5, 150, 105];
        else if (val === 'ME') cellData.cell.styles.textColor = [30, 64, 175];
        else if (val === 'AE') cellData.cell.styles.textColor = [217, 119, 6];
        else if (val === 'BE') cellData.cell.styles.textColor = [225, 29, 72];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const defaultCtComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'class_teacher',
    isProvisional: !isAssessmentComplete,
  });
  const defaultHoiComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'hoi',
    isProvisional: !isAssessmentComplete,
  });

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // CT Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`CLASS TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(ctComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 20;

  // HOI Box
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text(`HEAD OF INSTITUTION'S REMARKS (HOI: ${hoiName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(hoiComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 21;

  // Key
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 20, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CBE 8-POINT ACHIEVEMENT SCALE GRADING KEY', marginX + 3, currentY + 4.5);

  const gradeKeyItems = [
    { code: 'EE1', range: '90–100%', pts: '8 Pts', color: [5, 150, 105] },
    { code: 'EE2', range: '75–89%', pts: '7 Pts', color: [5, 150, 105] },
    { code: 'ME1', range: '58–74%', pts: '6 Pts', color: [30, 64, 175] },
    { code: 'ME2', range: '41–57%', pts: '5 Pts', color: [30, 64, 175] },
    { code: 'AE1', range: '31–40%', pts: '4 Pts', color: [217, 119, 6] },
    { code: 'AE2', range: '21–30%', pts: '3 Pts', color: [217, 119, 6] },
    { code: 'BE1', range: '11–20%', pts: '2 Pts', color: [225, 29, 72] },
    { code: 'BE2', range: '0–10%', pts: '1 Pt', color: [225, 29, 72] },
  ];

  const keyColW = contentWidth / 4;
  gradeKeyItems.forEach((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    const x = marginX + col * keyColW + 3;
    const y = currentY + 9.5 + row * 6;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.code}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${item.range} (${item.pts})`, x + 7, y);
  });

  currentY += 24;

  // Signatures
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Head of Institution & Stamp', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 18, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.5, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.label, x + sigColW / 2, currentY + 13.5, { align: 'center' });
  });

  currentY += 23;

  // Footer
  const footerY = Math.max(currentY + 5, 278);
  const nextTermDate = savedRemarks?.next_term_opening_date || '12th September 2026';
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, footerY - 2.5, contentWidth, 0.4, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${currentDateStr}`, pageWidth / 2, footerY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('CBE REPORTING SYSTEM', marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// 4. JUNIOR SCHOOL REPORT CARD PDF GENERATOR (Grades 7 - 9)
// -------------------------------------------------------------
async function generateJuniorSchoolReportPDF(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, school, exam, classes = [], subjects = [], marks = [], grades = [], teachers = [], allStudents = [], savedRemarks } = data;

  const doc = existingDoc || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = pageWidth - marginX * 2;

  const examId = exam?.id || '';
  const { targetClass, targetClassId, classNameStr, studentGrade, effectiveStudent } = resolvePDFLearnerContext(student, exam, classes);

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const examResults = calculateExamResults(examId, allStudents, marks, grades, classes, subjects);
  const studentResult = examResults.find((r) => r.student_id === student.id);
  const isAssessmentComplete = studentResult ? studentResult.is_complete !== false : false;

  const totalMarks = studentResult?.total_marks || 0;
  const averageScore = studentResult?.average || 0;
  const totalPoints = isAssessmentComplete ? (studentResult?.total_points || 0) : 0;
  const overallLevel = isAssessmentComplete ? (studentResult?.performance_level || 'ME') : 'Pending';
  const overallGradeCode = isAssessmentComplete ? (studentResult?.grade_code || studentResult?.grade || 'ME1') : 'Pending';
  const overallRank = isAssessmentComplete && studentResult?.position ? `#${studentResult.position}` : 'Not Ranked';
  const streamRank = isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `#${studentResult.class_position || studentResult.position}` : 'Not Ranked';
  const totalAssessedStudents = examResults.filter(r => r.is_complete !== false).length || 1;
  const streamStudentsCount = targetClassId ? (allStudents.filter((s) => s.class_id === targetClassId).length || 1) : 1;

  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 8;

  let currentY = 7;
  currentY = await drawReportHeader(doc, school, 'LEARNER ASSESSMENT REPORT', 'Competency-Based Education (CBE)', currentY);

  // Details Grid
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');

  doc.text('LEARNER NAME:', marginX + 3, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(student.full_name.toUpperCase(), marginX + 3, currentY + 10.5, { maxWidth: 54 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ADM NO:', marginX + 60, currentY + 4.5);
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8.5);
  doc.text(student.admission_number, marginX + 60, currentY + 10.5, { maxWidth: 25 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GRADE & STREAM:', marginX + 88, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(classNameStr, marginX + 88, currentY + 10.5, { maxWidth: 37 });

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSESSMENT TERM:', marginX + 128, currentY + 4.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(`${exam?.exam_name || 'End-Term'} (${exam?.term || 'Term 2'} ${exam?.year || 2026})`, marginX + 128, currentY + 10.5, { maxWidth: 62 });

  currentY += 21;

  // Summary Card
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'F');
  const colW = contentWidth / 6;

  const metrics = [
    { label: 'TOTAL SCORE', val: `${totalMarks} / ${maxPossibleMarks}` },
    { label: 'AVERAGE (%)', val: formatPercentage(averageScore, true) },
    { label: 'CBE LEVEL', val: isAssessmentComplete ? `${overallLevel} (${overallGradeCode})` : 'Pending' },
    { label: 'TOTAL POINTS', val: isAssessmentComplete ? `${totalPoints} / ${maxPossiblePoints}` : '-' },
    { label: 'STREAM RANK', val: isAssessmentComplete && streamRank !== 'Not Ranked' ? `${streamRank} of ${streamStudentsCount}` : streamRank },
    { label: 'OVERALL RANK', val: isAssessmentComplete && overallRank !== 'Not Ranked' ? `${overallRank} of ${totalAssessedStudents}` : overallRank },
  ];

  metrics.forEach((m, idx) => {
    const startX = marginX + idx * colW;
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(m.label, startX + colW / 2, currentY + 4.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    if (idx === 1) doc.setTextColor(251, 191, 36);
    if (idx === 2) doc.setTextColor(52, 211, 153);
    doc.text(m.val, startX + colW / 2, currentY + 11, { align: 'center' });
  });

  currentY += 21;

  // Performance Table
  const customSubjectComments = savedRemarks?.subject_comments || {};
  const tableRows = learnerSubjects.map((sb) => {
    const stdMark = marks.find((m) => m.student_id === student.id && m.subject_id === sb.id && m.exam_id === examId);
    const markInfo = evaluateMark(stdMark);

    let scoreDisplay = 'X';
    let pctDisplay = 'X';
    let levelDisplay = 'X';
    let codeDisplay = 'X';
    let pointsDisplay = 'X';
    let defaultSubjComment = 'Missing Assessment (X)';

    if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
      const gr = getGradeForMark(markInfo.percentage, grades);
      const roundedScore = Math.round(markInfo.percentage);
      scoreDisplay = `${roundedScore}/100`;
      pctDisplay = formatPercentage(roundedScore, true);
      levelDisplay = gr.performance_level;
      codeDisplay = gr.grade_code || gr.grade || '-';
      pointsDisplay = `${gr.points}`;
      defaultSubjComment = gr.remarks || 'Good Progress';
    } else if (markInfo.status === 'Y') {
      scoreDisplay = 'Y';
      pctDisplay = 'Y';
      levelDisplay = 'Y';
      codeDisplay = 'Y';
      pointsDisplay = 'Y';
      defaultSubjComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
    }

    const subjectRankStr = markInfo.status === 'Normal' ? calculateSubjectRank(effectiveStudent, sb.id, examId, allStudents, classes, marks) : '-';
    const subjTeacher = targetClassId ? teachers.find((t) => (t.allocations || []).some(a => a.subject_id === sb.id && a.class_id === targetClassId)) : undefined;
    const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';

    const commentStr = stripSurroundingQuotes(customSubjectComments[sb.id] || defaultSubjComment);

    return [sb.subject_code, sb.subject_name, scoreDisplay, pctDisplay, levelDisplay, codeDisplay, pointsDisplay, subjectRankStr, commentStr, teacherNameStr];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Code', 'Learning Area / Subject', 'Score', '%', 'CBE Level', 'Code', 'Points', 'Rank', 'Subject Teacher Comment', 'Teacher']],
    body: tableRows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.0, textColor: [15, 23, 42], lineColor: [203, 213, 225], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 42, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 11, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      8: { halign: 'left', fontStyle: 'italic', fontSize: 7 },
      9: { halign: 'left', cellWidth: 24, fontSize: 7 },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 4) {
        const val = cellData.cell.raw as string;
        if (val === 'EE') cellData.cell.styles.textColor = [5, 150, 105];
        else if (val === 'ME') cellData.cell.styles.textColor = [30, 64, 175];
        else if (val === 'AE') cellData.cell.styles.textColor = [217, 119, 6];
        else if (val === 'BE') cellData.cell.styles.textColor = [225, 29, 72];
      }
    },
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Remarks
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) || teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;
  const classTeacherName = savedRemarks?.class_teacher_name || classTeacher?.teacher_name || 'Class Teacher';
  const hoiName = savedRemarks?.hoi_name || school.principal_name || 'Head of Institution';

  const defaultCtComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'class_teacher',
    isProvisional: !isAssessmentComplete,
  });
  const defaultHoiComment = generatePersonalizedLearnerComment({
    student: effectiveStudent,
    examId,
    marks,
    subjects: learnerSubjects,
    grades,
    averageScore,
    commentType: 'hoi',
    isProvisional: !isAssessmentComplete,
  });

  const ctComment = stripSurroundingQuotes(savedRemarks?.class_teacher_comment || defaultCtComment);
  const hoiComment = stripSurroundingQuotes(savedRemarks?.hoi_comment || defaultHoiComment);
  const currentDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // CT Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`CLASS TEACHER'S REMARKS (Tr. ${classTeacherName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(ctComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 20;

  // HOI Box
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text(`HEAD OF INSTITUTION'S REMARKS (HOI: ${hoiName}):`, marginX + 3, currentY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(hoiComment, marginX + 3, currentY + 9.5, { maxWidth: contentWidth - 6 });

  currentY += 21;

  // Key
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 20, 1, 1, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CBE 8-POINT ACHIEVEMENT SCALE GRADING KEY', marginX + 3, currentY + 4.5);

  const gradeKeyItems = [
    { code: 'EE1', range: '90–100%', pts: '8 Pts', color: [5, 150, 105] },
    { code: 'EE2', range: '75–89%', pts: '7 Pts', color: [5, 150, 105] },
    { code: 'ME1', range: '58–74%', pts: '6 Pts', color: [30, 64, 175] },
    { code: 'ME2', range: '41–57%', pts: '5 Pts', color: [30, 64, 175] },
    { code: 'AE1', range: '31–40%', pts: '4 Pts', color: [217, 119, 6] },
    { code: 'AE2', range: '21–30%', pts: '3 Pts', color: [217, 119, 6] },
    { code: 'BE1', range: '11–20%', pts: '2 Pts', color: [225, 29, 72] },
    { code: 'BE2', range: '0–10%', pts: '1 Pt', color: [225, 29, 72] },
  ];

  const keyColW = contentWidth / 4;
  gradeKeyItems.forEach((item, idx) => {
    const row = Math.floor(idx / 4);
    const col = idx % 4;
    const x = marginX + col * keyColW + 3;
    const y = currentY + 9.5 + row * 6;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(`${item.code}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${item.range} (${item.pts})`, x + 7, y);
  });

  currentY += 24;

  // Signatures
  const sigColW = contentWidth / 3;
  const sigBoxes = [
    { title: 'Class Teacher Signature', label: 'Sign: _____________' },
    { title: 'Head of Institution & Stamp', label: 'Sign & Seal: __________' },
    { title: 'Parent / Guardian Signature', label: 'Sign: _____________' },
  ];

  sigBoxes.forEach((sig, idx) => {
    const x = marginX + idx * sigColW;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x + 1, currentY, sigColW - 2, 18, 1, 1, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(sig.title.toUpperCase(), x + sigColW / 2, currentY + 4.5, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.label, x + sigColW / 2, currentY + 13.5, { align: 'center' });
  });

  currentY += 23;

  // Footer
  const footerY = Math.max(currentY + 5, 278);
  const nextTermDate = savedRemarks?.next_term_opening_date || '12th September 2026';
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, footerY - 2.5, contentWidth, 0.4, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`NEXT TERM OPENING DATE: ${nextTermDate}`, marginX, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${currentDateStr}`, pageWidth / 2, footerY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('CBE REPORTING SYSTEM', marginX + contentWidth, footerY, { align: 'right' });

  return doc;
}

// -------------------------------------------------------------
// MAIN ENTRY POINT FOR PDF DOCUMENT GENERATION
// Automatically dispatches based on the learner's educational level
// -------------------------------------------------------------
export async function createReportCardPDFDoc(data: PDFReportData, existingDoc?: jsPDF): Promise<jsPDF> {
  const { student, exam, classes } = data;
  const { studentGrade } = resolvePDFLearnerContext(student, exam, classes);
  const eduLevel: EducationLevel = getEducationLevelForGrade(studentGrade);

  switch (eduLevel) {
    case 'Pre-Primary':
      return generatePrePrimaryReportPDF(data, existingDoc);
    case 'Lower Primary':
      return generateLowerPrimaryReportPDF(data, existingDoc);
    case 'Upper Primary':
      return generateUpperPrimaryReportPDF(data, existingDoc);
    case 'Junior School':
    default:
      return generateJuniorSchoolReportPDF(data, existingDoc);
  }
}

// Download single learner PDF
export async function downloadSingleReportCardPDF(data: PDFReportData): Promise<void> {
  const doc = await createReportCardPDFDoc(data);
  const fileName = `${data.student.admission_number}_${data.student.full_name.replace(/\s+/g, '_')}_ReportCard.pdf`;
  doc.save(fileName);
}

// Download batch combined PDF of report cards (One master PDF document, exactly 1 page per learner)
export async function downloadAllReportCardsCombinedPDF(
  dataList: PDFReportData[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!dataList || dataList.length === 0) return;

  const total = dataList.length;
  const masterDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < total; i++) {
    const item = dataList[i];
    if (onProgress) {
      onProgress(i + 1, total);
    }
    if (i > 0) {
      masterDoc.addPage('a4', 'portrait');
    }
    await createReportCardPDFDoc(item, masterDoc);
  }

  const firstItem = dataList[0];
  const examName = firstItem?.exam?.exam_name || 'Report';
  const year = firstItem?.exam?.year || new Date().getFullYear();
  const { classNameStr } = resolvePDFLearnerContext(firstItem.student, firstItem.exam, firstItem.classes);

  const cleanClass = classNameStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExam = examName.replace(/[^a-zA-Z0-9_-]/g, '_');

  const fileName = `Report_Forms_${cleanExam}_${year}_${cleanClass}.pdf`;
  masterDoc.save(fileName);
}

// Download batch ZIP of report cards (Kept for compatibility)
export async function downloadAllReportCardsZIP(
  dataList: PDFReportData[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const total = dataList.length;

  for (let i = 0; i < total; i++) {
    const item = dataList[i];
    if (onProgress) {
      onProgress(i + 1, total);
    }
    const doc = await createReportCardPDFDoc(item);
    const pdfBlob = doc.output('blob');
    const fileName = `${item.student.admission_number}_${item.student.full_name.replace(/\s+/g, '_')}_ReportCard.pdf`;
    zip.file(fileName, pdfBlob);
  }

  const firstExam = dataList[0]?.exam?.exam_name || 'Class_Report_Cards';
  const zipName = `Learner_Report_Cards_${firstExam.replace(/\s+/g, '_')}.zip`;

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipName);
}
