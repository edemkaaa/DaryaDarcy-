# Аудит статичных изображений из S3 — 6 октября 2026 года

**Исторический снимок первого этапа оптимизации без изменения разрешения.** После этого статичные изображения получили локальные адаптивные превью. Этот отчёт не описывает вес текущей страницы и не подтверждает наличие старых производных файлов после последующих изменений. Актуальные варианты указаны в [манифесте изображений](../../apps/frontend/image-variants.json).

На этом этапе меньший файл применялся только после проверки совпадения декодированных пикселей. Бэкенд, пользовательские загрузки и исходные объекты S3 не изменялись.

## Сводка

| Показатель | Результат |
| --- | --- |
| Режим | Изменения применены (`applied`) |
| Запрошено изображений | 152 |
| Проверено изображений | 152 |
| Оптимизировано | 23 |
| Без изменений | 129 |
| Исходный вес, байт | 76 296 104 |
| Вес после этого этапа, байт | 50 362 063 |
| Экономия, байт | 25 934 041 |
| Экономия от исходного веса | 33,99% |
| jpegtran доступен | Да |

[Исходные данные для инструментов](../../tooling/data/frontend-audits/frontend-external-image-audit-2026-10-06.json) сохранены отдельно от документации, без изменения значений.

## Как читать результаты

`pixel-identical` — применён меньший файл с совпадающими декодированными пикселями; `unchanged` — исходник сохранён. Контрольные суммы относятся к моменту этого аудита. Значения объёма указаны в байтах, размеры — в пикселях.

Оптимизированы **23 изображения оформления Клуба**. Их суммарный исходный вес — **56 861 675 байт**, результат — **30 927 634 байт**. Остальные 129 файлов сохранены. Все 152 оригинала были успешно получены; время скачивания и заголовки — наблюдения конкретного запроса.

## Динамические адреса

Следующий шаблон обнаружен в коде, но не учитывался как буквальный URL изображения:

- `https://daryadarcy.com/media/yt-thumb/${item.youtubeId}/hqdefault.jpg`

## Полный список файлов

| № | Оригинал | Размер, px | Формат | До, байт | После, байт | Экономия, байт | Статус |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/cloudfront/afae02aa817a-shelf-label-frame-wide-iUo6pePUPBamyiM9D5NVtE.webp` | 1200 × 514 | webp | 196 004 | 196 004 | 0 | unchanged |
| 2 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/feed/banner-shelf-v2.jpg` | 1024 × 183 | jpeg | 67 344 | 67 344 | 0 | unchanged |
| 3 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/home/secret-garden-poster.webp` | 900 × 599 | webp | 134 310 | 134 310 | 0 | unchanged |
| 4 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/library/loshadka-cover.jpg` | 1176 × 1628 | jpeg | 191 088 | 191 088 | 0 | unchanged |
| 5 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/011254ea51fb-iXlFvAzqcTIXBklq.png` | 299 × 208 | png | 118 306 | 118 306 | 0 | unchanged |
| 6 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/01ac0596761e-CpXcSOXRRuKDFbNs.png` | 2048 × 1890 | png | 1 058 006 | 476 792 | 581 214 | pixel-identical |
| 7 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/02ac70f42cc6-RleAncWBrOTmRsWP.webp` | 900 × 1074 | webp | 222 282 | 222 282 | 0 | unchanged |
| 8 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0479fc01d16a-MSbIPSMMSqmZweYd.png` | 2048 × 1098 | png | 2 942 145 | 1 467 328 | 1 474 817 | pixel-identical |
| 9 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/049e3831441b-iirWKYJcvPUnEdXs.webp` | 900 × 900 | webp | 47 544 | 47 544 | 0 | unchanged |
| 10 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0c95d509c862-oewXdFleqUUvImKT.png` | 2048 × 884 | png | 550 759 | 251 206 | 299 553 | pixel-identical |
| 11 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0f57f1bbff1b-ZJsYljHDvCbRNMgf.JPG` | 1200 × 1600 | jpeg | 281 359 | 281 359 | 0 | unchanged |
| 12 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.webp` | 900 × 720 | webp | 80 942 | 80 942 | 0 | unchanged |
| 13 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/18c14e47537e-EJllmcoOmdUexPyK.jpg` | 1200 × 1470 | jpeg | 151 829 | 151 829 | 0 | unchanged |
| 14 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1a03ee114023-cCbdKIZtJmsSzKzg.png` | 2048 × 1172 | png | 827 993 | 393 896 | 434 097 | pixel-identical |
| 15 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1d28efefb09b-mlHctAbwrdujnkAl.png` | 2048 × 1526 | png | 2 454 432 | 1 103 706 | 1 350 726 | pixel-identical |
| 16 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG` | 1200 × 1600 | jpeg | 235 003 | 235 003 | 0 | unchanged |
| 17 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbdc4edd1f6-WglvBAnfwHsodSFE.webp` | 864 × 896 | webp | 36 790 | 36 790 | 0 | unchanged |
| 18 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fdd58674349-hbukoToSZXIzQKHV.JPG` | 1200 × 1600 | jpeg | 294 663 | 294 663 | 0 | unchanged |
| 19 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/234b0e0452ba-vVFccXYZXhHdnGCR.png` | 2048 × 1508 | png | 3 501 174 | 1 806 750 | 1 694 424 | pixel-identical |
| 20 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/248794a7bd51-TGjGBKCtCDaiNEGA.png` | 1542 × 2048 | png | 3 458 358 | 1 662 340 | 1 796 018 | pixel-identical |
| 21 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/24c37be76c6e-lURmCnSESVWSORUh.webp` | 900 × 1168 | webp | 194 642 | 194 642 | 0 | unchanged |
| 22 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/250423a7ec62-uyAaCmBzfqhlMwpt.PNG` | 1320 × 2868 | png | 7 838 275 | 6 995 024 | 843 251 | pixel-identical |
| 23 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/2c8069c13604-UBeEtDCkYYkHKSKN.png` | 2048 × 1490 | png | 4 234 825 | 2 067 746 | 2 167 079 | pixel-identical |
| 24 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/33a4bcfff34a-wmgRUgkBOrSfVIso.JPG` | 1200 × 1600 | jpeg | 281 300 | 281 300 | 0 | unchanged |
| 25 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3b8642166933-rdRVzYWvuGEmSUdF.jpeg` | 1081 × 1920 | jpeg | 268 417 | 268 417 | 0 | unchanged |
| 26 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3f69fb85d89c-nbShGAsyJAWYwcXH.webp` | 600 × 480 | webp | 36 824 | 36 824 | 0 | unchanged |
| 27 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/415deb6315a5-NYoaDuYcEzpOmhRE.JPG` | 1200 × 1600 | jpeg | 230 828 | 230 828 | 0 | unchanged |
| 28 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg` | 1200 × 683 | jpeg | 151 110 | 151 110 | 0 | unchanged |
| 29 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/43aa6a138c7a-vMZdQbHoxLvCLaHZ.jpg` | 1280 × 720 | jpeg | 67 138 | 67 138 | 0 | unchanged |
| 30 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4421e2915127-MHSQScqFnuIJSihl.png` | 1548 × 2048 | png | 3 375 330 | 1 585 992 | 1 789 338 | pixel-identical |
| 31 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4754542d454e-ioZaSTACsHELFmfu.PNG` | 599 × 450 | png | 132 398 | 132 398 | 0 | unchanged |
| 32 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg` | 1200 × 840 | jpeg | 159 734 | 159 734 | 0 | unchanged |
| 33 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4f6a6814aa8b-mTIjouFpTLtMeseC.png` | 1542 × 2048 | png | 4 879 389 | 2 463 156 | 2 416 233 | pixel-identical |
| 34 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/50e90f364a43-MrKdMmoQWEKpOoxG.png` | 1424 × 2048 | png | 2 458 032 | 1 255 304 | 1 202 728 | pixel-identical |
| 35 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg` | 1280 × 720 | jpeg | 53 664 | 53 664 | 0 | unchanged |
| 36 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/549a6bdf3cb0-aeHHNBoBXpIdgjhp.jpeg` | 1200 × 420 | jpeg | 95 796 | 95 796 | 0 | unchanged |
| 37 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5874785062ca-rlHYzkmmypyaASly.JPG` | 1200 × 1600 | jpeg | 228 030 | 228 030 | 0 | unchanged |
| 38 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/597ab82580a0-GDVbsOSXBYgogKWH.jpg` | 640 × 360 | jpeg | 38 914 | 38 914 | 0 | unchanged |
| 39 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5bd115dd81db-DrBdxQHzlzuekkDZ.JPG` | 1200 × 900 | jpeg | 192 514 | 192 514 | 0 | unchanged |
| 40 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5c000c389c50-FumaYiYPevouyHwe.webp` | 900 × 658 | webp | 154 140 | 154 140 | 0 | unchanged |
| 41 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5e5fd301a85f-RUzAPGZKMyJeBjUr.JPG` | 1200 × 1600 | jpeg | 321 986 | 321 986 | 0 | unchanged |
| 42 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/61940224ff85-PbhSAqAqJmSvelQW.webp` | 900 × 1191 | webp | 240 186 | 240 186 | 0 | unchanged |
| 43 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/6ac128a122fc-aEjJLmnJbZuksHiz.jpg` | 640 × 360 | jpeg | 47 154 | 47 154 | 0 | unchanged |
| 44 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7362db96b0a1-JGyvReRkTzKEFEru.png` | 2048 × 1024 | png | 985 872 | 461 998 | 523 874 | pixel-identical |
| 45 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/75d234e719e4-qRZzKsNlaPRjMabP.png` | 2048 × 634 | png | 547 034 | 254 968 | 292 066 | pixel-identical |
| 46 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/76751795802b-cvPWAEJjkmXMKPjM.webp` | 900 × 720 | webp | 31 812 | 31 812 | 0 | unchanged |
| 47 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/77be05fab34c-HWbDueWsSqSewhtK.png` | 2048 × 688 | png | 580 150 | 268 864 | 311 286 | pixel-identical |
| 48 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/78b61d3f13ad-ecZVWefzXRwRboPv.webp` | 900 × 1081 | webp | 137 524 | 137 524 | 0 | unchanged |
| 49 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7e8f673737d1-bGwFUQjrxWpTxAMM.jpg` | 640 × 360 | jpeg | 37 140 | 37 140 | 0 | unchanged |
| 50 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/80167c1dcc6f-vSlkTezTOrkVQWvB.png` | 2048 × 930 | png | 570 150 | 257 292 | 312 858 | pixel-identical |
| 51 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8283ecb861ab-BSgzKdVEmubRcHjZ.jpg` | 640 × 360 | jpeg | 37 792 | 37 792 | 0 | unchanged |
| 52 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/851b9291eba1-lcDkOhuXxsYEaquQ.JPG` | 1200 × 900 | jpeg | 201 060 | 201 060 | 0 | unchanged |
| 53 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/877a6c2a49ef-JZjLEpuxmhqHszUD.jpg` | 1200 × 801 | jpeg | 109 648 | 109 648 | 0 | unchanged |
| 54 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8b44a02c41d1-avIlcuIRwQPHiWEZ.webp` | 564 × 599 | webp | 78 858 | 78 858 | 0 | unchanged |
| 55 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8cd6e38feb2b-GEblEVfYOlTMcdZL.webp` | 640 × 640 | webp | 53 176 | 53 176 | 0 | unchanged |
| 56 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8d13aefa8185-IZEbDdSSzwHYlZJi.png` | 2048 × 1098 | png | 2 913 169 | 1 417 030 | 1 496 139 | pixel-identical |
| 57 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e13a3ec38f0-KFvjVaUAsIOcwZxo.png` | 2048 × 1126 | png | 3 458 214 | 1 695 212 | 1 763 002 | pixel-identical |
| 58 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e2caea5d436-dVirjqOQtEhpIeZq.JPG` | 1200 × 900 | jpeg | 144 956 | 144 956 | 0 | unchanged |
| 59 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/90e0ee86a4ff-kMJdEKDrnBTzTyzP.JPG` | 1200 × 1600 | jpeg | 196 048 | 196 048 | 0 | unchanged |
| 60 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/925076516046-CkdCchNXtpJkPNVd.JPG` | 1200 × 2133 | jpeg | 190 288 | 190 288 | 0 | unchanged |
| 61 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/94b5bebfd7f4-IbTlGDtcIAJBcJAR.webp` | 900 × 720 | webp | 74 524 | 74 524 | 0 | unchanged |
| 62 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9503c81d3711-gFvZsxUUAlJFJQPJ.JPG` | 1200 × 1600 | jpeg | 225 050 | 225 050 | 0 | unchanged |
| 63 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/958b97c139fc-kvcsayGSgtVcnjGN.jpg` | 1200 × 1484 | jpeg | 150 186 | 150 186 | 0 | unchanged |
| 64 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/98ab8fafc475-UumiPOEfgzXJXOMx.webp` | 900 × 720 | webp | 30 730 | 30 730 | 0 | unchanged |
| 65 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9b32f7b0c8f1-ReabYqEbymjBrDEY.jpg` | 1200 × 1481 | jpeg | 162 782 | 162 782 | 0 | unchanged |
| 66 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9e3aec1f0a5d-PUMBhecZrXmmctyT.jpg` | 1000 × 563 | jpeg | 112 926 | 112 926 | 0 | unchanged |
| 67 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a1a591be13aa-AZYAKPGUhWakANOo.png` | 2048 × 726 | png | 619 379 | 283 954 | 335 425 | pixel-identical |
| 68 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a3c7d398b304-zLXMNrsxvYbFxTGr.JPG` | 1200 × 900 | jpeg | 120 122 | 120 122 | 0 | unchanged |
| 69 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a408a8ab4bfb-zvCnxlYvTeWzjTKf.JPG` | 1200 × 900 | jpeg | 163 125 | 163 125 | 0 | unchanged |
| 70 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a7444048ce43-IYxPwzEBGGVfKrLw.JPG` | 1200 × 1600 | jpeg | 232 951 | 232 951 | 0 | unchanged |
| 71 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a8a92a28eba4-xndzkbTFXAjrqEdW.JPG` | 1200 × 1600 | jpeg | 234 764 | 234 764 | 0 | unchanged |
| 72 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b010b81b5866-rvMvDhDknWfcKisy.webp` | 900 × 720 | webp | 93 278 | 93 278 | 0 | unchanged |
| 73 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b0256e249003-fTvlKJxwwRXhliWp.png` | 2048 × 1704 | png | 1 157 690 | 531 604 | 626 086 | pixel-identical |
| 74 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b111512afc6d-DIvPBhtemQFssInq.JPG` | 1200 × 1600 | jpeg | 263 135 | 263 135 | 0 | unchanged |
| 75 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b573a5cea177-nNMSLpNDmzQdnfqe.webp` | 900 × 720 | webp | 50 474 | 50 474 | 0 | unchanged |
| 76 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b8106c44719f-tlMfbAYBCxFjOQfm.webp` | 900 × 720 | webp | 58 642 | 58 642 | 0 | unchanged |
| 77 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/bd8ad8ec3381-qnhLMhhMFwJPLflj.JPG` | 1200 × 1600 | jpeg | 173 348 | 173 348 | 0 | unchanged |
| 78 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/be172f0dd15b-FfermcbrvIjJZXGz.JPG` | 1200 × 900 | jpeg | 163 722 | 163 722 | 0 | unchanged |
| 79 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c1fc2e32d868-jpAnnXDosARxcyid.JPG` | 1200 × 1600 | jpeg | 200 059 | 200 059 | 0 | unchanged |
| 80 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c2a4341558e8-dZtWbRtaJLWFOYGX.webp` | 1400 × 1050 | webp | 245 170 | 245 170 | 0 | unchanged |
| 81 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c666fd8041cd-gMlxhhnFvlmwZewA.JPG` | 1200 × 900 | jpeg | 121 661 | 121 661 | 0 | unchanged |
| 82 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/cc53a49e1416-qxGDcExHmMNZuoWc.jpg` | 640 × 360 | jpeg | 38 110 | 38 110 | 0 | unchanged |
| 83 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ce515dd1f602-yLEBPmBjoZXimIfm.webp` | 900 × 1200 | webp | 106 010 | 106 010 | 0 | unchanged |
| 84 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg` | 1440 × 2560 | jpeg | 234 795 | 234 795 | 0 | unchanged |
| 85 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d2e7c03c6f36-CAbMTXzGTiRynQvA.jpeg` | 1200 × 1598 | jpeg | 243 534 | 243 534 | 0 | unchanged |
| 86 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d41da8bb49e5-qtTdhxTQTceQjglS.jpeg` | 1200 × 1598 | jpeg | 297 400 | 297 400 | 0 | unchanged |
| 87 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4c9b66fca3b-SRsjwrPhBzgdUgKP.png` | 1532 × 2048 | png | 3 402 733 | 1 712 298 | 1 690 435 | pixel-identical |
| 88 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4e9a2f83368-DFKxWfbFBBqVrKyK.JPG` | 1200 × 900 | jpeg | 169 390 | 169 390 | 0 | unchanged |
| 89 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7c6da7c51eb-ajKAgiYmRhdfjrvA.png` | 2048 × 1992 | png | 1 281 075 | 584 930 | 696 145 | pixel-identical |
| 90 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7d902b3580b-ibiaXiTZueqqzkwU.png` | 1548 × 2048 | png | 3 767 491 | 1 930 244 | 1 837 247 | pixel-identical |
| 91 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/de1723199afb-UbAVGWtYciEmYaOm.JPG` | 1200 × 900 | jpeg | 135 384 | 135 384 | 0 | unchanged |
| 92 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ded750bddbeb-HSvrSZijpbSHOLAN.jpg` | 1200 × 1487 | jpeg | 150 132 | 150 132 | 0 | unchanged |
| 93 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e197a59fb5c3-qFGLTXCnSORlpLhB.webp` | 900 × 720 | webp | 34 868 | 34 868 | 0 | unchanged |
| 94 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e51b2ade0a13-NIyDYATUAoJPZeaz.JPG` | 1200 × 1600 | jpeg | 243 496 | 243 496 | 0 | unchanged |
| 95 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e5fae384392a-ZOLblRiqaXdykwDW.JPG` | 1200 × 900 | jpeg | 140 320 | 140 320 | 0 | unchanged |
| 96 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e8e5386d449f-xGuqHGnxPOYPLwJz.webp` | 900 × 1200 | webp | 108 480 | 108 480 | 0 | unchanged |
| 97 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e933a044db55-gMwUitXnrfSEIunK.jpg` | 1280 × 720 | jpeg | 75 070 | 75 070 | 0 | unchanged |
| 98 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ea0b60bea0fe-EhNRvSBlhxWjRXfT.JPG` | 1200 × 1200 | jpeg | 273 549 | 273 549 | 0 | unchanged |
| 99 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ed5c0d6e67b1-XTxEeqUQaizDpkGL.jpg` | 1021 × 3118 | jpeg | 469 068 | 469 068 | 0 | unchanged |
| 100 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f6dc8eaf6752-ilmNGaCKWJLSYlVp.jpg` | 1280 × 720 | jpeg | 85 849 | 85 849 | 0 | unchanged |
| 101 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f74380dbb7e5-LhJhOevOxDNnKdkT.webp` | 837 × 1300 | webp | 254 276 | 254 276 | 0 | unchanged |
| 102 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f77e4cc67d62-hpkSyBEErrnqiTvh.JPG` | 1200 × 900 | jpeg | 135 907 | 135 907 | 0 | unchanged |
| 103 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f8a919017d4c-WDRmWxjeWyXWNrto.webp` | 900 × 1955 | webp | 134 538 | 134 538 | 0 | unchanged |
| 104 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fa733b106dca-sASvqozNGkUbZQiV.JPG` | 1200 × 1600 | jpeg | 209 021 | 209 021 | 0 | unchanged |
| 105 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fd2a40d2d655-odfxOAxwqkixLoZd.jpeg` | 1200 × 1598 | jpeg | 181 780 | 181 780 | 0 | unchanged |
| 106 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fe7dfc66e8d6-AUsXwEtMBYRSiNAN.JPG` | 1200 × 1600 | jpeg | 230 361 | 230 361 | 0 | unchanged |
| 107 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ff49f6ba1a27-NdnEHWCbQbNuKmyB.JPG` | 1199 × 900 | jpeg | 264 759 | 264 759 | 0 | unchanged |
| 108 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aaDcJuCLOeCrHfxk.JPG` | 1200 × 1500 | jpeg | 150 128 | 150 128 | 0 | unchanged |
| 109 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aNIPzDLqCSCRrrKT.JPG` | 1200 × 1500 | jpeg | 187 701 | 187 701 | 0 | unchanged |
| 110 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/cover.webp` | 900 × 1162 | webp | 179 070 | 179 070 | 0 | unchanged |
| 111 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6125.jpg` | 819 × 1024 | jpeg | 138 164 | 138 164 | 0 | unchanged |
| 112 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6126.jpg` | 819 × 1024 | jpeg | 113 731 | 113 731 | 0 | unchanged |
| 113 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6127.jpg` | 819 × 1024 | jpeg | 106 271 | 106 271 | 0 | unchanged |
| 114 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6128.jpg` | 819 × 1024 | jpeg | 118 715 | 118 715 | 0 | unchanged |
| 115 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6129.jpg` | 819 × 1024 | jpeg | 85 489 | 85 489 | 0 | unchanged |
| 116 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6130.jpg` | 819 × 1024 | jpeg | 90 078 | 90 078 | 0 | unchanged |
| 117 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6131.jpg` | 819 × 1024 | jpeg | 95 715 | 95 715 | 0 | unchanged |
| 118 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6132.jpg` | 819 × 1024 | jpeg | 87 399 | 87 399 | 0 | unchanged |
| 119 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6133.jpg` | 819 × 1024 | jpeg | 133 905 | 133 905 | 0 | unchanged |
| 120 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/autumn.jpg` | 599 × 749 | jpeg | 84 129 | 84 129 | 0 | unchanged |
| 121 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover-shelf.jpg` | 461 × 576 | jpeg | 59 081 | 59 081 | 0 | unchanged |
| 122 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover.webp` | 900 × 1072 | webp | 220 828 | 220 828 | 0 | unchanged |
| 123 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/crafts.jpg` | 599 × 749 | jpeg | 90 871 | 90 871 | 0 | unchanged |
| 124 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/toc.jpg` | 767 × 959 | jpeg | 115 599 | 115 599 | 0 | unchanged |
| 125 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-desk.jpg` | 768 × 960 | jpeg | 99 480 | 99 480 | 0 | unchanged |
| 126 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-open.jpg` | 768 × 960 | jpeg | 94 729 | 94 729 | 0 | unchanged |
| 127 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover-shelf.jpg` | 768 × 960 | jpeg | 93 437 | 93 437 | 0 | unchanged |
| 128 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover.webp` | 900 × 1186 | webp | 235 408 | 235 408 | 0 | unchanged |
| 129 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-clothes.jpg` | 768 × 960 | jpeg | 75 128 | 75 128 | 0 | unchanged |
| 130 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-life.jpg` | 779 × 974 | jpeg | 114 264 | 114 264 | 0 | unchanged |
| 131 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-makeover.jpg` | 782 × 978 | jpeg | 118 033 | 118 033 | 0 | unchanged |
| 132 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-pokoy.jpg` | 768 × 960 | jpeg | 86 495 | 86 495 | 0 | unchanged |
| 133 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-wardrobe.jpg` | 774 × 968 | jpeg | 99 201 | 99 201 | 0 | unchanged |
| 134 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/toc.jpg` | 779 × 974 | jpeg | 85 109 | 85 109 | 0 | unchanged |
| 135 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/bqfYlZTjwUTYkjTU.JPG` | 1200 × 1500 | jpeg | 152 939 | 152 939 | 0 | unchanged |
| 136 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/duefjXzIoLGcxdSk.JPG` | 1200 × 1500 | jpeg | 248 802 | 248 802 | 0 | unchanged |
| 137 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/eWHYEgFyQkkTVIac.webp` | 900 × 720 | webp | 50 474 | 50 474 | 0 | unchanged |
| 138 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/fHBiLIdoOBjhvOYB.JPG` | 1200 × 1500 | jpeg | 185 160 | 185 160 | 0 | unchanged |
| 139 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/GyoFVkxRZaWzdOws.JPG` | 1200 × 1500 | jpeg | 258 174 | 258 174 | 0 | unchanged |
| 140 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/KmoncPQbMmceOtFu.jpeg` | 1200 × 1501 | jpeg | 216 616 | 216 616 | 0 | unchanged |
| 141 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/luiZwEIyLvSFPdXH.JPG` | 1200 × 1500 | jpeg | 137 850 | 137 850 | 0 | unchanged |
| 142 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/mltnKcpNhCFwXkYN.JPG` | 1200 × 1600 | jpeg | 248 952 | 248 952 | 0 | unchanged |
| 143 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/moLPhaYtFBzPVhrp.jpeg` | 1200 × 1501 | jpeg | 137 464 | 137 464 | 0 | unchanged |
| 144 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/nZoznAbRePJnvALl.JPG` | 1200 × 1500 | jpeg | 168 023 | 168 023 | 0 | unchanged |
| 145 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/OpGQZMvzgVXxbwhN.jpeg` | 1200 × 1501 | jpeg | 167 403 | 167 403 | 0 | unchanged |
| 146 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/PBfYGmrZAiWpzHvD.JPG` | 1200 × 1500 | jpeg | 130 780 | 130 780 | 0 | unchanged |
| 147 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/SposdtLMcZWpTsyM.JPG` | 1200 × 1500 | jpeg | 326 777 | 326 777 | 0 | unchanged |
| 148 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/vjdQHvFhVxKjVyWq.webp` | 900 × 720 | webp | 31 812 | 31 812 | 0 | unchanged |
| 149 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/VTdmWRaePLfvfgrq.JPG` | 1200 × 1500 | jpeg | 162 849 | 162 849 | 0 | unchanged |
| 150 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/xGKrarMYfeycHdkb.JPG` | 1200 × 1500 | jpeg | 211 965 | 211 965 | 0 | unchanged |
| 151 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/videos/film-strip.webp` | 1200 × 1200 | webp | 60 092 | 60 092 | 0 | unchanged |
| 152 | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/videos/rose-hip-branches.webp` | 800 × 902 | webp | 116 852 | 116 852 | 0 | unchanged |

