with open('RESEND_SETUP.md', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

safe_content = content.encode('ascii', errors='backslashreplace').decode('ascii')

with open('RESEND_SETUP_ascii.txt', 'w', encoding='ascii') as f:
    f.write(safe_content)

print("Saved RESEND_SETUP.md to RESEND_SETUP_ascii.txt")
