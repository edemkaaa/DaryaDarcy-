# Проверяет доступность заданных внешних обложек. Сетевой статус зависит от маршрута и не доказывает работу плеера.
import json
import urllib.request

url = "https://daryadarcy.com/api/trpc/videos.list"
req = urllib.request.Request(url, headers={"Accept": "application/json"})
with urllib.request.urlopen(req, timeout=20) as r:
    data = json.loads(r.read().decode("utf-8"))

result = data["result"]["data"]
videos = result["json"] if isinstance(result, dict) and "json" in result else result
print("count", len(videos))
for v in videos[:3]:
    print(v.get("id"), v.get("youtubeId"), v.get("thumbnailUrl"))

thumb = videos[0]["thumbnailUrl"]
r = urllib.request.urlopen(urllib.request.Request(thumb, method="GET"), timeout=15)
print("thumb status", r.status, r.headers.get("content-type"), len(r.read()))
