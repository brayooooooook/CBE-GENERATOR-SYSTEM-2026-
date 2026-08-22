const fs = require('fs');
const file = 'src/components/AttendanceManagement.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "  const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes).filter(c => {\n    if (isAdmin) return true;\n    return activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === c.id || c.class_teacher_id === activeTeacher.id);\n  });\n  const accessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);",
  `  const accessibleClasses = React.useMemo(() => getAccessibleClasses(currentUser || null, activeTeacher, classes).filter(c => {
    if (isAdmin) return true;
    return activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === c.id || c.class_teacher_id === activeTeacher.id);
  }), [currentUser, activeTeacher, classes, isAdmin]);
  const accessibleStudents = React.useMemo(() => getAccessibleStudents(currentUser || null, activeTeacher, students, classes), [currentUser, activeTeacher, students, classes]);`
);

fs.writeFileSync(file, code);
