import os

migrations_dir = 'supabase/migrations'
for f in sorted(os.listdir(migrations_dir)):
    if f.endswith('.sql'):
        path = os.path.join(migrations_dir, f)
        with open(path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
        for i, line in enumerate(content.split('\n')):
            upper_line = line.upper()
            if 'REFERENCES' in upper_line or 'CASCADE' in upper_line:
                print(f"{f}:{i+1} -> {line.strip()[:120]}")
