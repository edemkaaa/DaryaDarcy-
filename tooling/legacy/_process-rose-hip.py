import io
import json
import os
import sys
import urllib.parse
import urllib.request

from PIL import Image
from psd_tools import PSDImage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = os.path.join(ROOT, ".tmp-media")
os.makedirs(TMP, exist_ok=True)

PSD_URL = (
    "https://downloader.disk.yandex.ru/disk/06134e5ac0898447d0834172945caad5ab2fc4d2b1d5626bc3b627a55dbab6d4/"
    "6a8866bc/A4uQ1O2BtrDUheJA2S2k8VNVtaEL-RHNDsY0E15W95kn04wrO27IjK77yCO8MWQ91hVwxX4726-XXVODco6KQg%3D%3D"
    "?uid=0&filename=%D1%88%D0%B8%D0%BF%D0%BE%D0%B2%D0%BD%D0%B8%D0%BA.png"
    "&disposition=attachment&hash=&limit=0&content_type=image%2Fvnd.adobe.photoshop"
    "&owner_uid=0&fsize=40696551&hid=b6c12e21a6cca4f8112ba0827eef6fc9"
    "&media_type=image&tknv=v3&is_direct_zip_experiment=1&etag=75fc2e5153f74b849722798ff147d56c"
)

psd_path = os.path.join(TMP, "rose-hip.psd")
png_path = os.path.join(TMP, "rose-hip-branches.png")

print("Downloading PSD...")
urllib.request.urlretrieve(PSD_URL, psd_path)
print("  size", os.path.getsize(psd_path))

print("Converting to PNG with alpha...")
psd = PSDImage.open(psd_path)
image = psd.composite()
if image.mode != "RGBA":
    image = image.convert("RGBA")

# Trim empty transparent margins
bbox = image.getbbox()
if bbox:
    image = image.crop(bbox)

# Slightly soften leftover dark fringe on edges
pixels = image.load()
width, height = image.size
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if a == 0:
            continue
        # Remove near-black matte pixels
        if r < 18 and g < 18 and b < 18:
            pixels[x, y] = (0, 0, 0, 0)
            continue
        # Fade dark semi-transparent edge halos
        if max(r, g, b) < 40 and a < 220:
            pixels[x, y] = (r, g, b, max(0, a - 80))

image.save(png_path, optimize=True)
print("  saved", png_path, image.size, os.path.getsize(png_path))

# Upload to S3
env = {}
with open(os.path.join(ROOT, ".env"), encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

from boto3 import client  # type: ignore

s3 = client(
    "s3",
    endpoint_url=env["S3_ENDPOINT"],
    region_name="ru-1",
    aws_access_key_id=env["S3_ACCESS_KEY"],
    aws_secret_access_key=env["S3_SECRET_KEY"],
)

key = "app-assets/videos/rose-hip-branches.png"
with open(png_path, "rb") as body:
    s3.put_object(
        Bucket=env["S3_BUCKET"],
        Key=key,
        Body=body,
        ContentType="image/png",
        ACL="public-read",
        CacheControl="public, max-age=31536000",
    )

print("uploaded", f"https://s3.twcstorage.ru/{env['S3_BUCKET']}/{key}")
