import pathlib
import re
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
src = (
    root / "apps" / "frontend" / "app" / "(tabs)" / "shop" / "[id].tsx"
).read_text(encoding="utf-8")
keys = sorted(set(re.findall(r"https://s3\.twcstorage\.ru/daryadarcy-s3/(app-assets/shop/[^\"']+)", src)))
out = root / ".tmp-shop-photos"
out.mkdir(exist_ok=True)
base = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663475213159/"

missing_file = root / ".tmp-shop-photos-missing.txt"
wanted = set(keys)
if missing_file.exists():
    wanted = {line.strip() for line in missing_file.read_text(encoding="utf-8").splitlines() if line.strip()}

ok = skip = fail = 0
for key in keys:
    if key not in wanted:
        continue
    name = key.rsplit("/", 1)[-1]
    dest = out / name
    if dest.exists() and dest.stat().st_size > 0:
        skip += 1
        print("have", name, dest.stat().st_size, flush=True)
        continue
    url = base + name
    last_err = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as res:
                data = res.read()
            dest.write_bytes(data)
            ok += 1
            print("ok", name, len(data), flush=True)
            last_err = None
            break
        except Exception as err:
            last_err = err
            print("retry", attempt, name, type(err).__name__, flush=True)
    if last_err is not None:
        fail += 1
        print("fail", name, type(last_err).__name__, last_err, flush=True)

print("downloaded", ok, "have", skip, "fail", fail, "of", len(keys), flush=True)
