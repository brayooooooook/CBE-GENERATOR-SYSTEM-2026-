const fs = require('fs');
let content = fs.readFileSync('src/components/ExaminationAnalysisValidation.tsx', 'utf8');

content = content.replace(
  "return Boolean(selectedLevel && selectedClassId && selectedYear && selectedTerm && selectedExamId);",
  "return Boolean(selectedLevel && selectedClassId && selectedStreamId && selectedYear && selectedTerm && selectedExamId);"
);

content = content.replace(
  "}, [selectedLevel, selectedClassId, selectedYear, selectedTerm, selectedExamId]);",
  "}, [selectedLevel, selectedClassId, selectedStreamId, selectedYear, selectedTerm, selectedExamId]);"
);

fs.writeFileSync('src/components/ExaminationAnalysisValidation.tsx', content);
