const fs = require('fs');
let file = 'src/components/TeacherDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// I need to find where activeExam was, or just insert it right after the component declaration
const declRegex = /export const TeacherDashboard: React\.FC<TeacherDashboardProps> = \(\{\s*teacher,\s*classes,\s*subjects,\s*exams,\s*marks,\s*students,\s*onNavigate,\s*\}\) => \{/;

const insertion = `\n  const isClassTeacher = teacher.is_class_teacher;\n  const classTeacherOf = classes.find(c => c.id === teacher.class_teacher_of_id) || classes.find(c => c.class_teacher_id === teacher.id);\n  const classTeacherStudents = classTeacherOf ? students.filter(s => s.class_id === classTeacherOf.id) : [];\n`;

content = content.replace(declRegex, match => match + insertion);
fs.writeFileSync(file, content);

file = 'src/components/ReportsView.tsx';
content = fs.readFileSync(file, 'utf8');
const reportsInsertion = `\n  const isSubjectTeacherOnly = currentUser?.role === 'teacher' && !activeTeacher?.is_class_teacher;\n`;

// Insert it right after const activeTeacher = ... inside ReportsView component
const reportsDeclRegex = /const activeTeacher = [^;]+;/;
content = content.replace(reportsDeclRegex, match => match + reportsInsertion);

fs.writeFileSync(file, content);
