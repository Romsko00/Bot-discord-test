const fs = require('fs');
const content = fs.readFileSync('commands/gestion/antiraid.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('function updateembed')) {
        console.log(`Line ${index + 1}: ${line}`);
    }
});
