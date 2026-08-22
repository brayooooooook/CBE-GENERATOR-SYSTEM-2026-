const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<LearnerReportCard\s+student=\{selectedStudent\}/,
  "<LearnerReportCard\n          canModify={canModify}\n          student={selectedStudent}"
);

content = content.replace(
  /<LearnerReportCard\s+key=\{std\.id\}\s+student=\{std\}/,
  "<LearnerReportCard\n                canModify={canModify}\n                key={std.id}\n                student={std}"
);

fs.writeFileSync(file, content);
