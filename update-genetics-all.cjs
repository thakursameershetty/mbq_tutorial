const fs = require('fs');
const glob = require('glob');

const files = glob.sync('public/templates/*.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace genetics icon size across all templates, handling whitespace and colors dynamically
  content = content.replace(/data-icon="genetics" data-color="([^"]+)" data-size="\d+"[\s]*style="display:inline-block;\s*width:\d+px;\s*height:\d+px;"/g, 'data-icon="genetics" data-color="$1" data-size="28" style="display:inline-block; width:28px; height:28px;"');
  
  fs.writeFileSync(file, content);
}
console.log('done genetics all');
