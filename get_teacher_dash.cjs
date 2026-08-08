const fs = require('fs');
const file = 'src/components/TeacherDashboard.tsx';
const content = fs.readFileSync(file, 'utf8');

const match = content.match(/<div className="grid grid-cols-1 md:grid-cols-2 gap-6">/);
console.log(match ? "Found grid" : "Not found");
