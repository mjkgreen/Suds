with open('README.md', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Safe ASCII conversion
safe_content = content.encode('ascii', errors='backslashreplace').decode('ascii')

with open('README_safe_ascii.txt', 'w', encoding='ascii') as f:
    f.write(safe_content)

print("Saved safe ASCII version to README_safe_ascii.txt")
