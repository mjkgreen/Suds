import os

with open('md_report.txt', 'w', encoding='utf-8') as out:
    for f in sorted(os.listdir('.')):
        if f.endswith('.md'):
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    content = fh.read()
                out.write(f"=== File: {f} ===\n")
                out.write(f"Length: {len(content)} chars\n")
                out.write(f"Lines: {content.count('\n')} lines\n\n")
                # Write first 500 characters
                out.write("First 500 chars:\n")
                out.write(content[:500])
                out.write("\n\n" + "="*80 + "\n\n")
            except Exception as e:
                out.write(f"Error reading {f}: {e}\n\n")