## Контрольные суммы и сведения по каждому файлу

Подробности включают все поля исходного отчёта. Отсутствующие поля не добавляются; адреса старых результатов приведены как исторические значения.

<details>
<summary>1. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/cloudfront/afae02aa817a-shelf-label-frame-wide-iUo6pePUPBamyiM9D5NVtE.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/cloudfront/afae02aa817a-shelf-label-frame-wide-iUo6pePUPBamyiM9D5NVtE.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"37137e2a4108ab18e26a0759b137ba62"` |
| Скачивание, мс | 728 |
| Время получения, UTC | `2026-10-06T13:12:21.438Z` |
| До оптимизации, байт | 196004 |
| После оптимизации, байт | 196004 |
| Ширина, px | 1200 |
| Высота, px | 514 |
| Формат | `webp` |
| SHA256 оригинала | `30582a18c6fb5baddba9cd4e64232bafc05ab36f3304b831e97f4f6d279d8b0b` |
| Статус | `unchanged` |

</details>

<details>
<summary>2. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/feed/banner-shelf-v2.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/feed/banner-shelf-v2.jpg` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"241e322ddba1e0ada2317dd7981f063e"` |
| Скачивание, мс | 542 |
| Время получения, UTC | `2026-10-06T13:12:21.313Z` |
| До оптимизации, байт | 67344 |
| После оптимизации, байт | 67344 |
| Ширина, px | 1024 |
| Высота, px | 183 |
| Формат | `jpeg` |
| SHA256 оригинала | `e6fad4d6b7c29e4841a0043ed1e1284c4944ba53bf7b22c01e7da5f75a7dc472` |
| Статус | `unchanged` |

</details>

<details>
<summary>3. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/home/secret-garden-poster.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/home/secret-garden-poster.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"c8497b1fd90cdf4ab98b8f115efc580e"` |
| Скачивание, мс | 603 |
| Время получения, UTC | `2026-10-06T13:12:21.376Z` |
| До оптимизации, байт | 134310 |
| После оптимизации, байт | 134310 |
| Ширина, px | 900 |
| Высота, px | 599 |
| Формат | `webp` |
| SHA256 оригинала | `c866cb81ef432ea30d414d251206092116d60fd25aa4b24196bada2f65e6a86d` |
| Статус | `unchanged` |

</details>

<details>
<summary>4. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/library/loshadka-cover.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/library/loshadka-cover.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"97003efa8ed4b9c1cd35ed73b966463a"` |
| Скачивание, мс | 447 |
| Время получения, UTC | `2026-10-06T13:12:21.782Z` |
| До оптимизации, байт | 191088 |
| После оптимизации, байт | 191088 |
| Ширина, px | 1176 |
| Высота, px | 1628 |
| Формат | `jpeg` |
| SHA256 оригинала | `457f881cc9263dc1e6823023ef96325a92de7d73653d2024e9f316380b7d4cd5` |
| Статус | `unchanged` |

</details>

<details>
<summary>5. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/011254ea51fb-iXlFvAzqcTIXBklq.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/011254ea51fb-iXlFvAzqcTIXBklq.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"275044c100b11cf60d22e2b20ef683d8"` |
| Скачивание, мс | 367 |
| Время получения, UTC | `2026-10-06T13:12:22.269Z` |
| До оптимизации, байт | 118306 |
| После оптимизации, байт | 118306 |
| Ширина, px | 299 |
| Высота, px | 208 |
| Формат | `png` |
| SHA256 оригинала | `249a4ec2224b6c8390c0f3b4ee7951a2fd11d891299629c499518d1e16b2ef8b` |
| Статус | `unchanged` |

</details>

<details>
<summary>6. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/01ac0596761e-CpXcSOXRRuKDFbNs.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/01ac0596761e-CpXcSOXRRuKDFbNs.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"55c1a8d6800a97e43188f0e08c9e14e2"` |
| Скачивание, мс | 1320 |
| Время получения, UTC | `2026-10-06T13:12:23.702Z` |
| До оптимизации, байт | 1058006 |
| После оптимизации, байт | 476792 |
| Ширина, px | 2048 |
| Высота, px | 1890 |
| Формат | `png` |
| SHA256 оригинала | `d80011e1225bf57842126fcd8741c1ab103ffa5999c5ad39a73aa926734b82cc` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/01ac0596761e-CpXcSOXRRuKDFbNs.1b7392d86b828ee3.webp` |
| SHA256 результата | `1b7392d86b828ee33b1ebaf9341ef5ccb24d22124cb2128382cbfe270c0bcf01` |
| SHA256 декодированных пикселей | `ca1ec5fb7d5282275ee2ee1421b1176111d774bd88e433121dc7121b7f2dd180` |

</details>

