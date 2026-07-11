const fs = require('fs');
const path = require('path');

const dirs = ['./commands', './events', './utils'];
const emojis = new Set();
const regex = /<a?:[a-zA-Z0-9_]+:\d+>/g;

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let match;
            while ((match = regex.exec(content)) !== null) {
                emojis.add(match[0]);
            }
        }
    }
}

dirs.forEach(walk);
console.log(Array.from(emojis).join('\n'));
