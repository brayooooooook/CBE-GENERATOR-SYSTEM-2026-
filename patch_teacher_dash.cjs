const fs = require('fs');
const file = 'src/components/TeacherDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add imports
content = content.replace(
  "import {\n  Teacher,",
  "import { Users, FileBarChart, Calendar as CalendarIcon } from 'lucide-react';\nimport {\n  Teacher,"
);

const isClassTeacherDef = `  const activeExam = exams.find((e) => e.is_active);`;
const isClassTeacherNew = `  const activeExam = exams.find((e) => e.is_active);\n  const isClassTeacher = teacher.is_class_teacher;\n  const classTeacherOf = classes.find(c => c.id === teacher.class_teacher_of_id) || classes.find(c => c.class_teacher_id === teacher.id);\n  const classTeacherStudents = classTeacherOf ? students.filter(s => s.class_id === classTeacherOf.id) : [];`;
content = content.replace(isClassTeacherDef, isClassTeacherNew);

const gridDef = `<div className="grid grid-cols-1 md:grid-cols-2 gap-6">`;
const gridNew = `      {isClassTeacher && classTeacherOf && (
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-emerald-900 flex items-center space-x-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span>My Class Summary &bull; {classTeacherOf.class_name} {classTeacherOf.stream}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Learners</span>
                <div className="text-2xl font-black text-emerald-700 mt-1">{classTeacherStudents.length}</div>
              </div>
              <button onClick={() => onNavigate('students')} className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center space-x-1">
                <Users className="w-4 h-4" /> <span>Manage Roster</span>
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Attendance</span>
                <div className="text-sm font-semibold text-slate-700 mt-1">Mark daily roll</div>
              </div>
              <button onClick={() => onNavigate('attendance')} className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center space-x-1">
                <CalendarIcon className="w-4 h-4" /> <span>Take Register</span>
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Report Forms</span>
                <div className="text-sm font-semibold text-slate-700 mt-1">Generate official reports</div>
              </div>
              <button onClick={() => onNavigate('reports')} className="mt-4 text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center space-x-1">
                <FileBarChart className="w-4 h-4" /> <span>View Reports</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">`;
content = content.replace(gridDef, gridNew);

fs.writeFileSync(file, content);
