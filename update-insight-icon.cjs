const fs = require('fs');
const glob = require('glob');

const files = glob.sync('public/templates/*.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // The script accidentally changed verified to docs in front of AI-DRIVEN GENETIC INSIGHT
  content = content.replace(/data-icon="docs"([^>]*><\/div>\s*<span[^>]*>AI-DRIVEN GENETIC)/g, 'data-icon="lucide-sparkles"$1');
  
  fs.writeFileSync(file, content);
}
console.log('done insight');
