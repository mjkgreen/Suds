import os

keywords = ['026', 'RESEND_API_KEY', 'Expo SDK 54', 'hydration', 'multi-photo']
results = {kw: [] for kw in keywords}

for root, dirs, files in os.walk('.'):
    # Skip standard ignored dirs
    if any(p in root for p in ['.git', 'node_modules', '.expo', '.vscode', 'assets']):
        continue
    for file in files:
        if file.endswith(('.md', '.py', '.js', '.json', '.ts', '.tsx', '.sql')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                for kw in keywords:
                    if kw in content:
                        results[kw].append(path)
            except Exception as e:
                pass

for kw, paths in results.items():
    print(f"Keyword '{kw}' found in:")
    for p in paths[:10]:
        print(f"  - {p}")
    if len(paths) > 10:
        print(f"  - and {len(paths) - 10} more files...")