<details>
<summary>7. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/02ac70f42cc6-RleAncWBrOTmRsWP.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/02ac70f42cc6-RleAncWBrOTmRsWP.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"d87e5a97aee53a0341b48518d83ba6b2"` |
| Скачивание, мс | 415 |
| Время получения, UTC | `2026-10-06T13:12:23.051Z` |
| До оптимизации, байт | 222282 |
| После оптимизации, байт | 222282 |
| Ширина, px | 900 |
| Высота, px | 1074 |
| Формат | `webp` |
| SHA256 оригинала | `ca9267a9e3eb34cdde45e1186987ab7dbeb2f61f969508b4c07ac9bb24798040` |
| Статус | `unchanged` |

</details>

<details>
<summary>8. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0479fc01d16a-MSbIPSMMSqmZweYd.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0479fc01d16a-MSbIPSMMSqmZweYd.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"18612685c5a177ccaa28b0ef2be45390"` |
| Скачивание, мс | 4415 |
| Время получения, UTC | `2026-10-06T13:12:27.242Z` |
| До оптимизации, байт | 2942145 |
| После оптимизации, байт | 1467328 |
| Ширина, px | 2048 |
| Высота, px | 1098 |
| Формат | `png` |
| SHA256 оригинала | `5785e4ea4a4edd8988c4d6d6ccdd2acdb1f9b529f8841b1f199f001461a5fbdf` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/0479fc01d16a-MSbIPSMMSqmZweYd.91a6c94401c3acef.webp` |
| SHA256 результата | `91a6c94401c3acefcbaf3f3e1fcb259a173bf016ca7876927619da9d8042987a` |
| SHA256 декодированных пикселей | `67ca1ed565a9466c32603ca0c42ba60ba6cad906ee49774b19a7787414bbd6d8` |

</details>

<details>
<summary>9. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/049e3831441b-iirWKYJcvPUnEdXs.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/049e3831441b-iirWKYJcvPUnEdXs.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"85446f893b9a3182883c3551b8341937"` |
| Скачивание, мс | 199 |
| Время получения, UTC | `2026-10-06T13:12:25.697Z` |
| До оптимизации, байт | 47544 |
| После оптимизации, байт | 47544 |
| Ширина, px | 900 |
| Высота, px | 900 |
| Формат | `webp` |
| SHA256 оригинала | `edd13b8369b9091a04d9c316584e886e7ec52fdf1760fd474dfb620a48ea44d7` |
| Статус | `unchanged` |

</details>

<details>
<summary>10. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0c95d509c862-oewXdFleqUUvImKT.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0c95d509c862-oewXdFleqUUvImKT.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"4e4487d8a62a71d946433404471166af"` |
| Скачивание, мс | 719 |
| Время получения, UTC | `2026-10-06T13:12:27.829Z` |
| До оптимизации, байт | 550759 |
| После оптимизации, байт | 251206 |
| Ширина, px | 2048 |
| Высота, px | 884 |
| Формат | `png` |
| SHA256 оригинала | `2bd04df34d020d174fa511a002a641e9707c68ce2737fb39f14916a5a5b4c7ef` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/0c95d509c862-oewXdFleqUUvImKT.e0a5505d12956c0c.webp` |
| SHA256 результата | `e0a5505d12956c0c4cfe975b217990bf18bd7bbf87a8e37660fcff8837858cf8` |
| SHA256 декодированных пикселей | `dc96e452cc62eee8dc03eb0b1c1b0a3111c70cff895f260c07b2378a92b36c10` |

</details>

<details>
<summary>11. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0f57f1bbff1b-ZJsYljHDvCbRNMgf.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0f57f1bbff1b-ZJsYljHDvCbRNMgf.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"205a62cf71d44c1d4b3e512fcb39f856"` |
| Скачивание, мс | 927 |
| Время получения, UTC | `2026-10-06T13:12:28.147Z` |
| До оптимизации, байт | 281359 |
| После оптимизации, байт | 281359 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `e59f3cfb0c7e7509926d8d1cc868b72b9640fc2470c2a036f2ab17c85caa9b7f` |
| Статус | `unchanged` |

</details>

<details>
<summary>12. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"652be0efc7363b15d59bb77a5ef7c6ea"` |
| Скачивание, мс | 230 |
| Время получения, UTC | `2026-10-06T13:12:28.491Z` |
| До оптимизации, байт | 80942 |
| После оптимизации, байт | 80942 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `d7c8b288aeb9bebb446f76fe34a640ddaa1dff028bfe949dd5284b7f8d82aaa4` |
| Статус | `unchanged` |

</details>

<details>
<summary>13. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/18c14e47537e-EJllmcoOmdUexPyK.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/18c14e47537e-EJllmcoOmdUexPyK.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"afad09f2c4f50c48d9cee78dd418e811"` |
| Скачивание, мс | 359 |
| Время получения, UTC | `2026-10-06T13:12:30.210Z` |
| До оптимизации, байт | 151829 |
| После оптимизации, байт | 151829 |
| Ширина, px | 1200 |
| Высота, px | 1470 |
| Формат | `jpeg` |
| SHA256 оригинала | `b418b1ee748ba069e838f36fbac1abc0d1b21b5953695351ae34646cf94aa8f8` |
| Статус | `unchanged` |

</details>

<details>
<summary>14. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1a03ee114023-cCbdKIZtJmsSzKzg.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1a03ee114023-cCbdKIZtJmsSzKzg.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"480a589ebda5ffaaa00749df29eb5bf6"` |
| Скачивание, мс | 1200 |
| Время получения, UTC | `2026-10-06T13:12:31.306Z` |
| До оптимизации, байт | 827993 |
| После оптимизации, байт | 393896 |
| Ширина, px | 2048 |
| Высота, px | 1172 |
| Формат | `png` |
| SHA256 оригинала | `abfeaefd8cad01181c37f723ea1aa1da72239ca60ef244fac59362ee8e61bf17` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/1a03ee114023-cCbdKIZtJmsSzKzg.8ae21b79a1ff1417.webp` |
| SHA256 результата | `8ae21b79a1ff14176b6496df55040a4ba1de543df310794a23dc0fab5c1fea3f` |
| SHA256 декодированных пикселей | `839a27c42718f6e5c2ad27c341e512d9c460c93290d236dc73fcc05148c67967` |

</details>

<details>
<summary>15. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1d28efefb09b-mlHctAbwrdujnkAl.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1d28efefb09b-mlHctAbwrdujnkAl.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"214700238c25d9fe2b495375089d46c7"` |
| Скачивание, мс | 4735 |
| Время получения, UTC | `2026-10-06T13:12:35.037Z` |
| До оптимизации, байт | 2454432 |
| После оптимизации, байт | 1103706 |
| Ширина, px | 2048 |
| Высота, px | 1526 |
| Формат | `png` |
| SHA256 оригинала | `3cb2f1369adfa5583cb0b2f6d7db48132b63ed7bad09da8029b6176748bdb80c` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/1d28efefb09b-mlHctAbwrdujnkAl.adf31d0036b59f75.webp` |
| SHA256 результата | `adf31d0036b59f75b8647335f3f5df1f9f62d030a4dcb069cf7be00934cbff63` |
| SHA256 декодированных пикселей | `8c3f4738327ed0fb2500925935946142f6d3018565590bbc5d15a38bf22a9336` |

</details>

<details>
<summary>16. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbca647058b-LvxZFiaBWuJSsIgj.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"5ae84857b46996f6aeb542f6db80c0d5"` |
| Скачивание, мс | 504 |
| Время получения, UTC | `2026-10-06T13:12:31.496Z` |
| До оптимизации, байт | 235003 |
| После оптимизации, байт | 235003 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `2f55ac51fddc10db95e3c5342f259faefb0e5493844738b8371c449af86453c4` |
| Статус | `unchanged` |

</details>

<details>
<summary>17. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbdc4edd1f6-WglvBAnfwHsodSFE.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fbdc4edd1f6-WglvBAnfwHsodSFE.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"9b9d0ecd2ef2553319beb42014430d44"` |
| Скачивание, мс | 91 |
| Время получения, UTC | `2026-10-06T13:12:31.698Z` |
| До оптимизации, байт | 36790 |
| После оптимизации, байт | 36790 |
| Ширина, px | 864 |
| Высота, px | 896 |
| Формат | `webp` |
| SHA256 оригинала | `266828b41b91d03d831c635d86198a29383df813b9a1952f0fad834583f4f04f` |
| Статус | `unchanged` |

</details>

<details>
<summary>18. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fdd58674349-hbukoToSZXIzQKHV.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1fdd58674349-hbukoToSZXIzQKHV.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"1637147aba327f872b4050f74d8a59c1"` |
| Скачивание, мс | 442 |
| Время получения, UTC | `2026-10-06T13:12:33.235Z` |
| До оптимизации, байт | 294663 |
| После оптимизации, байт | 294663 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `d5f07497ba15f72360f7268973bd15361a349c238c222fccfa0a74ae0c4eda38` |
| Статус | `unchanged` |

</details>

<details>
<summary>19. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/234b0e0452ba-vVFccXYZXhHdnGCR.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/234b0e0452ba-vVFccXYZXhHdnGCR.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"ec1c3a391a286ca48d8efd5f4ce939ab"` |
| Скачивание, мс | 5086 |
| Время получения, UTC | `2026-10-06T13:12:38.453Z` |
| До оптимизации, байт | 3501174 |
| После оптимизации, байт | 1806750 |
| Ширина, px | 2048 |
| Высота, px | 1508 |
| Формат | `png` |
| SHA256 оригинала | `7155a68c9d7929f9d7ab3fc1ee7816025416bb55428cc48428677cf76f4f63d0` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/234b0e0452ba-vVFccXYZXhHdnGCR.308166586d5dd55c.webp` |
| SHA256 результата | `308166586d5dd55cb0d8042baf5e1ddedeec5218db631b6c4d6c0c39cf2d5b22` |
| SHA256 декодированных пикселей | `7ff0e3e794a4bc235a1e00f10f1507799bc6c40e1595a1fb3cbd4e02ae973821` |

</details>

<details>
<summary>20. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/248794a7bd51-TGjGBKCtCDaiNEGA.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/248794a7bd51-TGjGBKCtCDaiNEGA.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"053f8d7de23293c5af935c31c50f2f81"` |
| Скачивание, мс | 5665 |
| Время получения, UTC | `2026-10-06T13:12:39.352Z` |
| До оптимизации, байт | 3458358 |
| После оптимизации, байт | 1662340 |
| Ширина, px | 1542 |
| Высота, px | 2048 |
| Формат | `png` |
| SHA256 оригинала | `4c5e1b7f280c2b6838bc9d42eb089b1810f51ae97c6b2c5fdec96bc79ff27476` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/248794a7bd51-TGjGBKCtCDaiNEGA.2e4d28bf4138fc4b.webp` |
| SHA256 результата | `2e4d28bf4138fc4b42ab61b1309e98fd3be7e10adcdfcd4598a5b0a71cff5d45` |
| SHA256 декодированных пикселей | `4a56d1ec4fb66d872da1fccc7c60d59e2524bd1b15b9eb1e556c9e55b71f900d` |

</details>

<details>
<summary>21. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/24c37be76c6e-lURmCnSESVWSORUh.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/24c37be76c6e-lURmCnSESVWSORUh.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"4ebbc2912ff8cbc25b9b1c453ec2c287"` |
| Скачивание, мс | 391 |
| Время получения, UTC | `2026-10-06T13:12:39.083Z` |
| До оптимизации, байт | 194642 |
| После оптимизации, байт | 194642 |
| Ширина, px | 900 |
| Высота, px | 1168 |
| Формат | `webp` |
| SHA256 оригинала | `3b96fc038e6de538f60c5724e76566504d8d46bee06bffd0fa4a8274a65f24f9` |
| Статус | `unchanged` |

</details>

<details>
<summary>22. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/250423a7ec62-uyAaCmBzfqhlMwpt.PNG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/250423a7ec62-uyAaCmBzfqhlMwpt.PNG` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"34a1ef803b1a3fa7ae87d5e72ffca42b"` |
| Скачивание, мс | 9673 |
| Время получения, UTC | `2026-10-06T13:28:57.533Z` |
| До оптимизации, байт | 7838275 |
| После оптимизации, байт | 6995024 |
| Ширина, px | 1320 |
| Высота, px | 2868 |
| Формат | `png` |
| SHA256 оригинала | `2b37450dc13254199468cec95c03a0379990ae383e655e8e06ab724a5097e211` |
| Статус | `pixel-identical` |
| Бит на канал | 16 |
| Исходная разрядность отсчётов сохранена | Да |
| Результирующий адрес | `/assets/optimized/250423a7ec62-uyAaCmBzfqhlMwpt.6f621a1a7abd30cd.png` |
| SHA256 результата | `6f621a1a7abd30cd909318aeb8c0a0f1b052943afeacc6d8aa6783b8a99ca20c` |
| SHA256 декодированных пикселей | `5588f953983c314fa4796011f254716b591d6971d8032132eb518af689be5946` |

</details>

<details>
<summary>23. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/2c8069c13604-UBeEtDCkYYkHKSKN.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/2c8069c13604-UBeEtDCkYYkHKSKN.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"e97480f03064b508b86021bd0891ffcc"` |
| Скачивание, мс | 2018 |
| Время получения, UTC | `2026-10-06T13:28:51.396Z` |
| До оптимизации, байт | 4234825 |
| После оптимизации, байт | 2067746 |
| Ширина, px | 2048 |
| Высота, px | 1490 |
| Формат | `png` |
| SHA256 оригинала | `8ee2e6b8096e59d38970eaae5b19325f82e33fbc302b7fbb2edaeb29a3d92cde` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/2c8069c13604-UBeEtDCkYYkHKSKN.8db66df41693a5fb.webp` |
| SHA256 результата | `8db66df41693a5fbea4575d740101de1087aa993e54d1355c7e57fe4825fe151` |
| SHA256 декодированных пикселей | `0d184c6dcba3404e269b938fbe6203358c5c1b49607124fbacd2ba8330f0b9d3` |

</details>

<details>
<summary>24. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/33a4bcfff34a-wmgRUgkBOrSfVIso.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/33a4bcfff34a-wmgRUgkBOrSfVIso.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"2aaa6646d7831d392b6b343a7f4b6219"` |
| Скачивание, мс | 1952 |
| Время получения, UTC | `2026-10-06T13:12:46.717Z` |
| До оптимизации, байт | 281300 |
| После оптимизации, байт | 281300 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `152d787b8e0827173d931e681848fcee3608e31c1326949eeeeef6687c08b3ba` |
| Статус | `unchanged` |

</details>

<details>
<summary>25. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3b8642166933-rdRVzYWvuGEmSUdF.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3b8642166933-rdRVzYWvuGEmSUdF.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"75f693bfe1eb798051b1bf734d31860b"` |
| Скачивание, мс | 1989 |
| Время получения, UTC | `2026-10-06T13:12:48.821Z` |
| До оптимизации, байт | 268417 |
| После оптимизации, байт | 268417 |
| Ширина, px | 1081 |
| Высота, px | 1920 |
| Формат | `jpeg` |
| SHA256 оригинала | `ffe775e1b13881aedb435f1302ecd31e233785bf0b2f067e42d562d79d4b8bfc` |
| Статус | `unchanged` |

</details>

<details>
<summary>26. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3f69fb85d89c-nbShGAsyJAWYwcXH.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/3f69fb85d89c-nbShGAsyJAWYwcXH.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"11580c77cba79979a268acbae6d9461e"` |
| Скачивание, мс | 213 |
| Время получения, UTC | `2026-10-06T13:12:49.139Z` |
| До оптимизации, байт | 36824 |
| После оптимизации, байт | 36824 |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `webp` |
| SHA256 оригинала | `abb89f30ea34c68616ab582f5f418a1fd3cad26980068d780bb73371b9b7f552` |
| Статус | `unchanged` |

</details>

<details>
<summary>27. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/415deb6315a5-NYoaDuYcEzpOmhRE.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/415deb6315a5-NYoaDuYcEzpOmhRE.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"7b2fb20e376e3c8001803ee7e7342a27"` |
| Скачивание, мс | 1633 |
| Время получения, UTC | `2026-10-06T13:12:51.339Z` |
| До оптимизации, байт | 230828 |
| После оптимизации, байт | 230828 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `909c03826cb3b701eade52f858f18c5cb46a2622f753f6d3fab7a6e04ec076d2` |
| Статус | `unchanged` |

</details>

<details>
<summary>28. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4327bffa91b1-TRkGduziKBAAVhso.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"974c45dc62ee9f1c112a822b08111f84"` |
| Скачивание, мс | 1277 |
| Время получения, UTC | `2026-10-06T13:12:52.723Z` |
| До оптимизации, байт | 151110 |
| После оптимизации, байт | 151110 |
| Ширина, px | 1200 |
| Высота, px | 683 |
| Формат | `jpeg` |
| SHA256 оригинала | `7942f7a28be49f80cf78cdef2c6371bb1a9c01146fbf9aeefdec0ad1b07290a4` |
| Статус | `unchanged` |

</details>

