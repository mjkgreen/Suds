import os

for f in os.listdir('.'):
    if f.endswith('.md'):
        try:
            with open(f, 'r', encoding='utf-8') as fh:
                content = fh.read()
                print(f"{f}: {len(content)} chars, {content.count('\n')} lines, starts with: {repr(content[:100])}")
        except Exception as e:
            print(f"{f}: Error reading with utf-8: {e}")
