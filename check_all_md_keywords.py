import os

keywords = ['RESEND_API_KEY', 'Expo SDK 54', 'migration', '007', '026']

for f in sorted(os.listdir('.')):
    if f.endswith('.md'):
        try:
            with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
                content = fh.read()
            print(f"=== {f} ({len(content)} chars) ===")
            for kw in keywords:
                found = kw in content
                print(f"  '{kw}': {'FOUND' if found else 'NOT FOUND'}")
        except Exception as e:
            print(f"Error reading {f}: {e}")
