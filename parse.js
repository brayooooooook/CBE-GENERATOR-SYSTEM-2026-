const fs = require('fs');
const doc = JSON.parse(fs.readFileSync('openapi.json', 'utf8'));
console.log(Object.keys(doc.definitions || doc.components?.schemas || {}));
