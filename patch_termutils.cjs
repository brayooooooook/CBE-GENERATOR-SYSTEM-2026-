const fs = require('fs');
const file = 'src/utils/termStatusUtils.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "export const isTermModifiable = (status: TermStatus): boolean => {",
  "export const canGenerateReports = (status: TermStatus): boolean => {\n  return status === 'Active' || status === 'Closed' || status === 'Locked' || status === 'Archived';\n};\n\nexport const isTermModifiable = (status: TermStatus): boolean => {"
);

fs.writeFileSync(file, content);
