import os

files = [
    '/Users/thakur/Desktop/Sample/mbq_tutorial/public/templates/hair-sample.html',
    '/Users/thakur/Desktop/Sample/mbq_tutorial/public/templates/caffeine-sample.html',
    '/Users/thakur/Desktop/Sample/mbq_tutorial/public/templates/muscle-sample.html',
]

poppins_link = '<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,700;1,800&amp;display=swap" rel="stylesheet"/>'
google_sans_link = '<link href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet"/>'

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Replace the link
    content = content.replace(poppins_link, google_sans_link)
    
    # Alternatively replace it even if unescaped
    content = content.replace('<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,700;1,800&display=swap" rel="stylesheet">', google_sans_link)
    
    # Replace font-family
    content = content.replace("font-family: 'Poppins', system-ui, sans-serif;", "font-family: 'Google Sans', system-ui, sans-serif;")
    content = content.replace("font-family: 'Poppins', sans-serif;", "font-family: 'Google Sans', sans-serif;")
    
    with open(file_path, 'w') as f:
        f.write(content)
        
print("Fonts updated!")
