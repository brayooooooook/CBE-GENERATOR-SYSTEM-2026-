const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { isTermModifiable, canViewTermData, getTermStatusMessage } from \"../utils/termStatusUtils\";",
  "import { isTermModifiable, canGenerateReports, getTermStatusMessage, canEnterMarks } from \"../utils/termStatusUtils\";"
);

content = content.replace(
  "const canModify = isTermModifiable(activeTermObj.status);",
  "const canModify = canEnterMarks(activeTermObj.status);"
);

content = content.replaceAll(
  "canViewTermData(",
  "canGenerateReports("
);

fs.writeFileSync(file, content);