<details>
<summary>29. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/43aa6a138c7a-vMZdQbHoxLvCLaHZ.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/43aa6a138c7a-vMZdQbHoxLvCLaHZ.jpg` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"9bcba8726e86aa0cc783143cf99f5606"` |
| Скачивание, мс | 702 |
| Время получения, UTC | `2026-10-06T13:12:53.495Z` |
| До оптимизации, байт | 67138 |
| После оптимизации, байт | 67138 |
| Ширина, px | 1280 |
| Высота, px | 720 |
| Формат | `jpeg` |
| SHA256 оригинала | `04d76ddab61b06167df63527d2e8a23ba2a1041d7de86a07baa875cd4cfa108c` |
| Статус | `unchanged` |

</details>

<details>
<summary>30. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4421e2915127-MHSQScqFnuIJSihl.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4421e2915127-MHSQScqFnuIJSihl.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"c2d284de8c76c10b30e06c69b902c5c2"` |
| Скачивание, мс | 2725 |
| Время получения, UTC | `2026-10-06T13:28:53.651Z` |
| До оптимизации, байт | 3375330 |
| После оптимизации, байт | 1585992 |
| Ширина, px | 1548 |
| Высота, px | 2048 |
| Формат | `png` |
| SHA256 оригинала | `51ae0766d04fc82acff52184d35d8ab660b8a607f0fc986b654084307e6f6aa3` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/4421e2915127-MHSQScqFnuIJSihl.558724889c429649.webp` |
| SHA256 результата | `558724889c429649c77f88cd3961a8512c1c7ec4d0d2c801ff833deaee8bff42` |
| SHA256 декодированных пикселей | `e5065d7f903c6ef257f6e1185c29c6050e9f88b1e32bb7599824b452fd8518a0` |

</details>

<details>
<summary>31. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4754542d454e-ioZaSTACsHELFmfu.PNG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4754542d454e-ioZaSTACsHELFmfu.PNG` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"5e85abb48786619473690ac454873e49"` |
| Скачивание, мс | 58891 |
| Время получения, UTC | `2026-10-06T13:14:50.048Z` |
| До оптимизации, байт | 132398 |
| После оптимизации, байт | 132398 |
| Ширина, px | 599 |
| Высота, px | 450 |
| Формат | `png` |
| SHA256 оригинала | `b1114607d76a05d662e7e5be3cfade0dbbebb247d377986692589c1ca4e253f8` |
| Статус | `unchanged` |

</details>

<details>
<summary>32. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/47ae04f69998-VjKNaGyYogjUkMPQ.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"dab48d0d5f895f8ced63bd719f065734"` |
| Скачивание, мс | 19962 |
| Время получения, UTC | `2026-10-06T13:14:33.171Z` |
| До оптимизации, байт | 159734 |
| После оптимизации, байт | 159734 |
| Ширина, px | 1200 |
| Высота, px | 840 |
| Формат | `jpeg` |
| SHA256 оригинала | `63560d2abc9d2c51269732a142468b48ecf62d41dd91790cbec10ddf7ad20f05` |
| Статус | `unchanged` |

</details>

<details>
<summary>33. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4f6a6814aa8b-mTIjouFpTLtMeseC.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4f6a6814aa8b-mTIjouFpTLtMeseC.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"d4637f8b83d8abfc73c7e52f691c0d5b"` |
| Скачивание, мс | 2221 |
| Время получения, UTC | `2026-10-06T13:28:59.798Z` |
| До оптимизации, байт | 4879389 |
| После оптимизации, байт | 2463156 |
| Ширина, px | 1542 |
| Высота, px | 2048 |
| Формат | `png` |
| SHA256 оригинала | `6d76c707ad66f3887e4eaafc01bd62e03b0742954b21da4585bcde61b3dcda34` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/4f6a6814aa8b-mTIjouFpTLtMeseC.c98753c64cd4c0ef.webp` |
| SHA256 результата | `c98753c64cd4c0ef50ab231e9f8eaa19189a2416afc242f00bee10c1843b697c` |
| SHA256 декодированных пикселей | `1658dd61ea80309f0eee9e01f8f8158436513d191685c3b09f28a16e5de124b3` |

</details>

<details>
<summary>34. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/50e90f364a43-MrKdMmoQWEKpOoxG.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/50e90f364a43-MrKdMmoQWEKpOoxG.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"0c5a045654358e617148c5c477d3e39d"` |
| Скачивание, мс | 2692 |
| Время получения, UTC | `2026-10-06T13:29:00.370Z` |
| До оптимизации, байт | 2458032 |
| После оптимизации, байт | 1255304 |
| Ширина, px | 1424 |
| Высота, px | 2048 |
| Формат | `png` |
| SHA256 оригинала | `5de778de028e045b5e5dd3a966cd9ed4d1d0ccf7eaadb7094c16e00af512e1c2` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/50e90f364a43-MrKdMmoQWEKpOoxG.a3fe5dccca97083d.webp` |
| SHA256 результата | `a3fe5dccca97083df30601ec22bf38f1ddb3b2bee4343832d85e958aa67ecd14` |
| SHA256 декодированных пикселей | `e7ef26408cb0ec636b33e0fc6bafcd0932d2d1b6b8046d61d87a672dd115a1ec` |

</details>

<details>
<summary>35. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/51246f8b81ec-vfwFbFYydFwyNDgc.jpg` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"3e7981638c6f410d486d22bd65f32ffc"` |
| Скачивание, мс | 16005 |
| Время получения, UTC | `2026-10-06T13:15:06.518Z` |
| До оптимизации, байт | 53664 |
| После оптимизации, байт | 53664 |
| Ширина, px | 1280 |
| Высота, px | 720 |
| Формат | `jpeg` |
| SHA256 оригинала | `48ccacfbc42d176d9d7bea4910c174dfc6ea8e1e230b3428fcd92a703f5cac5c` |
| Статус | `unchanged` |

</details>

<details>
<summary>36. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/549a6bdf3cb0-aeHHNBoBXpIdgjhp.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/549a6bdf3cb0-aeHHNBoBXpIdgjhp.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"138477f477306c11058b97853f22c624"` |
| Скачивание, мс | 22181 |
| Время получения, UTC | `2026-10-06T13:15:28.752Z` |
| До оптимизации, байт | 95796 |
| После оптимизации, байт | 95796 |
| Ширина, px | 1200 |
| Высота, px | 420 |
| Формат | `jpeg` |
| SHA256 оригинала | `30bbc5ec57345ccaf10e5b0ff2bec99806347ca2a0a85303434ff6d0bb64ae85` |
| Статус | `unchanged` |

</details>

<details>
<summary>37. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5874785062ca-rlHYzkmmypyaASly.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5874785062ca-rlHYzkmmypyaASly.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"b4dd5595718f6aae30b4f6a3a2cd210f"` |
| Скачивание, мс | 881 |
| Время получения, UTC | `2026-10-06T13:28:59.655Z` |
| До оптимизации, байт | 228030 |
| После оптимизации, байт | 228030 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `2013e1c6f10f506eccbec9710f6983fe86428076667b9e60d04d0231c8910747` |
| Статус | `unchanged` |

</details>

<details>
<summary>38. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/597ab82580a0-GDVbsOSXBYgogKWH.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/597ab82580a0-GDVbsOSXBYgogKWH.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"5483f86f06e9730a91a3fc90e29b6550"` |
| Скачивание, мс | 23096 |
| Время получения, UTC | `2026-10-06T13:16:16.659Z` |
| До оптимизации, байт | 38914 |
| После оптимизации, байт | 38914 |
| Ширина, px | 640 |
| Высота, px | 360 |
| Формат | `jpeg` |
| SHA256 оригинала | `ba28fbfe01bdb50b0675b263ea299921d00d8ded9381e9cb3e9d3ccab86ca617` |
| Статус | `unchanged` |

</details>

<details>
<summary>39. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5bd115dd81db-DrBdxQHzlzuekkDZ.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5bd115dd81db-DrBdxQHzlzuekkDZ.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"0c0336ce70ae7d010625aabb82ac0648"` |
| Скачивание, мс | 112 |
| Время получения, UTC | `2026-10-06T13:28:59.941Z` |
| До оптимизации, байт | 192514 |
| После оптимизации, байт | 192514 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `d0a7681df938fa2697be23229ed08b6054d4c4ae66fe57fc24fbb7e5280db0c3` |
| Статус | `unchanged` |

</details>

<details>
<summary>40. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5c000c389c50-FumaYiYPevouyHwe.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5c000c389c50-FumaYiYPevouyHwe.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"763eea946178b81b22897c929f59387d"` |
| Скачивание, мс | 111 |
| Время получения, UTC | `2026-10-06T13:29:00.147Z` |
| До оптимизации, байт | 154140 |
| После оптимизации, байт | 154140 |
| Ширина, px | 900 |
| Высота, px | 658 |
| Формат | `webp` |
| SHA256 оригинала | `92f63b9289dd9144bdef3416eb005d61af63e6dc3805ac906ba5bd7414466c5d` |
| Статус | `unchanged` |

</details>

<details>
<summary>41. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5e5fd301a85f-RUzAPGZKMyJeBjUr.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/5e5fd301a85f-RUzAPGZKMyJeBjUr.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"e576453a83e27288562b0ada69605c36"` |
| Скачивание, мс | 311 |
| Время получения, UTC | `2026-10-06T13:29:02.266Z` |
| До оптимизации, байт | 321986 |
| После оптимизации, байт | 321986 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `2737ba15fb5a0ab83492f2fd66fc1d7949a6d4c1a80ee50ddf5ec6890966725b` |
| Статус | `unchanged` |

</details>

<details>
<summary>42. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/61940224ff85-PbhSAqAqJmSvelQW.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/61940224ff85-PbhSAqAqJmSvelQW.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"a6dd6364ef58544297ef364e64d38532"` |
| Скачивание, мс | 23546 |
| Время получения, UTC | `2026-10-06T13:17:50.413Z` |
| До оптимизации, байт | 240186 |
| После оптимизации, байт | 240186 |
| Ширина, px | 900 |
| Высота, px | 1191 |
| Формат | `webp` |
| SHA256 оригинала | `895210adb7abaa3fc8b07f98d8b7ca72690b6659792398b18482f42b03b12b11` |
| Статус | `unchanged` |

</details>

<details>
<summary>43. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/6ac128a122fc-aEjJLmnJbZuksHiz.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/6ac128a122fc-aEjJLmnJbZuksHiz.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"3855b7c4dc978f0f081e913f2346ac24"` |
| Скачивание, мс | 13027 |
| Время получения, UTC | `2026-10-06T13:17:46.281Z` |
| До оптимизации, байт | 47154 |
| После оптимизации, байт | 47154 |
| Ширина, px | 640 |
| Высота, px | 360 |
| Формат | `jpeg` |
| SHA256 оригинала | `2f118048a4e6da6d62e9df49eccd7e206e971953016f74c01baf75a3755c96e2` |
| Статус | `unchanged` |

</details>

<details>
<summary>44. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7362db96b0a1-JGyvReRkTzKEFEru.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7362db96b0a1-JGyvReRkTzKEFEru.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"b86b4f2fa0ba386cf1eabd0d2240cfe3"` |
| Скачивание, мс | 594 |
| Время получения, UTC | `2026-10-06T13:29:04.872Z` |
| До оптимизации, байт | 985872 |
| После оптимизации, байт | 461998 |
| Ширина, px | 2048 |
| Высота, px | 1024 |
| Формат | `png` |
| SHA256 оригинала | `127b365b963e6fc8668ef3176d76b1d9c8510a135e5efb850241d4810252817e` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/7362db96b0a1-JGyvReRkTzKEFEru.f7e5c6bb167bbbd9.webp` |
| SHA256 результата | `f7e5c6bb167bbbd970fbf42e07fa3a7642939b75e829c63f3321a65544c7df14` |
| SHA256 декодированных пикселей | `08931f9eed7a1463d8d526cad1d673dcadcf064a59ce752ad4739c56c1a39ef9` |

</details>

<details>
<summary>45. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/75d234e719e4-qRZzKsNlaPRjMabP.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/75d234e719e4-qRZzKsNlaPRjMabP.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"e8acab5000263d76eccfd8f46f510fbe"` |
| Скачивание, мс | 736 |
| Время получения, UTC | `2026-10-06T13:29:05.322Z` |
| До оптимизации, байт | 547034 |
| После оптимизации, байт | 254968 |
| Ширина, px | 2048 |
| Высота, px | 634 |
| Формат | `png` |
| SHA256 оригинала | `1c277e67feb0d5fdd223a6398abe3c17415ab0a7f4cd5df62896971c91d91516` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/75d234e719e4-qRZzKsNlaPRjMabP.a24f64ac8ed2b672.webp` |
| SHA256 результата | `a24f64ac8ed2b672d1c9ed3f147c86c3e5e868d8d47dbab06c8b1210f6a39759` |
| SHA256 декодированных пикселей | `72313755c4b6d2bd770812e77a85bb2409148a91067f2bcbe1ed2e1a6f9726c5` |

</details>

<details>
<summary>46. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/76751795802b-cvPWAEJjkmXMKPjM.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/76751795802b-cvPWAEJjkmXMKPjM.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"4990172b1f2336c40e97bea35f73ea2b"` |
| Скачивание, мс | 1591 |
| Время получения, UTC | `2026-10-06T13:18:10.444Z` |
| До оптимизации, байт | 31812 |
| После оптимизации, байт | 31812 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `b01f5f52dcb6fccf0a1770990ce5cc141887c41b1c24a6e2985e92e5bf18134f` |
| Статус | `unchanged` |

</details>

<details>
<summary>47. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/77be05fab34c-HWbDueWsSqSewhtK.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/77be05fab34c-HWbDueWsSqSewhtK.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"04cabe495de73e8e1e9c2511417585d1"` |
| Скачивание, мс | 374 |
| Время получения, UTC | `2026-10-06T13:29:07.222Z` |
| До оптимизации, байт | 580150 |
| После оптимизации, байт | 268864 |
| Ширина, px | 2048 |
| Высота, px | 688 |
| Формат | `png` |
| SHA256 оригинала | `a8a368ba3ada437bf4fdf4f2ba809a16f19040fbe96d941880ee98968468d608` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/77be05fab34c-HWbDueWsSqSewhtK.ad21df1da9b8807c.webp` |
| SHA256 результата | `ad21df1da9b8807cabb2f37e72c02626d9e61b282fb05704bd857dde999192ce` |
| SHA256 декодированных пикселей | `05febd0d06b654be34e6a95f067c9e8747411b79f36814110a93cb2a0e1d921c` |

</details>

<details>
<summary>48. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/78b61d3f13ad-ecZVWefzXRwRboPv.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/78b61d3f13ad-ecZVWefzXRwRboPv.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"952fc76aa0376fc9d1d272c5be7b1251"` |
| Скачивание, мс | 98 |
| Время получения, UTC | `2026-10-06T13:29:07.596Z` |
| До оптимизации, байт | 137524 |
| После оптимизации, байт | 137524 |
| Ширина, px | 900 |
| Высота, px | 1081 |
| Формат | `webp` |
| SHA256 оригинала | `6bd950f10a33771e177a205faf0820030b0cf72f6a8bd30e4eb626a9896f2eb5` |
| Статус | `unchanged` |

</details>

<details>
<summary>49. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7e8f673737d1-bGwFUQjrxWpTxAMM.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7e8f673737d1-bGwFUQjrxWpTxAMM.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"667140a9137b6cdece013ba2869c92c1"` |
| Скачивание, мс | 7767 |
| Время получения, UTC | `2026-10-06T13:19:29.940Z` |
| До оптимизации, байт | 37140 |
| После оптимизации, байт | 37140 |
| Ширина, px | 640 |
| Высота, px | 360 |
| Формат | `jpeg` |
| SHA256 оригинала | `4f639bc18607fcbd92c235706427f733b1688155c824cdc27432ad615d475432` |
| Статус | `unchanged` |

</details>

