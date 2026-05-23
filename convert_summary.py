with open('migrations_summary.txt', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()
with open('migrations_summary_ascii.txt', 'w', encoding='ascii', errors='replace') as f:
    f.write(content)
print("Converted!")
