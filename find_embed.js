const fs = require('fs');
const content = fs.readFileSync('commands/gestion/antiraid.js', 'utf8');

const regex = /function\s+updateembed/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const linesBefore = content.substring(0, match.index).split('\n');
    console.log(`Found updateembed at line ${linesBefore.length}`);
}
