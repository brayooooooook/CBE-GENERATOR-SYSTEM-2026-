const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
const content = fs.readFileSync(file, 'utf8');

const match = content.match(/<div className="flex flex-wrap items-center gap-2">[\s\S]*?<\/div>/);
console.log(match ? match[0] : "Not found");
