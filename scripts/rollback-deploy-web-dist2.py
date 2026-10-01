"""Deploy the saved web-dist2 snapshot (Sep 2 stable build) to production."""
import pathlib
import re
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
source = root / "web-dist2"
target = root / "web-dist"
backup = root / "web-dist-broken-20250917"

if not (source / "index.html").exists():
    raise SystemExit(f"Missing rollback source: {source / 'index.html'}")

if target.exists() and not backup.exists():
    print(f"backing up current web-dist -> {backup.name}")
    shutil.move(str(target), str(backup))

if target.exists():
    shutil.rmtree(target)
shutil.copytree(source, target)

index = target / "index.html"
html = index.read_text(encoding="utf-8")
stamp = "2026-09-02T08:28:00.000Z-rollback"
tag = f'<meta name="dd-deploy" content="{stamp}">'
if "dd-deploy" in html:
    html = re.sub(r'<meta name="dd-deploy" content="[^"]*">\s*', tag, html)
else:
    html = html.replace("</head>", f"{tag}</head>")
index.write_text(html, encoding="utf-8")
print("rollback source:", source.name)
print("deploy tag:", stamp)

subprocess.run([sys.executable, str(root / "scripts" / "ssh-deploy-web-direct.py")], cwd=root, check=True)
