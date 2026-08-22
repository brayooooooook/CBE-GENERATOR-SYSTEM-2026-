const fs = require('fs');
const file = 'src/components/ExaminationAnalysisValidation.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { isTermModifiable, canViewTermData, getTermStatusMessage } from \"../utils/termStatusUtils\";",
  "import { isTermModifiable, canViewTermData, getTermStatusMessage, canApproveExams } from \"../utils/termStatusUtils\";"
);

content = content.replace(
  "const canModify = isTermModifiable(activeTermObj.status);",
  "const canModify = canApproveExams(activeTermObj.status);"
);

fs.writeFileSync(file, content);
