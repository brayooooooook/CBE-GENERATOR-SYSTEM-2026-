const fs = require('fs');
const file = 'src/components/Header.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '<div className="flex items-center justify-between md:justify-end space-x-2 w-full md:w-auto overflow-hidden">',
  '<div className="flex items-center justify-between md:justify-end flex-wrap gap-2 md:gap-0 md:space-x-2 w-full md:w-auto">'
);

fs.writeFileSync(file, code);
