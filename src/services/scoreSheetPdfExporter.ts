import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdf } from '../utils/fileDownloader';
import {
  Student,
  School,
  Examination,
  Subject,
  ClassStream,
  Teacher,
  getStudentFullName,
} from '../types';
import { getFilteredStudents } from '../utils/filterUtils';
import { formatKenyaPdfTimestamp } from '../utils/kenyaDateUtils';

export interface ScoreSheetPDFOptions {
  school: School;
  exam?: Examination | null;
  subject?: Subject | null;
  outOfMaxScore?: string | number;
  selectedClassId: string;
  selectedStreamId?: string;
  students: Student[];
  classes: ClassStream[];
  teachers?: Teacher[];
  generatedBy?: string;
}

export async function exportScoreSheetPDF(options: ScoreSheetPDFOptions): Promise<void> {
  const {
    school,
    exam,
    subject,
    outOfMaxScore,
    selectedClassId,
    selectedStreamId = 'all',
    students = [],
    classes = [],
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 190mm

  // 1. Filter target students matching selected class & stream context
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);

  if (!targetStudents || targetStudents.length === 0) {
    throw new Error('No learner records found for the selected class scope.');
  }

  // Sort students alphabetically by full name
  const sortedStudents = [...targetStudents].sort((a, b) => {
    const nameA = getStudentFullName(a) || a.full_name || '';
    const nameB = getStudentFullName(b) || b.full_name || '';
    return nameA.localeCompare(nameB);
  });

  // 2. Resolve Class and Stream Display Names
  const targetClassObj = classes.find(
    (c) => c.id === selectedClassId || c.class_name.toLowerCase() === selectedClassId.toLowerCase()
  );

  const classNameStr = targetClassObj ? targetClassObj.class_name : (selectedClassId !== 'all' ? selectedClassId : 'All Classes');

  let streamNameStr = '';
  if (selectedStreamId && selectedStreamId !== 'all' && selectedStreamId !== 'All Streams') {
    const targetStreamObj = classes.find((c) => c.id === selectedStreamId);
    streamNameStr = targetStreamObj ? (targetStreamObj.stream || '') : selectedStreamId;
  } else if (targetClassObj && targetClassObj.stream) {
    streamNameStr = targetClassObj.stream;
  }

  const fullClassDisplay = streamNameStr && streamNameStr !== 'All Streams' && !classNameStr.toLowerCase().includes(streamNameStr.toLowerCase())
    ? `${classNameStr} ${streamNameStr}`
    : classNameStr;

  const schoolNameStr = (school?.school_name || 'MUCHORWE JUNIOR SCHOOL').toUpperCase();
  const subTitleStr = `${fullClassDisplay.toUpperCase()} SCORE SHEET`;

  const examOutStr = outOfMaxScore ? String(outOfMaxScore) : '______________';
  const learningAreaStr = subject ? subject.subject_name.toUpperCase() : '______________';

  // 3. Render Header (NO LOGO as explicitly instructed)
  const renderPDFHeader = () => {
    let currentY = 10;

    // School Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110); // Teal / Dark Green (#0F766E)
    doc.text(schoolNameStr, marginX, currentY);

    currentY += 6;

    // Subtitle (e.g. GRADE 8-BLUE SCORE SHEET)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(subTitleStr, marginX, currentY);

    currentY += 6;

    // Info line: CLASS:   GRADE 8 BLUE     EXAM OUT OF ______________     LEARNING AREA ______________
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);

    const lineText = `CLASS:   ${fullClassDisplay.toUpperCase()}     EXAM OUT OF  ${examOutStr}     LEARNING AREA  ${learningAreaStr}`;
    doc.text(lineText, marginX, currentY);

    currentY += 3;

    // Horizontal line below header
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY, marginX + contentWidth, currentY);
  };

  renderPDFHeader();

  const startY = 28;

  // 4. Construct Table Headers & Data
  // Headings: No | ADM | STUDENT NAME | 7 empty grid columns
  const tableHead = [['No', 'ADM', 'STUDENT NAME', '', '', '', '', '', '', '']];

  const tableBody = sortedStudents.map((st, idx) => {
    const admNo = st.admission_number || (st as any).adm_no || '-';
    const name = getStudentFullName(st) || st.full_name || '';

    return [
      idx + 1,
      admNo,
      name,
      '', '', '', '', '', '', ''
    ];
  });

  // 5. Render Table using autoTable
  autoTable(doc, {
    startY,
    margin: { left: marginX, right: marginX, top: 28, bottom: 12 },
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    showHead: 'everyPage',
    styles: {
      fontSize: 8,
      cellPadding: 2.5, // Generous padding for manual score entries
      textColor: [15, 23, 42], // Slate-900
      valign: 'middle',
      lineColor: [51, 65, 85], // Slate-700 border lines
      lineWidth: 0.35,
      fontStyle: 'bold', // Bold text for table cells
    },
    headStyles: {
      fillColor: false, // Clean white / no dark fill
      textColor: [15, 23, 42], // Slate-900 text
      fontStyle: 'bold', // Headings in bold
      halign: 'center',
      fontSize: 8,
      lineColor: [30, 41, 59], // Darker border lines
      lineWidth: 0.4,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255], // Clean white rows
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },  // No
      1: { halign: 'center', cellWidth: 18 },  // ADM
      2: { halign: 'left', cellWidth: 64 },    // STUDENT NAME
      3: { halign: 'center', cellWidth: 14 },  // Grid Col 1
      4: { halign: 'center', cellWidth: 14 },  // Grid Col 2
      5: { halign: 'center', cellWidth: 14 },  // Grid Col 3
      6: { halign: 'center', cellWidth: 14 },  // Grid Col 4
      7: { halign: 'center', cellWidth: 14 },  // Grid Col 5
      8: { halign: 'center', cellWidth: 14 },  // Grid Col 6
      9: { halign: 'center', cellWidth: 14 },  // Grid Col 7
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        renderPDFHeader();
      }
    },
  });

  // 6. Dynamic Footers & Page Numbers
  const totalPages = (doc.internal as any).getNumberOfPages();
  const timestampStr = formatKenyaPdfTimestamp(new Date());

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Report generated on: ${timestampStr} Page ${i}/${totalPages}`, pageWidth - marginX, footerY, { align: 'right' });
  }

  // 7. Save File
  const cleanClassName = fullClassDisplay.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanClassName}_Score_Sheet.pdf`;
  await savePdf(doc, fileName);
}
