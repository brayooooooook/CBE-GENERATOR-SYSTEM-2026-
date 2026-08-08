const fs = require('fs');
const file = 'src/components/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "  currentRole: Role;",
  "  currentRole: Role;\n  isClassTeacher?: boolean;"
);

content = content.replace(
  "export const Sidebar: React.FC<SidebarProps> = ({\n  currentRole,\n  activeTab,\n  onSelectTab,\n  isOpenMobile,\n  onCloseMobile,\n  onLogout,\n}) => {",
  "export const Sidebar: React.FC<SidebarProps> = ({\n  currentRole,\n  isClassTeacher = false,\n  activeTab,\n  onSelectTab,\n  isOpenMobile,\n  onCloseMobile,\n  onLogout,\n}) => {"
);

content = content.replace(
  "const isClassTeacher = currentUser?.role === 'teacher' && activeTeacher?.is_class_teacher;",
  ""
);

content = content.replace(
  "currentRole === 'teacher' ? (activeTeacher?.is_class_teacher ? 'Class Teacher View' : 'Subject Teacher View') : 'Student Portal'",
  "currentRole === 'teacher' ? (isClassTeacher ? 'Class Teacher View' : 'Subject Teacher View') : 'Student Portal'"
);

fs.writeFileSync(file, content);
