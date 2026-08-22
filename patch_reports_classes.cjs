const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `  const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);`;
const replace1 = `  const baseAccessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);
  const accessibleClasses = baseAccessibleClasses.filter(c => {
    if (currentUser?.role === 'admin') return true;
    if (reportTab === 'subject') return true;
    return activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === c.id || c.class_teacher_id === activeTeacher.id);
  });`;

content = content.replace(target1, replace1);

fs.writeFileSync(file, content);
