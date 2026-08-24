const fs = require('fs');
const glob = require('glob');

const files = glob.sync('public/templates/*.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix Date icon which was accidentally set to docs
  content = content.replace(/data-icon="docs"([^>]*><\/div>\s*dd mm yyyy)/g, 'data-icon="calendar_clock"$1');
  
  fs.writeFileSync(file, content);
}
console.log('done fixing date icon');
