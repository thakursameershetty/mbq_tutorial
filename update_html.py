import re
import os

files = ['public/templates/caffeine-sample.html', 'public/templates/muscle-sample.html', 'public/templates/hair-sample.html']

page2_regex = re.compile(r'<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;">.*?<div\s*style="margin-top:14px;', re.DOTALL)
page2_replacement = r'<img src="assets/page2-YOUR SUCCESS FORMULA.png" style="width: 100%; height: auto; max-height: 120px; object-fit: contain; margin: 10px 0;" />\n            <div\n              style="margin-top:14px;'

page3_regex = re.compile(r'<div style="position:relative;height:155px;margin-top:12px;">.*?<div\s*style="margin-top:2px;background:#fdf6ef;', re.DOTALL)
page3_replacement = r'<img src="assets/page3-GENETICS IS ONE PIECE OF THE PICTURE.png" style="width: 100%; height: auto; margin: 12px 0;" />\n            <div\n              style="margin-top:2px;background:#fdf6ef;'

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = page2_regex.sub(page2_replacement, content)
    new_content = page3_regex.sub(page3_replacement, new_content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes in {filepath}")

