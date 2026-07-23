const fs = require('fs');

const injectionScript = `
<script>
  window.onload = function() {
    if (!window.REPORT_DATA) return;
    try {
      let bio = window.REPORT_DATA.biological_narrative;
      if (typeof bio === 'string') bio = JSON.parse(bio);

      // In a full implementation, we'd traverse and replace text nodes here.
      // For now, let's update some easy-to-target elements based on their existing text content
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue.trim();
        if (text.includes("Your body's interaction with caffeine is a fascinating blend")) {
           node.nodeValue = bio.domain_overview || text;
        }
        if (text.includes("genetics indicate you are a")) {
           node.nodeValue = bio.how_your_body_works || text;
        }
      }
      
      console.log("Successfully injected AI data into HTML layout.");
    } catch(e) {
      console.error("Error injecting data", e);
    }
  };
</script>
`;

['caffeine-sample.html', 'hair-sample.html', 'muscle-sample.html'].forEach(file => {
  const path = \`public/templates/\${file}\`;
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    if (!content.includes('window.REPORT_DATA')) {
      content = content.replace('</body>', injectionScript + '\\n</body>');
      fs.writeFileSync(path, content);
      console.log(\`Injected script into \${file}\`);
    }
  }
});
