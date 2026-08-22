const fs = require('fs');
const file = 'src/components/Header.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '<span className="hidden md:inline">Logout</span>',
  '<span className="inline">Logout</span>'
);

fs.writeFileSync(file, code);
