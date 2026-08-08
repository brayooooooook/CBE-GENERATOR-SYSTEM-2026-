const fs = require('fs');
const file = 'src/components/MarksEntryTable.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { isTermModifiable, canViewTermData, getTermStatusMessage } from \"../utils/termStatusUtils\";",
  "import { isTermModifiable, canViewTermData, getTermStatusMessage, canEnterMarks } from \"../utils/termStatusUtils\";"
);

content = content.replace(
  "const canModify = isTermModifiable(activeTermObj.status);",
  "const canModify = canEnterMarks(activeTermObj.status);"
);

fs.writeFileSync(file, content);
