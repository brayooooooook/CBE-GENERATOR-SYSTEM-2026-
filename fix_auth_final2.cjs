const fs = require('fs');

let content = fs.readFileSync('src/services/authService.ts', 'utf8');
content = content.replace(`    ip: '192.168.1.104 (Local LAN Proxy)',`, `  return {\n    ip: '192.168.1.104 (Local LAN Proxy)',`);
fs.writeFileSync('src/services/authService.ts', content);
