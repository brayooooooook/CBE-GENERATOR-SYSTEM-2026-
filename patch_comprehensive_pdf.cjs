const fs = require('fs');
const file = 'src/services/schoolAnalyticsPdfExporter.ts';
let code = fs.readFileSync(file, 'utf8');

const newFunction = `
export async function exportComprehensiveAnalyticsPDF(data: SchoolAnalyticsData, comp: ExaminationComparisonData | null, school: School) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logo = await getBase64ImageFromUrl(school.logo_url);

  renderHeader(
    doc,
    school,
    'Comprehensive School Performance Report',
    \`Exam: \${data.exam.exam_name} (\${data.exam.term} \${data.exam.year}) • Official Analytics\`,
    logo
  );

  let currentY = 38;

  // --- Executive Dashboard ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(8, currentY, doc.internal.pageSize.getWidth() - 16, 28, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE PERFORMANCE HIGHLIGHTS', 12, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(\`Overall School Mean Score: \${data.overall_school_mean.toFixed(2)}\`, 12, currentY + 12);
  doc.text(\`Overall School Mean Points: \${data.overall_school_mean_points.toFixed(2)}\`, 12, currentY + 17);
  doc.text(\`Overall CBE Performance Level: \${data.overall_school_level} (\${data.overall_school_grade_code})\`, 12, currentY + 22);

  doc.text(\`Total Learners Assessed: \${data.total_students_assessed}\`, 110, currentY + 12);
  doc.text(\`Highest Performing Class: \${data.highest_performing_class}\`, 110, currentY + 17);
  doc.text(\`Highest Performing Stream: \${data.highest_performing_stream}\`, 110, currentY + 22);

  currentY += 34;

  // --- Class & Stream Rankings ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('1. Class Performance Overview', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Class', 'Learners', 'Mean Marks', 'Mean %', 'Mean Points', 'Overall Level']],
    body: data.class_rankings.map((c) => [
      c.rank,
      c.class_name,
      c.learners_count,
      c.mean_marks.toFixed(2),
      formatPercentage(c.mean_percentage, true),
      c.mean_points.toFixed(2),
      \`\${c.overall_level} (\${c.grade_code})\`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  if (data.stream_rankings.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 51, 102);
    doc.text('2. Stream Performance Standings', 8, currentY);

    autoTable(doc, {
      startY: currentY + 2,
      margin: { left: 8, right: 8 },
      head: [['Rank', 'Class', 'Stream', 'Candidates', 'Mean Marks', 'Mean %', 'Mean Points', 'Level']],
      body: data.stream_rankings.map((st) => [
        st.rank,
        st.class_name,
        st.stream || 'Main',
        st.learners_count,
        st.mean_marks.toFixed(2),
        formatPercentage(st.mean_percentage, true),
        st.mean_points.toFixed(2),
        \`\${st.overall_level} (\${st.grade_code})\`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- Subject Analysis ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('3. Subject Performance Standings', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Subject', 'Code', 'Candidates', 'Mean Marks', 'Mean %', 'Mean Points', 'Level']],
    body: data.subject_rankings.map((s) => [
      s.rank,
      s.subject_name,
      s.subject_code,
      s.total_candidates,
      s.mean_marks.toFixed(2),
      formatPercentage(s.mean_percentage, true),
      s.mean_points.toFixed(2),
      \`\${s.overall_level} (\${s.grade_code})\`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;
  
  if (currentY > doc.internal.pageSize.getHeight() - 30) {
     doc.addPage();
     currentY = 15;
  }

  // --- Top Performers & Best Learners ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 51, 102);
  doc.text('4. Best Learners & Top Performers', 8, currentY);

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 8, right: 8 },
    head: [['Rank', 'Name', 'Adm No', 'Class', 'Stream', 'Total', 'Mean %', 'Points', 'Level']],
    body: data.best_learners_school.map((l) => [
      l.rank,
      l.name,
      l.admission_number || '-',
      l.class_name,
      l.stream || '-',
      l.total_marks.toLocaleString(),
      formatPercentage(l.average_marks, true),
      l.average_points.toFixed(2),
      \`\${getAbbreviatedLevel(l.overall_level, l.grade_code)} (\${l.grade_code})\`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;
  
  if (currentY > doc.internal.pageSize.getHeight() - 40) {
     doc.addPage();
     currentY = 15;
  }

  // --- Examination Comparison & Trends ---
  if (comp) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 51, 102);
    doc.text(\`5. Comparison: \${comp.examA.exam_name} vs \${comp.examB.exam_name}\`, 8, currentY);
    
    // Summary
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(8, currentY + 3, doc.internal.pageSize.getWidth() - 16, 18, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(\`School Mean Diff: \${comp.school_deviation.diff_mean > 0 ? '+' : ''}\${comp.school_deviation.diff_mean.toFixed(2)} marks (\${formatPercentage(comp.school_deviation.percentage_change, true)})\`, 12, currentY + 9);
    doc.text(\`School Mean Points Diff: \${comp.school_deviation.diff_points > 0 ? '+' : ''}\${comp.school_deviation.diff_points.toFixed(2)} pts\`, 12, currentY + 14);
    doc.text(\`School Competency Trend: \${comp.school_deviation.trend}\`, 12, currentY + 19);

    currentY += 26;

    // Class Comparative Table
    autoTable(doc, {
      startY: currentY,
      margin: { left: 8, right: 8 },
      head: [['Class', 'Current Mean', 'Prev Mean', 'Diff', '% Change', 'Points Diff', 'Trend']],
      body: comp.class_deviations.map((c) => [
        c.class_name,
        c.current_mean.toFixed(2),
        c.previous_mean.toFixed(2),
        \`\${c.diff_mean > 0 ? '+' : ''}\${c.diff_mean.toFixed(2)}\`,
        formatPercentage(c.percentage_change, true),
        \`\${c.diff_points > 0 ? '+' : ''}\${c.diff_points.toFixed(2)}\`,
        c.trend,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    });
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderFooter(doc, i, totalPages);
  }

  doc.save(\`Comprehensive_Analytics_\${data.exam.exam_name.replace(/\\s+/g, '_')}.pdf\`);
}
`;

fs.writeFileSync(file, code + '\n' + newFunction);
