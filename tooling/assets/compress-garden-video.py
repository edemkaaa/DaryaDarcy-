# Подготавливает отдельный сжатый ролик по прежним путям проекта. Это ручная обработка конкретного исходника, а не изменение общего upload-контракта.
import json
import pathlib
import subprocess
import urllib.parse
import urllib.request

root = pathlib.Path(r"C:\Users\Иван\Downloads\daryadarcy_app")
out_dir = root / ".tmp-media"
out_dir.mkdir(exist_ok=True)
src = out_dir / "garden-source.m4v"
mp4 = out_dir / "secret-garden.mp4"
poster = out_dir / "secret-garden.jpg"
ffmpeg = r"C:\Users\Иван\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
public = "https://disk.yandex.ru/i/vJDF9B0Bqoq7bQ"

def download_url():
    meta_url = (
        "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key="
        + urllib.parse.quote(public)
    )
    return json.load(urllib.request.urlopen(meta_url, timeout=30))["href"]

expected = 1405295759
if not src.exists() or src.stat().st_size < expected * 0.98:
    href = download_url()
    print("downloading", expected, "bytes", flush=True)
    urllib.request.urlretrieve(href, src)
print("source bytes", src.stat().st_size, flush=True)

cmd = [
    ffmpeg, "-y", "-i", str(src),
    "-vf", "scale=-2:720",
    "-c:v", "libx264", "-crf", "28", "-preset", "veryfast",
    "-c:a", "aac", "-b:a", "96k",
    "-movflags", "+faststart", "-pix_fmt", "yuv420p",
    str(mp4),
]
print("encoding", flush=True)
subprocess.check_call(cmd)
print("mp4 bytes", mp4.stat().st_size, flush=True)
subprocess.check_call([ffmpeg, "-y", "-ss", "3", "-i", str(mp4), "-frames:v", "1", "-q:v", "3", str(poster)])
print("poster bytes", poster.stat().st_size, flush=True)
print("DONE", flush=True)
