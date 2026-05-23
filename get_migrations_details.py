import os

migrations_dir = 'supabase/migrations'
files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])

with open('migrations_summary.txt', 'w', encoding='utf-8') as out:
    for f in files:
        # We only care about migrations 007 through 026 (or more)
        if f.startswith(('007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021', '022', '023', '024', '025', '026')):
            out.write(f"=== {f} ===\n")
            with open(os.path.join(migrations_dir, f), 'r', encoding='utf-8', errors='ignore') as fh:
                lines = fh.readlines()
                # Print first 20 lines or lines with ALTER, CREATE, COMMENT, etc.
                out.write("".join(lines[:30]))
                out.write("\n... (truncated if longer) ...\n")
                important_lines = [l.strip() for l in lines if any(x in l.upper() for x in ['CREATE TABLE', 'ALTER TABLE', 'CREATE OR REPLACE FUNCTION', 'CREATE TRIGGER', 'ADD COLUMN', 'DROP COLUMN'])]
                if important_lines:
                    out.write("Key SQL statements:\n")
                    for il in important_lines:
                        out.write(f"  {il}\n")
            out.write("\n" + "="*50 + "\n\n")