<details>
<summary>50. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/80167c1dcc6f-vSlkTezTOrkVQWvB.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/80167c1dcc6f-vSlkTezTOrkVQWvB.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"20b2923b4507a5eadf2625bf4e701944"` |
| Скачивание, мс | 235 |
| Время получения, UTC | `2026-10-06T13:29:07.870Z` |
| До оптимизации, байт | 570150 |
| После оптимизации, байт | 257292 |
| Ширина, px | 2048 |
| Высота, px | 930 |
| Формат | `png` |
| SHA256 оригинала | `f46013e20626cf0af1d9af52455c4c64dc1b206b1ec99dfd3caabcd4794ad170` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/80167c1dcc6f-vSlkTezTOrkVQWvB.a052751f8ea9fb0a.webp` |
| SHA256 результата | `a052751f8ea9fb0a1b594e5277352cbf518ecfff20bb1026c6270006c59fd1ff` |
| SHA256 декодированных пикселей | `f70b93fa0e448a8503c77cb4761afa46d926a6ece79045206448b217d350d0e2` |

</details>

<details>
<summary>51. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8283ecb861ab-BSgzKdVEmubRcHjZ.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8283ecb861ab-BSgzKdVEmubRcHjZ.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"756617b4bbba2e2b2e7d2649516826d2"` |
| Скачивание, мс | 8136 |
| Время получения, UTC | `2026-10-06T13:19:49.729Z` |
| До оптимизации, байт | 37792 |
| После оптимизации, байт | 37792 |
| Ширина, px | 640 |
| Высота, px | 360 |
| Формат | `jpeg` |
| SHA256 оригинала | `e2cbbb1eec9a9ba6634abbb1e0d67f11de527b1d2004d137f4d15c078c27d062` |
| Статус | `unchanged` |

</details>

<details>
<summary>52. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/851b9291eba1-lcDkOhuXxsYEaquQ.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/851b9291eba1-lcDkOhuXxsYEaquQ.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"424cad155b4f6604c668f2bd1eae0798"` |
| Скачивание, мс | 256 |
| Время получения, UTC | `2026-10-06T13:29:09.224Z` |
| До оптимизации, байт | 201060 |
| После оптимизации, байт | 201060 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `467ae4b0d0110892142194ad0ed17b0864aed8f2ac27028899b268aae50777b2` |
| Статус | `unchanged` |

</details>

<details>
<summary>53. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/877a6c2a49ef-JZjLEpuxmhqHszUD.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/877a6c2a49ef-JZjLEpuxmhqHszUD.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"78da88388a1f5ec9918811074d9157a0"` |
| Скачивание, мс | 45636 |
| Время получения, UTC | `2026-10-06T13:21:12.391Z` |
| До оптимизации, байт | 109648 |
| После оптимизации, байт | 109648 |
| Ширина, px | 1200 |
| Высота, px | 801 |
| Формат | `jpeg` |
| SHA256 оригинала | `cdc7c547845e8eda8c9d6f22b94144d77ac9406ba54e5b7af0c410d84be154f4` |
| Статус | `unchanged` |

</details>

<details>
<summary>54. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8b44a02c41d1-avIlcuIRwQPHiWEZ.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8b44a02c41d1-avIlcuIRwQPHiWEZ.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"4d9d7c3e0a3a3057813c42683824b43b"` |
| Скачивание, мс | 11736 |
| Время получения, UTC | `2026-10-06T13:21:11.726Z` |
| До оптимизации, байт | 78858 |
| После оптимизации, байт | 78858 |
| Ширина, px | 564 |
| Высота, px | 599 |
| Формат | `webp` |
| SHA256 оригинала | `4d4e95a1307037cb6cbe81a925b222bcc7f44d1d7e9e985d2070992746bfe6ff` |
| Статус | `unchanged` |

</details>

<details>
<summary>55. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8cd6e38feb2b-GEblEVfYOlTMcdZL.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8cd6e38feb2b-GEblEVfYOlTMcdZL.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"03bc329e73c2816bfe6c473308cad0de"` |
| Скачивание, мс | 2139 |
| Время получения, UTC | `2026-10-06T13:21:14.608Z` |
| До оптимизации, байт | 53176 |
| После оптимизации, байт | 53176 |
| Ширина, px | 640 |
| Высота, px | 640 |
| Формат | `webp` |
| SHA256 оригинала | `eeeac2bcbdaf78b8353a223d1cc65d8b3fddbdd73e33a5531bf00edbc083522b` |
| Статус | `unchanged` |

</details>

<details>
<summary>56. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8d13aefa8185-IZEbDdSSzwHYlZJi.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8d13aefa8185-IZEbDdSSzwHYlZJi.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"b4265809b3a81d53a6f651fcf1a2f240"` |
| Скачивание, мс | 1462 |
| Время получения, UTC | `2026-10-06T13:29:11.760Z` |
| До оптимизации, байт | 2913169 |
| После оптимизации, байт | 1417030 |
| Ширина, px | 2048 |
| Высота, px | 1098 |
| Формат | `png` |
| SHA256 оригинала | `9a28f021ad9627370b6dff4acfc65176a90751059dc0724e5640bdcde6d11b3f` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/8d13aefa8185-IZEbDdSSzwHYlZJi.f63e6be139179f65.webp` |
| SHA256 результата | `f63e6be139179f6506678fd5d91c9d3c636f6a1d637aba23172a095fcc507885` |
| SHA256 декодированных пикселей | `19ba1032cd753575c5e39e5a84e774e978ef6cfee33a67ccf7b4cbd6c9f9b6a2` |

</details>

<details>
<summary>57. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e13a3ec38f0-KFvjVaUAsIOcwZxo.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e13a3ec38f0-KFvjVaUAsIOcwZxo.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"d7e9bd869b40aaa2e42656cc15829db0"` |
| Скачивание, мс | 3259 |
| Время получения, UTC | `2026-10-06T13:29:13.929Z` |
| До оптимизации, байт | 3458214 |
| После оптимизации, байт | 1695212 |
| Ширина, px | 2048 |
| Высота, px | 1126 |
| Формат | `png` |
| SHA256 оригинала | `0db9cc912cd94bb9a809d125a7ec6cd4cb264551c7c6ee7c15820534c9bd33dc` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/8e13a3ec38f0-KFvjVaUAsIOcwZxo.d70a14b7adf18b62.webp` |
| SHA256 результата | `d70a14b7adf18b62bd62c6c07cc568b9ccbb0bb90ac4c78e96f192f0a163bdca` |
| SHA256 декодированных пикселей | `bfee934217796ae99fb02eab8ec7cab6d2bc0251b81b0fb3decca93b9002648d` |

</details>

<details>
<summary>58. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e2caea5d436-dVirjqOQtEhpIeZq.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e2caea5d436-dVirjqOQtEhpIeZq.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"5349408760dbae2eab6665212c59c72e"` |
| Скачивание, мс | 11197 |
| Время получения, UTC | `2026-10-06T13:21:30.976Z` |
| До оптимизации, байт | 144956 |
| После оптимизации, байт | 144956 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `d571685518ade498851d5e19915f82863177fe9baf45ea524a0135c62e78140c` |
| Статус | `unchanged` |

</details>

<details>
<summary>59. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/90e0ee86a4ff-kMJdEKDrnBTzTyzP.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/90e0ee86a4ff-kMJdEKDrnBTzTyzP.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"0750da37eaa38ad7fa1f93c84fe3e3a1"` |
| Скачивание, мс | 18103 |
| Время получения, UTC | `2026-10-06T13:21:49.162Z` |
| До оптимизации, байт | 196048 |
| После оптимизации, байт | 196048 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `a65e6bf22b7a7a9ed30cc9ad1cf4ab17f870d2eb912d3c25e579bfad584bafed` |
| Статус | `unchanged` |

</details>

<details>
<summary>60. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/925076516046-CkdCchNXtpJkPNVd.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/925076516046-CkdCchNXtpJkPNVd.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"bbec2c34a5430142c65a91aa2febbc95"` |
| Скачивание, мс | 8183 |
| Время получения, UTC | `2026-10-06T13:21:57.451Z` |
| До оптимизации, байт | 190288 |
| После оптимизации, байт | 190288 |
| Ширина, px | 1200 |
| Высота, px | 2133 |
| Формат | `jpeg` |
| SHA256 оригинала | `cecc8825fbd458b1f9a13dbb036d9a18ece3e174791b83ed82f080a1e7857c20` |
| Статус | `unchanged` |

</details>

<details>
<summary>61. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/94b5bebfd7f4-IbTlGDtcIAJBcJAR.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/94b5bebfd7f4-IbTlGDtcIAJBcJAR.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"36a0c917e66a5a2b2508e5188e408366"` |
| Скачивание, мс | 6437 |
| Время получения, UTC | `2026-10-06T13:22:04.035Z` |
| До оптимизации, байт | 74524 |
| После оптимизации, байт | 74524 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `2f8ac09310638742790eedc61ab7fc799c2222119551fb4249799b516b891d7b` |
| Статус | `unchanged` |

</details>

<details>
<summary>62. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9503c81d3711-gFvZsxUUAlJFJQPJ.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9503c81d3711-gFvZsxUUAlJFJQPJ.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"0735bf926c8a582c47eb059cd50a99f9"` |
| Скачивание, мс | 26343 |
| Время получения, UTC | `2026-10-06T13:22:31.877Z` |
| До оптимизации, байт | 225050 |
| После оптимизации, байт | 225050 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `b2b485e2349d78314bc85abc07734e9138a7a9ca124f17e834457433068d6c7d` |
| Статус | `unchanged` |

</details>

<details>
<summary>63. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/958b97c139fc-kvcsayGSgtVcnjGN.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/958b97c139fc-kvcsayGSgtVcnjGN.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"b5bc956462b31215624058c402bb99ef"` |
| Скачивание, мс | 13253 |
| Время получения, UTC | `2026-10-06T13:22:45.237Z` |
| До оптимизации, байт | 150186 |
| После оптимизации, байт | 150186 |
| Ширина, px | 1200 |
| Высота, px | 1484 |
| Формат | `jpeg` |
| SHA256 оригинала | `e3dcaa7e76e1b9af6de671235d21dd4fb0612112d1d30d8afbea5bd8803bdc62` |
| Статус | `unchanged` |

</details>

<details>
<summary>64. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/98ab8fafc475-UumiPOEfgzXJXOMx.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/98ab8fafc475-UumiPOEfgzXJXOMx.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"2b868cc9ff476507bdc859e54a909e24"` |
| Скачивание, мс | 4140 |
| Время получения, UTC | `2026-10-06T13:22:46.707Z` |
| До оптимизации, байт | 30730 |
| После оптимизации, байт | 30730 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `cfac9f24edadc5760b275446963518dbac3cbef2bfd1ae4617bd13c43d7b5d64` |
| Статус | `unchanged` |

</details>

<details>
<summary>65. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9b32f7b0c8f1-ReabYqEbymjBrDEY.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9b32f7b0c8f1-ReabYqEbymjBrDEY.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"20b69ae1ab5a6a50ecb6a6ddc7f33ffb"` |
| Скачивание, мс | 19303 |
| Время получения, UTC | `2026-10-06T13:23:04.680Z` |
| До оптимизации, байт | 162782 |
| После оптимизации, байт | 162782 |
| Ширина, px | 1200 |
| Высота, px | 1481 |
| Формат | `jpeg` |
| SHA256 оригинала | `64f01b5bcbb261ad2cf0931e7bc1d0703882835c2483f56e992e1c62974cd121` |
| Статус | `unchanged` |

</details>

<details>
<summary>66. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9e3aec1f0a5d-PUMBhecZrXmmctyT.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9e3aec1f0a5d-PUMBhecZrXmmctyT.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"060a21908faf48f4068b08493e68b80b"` |
| Скачивание, мс | 10012 |
| Время получения, UTC | `2026-10-06T13:22:55.421Z` |
| До оптимизации, байт | 112926 |
| После оптимизации, байт | 112926 |
| Ширина, px | 1000 |
| Высота, px | 563 |
| Формат | `jpeg` |
| SHA256 оригинала | `83aa3e97448140d2668017b66b7443a41cb1ec217f8eab0788e7045b51a5b968` |
| Статус | `unchanged` |

</details>

<details>
<summary>67. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a1a591be13aa-AZYAKPGUhWakANOo.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a1a591be13aa-AZYAKPGUhWakANOo.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"b4679b55f832823060393c110c9e5a1c"` |
| Скачивание, мс | 496 |
| Время получения, UTC | `2026-10-06T13:29:14.870Z` |
| До оптимизации, байт | 619379 |
| После оптимизации, байт | 283954 |
| Ширина, px | 2048 |
| Высота, px | 726 |
| Формат | `png` |
| SHA256 оригинала | `ed566eb55ad20f74c8d15bcfebe89c5b3811fd9e7544053b59989cab3135f336` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/a1a591be13aa-AZYAKPGUhWakANOo.b51a990a56c258ce.webp` |
| SHA256 результата | `b51a990a56c258cee2f65c744d7f6d0af6a707e1ac66c0254125993ab351033d` |
| SHA256 декодированных пикселей | `42a391922f58ec120313e87eab7f9e48c2a70536f00110a9954ba6758c3b4828` |

</details>

<details>
<summary>68. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a3c7d398b304-zLXMNrsxvYbFxTGr.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a3c7d398b304-zLXMNrsxvYbFxTGr.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"a87c6082d29c9dacadb4f14ae12e849d"` |
| Скачивание, мс | 20174 |
| Время получения, UTC | `2026-10-06T13:23:15.658Z` |
| До оптимизации, байт | 120122 |
| После оптимизации, байт | 120122 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `1ea1c75ac1bfa12bfb39d73ac15aaa0d64e76a3237df5b909cb887980f5281b1` |
| Статус | `unchanged` |

</details>

<details>
<summary>69. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a408a8ab4bfb-zvCnxlYvTeWzjTKf.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a408a8ab4bfb-zvCnxlYvTeWzjTKf.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"c2738f15eb90597fe8f699e8481bf509"` |
| Скачивание, мс | 13577 |
| Время получения, UTC | `2026-10-06T13:23:18.353Z` |
| До оптимизации, байт | 163125 |
| После оптимизации, байт | 163125 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `c3f85b74ddf8d35c4027719ce0a67671a233ef759fb1eda4726186d9d3265ddd` |
| Статус | `unchanged` |

</details>

<details>
<summary>70. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a7444048ce43-IYxPwzEBGGVfKrLw.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a7444048ce43-IYxPwzEBGGVfKrLw.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"b590152571d13d01b196dd618eaa649d"` |
| Скачивание, мс | 38924 |
| Время получения, UTC | `2026-10-06T13:23:54.663Z` |
| До оптимизации, байт | 232951 |
| После оптимизации, байт | 232951 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `03499720c4e0f26026d4e206f1052feac0f849e00d87d44d59e627914df66644` |
| Статус | `unchanged` |

</details>

<details>
<summary>71. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a8a92a28eba4-xndzkbTFXAjrqEdW.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a8a92a28eba4-xndzkbTFXAjrqEdW.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"f2af6ebd9970afb3c5d2d46cc09657e5"` |
| Скачивание, мс | 53458 |
| Время получения, UTC | `2026-10-06T13:24:11.974Z` |
| До оптимизации, байт | 234764 |
| После оптимизации, байт | 234764 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `a1c04679277a11701103ac571f0f72585f32b1962870d5aa99c3b7c46014d416` |
| Статус | `unchanged` |

</details>

