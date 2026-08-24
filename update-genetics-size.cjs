const fs = require('fs');
const glob = require('glob');

const files = glob.sync('public/templates/*.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace genetics icon size from 22 to 28
  content = content.replace(/data-icon="genetics" data-color="#1f9d63" data-size="22"\s*style="display:inline-block; width:22px; height:22px;"/g, 'data-icon="genetics" data-color="#1f9d63" data-size="28" style="display:inline-block; width:28px; height:28px;"');
  
  fs.writeFileSync(file, content);
}
console.log('done genetics icon size');
