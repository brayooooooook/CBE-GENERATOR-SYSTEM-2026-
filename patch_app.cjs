const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace isTabAllowedForRole function
const isTabAllowedRegex = /const isTabAllowedForRole = \(role: Role, tab: TabType\): boolean => \{[\s\S]*?\};/m;
const newIsTabAllowed = `const getTeacherAllowedTabs = (isClassTeacher: boolean) => {
  const baseTabs = [
    'dashboard',
    'academic-session',
    'marks-entry',
    'provisional',
    'exam-validation',
    'reports',
  ];
  if (isClassTeacher) {
    baseTabs.push('students');
    baseTabs.push('attendance');
  }
  return baseTabs;
};

const isTabAllowedForRole = (user: User | null, tab: TabType, activeTeacher: Teacher | null): boolean => {
  if (!user) return false;
  if (user.role === 'admin') {
    return ROLE_ALLOWED_TABS.admin.includes(tab as any);
  }
  if (user.role === 'student') {
    return ROLE_ALLOWED_TABS.student.includes(tab as any);
  }
  if (user.role === 'teacher') {
    const isClassTeacher = activeTeacher?.is_class_teacher || false;
    return getTeacherAllowedTabs(isClassTeacher).includes(tab as any);
  }
  return false;
};`;
content = content.replace(isTabAllowedRegex, newIsTabAllowed);

content = content.replace(
  "if (hash && isTabAllowedForRole(user.role, hash)) {",
  "const tch = getActiveTeacher(user, api.getTeachers());\n            if (hash && isTabAllowedForRole(user, hash, tch)) {"
);

content = content.replace(
  "const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);",
  ""
);

content = content.replace(
  "export default function App() {",
  "export default function App() {\n  // activeTeacher needs to be accessible in App\n  const activeTeacher = getActiveTeacher(api.getCurrentUser() || null, api.getTeachers() || []);"
);

// We need to fix the hashchange check as well
content = content.replace(
  "if (hash && isAuthenticated && currentUser) {",
  "if (hash && isAuthenticated && currentUser) {\n        if (!isTabAllowedForRole(currentUser, hash, activeTeacher)) {\n          setActiveTab('dashboard');\n          window.location.hash = 'dashboard';\n          return;\n        }"
);

fs.writeFileSync(file, content);
