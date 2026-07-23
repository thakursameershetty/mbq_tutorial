const fs = require('fs');
const html = fs.readFileSync('public/templates/muscle-sample.html', 'utf8');
const finalHtml = html
  .replace('<head>', `<head><base href="http://localhost:5173/">`)
  .replace('src="./support.js"', 'src="/templates/support.js"');

console.log(finalHtml.substring(0, 250));
