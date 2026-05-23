with open('README_clean.md', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

print(f"File size in characters: {len(content)}")
keywords = ['RESEND_API_KEY', 'Expo SDK 54', 'migration', '007', '026', 'hydration', 'multi-photo']
for kw in keywords:
    found = kw in content
    print(f"Keyword '{kw}': {'FOUND' if found else 'NOT FOUND'}")

# Save ASCII representation of first 500 chars to inspect
safe_content = content[:1000].encode('ascii', errors='backslashreplace').decode('ascii')
print("First 1000 characters:")
print(safe_content)
