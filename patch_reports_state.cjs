const fs = require('fs');
let content = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

// 1. Remove initial selections
content = content.replace(
  "const [selectedExamId, setSelectedExamId] = useState<string>(\n    (exams || [])[0]?.id || ''\n  );",
  "const [selectedExamId, setSelectedExamId] = useState<string>('');"
);
content = content.replace(
  "const [selectedStreamId, setSelectedStreamId] = useState<string>('all');",
  "const [selectedStreamId, setSelectedStreamId] = useState<string>('');"
);
content = content.replace(
  "const [selectedStudentId, setSelectedStudentId] = useState<string>(\n    studentSelfId || (students || [])[0]?.id || ''\n  );",
  "const [selectedStudentId, setSelectedStudentId] = useState<string>(studentSelfId || '');"
);
content = content.replace(
  "const [selectedSubjectId, setSelectedSubjectId] = useState<string>(\n    (subjects || [])[0]?.id || ''\n  );",
  "const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');"
);

// 2. Remove useEffect auto-selects
content = content.replace(/\/\/ Unique class levels[\s\S]*?}, \[uniqueClasses, selectedClassId\]\);/g, "// Unique class levels\n  const uniqueClasses = Array.from(new Set((accessibleClasses || []).map((c) => c.class_name)));");

content = content.replace(/\/\/ Auto-adjust selectedSubjectId[\s\S]*?}, \[selectedClassId, displaySubjects\]\);/g, "// Removed auto-adjust subject");

content = content.replace(/useEffect\(\(\) => \{\n    if \(targetStudents\.length > 0\) \{\n      if \(!targetStudents\.some\(\(s\) => s\.id === selectedStudentId\)\) \{\n        setSelectedStudentId\(targetStudents\[0\]\.id\);\n      \}\n    \} else \{\n      setSelectedStudentId\(''\);\n    \}\n  \}, \[selectedClassId, selectedStreamId, targetStudents\]\);/g, "");

fs.writeFileSync('src/components/ReportsView.tsx', content);
