const fs = require('fs');
const file = 'src/components/Header.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/<\/div>\n        <\/div>\n      <\/div>\n    <\/header>/, '<\/div>\n      <\/div>\n    <\/header>');

fs.writeFileSync(file, code);
