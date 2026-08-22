const fs = require('fs');
const file = 'src/components/AttendanceManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldAccessible = "const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);";
const newAccessible = `const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes).filter(c => {
    if (isAdmin) return true;
    return activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === c.id || c.class_teacher_id === activeTeacher.id);
  });`;

content = content.replace(oldAccessible, newAccessible);

fs.writeFileSync(file, content);