<details>
<summary>72. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b010b81b5866-rvMvDhDknWfcKisy.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b010b81b5866-rvMvDhDknWfcKisy.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"1bda2d6a87e2c8ff8f35dd536cbd11a9"` |
| Скачивание, мс | 22503 |
| Время получения, UTC | `2026-10-06T13:24:00.992Z` |
| До оптимизации, байт | 93278 |
| После оптимизации, байт | 93278 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `85be0a511d9e1c58989e189677dadaef0648de775712c4ea2692c5acf4d6fdd8` |
| Статус | `unchanged` |

</details>

<details>
<summary>73. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b0256e249003-fTvlKJxwwRXhliWp.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b0256e249003-fTvlKJxwwRXhliWp.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"be4f09dd8e3e5139038bbf166534c00e"` |
| Скачивание, мс | 30296 |
| Время получения, UTC | `2026-10-06T13:24:25.075Z` |
| До оптимизации, байт | 1157690 |
| После оптимизации, байт | 531604 |
| Ширина, px | 2048 |
| Высота, px | 1704 |
| Формат | `png` |
| SHA256 оригинала | `a263e1465004ee4a8af211abdd25c45c95c9175329e5af642ad23509b087862b` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/b0256e249003-fTvlKJxwwRXhliWp.56c00c46bd499e09.webp` |
| SHA256 результата | `56c00c46bd499e090772a8671796afb3cb55d9e1db3e69b749ea4f65ffce50cd` |
| SHA256 декодированных пикселей | `2ab2c1750d4b6794cfe73c836d8b2cc0e408f96965460f37f5cb51fba2ee83ab` |

</details>

<details>
<summary>74. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b111512afc6d-DIvPBhtemQFssInq.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b111512afc6d-DIvPBhtemQFssInq.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"ed4c693e4723ab67580c9ba48d5ea939"` |
| Скачивание, мс | 18036 |
| Время получения, UTC | `2026-10-06T13:24:20.497Z` |
| До оптимизации, байт | 263135 |
| После оптимизации, байт | 263135 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `c210256ed5699a5245f0386626d350c958ecac6258744fa47e51adda78e3ffb5` |
| Статус | `unchanged` |

</details>

<details>
<summary>75. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b573a5cea177-nNMSLpNDmzQdnfqe.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b573a5cea177-nNMSLpNDmzQdnfqe.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"a3173228bb6f6375823830783178a857"` |
| Скачивание, мс | 19958 |
| Время получения, UTC | `2026-10-06T13:24:32.046Z` |
| До оптимизации, байт | 50474 |
| После оптимизации, байт | 50474 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `4acf43bd33947211a7355394d14fe6ddc1166839d4cde2192e70299b05c013ba` |
| Статус | `unchanged` |

</details>

<details>
<summary>76. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b8106c44719f-tlMfbAYBCxFjOQfm.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b8106c44719f-tlMfbAYBCxFjOQfm.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"03a396fa6919aa8f386cef1c5a2061f4"` |
| Скачивание, мс | 179 |
| Время получения, UTC | `2026-10-06T13:24:20.815Z` |
| До оптимизации, байт | 58642 |
| После оптимизации, байт | 58642 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `6c36d5714c68892403ef7e65ecbbd2c349a570949fdc0c10ab27f6ea689e46d4` |
| Статус | `unchanged` |

</details>

<details>
<summary>77. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/bd8ad8ec3381-qnhLMhhMFwJPLflj.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/bd8ad8ec3381-qnhLMhhMFwJPLflj.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"6ab968c3b612fd3fcd879ff91a8beecb"` |
| Скачивание, мс | 489 |
| Время получения, UTC | `2026-10-06T13:24:22.546Z` |
| До оптимизации, байт | 173348 |
| После оптимизации, байт | 173348 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `7f1afd9c5c5aeca91fbeb00a361381af0e4a9e7507013abca873674300b357be` |
| Статус | `unchanged` |

</details>

<details>
<summary>78. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/be172f0dd15b-FfermcbrvIjJZXGz.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/be172f0dd15b-FfermcbrvIjJZXGz.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"a213f17180d83a04a550aa5062191f41"` |
| Скачивание, мс | 314 |
| Время получения, UTC | `2026-10-06T13:24:22.955Z` |
| До оптимизации, байт | 163722 |
| После оптимизации, байт | 163722 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `45953fa20ff5c459aeda2d0780d7db9a934fb2435c12567567d13751d53992f8` |
| Статус | `unchanged` |

</details>

<details>
<summary>79. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c1fc2e32d868-jpAnnXDosARxcyid.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c1fc2e32d868-jpAnnXDosARxcyid.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"77053f68561aa6325041e10237d8b1ae"` |
| Скачивание, мс | 355 |
| Время получения, UTC | `2026-10-06T13:24:23.401Z` |
| До оптимизации, байт | 200059 |
| После оптимизации, байт | 200059 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `b984a79678275d08cec9c406791def43788c0fa516c781a50517e160f1b3fef1` |
| Статус | `unchanged` |

</details>

<details>
<summary>80. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c2a4341558e8-dZtWbRtaJLWFOYGX.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c2a4341558e8-dZtWbRtaJLWFOYGX.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"e1948a23b24b0cd0887c7270dccb9a4a"` |
| Скачивание, мс | 433 |
| Время получения, UTC | `2026-10-06T13:24:23.940Z` |
| До оптимизации, байт | 245170 |
| После оптимизации, байт | 245170 |
| Ширина, px | 1400 |
| Высота, px | 1050 |
| Формат | `webp` |
| SHA256 оригинала | `1ceb8381350df1252a0c6ade1997e465ce6e23dc119f69d3465d1413dbfdcd2e` |
| Статус | `unchanged` |

</details>

<details>
<summary>81. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c666fd8041cd-gMlxhhnFvlmwZewA.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/c666fd8041cd-gMlxhhnFvlmwZewA.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"988ddb5daaaebc40fe9a6e45f88e7e8b"` |
| Скачивание, мс | 327 |
| Время получения, UTC | `2026-10-06T13:24:27.237Z` |
| До оптимизации, байт | 121661 |
| После оптимизации, байт | 121661 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `c3529547069ec2017cf4e80c28fa61d068c5bf133b26141980ba0bfb241fd57e` |
| Статус | `unchanged` |

</details>

<details>
<summary>82. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/cc53a49e1416-qxGDcExHmMNZuoWc.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/cc53a49e1416-qxGDcExHmMNZuoWc.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"074afdb72c86cd923b9b9896005a10bb"` |
| Скачивание, мс | 160 |
| Время получения, UTC | `2026-10-06T13:24:27.540Z` |
| До оптимизации, байт | 38110 |
| После оптимизации, байт | 38110 |
| Ширина, px | 640 |
| Высота, px | 360 |
| Формат | `jpeg` |
| SHA256 оригинала | `184c30d80055f4f00b34c8ed2a766e9c06669daa8ecdebcde50e72eccde02931` |
| Статус | `unchanged` |

</details>

<details>
<summary>83. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ce515dd1f602-yLEBPmBjoZXimIfm.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ce515dd1f602-yLEBPmBjoZXimIfm.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"2b805e54ef879a3b21019cf5a7180e40"` |
| Скачивание, мс | 196 |
| Время получения, UTC | `2026-10-06T13:24:27.793Z` |
| До оптимизации, байт | 106010 |
| После оптимизации, байт | 106010 |
| Ширина, px | 900 |
| Высота, px | 1200 |
| Формат | `webp` |
| SHA256 оригинала | `3839453db773a65e6eb7ea285efdbdf94dc276ecebdb35bdcfecb3a4d5486195` |
| Статус | `unchanged` |

</details>

<details>
<summary>84. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"40a8118d00f55bfa97a0c12b13006ead"` |
| Скачивание, мс | 488 |
| Время получения, UTC | `2026-10-06T13:24:29.879Z` |
| До оптимизации, байт | 234795 |
| После оптимизации, байт | 234795 |
| Ширина, px | 1440 |
| Высота, px | 2560 |
| Формат | `jpeg` |
| SHA256 оригинала | `7be3fc15eb2bb84f079b579c250183ebd4a29bd84203c25b52b992f0d61d4e5e` |
| Статус | `unchanged` |

</details>

<details>
<summary>85. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d2e7c03c6f36-CAbMTXzGTiRynQvA.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d2e7c03c6f36-CAbMTXzGTiRynQvA.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"c96efcb606e3d320bfefa9bc33e7f5ce"` |
| Скачивание, мс | 11993 |
| Время получения, UTC | `2026-10-06T13:24:41.462Z` |
| До оптимизации, байт | 243534 |
| После оптимизации, байт | 243534 |
| Ширина, px | 1200 |
| Высота, px | 1598 |
| Формат | `jpeg` |
| SHA256 оригинала | `0ba0e4e3dfe849eab5e970808ba21baa121294165cc725f33a3a065849045c9f` |
| Статус | `unchanged` |

</details>

<details>
<summary>86. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d41da8bb49e5-qtTdhxTQTceQjglS.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d41da8bb49e5-qtTdhxTQTceQjglS.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"2875443ec840020e2eb07a4d4b4d4ee6"` |
| Скачивание, мс | 358 |
| Время получения, UTC | `2026-10-06T13:24:30.396Z` |
| До оптимизации, байт | 297400 |
| После оптимизации, байт | 297400 |
| Ширина, px | 1200 |
| Высота, px | 1598 |
| Формат | `jpeg` |
| SHA256 оригинала | `48172bf7a0299259e4bbeb02f144023e3d1fb3fb48b8b5e5163d6b342c65a963` |
| Статус | `unchanged` |

</details>

<details>
<summary>87. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4c9b66fca3b-SRsjwrPhBzgdUgKP.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4c9b66fca3b-SRsjwrPhBzgdUgKP.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"6c10ca48408ace0899f0f1bf7c9fff4c"` |
| Скачивание, мс | 8509 |
| Время получения, UTC | `2026-10-06T13:24:39.016Z` |
| До оптимизации, байт | 3402733 |
| После оптимизации, байт | 1712298 |
| Ширина, px | 1532 |
| Высота, px | 2048 |
| Формат | `png` |
| SHA256 оригинала | `8da8dd230894e617957571a5117aa327f97e49b041002e87f393c0f6edfe4191` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/d4c9b66fca3b-SRsjwrPhBzgdUgKP.3a606f09c0b04d3a.webp` |
| SHA256 результата | `3a606f09c0b04d3a42b274f9a7f16d1c864eb87a9ad3418783068f5e27a8a2c1` |
| SHA256 декодированных пикселей | `33a9ab8a00c420205a7ac5ce3f4880bab400eb6bf421ea985e64fc451eff9e21` |

</details>

<details>
<summary>88. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4e9a2f83368-DFKxWfbFBBqVrKyK.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4e9a2f83368-DFKxWfbFBBqVrKyK.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"62c10e7c80354bd268e121cd68fb2683"` |
| Скачивание, мс | 1111 |
| Время получения, UTC | `2026-10-06T13:24:34.764Z` |
| До оптимизации, байт | 169390 |
| После оптимизации, байт | 169390 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `9b8ca5f89dd448b8772f575ecca0f5da815fed7abcf18aeaeed7f16ae964b970` |
| Статус | `unchanged` |

</details>

<details>
<summary>89. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7c6da7c51eb-ajKAgiYmRhdfjrvA.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7c6da7c51eb-ajKAgiYmRhdfjrvA.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"49e9255757b89d667c3a59332041605d"` |
| Скачивание, мс | 4883 |
| Время получения, UTC | `2026-10-06T13:24:39.744Z` |
| До оптимизации, байт | 1281075 |
| После оптимизации, байт | 584930 |
| Ширина, px | 2048 |
| Высота, px | 1992 |
| Формат | `png` |
| SHA256 оригинала | `47be8e10b71855bdcffe16ec134ca43a38194da4571a120d23be09c7605bc73f` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/d7c6da7c51eb-ajKAgiYmRhdfjrvA.4314d52322187267.webp` |
| SHA256 результата | `4314d523221872676724136746f6b34433ec9549d0ed968ccfdfb8487142ccf3` |
| SHA256 декодированных пикселей | `f645f068c3cee26065798b7c52cb4540328ddc31719a9d1672381acc26309d47` |

</details>

<details>
<summary>90. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7d902b3580b-ibiaXiTZueqqzkwU.png</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7d902b3580b-ibiaXiTZueqqzkwU.png` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"e8a22589fa82a78c2d2acafd8745d308"` |
| Скачивание, мс | 4081 |
| Время получения, UTC | `2026-10-06T13:24:45.887Z` |
| До оптимизации, байт | 3767491 |
| После оптимизации, байт | 1930244 |
| Ширина, px | 1548 |
| Высота, px | 2048 |
| Формат | `png` |
| SHA256 оригинала | `6013fd15d9af1c34e0bbfd79dd305643582857f9af4879412a3108642ed2f107` |
| Статус | `pixel-identical` |
| Результирующий адрес | `/assets/optimized/d7d902b3580b-ibiaXiTZueqqzkwU.e47afb926959209f.webp` |
| SHA256 результата | `e47afb926959209f6c0ba4dc14a5918c7bdbac0b41e65b7bcb1ab8749bd3f7a7` |
| SHA256 декодированных пикселей | `2a9e4a0e4363e1bcc102e7d2f38cc5c5ed461decd89103495d435b76c2e0fbe6` |

</details>

<details>
<summary>91. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/de1723199afb-UbAVGWtYciEmYaOm.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/de1723199afb-UbAVGWtYciEmYaOm.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"77ff01a6e32485e3eef94b6cf1b37320"` |
| Скачивание, мс | 468 |
| Время получения, UTC | `2026-10-06T13:24:45.684Z` |
| До оптимизации, байт | 135384 |
| После оптимизации, байт | 135384 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `09c242aeb2a4a3d2daa6ca31a4af73a2bede25cbc9c4f232b0e8b2eb79dbf896` |
| Статус | `unchanged` |

</details>

<details>
<summary>92. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ded750bddbeb-HSvrSZijpbSHOLAN.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ded750bddbeb-HSvrSZijpbSHOLAN.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"a87e233fa906b911534db0129e96b154"` |
| Скачивание, мс | 205 |
| Время получения, UTC | `2026-10-06T13:24:45.891Z` |
| До оптимизации, байт | 150132 |
| После оптимизации, байт | 150132 |
| Ширина, px | 1200 |
| Высота, px | 1487 |
| Формат | `jpeg` |
| SHA256 оригинала | `fc2a96a7206bc037cf006ea739303202001b2e041f206bf12fce3a11f9b40ff4` |
| Статус | `unchanged` |

</details>

<details>
<summary>93. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e197a59fb5c3-qFGLTXCnSORlpLhB.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e197a59fb5c3-qFGLTXCnSORlpLhB.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"1fcd06ff70e66e34837ab2606a8ca641"` |
| Скачивание, мс | 372 |
| Время получения, UTC | `2026-10-06T13:24:46.157Z` |
| До оптимизации, байт | 34868 |
| После оптимизации, байт | 34868 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `a5486ca7e1360951547f57c635c1ff219d230bc78ab341be2ea7731308913616` |
| Статус | `unchanged` |

</details>

<details>
<summary>94. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e51b2ade0a13-NIyDYATUAoJPZeaz.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e51b2ade0a13-NIyDYATUAoJPZeaz.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"cc3d7a8548a50be954744e799e36c93b"` |
| Скачивание, мс | 341 |
| Время получения, UTC | `2026-10-06T13:24:46.411Z` |
| До оптимизации, байт | 243496 |
| После оптимизации, байт | 243496 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `cecf9350e60f60fabe54a1dcd291b320bccbe6260894a1afcadfe292cd562e22` |
| Статус | `unchanged` |

</details>

<details>
<summary>95. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e5fae384392a-ZOLblRiqaXdykwDW.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e5fae384392a-ZOLblRiqaXdykwDW.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"1dddcdf4c98128a1a519b6b935f1d05a"` |
| Скачивание, мс | 166 |
| Время получения, UTC | `2026-10-06T13:24:46.773Z` |
| До оптимизации, байт | 140320 |
| После оптимизации, байт | 140320 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `2c3833e8391b6b38bc113c88173a0f219345bd8ff1ee756503aae943819c91f9` |
| Статус | `unchanged` |

</details>

