import os

readme_path = 'README.md'
if os.path.exists(readme_path):
    with open(readme_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    print(f"File size in characters: {len(content)}")
    print(f"File size in bytes: {os.path.getsize(readme_path)}")
    keywords = ['026', 'RESEND_API_KEY', 'Expo SDK 54', 'hydration', 'multi-photo']
    for kw in keywords:
        found = kw in content
        print(f"Keyword '{kw}': {'FOUND' if found else 'NOT FOUND'}")
else:
    print("README.md does not exist.")
