const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir('./src');
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('useEffect(')) {
        // extract useEffect blocks
        const matches = [...content.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[([\s\S]*?)\]\)/g)];
        matches.forEach((m, idx) => {
            const body = m[1];
            const deps = m[2];
            if (body.includes('set') && !body.includes('setTimeout')) {
                // If the body calls set state, check the deps
                console.log(`\n--- ${file} (Effect ${idx + 1}) ---`);
                console.log(`Deps: ${deps.trim()}`);
            }
        });
    }
});
