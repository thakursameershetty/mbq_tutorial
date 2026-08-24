const fs = require('fs');
const glob = require('glob');

const files = glob.sync('public/templates/*.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace only the first occurrence (no /g flag)
  content = content.replace(
    '<img alt="CQ Logo" height="42" src="assets/logo_mbq.png" style="flex:none;">',
    '<img alt="CQ Logo" height="56" src="assets/logo_mbq.png" style="flex:none;">'
  );
  
  fs.writeFileSync(file, content);
}
console.log('done updating first page logo');
