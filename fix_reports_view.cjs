const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "  const baseAccessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);",
  "  const baseAccessibleStudents = React.useMemo(() => getAccessibleStudents(currentUser || null, activeTeacher, students, classes), [currentUser, activeTeacher, students, classes]);"
);

fs.writeFileSync(file, code);
