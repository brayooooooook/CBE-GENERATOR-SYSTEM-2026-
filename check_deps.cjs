const fs = require('fs');

const files = [
  'src/components/AttendanceManagement.tsx',
  'src/components/ChartWrapper.tsx',
  'src/components/DeveloperSettingsPage.tsx',
  'src/components/LearnerReportCard.tsx',
  'src/components/LoginPage.tsx',
  'src/components/MarksEntryTable.tsx',
  'src/components/ReportsView.tsx',
  'src/components/SchoolProfileModal.tsx',
  'src/components/Sidebar.tsx',
  'src/components/SubjectGroupManagement.tsx',
  'src/components/SupabaseModal.tsx',
  'src/App.tsx',
  'src/contexts/AcademicSessionContext.tsx'
];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  const regex = /useEffect\(\(\) => \{[\s\S]*?\}, \[([\s\S]*?)\]\);/g;
  const count1 = (content.match(/useEffect\(\(\) => \{/g) || []).length;
  let count2 = 0;
  while ((match = regex.exec(content)) !== null) {
    count2++;
  }
  if (count1 !== count2) {
    console.log(`Mismatch in ${f}: ${count1} useEffects, ${count2} with deps`);
  }
});
