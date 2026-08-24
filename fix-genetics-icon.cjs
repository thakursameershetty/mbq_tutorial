const fs = require('fs');
const glob = require('glob');

const files = glob.sync('public/templates/*.html');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the genetics icon style to add flex-shrink: 0 and maybe increase size slightly more just in case
  content = content.replace(
    /data-icon="genetics"([^>]*)data-size="\d+" style="([^"]*)"/g,
    (match, p1, p2) => {
      // we'll force it to size 32 and add flex-shrink 0
      const newStyle = p2.replace(/width:\s*\d+px;?/g, '').replace(/height:\s*\d+px;?/g, '').trim() + ' width:32px; height:32px; flex-shrink:0;';
      return `data-icon="genetics"${p1}data-size="32" style="${newStyle}"`;
    }
  );
  
  fs.writeFileSync(file, content);
}
console.log('done fixing genetics icon');
