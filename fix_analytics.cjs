const fs = require('fs');
const file = 'src/components/SchoolPerformanceAnalytics.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "  const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);",
  "  const accessibleClasses = React.useMemo(() => getAccessibleClasses(currentUser || null, activeTeacher, classes), [currentUser, activeTeacher, classes]);"
);

code = code.replace(
  "  const accessibleSubjects = getAccessibleSubjects(currentUser || null, activeTeacher, subjects);",
  "  const accessibleSubjects = React.useMemo(() => getAccessibleSubjects(currentUser || null, activeTeacher, subjects), [currentUser, activeTeacher, subjects]);"
);

code = code.replace(
  "  const accessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);",
  "  const accessibleStudents = React.useMemo(() => getAccessibleStudents(currentUser || null, activeTeacher, students, classes), [currentUser, activeTeacher, students, classes]);"
);

fs.writeFileSync(file, code);