<details>
<summary>96. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e8e5386d449f-xGuqHGnxPOYPLwJz.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e8e5386d449f-xGuqHGnxPOYPLwJz.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"af26595f417063bad024dd50573b6f17"` |
| Скачивание, мс | 183 |
| Время получения, UTC | `2026-10-06T13:24:47.182Z` |
| До оптимизации, байт | 108480 |
| После оптимизации, байт | 108480 |
| Ширина, px | 900 |
| Высота, px | 1200 |
| Формат | `webp` |
| SHA256 оригинала | `c32035de391abc36e1ba22cfc426c75a6acad2c5c05e9a78b07557c1813f05b5` |
| Статус | `unchanged` |

</details>

<details>
<summary>97. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e933a044db55-gMwUitXnrfSEIunK.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e933a044db55-gMwUitXnrfSEIunK.jpg` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"50e4e670616a7221fa775b359e243865"` |
| Скачивание, мс | 130 |
| Время получения, UTC | `2026-10-06T13:24:47.771Z` |
| До оптимизации, байт | 75070 |
| После оптимизации, байт | 75070 |
| Ширина, px | 1280 |
| Высота, px | 720 |
| Формат | `jpeg` |
| SHA256 оригинала | `ae25ba32d6e3dbcfd41b92fcc748f640e7236252a015fd96aa02ca4a047abdbb` |
| Статус | `unchanged` |

</details>

<details>
<summary>98. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ea0b60bea0fe-EhNRvSBlhxWjRXfT.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ea0b60bea0fe-EhNRvSBlhxWjRXfT.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"a720a009bf6dd09421f413fd9883d59b"` |
| Скачивание, мс | 258 |
| Время получения, UTC | `2026-10-06T13:24:48.162Z` |
| До оптимизации, байт | 273549 |
| После оптимизации, байт | 273549 |
| Ширина, px | 1200 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| SHA256 оригинала | `f59445d07c02988e7e575fc3bb8acfb0997f8ec91d9d0f778962876cf1d831fe` |
| Статус | `unchanged` |

</details>

<details>
<summary>99. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ed5c0d6e67b1-XTxEeqUQaizDpkGL.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ed5c0d6e67b1-XTxEeqUQaizDpkGL.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"2bf26ec6b1fe0526fbcbfa52727d3bba"` |
| Скачивание, мс | 413 |
| Время получения, UTC | `2026-10-06T13:24:48.916Z` |
| До оптимизации, байт | 469068 |
| После оптимизации, байт | 469068 |
| Ширина, px | 1021 |
| Высота, px | 3118 |
| Формат | `jpeg` |
| SHA256 оригинала | `d60d451a3b4a004dae3dddaecde90be0c45efcfbff67430fbfff6be5f91d9d30` |
| Статус | `unchanged` |

</details>

<details>
<summary>100. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f6dc8eaf6752-ilmNGaCKWJLSYlVp.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f6dc8eaf6752-ilmNGaCKWJLSYlVp.jpg` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"21266e7bce404c7418c35907c03db993"` |
| Скачивание, мс | 186 |
| Время получения, UTC | `2026-10-06T13:24:49.033Z` |
| До оптимизации, байт | 85849 |
| После оптимизации, байт | 85849 |
| Ширина, px | 1280 |
| Высота, px | 720 |
| Формат | `jpeg` |
| SHA256 оригинала | `196506a4ab1c92144ed2dbd325320164a6c2109f2e4c35d90bc1c8611d72418e` |
| Статус | `unchanged` |

</details>

<details>
<summary>101. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f74380dbb7e5-LhJhOevOxDNnKdkT.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f74380dbb7e5-LhJhOevOxDNnKdkT.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"ee4936475d62a0d951fffa0a9a9b821a"` |
| Скачивание, мс | 364 |
| Время получения, UTC | `2026-10-06T13:24:49.589Z` |
| До оптимизации, байт | 254276 |
| После оптимизации, байт | 254276 |
| Ширина, px | 837 |
| Высота, px | 1300 |
| Формат | `webp` |
| SHA256 оригинала | `a191ee0a698b7ecb01dbc68e957a481b5fbf9cb541275931983ba578b7c143b2` |
| Статус | `unchanged` |

</details>

<details>
<summary>102. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f77e4cc67d62-hpkSyBEErrnqiTvh.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f77e4cc67d62-hpkSyBEErrnqiTvh.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"6ebb2127a2cd1be1dad8629d7612d6ee"` |
| Скачивание, мс | 266 |
| Время получения, UTC | `2026-10-06T13:24:49.545Z` |
| До оптимизации, байт | 135907 |
| После оптимизации, байт | 135907 |
| Ширина, px | 1200 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `c6492bab25e6967ad437003d132a396bf57a0e89016941a4b0f7a8332a63e129` |
| Статус | `unchanged` |

</details>

<details>
<summary>103. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f8a919017d4c-WDRmWxjeWyXWNrto.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f8a919017d4c-WDRmWxjeWyXWNrto.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"caa34f5dc4ae795083fc7cd770a76110"` |
| Скачивание, мс | 147 |
| Время получения, UTC | `2026-10-06T13:24:49.801Z` |
| До оптимизации, байт | 134538 |
| После оптимизации, байт | 134538 |
| Ширина, px | 900 |
| Высота, px | 1955 |
| Формат | `webp` |
| SHA256 оригинала | `ea6d6770802512b54749b65bcb58fce3a9ac254d534d17cab4f15c2acb8eed6c` |
| Статус | `unchanged` |

</details>

<details>
<summary>104. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fa733b106dca-sASvqozNGkUbZQiV.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fa733b106dca-sASvqozNGkUbZQiV.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"6207dfbc394a07b2c531aac394f17675"` |
| Скачивание, мс | 312 |
| Время получения, UTC | `2026-10-06T13:24:52.827Z` |
| До оптимизации, байт | 209021 |
| После оптимизации, байт | 209021 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `eec8d51c868a67e1bb334b1074d654827696ca815b805b39b0008c178d758c0c` |
| Статус | `unchanged` |

</details>

<details>
<summary>105. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fd2a40d2d655-odfxOAxwqkixLoZd.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fd2a40d2d655-odfxOAxwqkixLoZd.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"6760cac4b596672bdc50dece114cc05f"` |
| Скачивание, мс | 164 |
| Время получения, UTC | `2026-10-06T13:24:53.193Z` |
| До оптимизации, байт | 181780 |
| После оптимизации, байт | 181780 |
| Ширина, px | 1200 |
| Высота, px | 1598 |
| Формат | `jpeg` |
| SHA256 оригинала | `53ef0dbe95cf951e165b214439f035f1a69c9f774468bdf89af061b8ca0002c0` |
| Статус | `unchanged` |

</details>

<details>
<summary>106. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fe7dfc66e8d6-AUsXwEtMBYRSiNAN.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fe7dfc66e8d6-AUsXwEtMBYRSiNAN.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"43cb678614025fd71b3887b2f99e0c4c"` |
| Скачивание, мс | 236 |
| Время получения, UTC | `2026-10-06T13:24:53.632Z` |
| До оптимизации, байт | 230361 |
| После оптимизации, байт | 230361 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `8f1d73de465a8849c479f8fe951ccc95ee9ee68a8140f1f0cff7b9a6e34875f1` |
| Статус | `unchanged` |

</details>

<details>
<summary>107. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ff49f6ba1a27-NdnEHWCbQbNuKmyB.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ff49f6ba1a27-NdnEHWCbQbNuKmyB.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"8f44a1278083b615e3078725330e6d42"` |
| Скачивание, мс | 323 |
| Время получения, UTC | `2026-10-06T13:24:54.205Z` |
| До оптимизации, байт | 264759 |
| После оптимизации, байт | 264759 |
| Ширина, px | 1199 |
| Высота, px | 900 |
| Формат | `jpeg` |
| SHA256 оригинала | `6b6d4fd137d2ac51c5e1a4528078d3486f6cd5caa5f2167d26852be7352ed5e3` |
| Статус | `unchanged` |

</details>

<details>
<summary>108. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aaDcJuCLOeCrHfxk.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aaDcJuCLOeCrHfxk.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"1dc1d27b803ed02b8ffa0c41d39237e7"` |
| Скачивание, мс | 416 |
| Время получения, UTC | `2026-10-06T13:24:56.265Z` |
| До оптимизации, байт | 150128 |
| После оптимизации, байт | 150128 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `a08740122b3d8d466c526f3c3bced48a21d42f98278654ff7261b1f43b29abed` |
| Статус | `unchanged` |

</details>

<details>
<summary>109. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aNIPzDLqCSCRrrKT.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aNIPzDLqCSCRrrKT.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"d7ea5ef6b209623585458678b39e7c2f"` |
| Скачивание, мс | 361 |
| Время получения, UTC | `2026-10-06T13:24:56.208Z` |
| До оптимизации, байт | 187701 |
| После оптимизации, байт | 187701 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `08def4656aa2f5494bba415c77eac86d2f6f98d428694838bdf84f1b78b15043` |
| Статус | `unchanged` |

</details>

<details>
<summary>110. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/cover.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/cover.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"b7cee4f65749ba2afde4982b3a7beeab"` |
| Скачивание, мс | 154 |
| Время получения, UTC | `2026-10-06T13:24:56.163Z` |
| До оптимизации, байт | 179070 |
| После оптимизации, байт | 179070 |
| Ширина, px | 900 |
| Высота, px | 1162 |
| Формат | `webp` |
| SHA256 оригинала | `0248fc3f3099e3831ff7f233951513591502be5f475e29b3dcce2ed3c871662e` |
| Статус | `unchanged` |

</details>

<details>
<summary>111. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6125.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6125.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"25848365cb5d488431f2985cee51e983"` |
| Скачивание, мс | 199 |
| Время получения, UTC | `2026-10-06T13:24:56.536Z` |
| До оптимизации, байт | 138164 |
| После оптимизации, байт | 138164 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `bc0537a754527090ba9181a4b22e9c00e7f93511446f3c0d8d6a850e401ea6f1` |
| Статус | `unchanged` |

</details>

<details>
<summary>112. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6126.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6126.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"c2ad8e6593c3a08fe64b93002379f4ac"` |
| Скачивание, мс | 234 |
| Время получения, UTC | `2026-10-06T13:24:56.683Z` |
| До оптимизации, байт | 113731 |
| После оптимизации, байт | 113731 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `68a73756fbe976ec520f6aed6ed97713cf1104cb6b0a61093d567db171f4ff39` |
| Статус | `unchanged` |

</details>

<details>
<summary>113. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6127.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6127.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"765d704f232dd9ec6fe4f2776064b42c"` |
| Скачивание, мс | 163 |
| Время получения, UTC | `2026-10-06T13:24:56.805Z` |
| До оптимизации, байт | 106271 |
| После оптимизации, байт | 106271 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `b8ff27c18632483fb46fa4364bf3ec375778779d1d10142ef0fa38e6d1c1102b` |
| Статус | `unchanged` |

</details>

<details>
<summary>114. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6128.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6128.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"5000b6fe9dcc780c5a6524e42ac9eee0"` |
| Скачивание, мс | 179 |
| Время получения, UTC | `2026-10-06T13:24:56.988Z` |
| До оптимизации, байт | 118715 |
| После оптимизации, байт | 118715 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `2c4844fd754f009f46fe438f218483b20460ddf188bf3434c6f57259361157bf` |
| Статус | `unchanged` |

</details>

<details>
<summary>115. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6129.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6129.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"d7cd68c39500925d4365d41da0f65555"` |
| Скачивание, мс | 203 |
| Время получения, UTC | `2026-10-06T13:24:57.125Z` |
| До оптимизации, байт | 85489 |
| После оптимизации, байт | 85489 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `5021f6024b9727ca5789e05555f66c08e45565fa4a7a89c004ce2fd2f8eb5900` |
| Статус | `unchanged` |

</details>

<details>
<summary>116. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6130.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6130.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"d4c979c7728be5a3060fcda20bbbf0b3"` |
| Скачивание, мс | 125 |
| Время получения, UTC | `2026-10-06T13:24:57.217Z` |
| До оптимизации, байт | 90078 |
| После оптимизации, байт | 90078 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `3b4cd772b626c784007b3b80a9dec1d0ce91b579699b844cc2ab71f5af431a62` |
| Статус | `unchanged` |

</details>

<details>
<summary>117. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6131.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6131.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"67cadc1d50a9092a7525357240de797b"` |
| Скачивание, мс | 143 |
| Время получения, UTC | `2026-10-06T13:24:57.361Z` |
| До оптимизации, байт | 95715 |
| После оптимизации, байт | 95715 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `aa3e9dd990c9c87164d9e7c2bf724a9739046891119d409d9d3446700835fd14` |
| Статус | `unchanged` |

</details>

<details>
<summary>118. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6132.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6132.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"6e3bb20d9a49881d05bb3fab6f3624a5"` |
| Скачивание, мс | 154 |
| Время получения, UTC | `2026-10-06T13:24:57.518Z` |
| До оптимизации, байт | 87399 |
| После оптимизации, байт | 87399 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `c71f8bb767c2b39c0b48097ead62bc54bd92f62fa0c8a979f83f29cbe5ce5f58` |
| Статус | `unchanged` |

</details>

<details>
<summary>119. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6133.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6133.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"c6098386d76bda33c39eadacf9e586a9"` |
| Скачивание, мс | 156 |
| Время получения, UTC | `2026-10-06T13:24:57.674Z` |
| До оптимизации, байт | 133905 |
| После оптимизации, байт | 133905 |
| Ширина, px | 819 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| SHA256 оригинала | `e8537fb81104b09dc7485bdde0ca09cde5aa2c7195803385474158ec8b755104` |
| Статус | `unchanged` |

</details>

<details>
<summary>120. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/autumn.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/autumn.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"f90a4b752885c0625e02499c00c4da61"` |
| Скачивание, мс | 179 |
| Время получения, UTC | `2026-10-06T13:24:57.785Z` |
| До оптимизации, байт | 84129 |
| После оптимизации, байт | 84129 |
| Ширина, px | 599 |
| Высота, px | 749 |
| Формат | `jpeg` |
| SHA256 оригинала | `0119a74ff0cd169247a05a3d3d3ca5a3624536ceb24e1c68ce4be8f0da5e0c43` |
| Статус | `unchanged` |

</details>

<details>
<summary>121. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover-shelf.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover-shelf.jpg` |
| Cache-Control | `public, max-age=31536000` |
| ETag | `"0ec49e149ea5db254d01aabb8e4a5261"` |
| Скачивание, мс | 89 |
| Время получения, UTC | `2026-10-06T13:24:57.875Z` |
| До оптимизации, байт | 59081 |
| После оптимизации, байт | 59081 |
| Ширина, px | 461 |
| Высота, px | 576 |
| Формат | `jpeg` |
| SHA256 оригинала | `3f9a6ab4f24e170d09116a78a4081ba448f73ae9b6bc31963966a92eb82f8964` |
| Статус | `unchanged` |

</details>

<details>
<summary>122. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"b6f08500e737bdaa7aaf964a9de3792f"` |
| Скачивание, мс | 283 |
| Время получения, UTC | `2026-10-06T13:24:58.159Z` |
| До оптимизации, байт | 220828 |
| После оптимизации, байт | 220828 |
| Ширина, px | 900 |
| Высота, px | 1072 |
| Формат | `webp` |
| SHA256 оригинала | `e925aea786078c153d732cb28f853de6162dc149f4a1cf61ba86a18b4c37f511` |
| Статус | `unchanged` |

</details>

<details>
<summary>123. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/crafts.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/crafts.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"41f11800c1afb471d8a4ed37461088b6"` |
| Скачивание, мс | 161 |
| Время получения, UTC | `2026-10-06T13:24:58.115Z` |
| До оптимизации, байт | 90871 |
| После оптимизации, байт | 90871 |
| Ширина, px | 599 |
| Высота, px | 749 |
| Формат | `jpeg` |
| SHA256 оригинала | `f897a762c2317c736537d3cd0ad8423311c73dedb4847604fcf14bfe97587bb3` |
| Статус | `unchanged` |

</details>

<details>
<summary>124. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/toc.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/toc.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"ff346fc541c85d1f2e9320e410e3b9d7"` |
| Скачивание, мс | 173 |
| Время получения, UTC | `2026-10-06T13:24:58.383Z` |
| До оптимизации, байт | 115599 |
| После оптимизации, байт | 115599 |
| Ширина, px | 767 |
| Высота, px | 959 |
| Формат | `jpeg` |
| SHA256 оригинала | `03ddfa2db0d3cb15fc48d02aa82a890c5ee12c3a8ddb46a27e02870c2008d817` |
| Статус | `unchanged` |

</details>

<details>
<summary>125. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-desk.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-desk.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"2b4b82afb64c653d8a85c64019194d7a"` |
| Скачивание, мс | 212 |
| Время получения, UTC | `2026-10-06T13:24:58.584Z` |
| До оптимизации, байт | 99480 |
| После оптимизации, байт | 99480 |
| Ширина, px | 768 |
| Высота, px | 960 |
| Формат | `jpeg` |
| SHA256 оригинала | `5b2b0f6347e2e433b40f9878fe42f1d2471a4d682bf9ac7177bfa6938ce63cd5` |
| Статус | `unchanged` |

