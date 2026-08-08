const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `  const accessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);`;
const replace1 = `  const baseAccessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);
  const accessibleStudents = baseAccessibleStudents.filter(s => {
    if (currentUser?.role === 'admin') return true;
    if (reportTab === 'subject') return true;
    const cls = classes.find(c => c.id === s.class_id);
    if (!cls) return false;
    return activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === cls.id || cls.class_teacher_id === activeTeacher.id);
  });`;

content = content.replace(target1, replace1);

fs.writeFileSync(file, content);
