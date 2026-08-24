import re
import os

files = ['public/templates/caffeine-sample.html', 'public/templates/muscle-sample.html', 'public/templates/hair-sample.html']

target_str = '<img src="assets/page3-GENETICS IS ONE PIECE OF THE PICTURE.png" style="width: 100%; height: auto; margin: 12px 0;" />'
replacement_str = '<img src="assets/page3-GENETICS IS ONE PIECE OF THE PICTURE.png" style="width: 100%; height: auto; max-height: 155px; object-fit: contain; margin: 12px auto; display: block;" />'

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content.replace(target_str, replacement_str)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes in {filepath}")

