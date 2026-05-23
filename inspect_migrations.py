import os

migrations_dir = 'supabase/migrations'
files = sorted(os.listdir(migrations_dir))

for f in files:
    if f.startswith(('007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021', '022', '023', '024', '025', '026')):
        path = os.path.join(migrations_dir, f)
        with open(path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
        print(f"=== {f} ===")
        # Extract first 5 comments or description
        lines = content.split('\n')
        comments = [l.strip() for l in lines if l.strip().startswith('--')]
        key_statements = [l.strip() for l in lines if any(x in l.upper() for x in ['ALTER TABLE', 'CREATE TABLE', 'CREATE OR REPLACE FUNCTION', 'CREATE POLICY', 'DROP POLICY', 'DROP FUNCTION', 'CREATE TRIGGER', 'DROP TRIGGER'])]
        
        print("Comments:")
        for c in comments[:5]:
            print(f"  {c}")
        print("Key Statements:")
        for s in key_statements[:10]:
            print(f"  {s}")
        print("\n" + "="*40 + "\n")