</details>

<details>
<summary>126. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-open.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-open.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"13391795e6fef67aff21fb37b37f4380"` |
| Скачивание, мс | 107 |
| Время получения, UTC | `2026-10-06T13:24:58.584Z` |
| До оптимизации, байт | 94729 |
| После оптимизации, байт | 94729 |
| Ширина, px | 768 |
| Высота, px | 960 |
| Формат | `jpeg` |
| SHA256 оригинала | `fe7d1fe62750b2cf9a491cbc0f9216026626db671d213ebf7306b4e525395a13` |
| Статус | `unchanged` |

</details>

<details>
<summary>127. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover-shelf.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover-shelf.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"73e05a8b27ba649db2b33009b3d644cf"` |
| Скачивание, мс | 146 |
| Время получения, UTC | `2026-10-06T13:24:58.878Z` |
| До оптимизации, байт | 93437 |
| После оптимизации, байт | 93437 |
| Ширина, px | 768 |
| Высота, px | 960 |
| Формат | `jpeg` |
| SHA256 оригинала | `17b02b7aeb1298e1e75172d9928e26736e2b9c083bb6d58d3321dd340f11b1a4` |
| Статус | `unchanged` |

</details>

<details>
<summary>128. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"fb116a481d6f47a460a212addbaa1b19"` |
| Скачивание, мс | 313 |
| Время получения, UTC | `2026-10-06T13:24:59.045Z` |
| До оптимизации, байт | 235408 |
| После оптимизации, байт | 235408 |
| Ширина, px | 900 |
| Высота, px | 1186 |
| Формат | `webp` |
| SHA256 оригинала | `56aa8502ff9e5b2fae79f1853c2658ab5004acf89b91c869eea25d2b4439b211` |
| Статус | `unchanged` |

</details>

<details>
<summary>129. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-clothes.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-clothes.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"0ab48d9e1c321ae2f3e5729594edacdb"` |
| Скачивание, мс | 99 |
| Время получения, UTC | `2026-10-06T13:24:59.082Z` |
| До оптимизации, байт | 75128 |
| После оптимизации, байт | 75128 |
| Ширина, px | 768 |
| Высота, px | 960 |
| Формат | `jpeg` |
| SHA256 оригинала | `389e0c07bcd539cfd06026ad2e54fae986ef281810c2a95c961ff7acf3560837` |
| Статус | `unchanged` |

</details>

<details>
<summary>130. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-life.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-life.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"91ef4fdb391517689bf581d7a8061c0a"` |
| Скачивание, мс | 181 |
| Время получения, UTC | `2026-10-06T13:24:59.375Z` |
| До оптимизации, байт | 114264 |
| После оптимизации, байт | 114264 |
| Ширина, px | 779 |
| Высота, px | 974 |
| Формат | `jpeg` |
| SHA256 оригинала | `c7f56ac555ff4f700f49b3ee667f92f7f9afba7cbbf1bc305144c4da23d2d989` |
| Статус | `unchanged` |

</details>

<details>
<summary>131. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-makeover.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-makeover.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"0731cc48c78115f86003830ef59f279b"` |
| Скачивание, мс | 123 |
| Время получения, UTC | `2026-10-06T13:24:59.644Z` |
| До оптимизации, байт | 118033 |
| После оптимизации, байт | 118033 |
| Ширина, px | 782 |
| Высота, px | 978 |
| Формат | `jpeg` |
| SHA256 оригинала | `68b6ccc030f5ff14cb0892ae6440e28b9592cb8a6c0f3e4173b04f453b449acb` |
| Статус | `unchanged` |

</details>

<details>
<summary>132. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-pokoy.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-pokoy.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"bd40b0611a64dca06d63ad44a2c81b2d"` |
| Скачивание, мс | 85 |
| Время получения, UTC | `2026-10-06T13:24:59.808Z` |
| До оптимизации, байт | 86495 |
| После оптимизации, байт | 86495 |
| Ширина, px | 768 |
| Высота, px | 960 |
| Формат | `jpeg` |
| SHA256 оригинала | `f4718e6b103c31383f8af356e7448bfdc5a4f2b922fa35d79987c7bd1ac122d8` |
| Статус | `unchanged` |

</details>

<details>
<summary>133. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-wardrobe.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-wardrobe.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"fef133f27a896e8aeb14a5be7a78ddc6"` |
| Скачивание, мс | 93 |
| Время получения, UTC | `2026-10-06T13:24:59.984Z` |
| До оптимизации, байт | 99201 |
| После оптимизации, байт | 99201 |
| Ширина, px | 774 |
| Высота, px | 968 |
| Формат | `jpeg` |
| SHA256 оригинала | `774faa515dcdce262cf7f7508861846eae32ec247f44b0d9affe266a64573515` |
| Статус | `unchanged` |

</details>

<details>
<summary>134. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/toc.jpg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/toc.jpg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"3a66b76fc0600b70b04c6afbf8fab467"` |
| Скачивание, мс | 79 |
| Время получения, UTC | `2026-10-06T13:25:00.182Z` |
| До оптимизации, байт | 85109 |
| После оптимизации, байт | 85109 |
| Ширина, px | 779 |
| Высота, px | 974 |
| Формат | `jpeg` |
| SHA256 оригинала | `cba2b271f35ac3b40147a88d4045f26e64fff1c2ea57aed59e512d0c22b50cf5` |
| Статус | `unchanged` |

</details>

<details>
<summary>135. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/bqfYlZTjwUTYkjTU.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/bqfYlZTjwUTYkjTU.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"63e88149cd3648c85f3b535d7cabd3bd"` |
| Скачивание, мс | 390 |
| Время получения, UTC | `2026-10-06T13:25:00.817Z` |
| До оптимизации, байт | 152939 |
| После оптимизации, байт | 152939 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `6a2251b19e6b75297efeb28064fecd7552bad12d7874970f39e819bd592aa66a` |
| Статус | `unchanged` |

</details>

<details>
<summary>136. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/duefjXzIoLGcxdSk.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/duefjXzIoLGcxdSk.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"7642aa63b701f9f668bc491f17d0d6ae"` |
| Скачивание, мс | 241 |
| Время получения, UTC | `2026-10-06T13:25:01.193Z` |
| До оптимизации, байт | 248802 |
| После оптимизации, байт | 248802 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `7bd45334ad3a284b23c7b9f74ba775902deea37a772a12c1337f1b699ba73ba1` |
| Статус | `unchanged` |

</details>

<details>
<summary>137. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/eWHYEgFyQkkTVIac.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/eWHYEgFyQkkTVIac.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"a3173228bb6f6375823830783178a857"` |
| Скачивание, мс | 149 |
| Время получения, UTC | `2026-10-06T13:25:01.469Z` |
| До оптимизации, байт | 50474 |
| После оптимизации, байт | 50474 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `4acf43bd33947211a7355394d14fe6ddc1166839d4cde2192e70299b05c013ba` |
| Статус | `unchanged` |

</details>

<details>
<summary>138. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/fHBiLIdoOBjhvOYB.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/fHBiLIdoOBjhvOYB.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"02f85aaaf6a6ceb14896d98cf34878e9"` |
| Скачивание, мс | 202 |
| Время получения, UTC | `2026-10-06T13:25:02.017Z` |
| До оптимизации, байт | 185160 |
| После оптимизации, байт | 185160 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `845ed9f9554d874ff04811f2c1dd3b1ec0f04c11fb351b4ab1ca25990b340a39` |
| Статус | `unchanged` |

</details>

<details>
<summary>139. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/GyoFVkxRZaWzdOws.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/GyoFVkxRZaWzdOws.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"7e69de5a418691abfbc961f5967bb710"` |
| Скачивание, мс | 247 |
| Время получения, UTC | `2026-10-06T13:24:54.667Z` |
| До оптимизации, байт | 258174 |
| После оптимизации, байт | 258174 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `ad19dca6246121e481e926fa733d30b8fca32a50f35178daeca515f3b4d630a9` |
| Статус | `unchanged` |

</details>

<details>
<summary>140. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/KmoncPQbMmceOtFu.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/KmoncPQbMmceOtFu.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"4e1612de93de758fbfa28d125ec03836"` |
| Скачивание, мс | 178 |
| Время получения, UTC | `2026-10-06T13:24:54.984Z` |
| До оптимизации, байт | 216616 |
| После оптимизации, байт | 216616 |
| Ширина, px | 1200 |
| Высота, px | 1501 |
| Формат | `jpeg` |
| SHA256 оригинала | `646bdc76fc5091a66ba6db641ae654568742c8be6d3ee1919de9932d51a32847` |
| Статус | `unchanged` |

</details>

<details>
<summary>141. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/luiZwEIyLvSFPdXH.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/luiZwEIyLvSFPdXH.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"bf4eb10874399b2434f2e2167a9cc48f"` |
| Скачивание, мс | 249 |
| Время получения, UTC | `2026-10-06T13:25:02.213Z` |
| До оптимизации, байт | 137850 |
| После оптимизации, байт | 137850 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `4a441db8546936210fed88b2f80d1d3e9b80a3cffee0dcf4ad9ffdad1fc6e324` |
| Статус | `unchanged` |

</details>

<details>
<summary>142. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/mltnKcpNhCFwXkYN.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/mltnKcpNhCFwXkYN.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"2dc9a323807e19b57dbc15976734e63b"` |
| Скачивание, мс | 221 |
| Время получения, UTC | `2026-10-06T13:25:02.416Z` |
| До оптимизации, байт | 248952 |
| После оптимизации, байт | 248952 |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| SHA256 оригинала | `03207d820749558012f5044b5e55286462a39bde3504ca2dec2b38e7ec72f499` |
| Статус | `unchanged` |

</details>

<details>
<summary>143. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/moLPhaYtFBzPVhrp.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/moLPhaYtFBzPVhrp.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"5fff59c015063b85e00fce4d9bf2ae1b"` |
| Скачивание, мс | 366 |
| Время получения, UTC | `2026-10-06T13:25:02.705Z` |
| До оптимизации, байт | 137464 |
| После оптимизации, байт | 137464 |
| Ширина, px | 1200 |
| Высота, px | 1501 |
| Формат | `jpeg` |
| SHA256 оригинала | `392611db3245d110d5715e15d75e2228e70fc2ee8633e2ae1ae478135923fe92` |
| Статус | `unchanged` |

</details>

<details>
<summary>144. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/nZoznAbRePJnvALl.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/nZoznAbRePJnvALl.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"faaddc78e177e7d0a5cd07367a6ca181"` |
| Скачивание, мс | 213 |
| Время получения, UTC | `2026-10-06T13:25:02.752Z` |
| До оптимизации, байт | 168023 |
| После оптимизации, байт | 168023 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `8cc63ba653c19bde7f0ad92c50b0e3cf69b99e49795085b716005c8b28fa0480` |
| Статус | `unchanged` |

</details>

<details>
<summary>145. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/OpGQZMvzgVXxbwhN.jpeg</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/OpGQZMvzgVXxbwhN.jpeg` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"8e1b9689b493b6b58acd88097b9bc5b1"` |
| Скачивание, мс | 595 |
| Время получения, UTC | `2026-10-06T13:24:55.500Z` |
| До оптимизации, байт | 167403 |
| После оптимизации, байт | 167403 |
| Ширина, px | 1200 |
| Высота, px | 1501 |
| Формат | `jpeg` |
| SHA256 оригинала | `889b6a685557bc5237fc5db32c93b89be101000a3a71954af8a7b1bf2cc2898b` |
| Статус | `unchanged` |

</details>

<details>
<summary>146. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/PBfYGmrZAiWpzHvD.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/PBfYGmrZAiWpzHvD.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"16ea0ce0662f30ab8926c91f41bbad04"` |
| Скачивание, мс | 586 |
| Время получения, UTC | `2026-10-06T13:24:55.500Z` |
| До оптимизации, байт | 130780 |
| После оптимизации, байт | 130780 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `386097ba2cc4437d4f468e3eba6d08288873d9917a6d1e47b837254ead6f80c2` |
| Статус | `unchanged` |

</details>

<details>
<summary>147. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/SposdtLMcZWpTsyM.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/SposdtLMcZWpTsyM.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"c5913dd232dff77416966ec55e04c367"` |
| Скачивание, мс | 299 |
| Время получения, UTC | `2026-10-06T13:24:55.399Z` |
| До оптимизации, байт | 326777 |
| После оптимизации, байт | 326777 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `1301ac8af2c0a8ded71d24f9f8040b44ad705a09467a7760143f79a4c2cb1e0a` |
| Статус | `unchanged` |

</details>

<details>
<summary>148. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/vjdQHvFhVxKjVyWq.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/vjdQHvFhVxKjVyWq.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"4990172b1f2336c40e97bea35f73ea2b"` |
| Скачивание, мс | 104 |
| Время получения, UTC | `2026-10-06T13:25:02.919Z` |
| До оптимизации, байт | 31812 |
| После оптимизации, байт | 31812 |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| SHA256 оригинала | `b01f5f52dcb6fccf0a1770990ce5cc141887c41b1c24a6e2985e92e5bf18134f` |
| Статус | `unchanged` |

</details>

<details>
<summary>149. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/VTdmWRaePLfvfgrq.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/VTdmWRaePLfvfgrq.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"e11d66da25638d7353e37cd3e4a3bdbf"` |
| Скачивание, мс | 248 |
| Время получения, UTC | `2026-10-06T13:24:55.901Z` |
| До оптимизации, байт | 162849 |
| После оптимизации, байт | 162849 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `909db07ec1151fec05508fcb2a3198100d2114a3a13a25765a443f2aad336c7c` |
| Статус | `unchanged` |

</details>

<details>
<summary>150. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/xGKrarMYfeycHdkb.JPG</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/xGKrarMYfeycHdkb.JPG` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"7f8b09549293d6d768a4e363aa3ca181"` |
| Скачивание, мс | 215 |
| Время получения, UTC | `2026-10-06T13:25:03.135Z` |
| До оптимизации, байт | 211965 |
| После оптимизации, байт | 211965 |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| SHA256 оригинала | `2dbc4a52aafdc95800cec7358efd4e1a601ccadc033b64bb55e2245115c45475` |
| Статус | `unchanged` |

</details>

<details>
<summary>151. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/videos/film-strip.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/videos/film-strip.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"d56e31611e5e52f81212ce2a51957802"` |
| Скачивание, мс | 81 |
| Время получения, UTC | `2026-10-06T13:25:03.368Z` |
| До оптимизации, байт | 60092 |
| После оптимизации, байт | 60092 |
| Ширина, px | 1200 |
| Высота, px | 1200 |
| Формат | `webp` |
| SHA256 оригинала | `422b311f3f24399af30a57a65841465173064d68dada826c5aca1a2ea91a4813` |
| Статус | `unchanged` |

</details>

<details>
<summary>152. https://s3.twcstorage.ru/daryadarcy-s3/app-assets/videos/rose-hip-branches.webp</summary>

| Поле | Значение |
| --- | --- |
| URL оригинала | `https://s3.twcstorage.ru/daryadarcy-s3/app-assets/videos/rose-hip-branches.webp` |
| Cache-Control | `public, max-age=31536000, immutable` |
| ETag | `"b79b18f7c8297a179f57ece1a11ec7fe"` |
| Скачивание, мс | 257 |
| Время получения, UTC | `2026-10-06T13:25:03.563Z` |
| До оптимизации, байт | 116852 |
| После оптимизации, байт | 116852 |
| Ширина, px | 800 |
| Высота, px | 902 |
| Формат | `webp` |
| SHA256 оригинала | `87c865e227ac50ab5a5f24324d4a76a2e8be9defad300d83b5966d937eee2a88` |
| Статус | `unchanged` |

</details>
