const fs = require('fs');
let content = fs.readFileSync('src/components/ExaminationAnalysisValidation.tsx', 'utf8');

// Update useState declarations
content = content.replace("useState<number>(2026);", "useState<number | ''>('');");
content = content.replace("useState<string>('Term 1');", "useState<string>('');");
content = content.replace("useState<string>('all');", "useState<string>('');");

// Remove the useEffects
content = content.replace(/\/\/ Auto-select level if empty[\s\S]*?}, \[selectedLevel\]\);/g, "");
content = content.replace(/\/\/ Auto-select first unique Class[\s\S]*?}, \[uniqueClasses, selectedClassId\]\);/g, "");
content = content.replace(/\/\/ Auto-select first available exam[\s\S]*?}, \[availableExams, selectedExamId\]\);/g, "");

fs.writeFileSync('src/components/ExaminationAnalysisValidation.tsx', content);
