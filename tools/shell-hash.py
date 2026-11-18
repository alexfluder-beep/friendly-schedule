#!/usr/bin/env python3
# Release step: writes the fingerprint (start of SHA-256) of every app file into SHELL in sw.js,
# so phones download only the files that changed. Run in the release folder after copying files: python3 tools/shell-hash.py
import hashlib, re, sys, os
os.chdir(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
s = open('sw.js', encoding='utf-8').read()
m = re.search(r"const SHELL = \{(.*?)\};", s)
files = re.findall(r"'([^']+)':\s*'[0-9a-f]*'", m.group(1))
def fp(f):
    p = 'index.html' if f == './' else f
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()[:12]
body = ", ".join(f"'{f}': '{fp(f)}'" for f in files)
s = s[:m.start(1)] + body + s[m.end(1):]
open('sw.js', 'w', encoding='utf-8').write(s)
print(len(files), 'files fingerprinted')
