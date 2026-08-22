import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdf } from '../utils/fileDownloader';
import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Grade,
  Teacher,
  getApplicableSubjectsForGrade,
} from '../types';
import { getGradeForMark, getLearnerReportSubjects } from './analysisEngine';
import { getFilteredStudents, getClassStreamLabel } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from './historicalContextResolver';
import { evaluateMark, roundMark, formatPercentage } from '../utils/markUtils';
import { getShortCbeCode, sortSubjectsByStandardOrder } from './meritListExporter';

export interface ExportProvisionalStudentResultsPDFOptions {
  school: School;
  exam: Examination;
  selectedClassId: string;
  selectedStreamId?: string;
  classes: ClassStream[];
  students: Student[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  generatedBy?: string;
}

// Convert image URL to Base64
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
      resolve(null);
    }
  });
}

export async function exportProvisionalStudentResultsPDF(
  options: ExportProvisionalStudentResultsPDFOptions
): Promise<void> {
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
    generatedBy = 'CBE Generator System',
  } = options;

  // 1. Filter target students by class and stream (historical exam context aware)
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

  // Sort students by admission number / name for easy verification (NO RANKING)
  targetStudents.sort((a, b) => {
    const admA = (a.admission_number || '').toString().toLowerCase();
    const admB = (b.admission_number || '').toString().toLowerCase();
    if (admA && admB) {
      return admA.localeCompare(admB, undefined, { numeric: true });
    }
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  // 2. Identify target class & applicable subjects specifically by education level
  const firstStudent = targetStudents[0];
  const firstHistCtx = firstStudent && exam ? getLearnerClassAtExamTime(firstStudent, exam, classes) : null;

  const targetClass = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstStudent?.class_id))
  ) || classes.find(
    (c) => (c.class_name || '').toLowerCase() === (selectedClassId || '').toLowerCase()
  ) || (firstStudent ? classes.find((c) => c.id === firstStudent.class_id) : undefined);

  const targetGradeName = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstStudent?.grade || (selectedClassId !== 'all' ? selectedClassId : 'Grade 7');

  const rawApplicableSubjects = targetClass
    ? getLearnerReportSubjects(firstStudent || ({} as any), targetClass, subjects, teachers || [])
    : getApplicableSubjectsForGrade(targetGradeName, subjects);

  const applicableSubjects = sortSubjectsByStandardOrder(
    (rawApplicableSubjects && rawApplicableSubjects.length > 0)
      ? rawApplicableSubjects
      : getApplicableSubjectsForGrade(targetGradeName, subjects)
  );

  const streamLabel = getClassStreamLabel(classes, selectedClassId, selectedStreamId);

  // Initialize jsPDF A4 Landscape (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  const marginTop = 10;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2; // 277mm

  const dateNowStr = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Load logo
  let logoBase64: string | null = null;
  if (school.logo_url) {
    try {
      logoBase64 = await getBase64ImageFromUrl(school.logo_url);
    } catch {
      logoBase64 = null;
    }
  }

  // --- BUILD TABLE HEADERS ---
  const tableHeadTitles: string[] = [
    'No.',
    'Adm No.',
    'Student Name',
    ...applicableSubjects.map((sb) => getShortCbeCode(sb.subject_code, sb.subject_name)),
    'Total Marks',
    'Avg Marks',
    'Total Pts',
    'Avg Pts',
    'Grade',
    'Perf. Level',
    'Remarks',
  ];

  // --- BUILD TABLE ROWS ---
  const examMarks = marks.filter((m) => m.exam_id === exam.id);

  const tableRows: (string | number)[][] = targetStudents.map((std, idx) => {
    const stdMarks = examMarks.filter((m) => m.student_id === std.id);

    let assessedCount = 0;
    let sumScore = 0;
    let sumPoints = 0;
    let missingCount = 0;

    const subjectCellValues: string[] = applicableSubjects.map((sb) => {
      const markObj = stdMarks.find((m) => m.subject_id === sb.id);
      const markInfo = evaluateMark(markObj);

      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
        assessedCount++;
        sumScore += markInfo.percentage;
        const gr = getGradeForMark(markInfo.percentage, grades);
        sumPoints += gr.points;
        const scoreVal = roundMark(markInfo.percentage);
        return `${scoreVal} ${gr.grade_code || gr.grade}`;
      } else if (markInfo.status === 'X') {
        missingCount++;
        return 'X';
      } else if (markInfo.status === 'Y') {
        return 'Y';
      } else {
        missingCount++;
        return 'X';
      }
    });

    const totalMarks = Math.round(sumScore);
    const avgMarks = assessedCount > 0 ? (sumScore / assessedCount).toFixed(1) : '-';
    const totalPoints = sumPoints;
    const avgPoints = assessedCount > 0 ? (sumPoints / assessedCount).toFixed(2) : '-';

    const numericAvg = assessedCount > 0 ? sumScore / assessedCount : 0;
    const overallGrade = assessedCount > 0 ? getGradeForMark(numericAvg, grades) : null;

    const gradeCode = overallGrade ? overallGrade.grade_code || overallGrade.grade : '-';
    const perfLevel = overallGrade ? overallGrade.performance_level || overallGrade.descriptor || '-' : '-';

    let remarks = overallGrade ? overallGrade.remarks || 'Satisfactory' : 'No Marks';
    if (missingCount > 0) {
      remarks = `${missingCount} Missing`;
    }

    return [
      idx + 1,
      std.admission_number || 'N/A',
      std.full_name || 'Unnamed Student',
      ...subjectCellValues,
      assessedCount > 0 ? totalMarks : '-',
      avgMarks,
      assessedCount > 0 ? totalPoints : '-',
      avgPoints,
      gradeCode,
      perfLevel,
      remarks,
    ];
  });

  // --- FUNCTION TO RENDER TOP PAGE HEADER (BLACK & WHITE + ALL BOLD) ---
  const renderDocumentHeader = (docInstance: jsPDF) => {
    let curY = marginTop;

    // Outer Header Box (BLACK & WHITE)
    const headerHeight = 24;
    docInstance.setDrawColor(0, 0, 0); // Black border
    docInstance.setFillColor(255, 255, 255); // White fill
    docInstance.setLineWidth(0.4);
    docInstance.rect(marginX, curY, contentWidth, headerHeight, 'FD');

    // Render Logo
    const logoX = marginX + 3;
    const logoY = curY + 2.5;
    const logoSize = 19;

    if (logoBase64) {
      try {
        docInstance.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch {
        docInstance.setFillColor(255, 255, 255);
        docInstance.setDrawColor(0, 0, 0);
        docInstance.rect(logoX, logoY, logoSize, logoSize, 'FD');
        docInstance.setFont('helvetica', 'bold');
        docInstance.setFontSize(7);
        docInstance.setTextColor(0, 0, 0);
        docInstance.text('CBE', logoX + 6, logoY + 11, { align: 'center' });
      }
    } else {
      docInstance.setFillColor(255, 255, 255);
      docInstance.setDrawColor(0, 0, 0);
      docInstance.rect(logoX, logoY, logoSize, logoSize, 'FD');
      docInstance.setFont('helvetica', 'bold');
      docInstance.setFontSize(7);
      docInstance.setTextColor(0, 0, 0);
      docInstance.text('SCHOOL LOGO', logoX + 9.5, logoY + 11, { align: 'center' });
    }

    // Title & School Name Area
    const textCenterX = marginX + contentWidth / 2;

    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(13);
    docInstance.setTextColor(0, 0, 0); // Solid Black
    docInstance.text((school.school_name || 'SCHOOL NAME').toUpperCase(), textCenterX, curY + 6, {
      align: 'center',
    });

    // Report Title
    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(11);
    docInstance.setTextColor(0, 0, 0); // Solid Black
    docInstance.text('PROVISIONAL STUDENT RESULTS', textCenterX, curY + 12, {
      align: 'center',
    });

    // Sub metadata line
    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(8.5);
    docInstance.setTextColor(0, 0, 0); // Solid Black

    const metaLine = `Exam: ${exam.exam_name || 'Examination'}  |  Term: ${exam.term || 'Term 2'}  |  Year: ${
      exam.year || 2026
    }  |  Class: ${streamLabel}  |  Date: ${dateNowStr}`;

    docInstance.text(metaLine, textCenterX, curY + 18, { align: 'center' });

    curY += headerHeight + 3;

    // --- PROVISIONAL NOTICE BANNER (BLACK & WHITE + ALL BOLD) ---
    const noticeHeight = 7.5;
    docInstance.setFillColor(255, 255, 255); // White fill
    docInstance.setDrawColor(0, 0, 0); // Black border
    docInstance.setLineWidth(0.4);
    docInstance.rect(marginX, curY, contentWidth, noticeHeight, 'FD');

    docInstance.setFont('helvetica', 'bold');
    docInstance.setFontSize(8.5);
    docInstance.setTextColor(0, 0, 0); // Solid Black
    docInstance.text(
      'This is a provisional report for verification purposes only. Results are not final until officially approved.',
      textCenterX,
      curY + 5,
      { align: 'center' }
    );
  };

  // Render Header on Page 1 before table
  renderDocumentHeader(doc);

  const startTableY = marginTop + 24 + 3 + 7.5 + 4; // ~48.5mm

  // Configure autotable column styles
  const numSubjectCols = applicableSubjects.length;
  
  // Custom column widths configuration
  const columnStyles: Record<number, any> = {
    0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' }, // No.
    1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // Adm No.
    2: { cellWidth: 38, halign: 'left', fontStyle: 'bold' }, // Student Name
  };

  // Dynamic width for subject columns
  const remainingForSubjects = 125; // mm available for subjects
  const subjColWidth = Math.max(9, Math.min(16, remainingForSubjects / (numSubjectCols || 1)));

  let colIdx = 3;
  for (let i = 0; i < numSubjectCols; i++) {
    columnStyles[colIdx] = { cellWidth: subjColWidth, halign: 'center', fontStyle: 'bold' };
    colIdx++;
  }

  // Summary columns after subjects
  columnStyles[colIdx++] = { cellWidth: 13, halign: 'center', fontStyle: 'bold' }; // Total Marks
  columnStyles[colIdx++] = { cellWidth: 13, halign: 'center', fontStyle: 'bold' }; // Avg Marks
  columnStyles[colIdx++] = { cellWidth: 12, halign: 'center', fontStyle: 'bold' }; // Total Pts
  columnStyles[colIdx++] = { cellWidth: 12, halign: 'center', fontStyle: 'bold' }; // Avg Pts
  columnStyles[colIdx++] = { cellWidth: 11, halign: 'center', fontStyle: 'bold' }; // Grade
  columnStyles[colIdx++] = { cellWidth: 20, halign: 'center', fontStyle: 'bold' }; // Perf. Level
  columnStyles[colIdx++] = { cellWidth: 20, halign: 'left', fontStyle: 'bold' }; // Remarks

  autoTable(doc, {
    startY: startTableY,
    margin: { left: marginX, right: marginX, top: 48, bottom: marginBottom },
    head: [tableHeadTitles],
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [0, 0, 0], // Solid Black header
      textColor: [255, 255, 255], // White bold text
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    styles: {
      fontStyle: 'bold',
      fontSize: 6.8,
      cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 1 },
      textColor: [0, 0, 0], // Solid Black text everywhere
      lineColor: [0, 0, 0], // Solid Black grid lines
      lineWidth: 0.2,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255], // White fill (black and white)
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        renderDocumentHeader(doc);
      }
    },
  });

  // --- FOOTER FOR ALL PAGES (BLACK & WHITE + ALL BOLD) ---
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 12;

    // Divider Line
    doc.setDrawColor(0, 0, 0); // Black line
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 2, marginX + contentWidth, footerY - 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0); // Solid Black

    // Left: Generated by
    doc.text(`Generated by: ${generatedBy || 'CBE Generator System'}`, marginX, footerY.valueOf());

    // Center: Date & Time Generated
    doc.text(`Date and Time Generated: ${dateNowStr}`, marginX + contentWidth / 2, footerY.valueOf(), {
      align: 'center',
    });

    // Right: Page number
    doc.text(`Page ${i} of ${totalPages}`, marginX + contentWidth, footerY.valueOf(), {
      align: 'right',
    });

    // Bottom Notice
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0); // Solid Black
    doc.text(
      'Students and teachers should report any missing or incorrect marks before the examination is approved.',
      marginX + contentWidth / 2,
      footerY + 4.5,
      { align: 'center' }
    );
  }

  // Save PDF
  const cleanExamName = (exam.exam_name || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClassName = streamLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Provisional_Student_Results_${cleanClassName}_${cleanExamName}.pdf`;

  await savePdf(doc, fileName);
}
