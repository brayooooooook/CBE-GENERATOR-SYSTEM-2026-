const fs = require('fs');
let file = 'src/components/TeacherDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const declRegex = /export const TeacherDashboard: React\.FC<TeacherDashboardProps> = \([\s\S]*?\) => \{/;
const insertion = `\n  const isClassTeacher = teacher.is_class_teacher;\n  const classTeacherOf = (classes||[]).find(c => c.id === teacher.class_teacher_of_id) || (classes||[]).find(c => c.class_teacher_id === teacher.id);\n  const classTeacherStudents = classTeacherOf ? (students||[]).filter(s => s.class_id === classTeacherOf.id) : [];\n`;

content = content.replace(declRegex, match => match + insertion);
fs.writeFileSync(file, content);
