const fs = require('fs');
const file = 'src/components/MarksEntryTable.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "onClick={handleSaveAll}\n            className=\"bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2 rounded-lg shadow-sm transition flex items-center space-x-1.5\"",
  "onClick={handleSaveAll}\n            disabled={(!canModify) || !canEditCurrentGrid || !isSelectionComplete}\n            className={`font-bold text-xs px-5 py-2 rounded-lg shadow-sm transition flex items-center space-x-1.5 ${(!canModify) || !canEditCurrentGrid || !isSelectionComplete ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}"
);

fs.writeFileSync(file, content);
