const fs = require('fs');
const file = 'src/components/SchoolPerformanceAnalytics.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { canViewTermData, getTermStatusMessage } from \"../utils/termStatusUtils\";",
  "import { canGenerateReports, getTermStatusMessage } from \"../utils/termStatusUtils\";"
);

content = content.replace(
  "if (!canViewTermData(activeTermObj.status)) {",
  "if (!canGenerateReports(activeTermObj.status)) {"
);

fs.writeFileSync(file, content);
