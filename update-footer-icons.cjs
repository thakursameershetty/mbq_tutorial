const fs = require('fs');
const glob = require('glob');

const files = glob.sync('public/templates/*.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace ID icon
  content = content.replace(/data-icon="verified"([^>]*><\/div>\s*(?:CQ ID|MBQ ID|HQ ID)?)/g, 'data-icon="docs"$1');
  
  // Replace Date icon
  content = content.replace(/data-icon="verified"([^>]*><\/div>\s*dd mm yyyy)/g, 'data-icon="calendar_clock"$1');
  
  fs.writeFileSync(file, content);
}
console.log('done');
