const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix the activeTeacher location
content = content.replace(
  "  // activeTeacher needs to be accessible in App\n  const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);",
  ""
);

content = content.replace(
  "  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>(\n    api.getVerificationLogs()\n  );",
  "  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>(\n    api.getVerificationLogs()\n  );\n\n  const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);"
);

// Fix handleLoginSuccess
content = content.replace(
  "    const hash = window.location.hash.replace('#', '') as TabType;\n    if (hash && isTabAllowedForRole(user.role, hash)) {",
  "    const hash = window.location.hash.replace('#', '') as TabType;\n    const tch = getActiveTeacher(user, api.getTeachers());\n    if (hash && isTabAllowedForRole(user, hash, tch)) {"
);

// Fix the render check
content = content.replace(
  "const isTabAllowed = isTabAllowedForRole(currentUser.role, activeTab);",
  "const isTabAllowed = isTabAllowedForRole(currentUser, activeTab, activeTeacher);"
);

// Pass isClassTeacher to Sidebar
content = content.replace(
  "          <Sidebar\n            currentRole={currentUser.role}\n            activeTab={activeTab}\n            onSelectTab={setActiveTab}\n            isOpenMobile={isOpenMobileSidebar}\n            onCloseMobile={() => setIsOpenMobileSidebar(false)}\n            onLogout={() => authService.signOut()}\n          />",
  "          <Sidebar\n            currentRole={currentUser.role}\n            isClassTeacher={activeTeacher?.is_class_teacher || false}\n            activeTab={activeTab}\n            onSelectTab={setActiveTab}\n            isOpenMobile={isOpenMobileSidebar}\n            onCloseMobile={() => setIsOpenMobileSidebar(false)}\n            onLogout={() => authService.signOut()}\n          />"
);

fs.writeFileSync(file, content);
