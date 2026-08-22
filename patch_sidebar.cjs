const fs = require('fs');
const file = 'src/components/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the getNavGroups implementation for teacher
const teacherBlockRegex = /\} else if \(currentRole === 'teacher'\) \{[\s\S]*?\} else \{/m;
const newTeacherBlock = `} else if (currentRole === 'teacher') {
      const isClassTeacher = currentUser?.role === 'teacher' && activeTeacher?.is_class_teacher;
      const teacherItems: NavGroupDef[] = [];
      
      teacherItems.push(
        {
          id: 'group_dashboard',
          title: 'Dashboard',
          icon: <LayoutDashboard className="w-4 h-4 text-blue-400" />,
          items: [
            { id: 'dashboard', label: 'My Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
          ],
        },
        {
          id: 'group_academic',
          title: 'Academic Management',
          icon: <GraduationCap className="w-4 h-4 text-purple-400" />,
          items: [
            { id: 'academic-session', label: 'Academic Terms Info', icon: <CalendarDays className="w-4 h-4 text-purple-400" /> },
          ],
        }
      );

      if (isClassTeacher) {
        teacherItems.push({
          id: 'group_learners',
          title: 'Learners',
          icon: <Users className="w-4 h-4 text-emerald-400" />,
          items: [
            { id: 'students', label: 'My Class Students', icon: <Users className="w-4 h-4" /> },
            { id: 'attendance', label: 'Class Attendance Roll', icon: <Calendar className="w-4 h-4 text-emerald-400" /> },
          ],
        });
      }

      teacherItems.push({
        id: 'group_assessments',
        title: 'Assessments',
        icon: <BookMarked className="w-4 h-4 text-blue-400" />,
        items: [
          { id: 'marks-entry', label: 'Enter Marks', icon: <FileSpreadsheet className="w-4 h-4" /> },
          { id: 'provisional', label: 'Verification Status', icon: <CheckSquare className="w-4 h-4" /> },
          { id: 'exam-validation', label: 'Exam Analysis & Validation', icon: <ShieldCheck className="w-4 h-4 text-amber-400" /> },
          { id: 'reports', label: isClassTeacher ? 'Reports & Merit Lists' : 'Subject Performance', icon: <FileBarChart className="w-4 h-4" /> },
        ],
      });

      return teacherItems;
    } else {`;

content = content.replace(teacherBlockRegex, newTeacherBlock);

// Also change the role text from "Class Teacher View" to "Class Teacher View" or "Subject Teacher View"
content = content.replace(
  "currentRole === 'teacher' ? 'Class Teacher View' : 'Student Portal'",
  "currentRole === 'teacher' ? (activeTeacher?.is_class_teacher ? 'Class Teacher View' : 'Subject Teacher View') : 'Student Portal'"
);

fs.writeFileSync(file, content);
