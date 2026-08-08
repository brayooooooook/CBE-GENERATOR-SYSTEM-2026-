const fs = require('fs');
const file = 'src/components/MarksEntryTable.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "{isSelectionComplete && (",
  "{isSelectionComplete && canModify && canEditCurrentGrid && ("
);

fs.writeFileSync(file, content);
