import sys

with open('README.md', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Total length: {len(content)}")
headers = [line for line in content.splitlines() if line.strip().startswith('#')]
print("Headers:")
for h in headers:
    print(h)

with open('README_headers.txt', 'w', encoding='utf-8') as out:
    out.write(f"Total length: {len(content)}\n")
    out.write("\n".join(headers))
