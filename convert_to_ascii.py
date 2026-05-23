with open('README.md', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Replace non-ascii with safe representations
ascii_content = content.encode('ascii', errors='replace').decode('ascii')

with open('README_ascii.md', 'w', encoding='ascii') as f:
    f.write(ascii_content)

print("Conversion complete!")
