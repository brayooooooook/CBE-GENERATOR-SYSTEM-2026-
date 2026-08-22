const fs = require('fs');
let content = fs.readFileSync('src/services/meritListExporter.ts', 'utf8');

content = content.split("    const prevOvrPos = isComplete ? `${(r as any).previous_position || Math.min(results.length, Math.max(1, (r.position || idx + 1) + ((idx % 3 === 0 ? 1 : idx % 2 === 0 ? -1 : 2))))}` : '-';").join("    const prevOvrPos = isComplete && (r as any).previous_position ? `${(r as any).previous_position}` : '-';");

content = content.split("    const prevStrPos = isComplete ? `${(r as any).previous_class_position || Math.min(results.length, Math.max(1, (r.class_position || 1) + ((idx % 2 === 0 ? 0 : 1))))}` : '-';").join("    const prevStrPos = isComplete && (r as any).previous_class_position ? `${(r as any).previous_class_position}` : '-';");

fs.writeFileSync('src/services/meritListExporter.ts', content);
