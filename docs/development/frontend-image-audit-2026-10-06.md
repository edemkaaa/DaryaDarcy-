# Аудит локальных изображений фронтенда — 6 октября 2026 года

**Исторический снимок первого этапа оптимизации без изменения разрешения.** После этого статичные изображения получили локальные адаптивные превью. Этот отчёт не описывает вес текущей страницы и не подтверждает наличие старых производных файлов после последующих изменений. Актуальные варианты указаны в [манифесте изображений](../../apps/frontend/image-variants.json).

На этом этапе меньший файл применялся только после проверки совпадения декодированных пикселей. Бэкенд, пользовательские загрузки и исходные объекты S3 не изменялись.

## Сводка

| Показатель | Результат |
| --- | --- |
| Режим | Изменения применены (`applied`) |
| Запрошено изображений | 279 |
| Проверено изображений | 279 |
| Оптимизировано | 49 |
| Без изменений | 230 |
| Исходный вес, байт | 28 303 803 |
| Вес после этого этапа, байт | 27 865 263 |
| Экономия, байт | 438 540 |
| Экономия от исходного веса | 1,55% |
| jpegtran доступен | Да |

[Исходные данные для инструментов](../../tooling/data/frontend-audits/frontend-image-audit-2026-10-06.json) сохранены отдельно от документации, без изменения значений.

## Как читать результаты

`pixel-identical` — применён меньший файл с совпадающими декодированными пикселями; `unchanged` — исходник сохранён. Контрольные суммы относятся к моменту этого аудита. Значения объёма указаны в байтах, размеры — в пикселях.

## Полный список файлов

| № | Оригинал | Размер, px | Формат | До, байт | После, байт | Экономия, байт | Статус |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/assets/images/favicon.png` | 192 × 192 | png | 60 437 | 60 437 | 0 | unchanged |
| 2 | `/assets/images/home/about_author_bg.jpg` | 1200 × 675 | jpeg | 127 587 | 122 509 | 5 078 | pixel-identical |
| 3 | `/assets/images/home/book_olive.webp` | 880 × 586 | webp | 29 070 | 29 070 | 0 | unchanged |
| 4 | `/assets/images/home/hero_header.jpg` | 1400 × 875 | jpeg | 194 382 | 194 382 | 0 | unchanged |
| 5 | `/assets/images/home/medallion_temp.webp` | 600 × 480 | webp | 31 980 | 31 980 | 0 | unchanged |
| 6 | `/assets/images/home/promo/promo-club.webp` | 1024 × 577 | webp | 129 886 | 129 886 | 0 | unchanged |
| 7 | `/assets/images/home/promo/promo-feed.webp` | 1024 × 577 | webp | 99 584 | 99 584 | 0 | unchanged |
| 8 | `/assets/images/home/promo/promo-quiz.webp` | 1024 × 577 | webp | 126 642 | 126 642 | 0 | unchanged |
| 9 | `/assets/images/icon.png` | 512 × 512 | png | 393 904 | 393 904 | 0 | unchanged |
| 10 | `/assets/images/legal-documents-folder.webp` | 1024 × 819 | webp | 198 028 | 198 028 | 0 | unchanged |
| 11 | `/assets/interactive/ivy-left.png` | 540 × 432 | png | 125 925 | 125 925 | 0 | unchanged |
| 12 | `/assets/interactive/ivy-right.png` | 540 × 432 | png | 125 927 | 125 927 | 0 | unchanged |
| 13 | `/assets/interactive/key-decor.png` | 360 × 288 | png | 44 538 | 44 538 | 0 | unchanged |
| 14 | `/assets/interactive/quiz-cover.jpg` | 1200 × 840 | jpeg | 175 311 | 169 425 | 5 886 | pixel-identical |
| 15 | `/assets/quiz/animals/castlecore.png` | 600 × 480 | png | 109 169 | 109 169 | 0 | unchanged |
| 16 | `/assets/quiz/animals/cottagecore.png` | 600 × 480 | png | 87 978 | 87 978 | 0 | unchanged |
| 17 | `/assets/quiz/animals/dark-academia.png` | 600 × 480 | png | 155 905 | 155 905 | 0 | unchanged |
| 18 | `/assets/quiz/animals/fairycore.png` | 600 × 480 | png | 104 075 | 104 075 | 0 | unchanged |
| 19 | `/assets/quiz/animals/goblincore.webp` | 600 × 480 | webp | 33 652 | 33 652 | 0 | unchanged |
| 20 | `/assets/quiz/animals/light-academia.png` | 600 × 480 | png | 155 920 | 155 920 | 0 | unchanged |
| 21 | `/assets/quiz/animals/witchcore.png` | 600 × 480 | png | 100 739 | 100 739 | 0 | unchanged |
| 22 | `/assets/quiz/artifacts/castlecore.webp` | 800 × 1000 | webp | 73 984 | 73 984 | 0 | unchanged |
| 23 | `/assets/quiz/artifacts/cottagecore.webp` | 800 × 1000 | webp | 78 232 | 78 232 | 0 | unchanged |
| 24 | `/assets/quiz/artifacts/dark-academia.webp` | 800 × 1000 | webp | 56 426 | 56 426 | 0 | unchanged |
| 25 | `/assets/quiz/artifacts/fairycore.webp` | 800 × 1000 | webp | 54 442 | 54 442 | 0 | unchanged |
| 26 | `/assets/quiz/artifacts/goblincore.webp` | 800 × 1000 | webp | 71 978 | 71 978 | 0 | unchanged |
| 27 | `/assets/quiz/artifacts/light-academia.webp` | 800 × 1000 | webp | 56 190 | 56 190 | 0 | unchanged |
| 28 | `/assets/quiz/artifacts/witchcore.webp` | 800 × 1000 | webp | 70 162 | 70 162 | 0 | unchanged |
| 29 | `/assets/quiz/chest.webp` | 800 × 640 | webp | 32 868 | 32 868 | 0 | unchanged |
| 30 | `/assets/quiz/houses/castlecore.jpg` | 960 × 960 | jpeg | 145 930 | 145 930 | 0 | unchanged |
| 31 | `/assets/quiz/houses/cottagecore.jpg` | 960 × 960 | jpeg | 183 391 | 183 391 | 0 | unchanged |
| 32 | `/assets/quiz/houses/dark-academia.jpg` | 960 × 960 | jpeg | 194 760 | 194 760 | 0 | unchanged |
| 33 | `/assets/quiz/houses/fairycore.jpg` | 960 × 960 | jpeg | 210 555 | 210 555 | 0 | unchanged |
| 34 | `/assets/quiz/houses/goblincore.jpg` | 960 × 960 | jpeg | 166 171 | 166 171 | 0 | unchanged |
| 35 | `/assets/quiz/houses/light-academia.jpg` | 960 × 960 | jpeg | 158 226 | 158 226 | 0 | unchanged |
| 36 | `/assets/quiz/houses/witchcore.jpg` | 960 × 960 | jpeg | 170 418 | 170 418 | 0 | unchanged |
| 37 | `/assets/quiz/landscapes/castlecore.jpg` | 960 × 960 | jpeg | 156 352 | 156 352 | 0 | unchanged |
| 38 | `/assets/quiz/landscapes/cottagecore.jpg` | 960 × 1200 | jpeg | 229 890 | 229 890 | 0 | unchanged |
| 39 | `/assets/quiz/landscapes/dark-academia.jpg` | 960 × 1200 | jpeg | 174 180 | 174 180 | 0 | unchanged |
| 40 | `/assets/quiz/landscapes/fairycore.jpg` | 960 × 960 | jpeg | 155 978 | 155 978 | 0 | unchanged |
| 41 | `/assets/quiz/landscapes/goblincore.jpg` | 960 × 960 | jpeg | 112 448 | 112 448 | 0 | unchanged |
| 42 | `/assets/quiz/landscapes/light-academia.jpg` | 960 × 1200 | jpeg | 196 078 | 196 078 | 0 | unchanged |
| 43 | `/assets/quiz/landscapes/witchcore.jpg` | 960 × 960 | jpeg | 155 407 | 155 407 | 0 | unchanged |
| 44 | `/assets/quiz/outfits/castlecore.webp` | 600 × 1301 | webp | 87 326 | 87 326 | 0 | unchanged |
| 45 | `/assets/quiz/outfits/cottagecore.webp` | 600 × 1301 | webp | 66 208 | 66 208 | 0 | unchanged |
| 46 | `/assets/quiz/outfits/dark-academia.webp` | 600 × 1301 | webp | 52 534 | 52 534 | 0 | unchanged |
| 47 | `/assets/quiz/outfits/fairycore.webp` | 600 × 1301 | webp | 68 536 | 68 536 | 0 | unchanged |
| 48 | `/assets/quiz/outfits/goblincore.webp` | 600 × 1301 | webp | 74 790 | 74 790 | 0 | unchanged |
| 49 | `/assets/quiz/outfits/light-academia.webp` | 600 × 1301 | webp | 45 610 | 45 610 | 0 | unchanged |
| 50 | `/assets/quiz/outfits/witchcore.webp` | 600 × 1301 | webp | 47 854 | 47 854 | 0 | unchanged |
| 51 | `/assets/quiz/shelters/castlecore.jpg` | 960 × 960 | jpeg | 116 821 | 116 821 | 0 | unchanged |
| 52 | `/assets/quiz/shelters/cottagecore.jpg` | 960 × 960 | jpeg | 146 877 | 146 877 | 0 | unchanged |
| 53 | `/assets/quiz/shelters/dark-academia.jpg` | 960 × 960 | jpeg | 82 465 | 82 263 | 202 | pixel-identical |
| 54 | `/assets/quiz/shelters/fairycore.jpg` | 960 × 960 | jpeg | 162 860 | 162 860 | 0 | unchanged |
| 55 | `/assets/quiz/shelters/goblincore.jpg` | 960 × 960 | jpeg | 156 863 | 156 863 | 0 | unchanged |
| 56 | `/assets/quiz/shelters/light-academia.jpg` | 960 × 960 | jpeg | 124 797 | 124 797 | 0 | unchanged |
| 57 | `/assets/quiz/shelters/witchcore.jpg` | 960 × 960 | jpeg | 107 211 | 107 211 | 0 | unchanged |
| 58 | `/assets/quiz/start-collage.webp` | 1000 × 800 | webp | 119 232 | 119 232 | 0 | unchanged |
| 59 | `/assets/results/castlecore/interiors/interior1.jpg` | 668 × 844 | jpeg | 112 339 | 112 339 | 0 | unchanged |
| 60 | `/assets/results/castlecore/interiors/interior10.jpg` | 500 × 633 | jpeg | 99 519 | 88 629 | 10 890 | pixel-identical |
| 61 | `/assets/results/castlecore/interiors/interior11.jpg` | 531 × 648 | jpeg | 121 151 | 100 833 | 20 318 | pixel-identical |
| 62 | `/assets/results/castlecore/interiors/interior12.jpg` | 474 × 711 | jpeg | 71 527 | 71 527 | 0 | unchanged |
| 63 | `/assets/results/castlecore/interiors/interior13.jpg` | 736 × 1104 | jpeg | 119 574 | 119 574 | 0 | unchanged |
| 64 | `/assets/results/castlecore/interiors/interior2.jpg` | 974 × 1200 | jpeg | 193 898 | 193 898 | 0 | unchanged |
| 65 | `/assets/results/castlecore/interiors/interior3.jpg` | 750 × 1123 | jpeg | 54 488 | 54 488 | 0 | unchanged |
| 66 | `/assets/results/castlecore/interiors/interior4.jpg` | 520 × 712 | jpeg | 112 331 | 95 928 | 16 403 | pixel-identical |
| 67 | `/assets/results/castlecore/interiors/interior5.jpg` | 400 × 500 | jpeg | 44 322 | 44 322 | 0 | unchanged |
| 68 | `/assets/results/castlecore/interiors/interior6.jpg` | 523 × 800 | jpeg | 116 157 | 98 968 | 17 189 | pixel-identical |
| 69 | `/assets/results/castlecore/interiors/interior7.jpg` | 900 × 1567 | jpeg | 199 073 | 199 073 | 0 | unchanged |
| 70 | `/assets/results/castlecore/interiors/interior8.jpg` | 750 × 1000 | jpeg | 107 296 | 107 296 | 0 | unchanged |
| 71 | `/assets/results/castlecore/interiors/interior9.jpg` | 900 × 1226 | jpeg | 158 184 | 155 374 | 2 810 | pixel-identical |
| 72 | `/assets/results/castlecore/moodboards/mood1.jpg` | 506 × 686 | jpeg | 65 709 | 65 709 | 0 | unchanged |
| 73 | `/assets/results/castlecore/moodboards/mood2.jpg` | 1023 × 1537 | jpeg | 80 507 | 80 507 | 0 | unchanged |
| 74 | `/assets/results/castlecore/moodboards/mood3.jpg` | 969 × 1200 | jpeg | 118 452 | 118 341 | 111 | pixel-identical |
| 75 | `/assets/results/castlecore/moodboards/mood4.jpg` | 735 × 890 | jpeg | 62 887 | 62 887 | 0 | unchanged |
| 76 | `/assets/results/castlecore/moodboards/mood5.jpg` | 1080 × 1440 | jpeg | 107 992 | 107 827 | 165 | pixel-identical |
| 77 | `/assets/results/castlecore/moodboards/mood6.jpg` | 900 × 1000 | jpeg | 166 675 | 162 945 | 3 730 | pixel-identical |
| 78 | `/assets/results/castlecore/moodboards/mood7.jpg` | 828 × 1031 | jpeg | 108 090 | 108 090 | 0 | unchanged |
| 79 | `/assets/results/castlecore/moodboards/mood8.jpg` | 1000 × 1500 | jpeg | 116 968 | 116 968 | 0 | unchanged |
| 80 | `/assets/results/castlecore/moodboards/mood9.jpg` | 750 × 750 | jpeg | 73 833 | 73 833 | 0 | unchanged |
| 81 | `/assets/results/castlecore/outfits/outfit1.webp` | 749 × 999 | webp | 38 084 | 38 084 | 0 | unchanged |
| 82 | `/assets/results/castlecore/outfits/outfit10.webp` | 522 × 560 | webp | 32 904 | 32 904 | 0 | unchanged |
| 83 | `/assets/results/castlecore/outfits/outfit11.webp` | 649 × 862 | webp | 73 162 | 73 162 | 0 | unchanged |
| 84 | `/assets/results/castlecore/outfits/outfit12.webp` | 700 × 1121 | webp | 41 976 | 41 976 | 0 | unchanged |
| 85 | `/assets/results/castlecore/outfits/outfit2.webp` | 600 × 953 | webp | 98 554 | 98 554 | 0 | unchanged |
| 86 | `/assets/results/castlecore/outfits/outfit3.png` | 580 × 580 | png | 177 501 | 113 658 | 63 843 | pixel-identical |
| 87 | `/assets/results/castlecore/outfits/outfit4.webp` | 736 × 981 | webp | 31 328 | 31 328 | 0 | unchanged |
| 88 | `/assets/results/castlecore/outfits/outfit5.webp` | 900 × 1095 | webp | 43 272 | 43 272 | 0 | unchanged |
| 89 | `/assets/results/castlecore/outfits/outfit6.webp` | 1080 × 977 | webp | 38 702 | 38 702 | 0 | unchanged |
| 90 | `/assets/results/castlecore/outfits/outfit7.webp` | 900 × 900 | webp | 55 796 | 55 796 | 0 | unchanged |
| 91 | `/assets/results/castlecore/outfits/outfit8.webp` | 720 × 789 | webp | 22 854 | 22 854 | 0 | unchanged |
| 92 | `/assets/results/castlecore/outfits/outfit9.webp` | 700 × 889 | webp | 62 232 | 62 232 | 0 | unchanged |
| 93 | `/assets/results/cottagecore/interiors/interior1.jpg` | 800 × 642 | jpeg | 172 354 | 160 283 | 12 071 | pixel-identical |
| 94 | `/assets/results/cottagecore/interiors/interior2.jpg` | 750 × 1000 | jpeg | 129 748 | 125 536 | 4 212 | pixel-identical |
| 95 | `/assets/results/cottagecore/interiors/interior3.jpg` | 800 × 889 | jpeg | 167 755 | 160 026 | 7 729 | pixel-identical |
| 96 | `/assets/results/cottagecore/interiors/interior4.jpg` | 800 × 1120 | jpeg | 193 314 | 193 314 | 0 | unchanged |
| 97 | `/assets/results/cottagecore/moodboards/moodboard1.png` | 700 × 560 | png | 108 232 | 108 232 | 0 | unchanged |
| 98 | `/assets/results/cottagecore/moodboards/moodboard2.webp` | 700 × 560 | webp | 37 580 | 37 580 | 0 | unchanged |
| 99 | `/assets/results/cottagecore/moodboards/moodboard3.png` | 700 × 560 | png | 123 602 | 123 602 | 0 | unchanged |
| 100 | `/assets/results/cottagecore/moodboards/moodboard4.webp` | 700 × 560 | webp | 34 422 | 34 422 | 0 | unchanged |
| 101 | `/assets/results/cottagecore/moodboards/moodboard5.png` | 700 × 560 | png | 117 344 | 117 344 | 0 | unchanged |
| 102 | `/assets/results/cottagecore/moodboards/moodboard6.png` | 700 × 560 | png | 135 818 | 135 818 | 0 | unchanged |
| 103 | `/assets/results/cottagecore/moodboards/moodboard7.webp` | 700 × 560 | webp | 19 836 | 19 836 | 0 | unchanged |
| 104 | `/assets/results/cottagecore/moodboards/moodboard8.webp` | 700 × 560 | webp | 41 256 | 41 256 | 0 | unchanged |
| 105 | `/assets/results/cottagecore/moodboards/moodboard9.png` | 700 × 560 | png | 115 036 | 115 036 | 0 | unchanged |
| 106 | `/assets/results/cottagecore/outfits/outfit1.jpg` | 600 × 869 | jpeg | 92 027 | 88 986 | 3 041 | pixel-identical |
| 107 | `/assets/results/cottagecore/outfits/outfit10.jpg` | 600 × 818 | jpeg | 80 099 | 77 877 | 2 222 | pixel-identical |
| 108 | `/assets/results/cottagecore/outfits/outfit11.jpg` | 600 × 960 | jpeg | 23 462 | 23 462 | 0 | unchanged |
| 109 | `/assets/results/cottagecore/outfits/outfit12.jpg` | 600 × 750 | jpeg | 31 251 | 30 313 | 938 | pixel-identical |
| 110 | `/assets/results/cottagecore/outfits/outfit2.jpg` | 417 × 540 | jpeg | 73 640 | 69 172 | 4 468 | pixel-identical |
| 111 | `/assets/results/cottagecore/outfits/outfit3.jpg` | 600 × 899 | jpeg | 106 397 | 102 144 | 4 253 | pixel-identical |
| 112 | `/assets/results/cottagecore/outfits/outfit4.jpg` | 600 × 704 | jpeg | 121 523 | 114 319 | 7 204 | pixel-identical |
| 113 | `/assets/results/cottagecore/outfits/outfit5.jpg` | 600 × 899 | jpeg | 122 962 | 118 733 | 4 229 | pixel-identical |
| 114 | `/assets/results/cottagecore/outfits/outfit6.jpg` | 600 × 855 | jpeg | 66 407 | 65 477 | 930 | pixel-identical |
| 115 | `/assets/results/cottagecore/outfits/outfit7.jpg` | 600 × 877 | jpeg | 130 660 | 124 935 | 5 725 | pixel-identical |
| 116 | `/assets/results/cottagecore/outfits/outfit8.jpg` | 600 × 894 | jpeg | 128 584 | 123 146 | 5 438 | pixel-identical |
| 117 | `/assets/results/cottagecore/outfits/outfit9.jpg` | 600 × 750 | jpeg | 117 783 | 111 543 | 6 240 | pixel-identical |
| 118 | `/assets/results/darkacademia/interiors/interior1.webp` | 1024 × 1024 | webp | 53 152 | 53 152 | 0 | unchanged |
| 119 | `/assets/results/darkacademia/interiors/interior2.jpg` | 474 × 842 | jpeg | 147 577 | 122 738 | 24 839 | pixel-identical |
| 120 | `/assets/results/darkacademia/interiors/interior3.jpg` | 564 × 846 | jpeg | 75 683 | 75 683 | 0 | unchanged |
| 121 | `/assets/results/darkacademia/interiors/interior4.jpg` | 900 × 900 | jpeg | 141 660 | 138 054 | 3 606 | pixel-identical |
| 122 | `/assets/results/darkacademia/interiors/interior5.jpg` | 564 × 705 | jpeg | 53 963 | 53 963 | 0 | unchanged |
| 123 | `/assets/results/darkacademia/interiors/interior6.jpg` | 720 × 1280 | jpeg | 162 209 | 162 209 | 0 | unchanged |
| 124 | `/assets/results/darkacademia/interiors/interior7.webp` | 700 × 1520 | webp | 75 954 | 75 954 | 0 | unchanged |
| 125 | `/assets/results/darkacademia/interiors/interior8.jpg` | 900 × 1350 | jpeg | 173 014 | 173 014 | 0 | unchanged |
| 126 | `/assets/results/darkacademia/moodboards/moodboard1.jpg` | 419 × 552 | jpeg | 35 711 | 35 711 | 0 | unchanged |
| 127 | `/assets/results/darkacademia/moodboards/moodboard2.jpg` | 736 × 1104 | jpeg | 125 377 | 125 377 | 0 | unchanged |
| 128 | `/assets/results/darkacademia/moodboards/moodboard3.jpg` | 736 × 1196 | jpeg | 168 967 | 168 967 | 0 | unchanged |
| 129 | `/assets/results/darkacademia/moodboards/moodboard4.jpg` | 736 × 1086 | jpeg | 75 841 | 75 635 | 206 | pixel-identical |
| 130 | `/assets/results/darkacademia/moodboards/moodboard5.jpg` | 1200 × 1600 | jpeg | 243 644 | 243 644 | 0 | unchanged |
| 131 | `/assets/results/darkacademia/moodboards/moodboard6.jpg` | 900 × 1125 | jpeg | 161 615 | 156 085 | 5 530 | pixel-identical |
| 132 | `/assets/results/darkacademia/moodboards/moodboard7.jpg` | 1000 × 1500 | jpeg | 108 801 | 108 801 | 0 | unchanged |
| 133 | `/assets/results/darkacademia/moodboards/moodboard8.jpg` | 553 × 779 | jpeg | 54 802 | 54 802 | 0 | unchanged |
| 134 | `/assets/results/darkacademia/outfits/outfit1.webp` | 900 × 720 | webp | 37 956 | 37 956 | 0 | unchanged |
| 135 | `/assets/results/darkacademia/outfits/outfit10.webp` | 640 × 626 | webp | 65 850 | 65 850 | 0 | unchanged |
| 136 | `/assets/results/darkacademia/outfits/outfit11.webp` | 510 × 680 | webp | 49 574 | 49 574 | 0 | unchanged |
| 137 | `/assets/results/darkacademia/outfits/outfit12.webp` | 700 × 674 | webp | 81 676 | 81 676 | 0 | unchanged |
| 138 | `/assets/results/darkacademia/outfits/outfit13.png` | 293 × 421 | png | 71 723 | 47 098 | 24 625 | pixel-identical |
| 139 | `/assets/results/darkacademia/outfits/outfit2.webp` | 1200 × 960 | webp | 21 274 | 21 274 | 0 | unchanged |
| 140 | `/assets/results/darkacademia/outfits/outfit3.webp` | 700 × 1050 | webp | 122 018 | 122 018 | 0 | unchanged |
| 141 | `/assets/results/darkacademia/outfits/outfit4.webp` | 900 × 900 | webp | 43 134 | 43 134 | 0 | unchanged |
| 142 | `/assets/results/darkacademia/outfits/outfit5.webp` | 900 × 900 | webp | 17 454 | 17 454 | 0 | unchanged |
| 143 | `/assets/results/darkacademia/outfits/outfit6.webp` | 500 × 600 | webp | 35 824 | 35 824 | 0 | unchanged |
| 144 | `/assets/results/darkacademia/outfits/outfit7.webp` | 600 × 942 | webp | 110 714 | 110 714 | 0 | unchanged |
| 145 | `/assets/results/darkacademia/outfits/outfit8.webp` | 900 × 822 | webp | 24 652 | 24 652 | 0 | unchanged |
| 146 | `/assets/results/darkacademia/outfits/outfit9.webp` | 600 × 600 | webp | 26 950 | 26 950 | 0 | unchanged |
| 147 | `/assets/results/fairycore/interiors/interior1.jpg` | 720 × 888 | jpeg | 105 558 | 105 558 | 0 | unchanged |
| 148 | `/assets/results/fairycore/interiors/interior10.jpg` | 710 × 712 | jpeg | 75 829 | 75 829 | 0 | unchanged |
| 149 | `/assets/results/fairycore/interiors/interior2.jpg` | 900 × 1200 | jpeg | 220 108 | 220 108 | 0 | unchanged |
| 150 | `/assets/results/fairycore/interiors/interior3.jpg` | 736 × 993 | jpeg | 160 295 | 160 295 | 0 | unchanged |
| 151 | `/assets/results/fairycore/interiors/interior4.jpg` | 750 × 1125 | jpeg | 167 214 | 167 214 | 0 | unchanged |
| 152 | `/assets/results/fairycore/interiors/interior5.jpg` | 960 × 720 | jpeg | 124 712 | 124 712 | 0 | unchanged |
| 153 | `/assets/results/fairycore/interiors/interior6.jpg` | 490 × 490 | jpeg | 93 571 | 82 702 | 10 869 | pixel-identical |
| 154 | `/assets/results/fairycore/interiors/interior7.jpg` | 736 × 1012 | jpeg | 152 557 | 152 557 | 0 | unchanged |
| 155 | `/assets/results/fairycore/interiors/interior8.jpg` | 683 × 879 | jpeg | 129 835 | 129 835 | 0 | unchanged |
| 156 | `/assets/results/fairycore/interiors/interior9.jpg` | 736 × 981 | jpeg | 136 680 | 136 680 | 0 | unchanged |
| 157 | `/assets/results/fairycore/moodboards/look1.jpg` | 554 × 758 | jpeg | 59 351 | 59 351 | 0 | unchanged |
| 158 | `/assets/results/fairycore/moodboards/look2.jpg` | 667 × 1000 | jpeg | 108 522 | 108 522 | 0 | unchanged |
| 159 | `/assets/results/fairycore/moodboards/look3.jpg` | 756 × 756 | jpeg | 106 110 | 106 110 | 0 | unchanged |
| 160 | `/assets/results/fairycore/moodboards/look4.jpg` | 860 × 1200 | jpeg | 191 505 | 191 505 | 0 | unchanged |
| 161 | `/assets/results/fairycore/moodboards/look5.jpg` | 800 × 1200 | jpeg | 204 713 | 204 713 | 0 | unchanged |
| 162 | `/assets/results/fairycore/moodboards/look6.jpg` | 720 × 1200 | jpeg | 155 138 | 150 492 | 4 646 | pixel-identical |
| 163 | `/assets/results/fairycore/moodboards/look7.jpg` | 828 × 1153 | jpeg | 133 247 | 133 247 | 0 | unchanged |
| 164 | `/assets/results/fairycore/moodboards/look8.jpg` | 720 × 960 | jpeg | 116 564 | 116 420 | 144 | pixel-identical |
| 165 | `/assets/results/fairycore/outfits/outfit1.webp` | 600 × 600 | webp | 59 472 | 59 472 | 0 | unchanged |
| 166 | `/assets/results/fairycore/outfits/outfit10.webp` | 1200 × 960 | webp | 61 874 | 61 874 | 0 | unchanged |
| 167 | `/assets/results/fairycore/outfits/outfit11.webp` | 500 × 500 | webp | 56 524 | 56 524 | 0 | unchanged |
| 168 | `/assets/results/fairycore/outfits/outfit12.webp` | 736 × 736 | webp | 53 656 | 53 656 | 0 | unchanged |
| 169 | `/assets/results/fairycore/outfits/outfit2.webp` | 900 × 1200 | webp | 78 758 | 78 758 | 0 | unchanged |
| 170 | `/assets/results/fairycore/outfits/outfit3.webp` | 800 × 1200 | webp | 62 572 | 62 572 | 0 | unchanged |
| 171 | `/assets/results/fairycore/outfits/outfit4.webp` | 800 × 800 | webp | 78 194 | 78 194 | 0 | unchanged |
| 172 | `/assets/results/fairycore/outfits/outfit5.png` | 1200 × 960 | png | 191 594 | 191 594 | 0 | unchanged |
| 173 | `/assets/results/fairycore/outfits/outfit6.webp` | 1200 × 1244 | webp | 94 724 | 94 724 | 0 | unchanged |
| 174 | `/assets/results/fairycore/outfits/outfit7.webp` | 1200 × 960 | webp | 51 402 | 51 402 | 0 | unchanged |
| 175 | `/assets/results/fairycore/outfits/outfit8.webp` | 1200 × 960 | webp | 49 306 | 49 306 | 0 | unchanged |
| 176 | `/assets/results/fairycore/outfits/outfit9.webp` | 639 × 852 | webp | 38 456 | 38 456 | 0 | unchanged |
| 177 | `/assets/results/goblincore/interiors/interior1.jpg` | 900 × 906 | jpeg | 159 267 | 153 379 | 5 888 | pixel-identical |
| 178 | `/assets/results/goblincore/interiors/interior2.jpg` | 680 × 680 | jpeg | 76 691 | 76 691 | 0 | unchanged |
| 179 | `/assets/results/goblincore/interiors/interior3.jpg` | 900 × 1200 | jpeg | 190 358 | 190 358 | 0 | unchanged |
| 180 | `/assets/results/goblincore/interiors/interior4.jpg` | 1080 × 1340 | jpeg | 209 207 | 209 207 | 0 | unchanged |
| 181 | `/assets/results/goblincore/interiors/interior5.jpg` | 900 × 1114 | jpeg | 155 587 | 152 380 | 3 207 | pixel-identical |
| 182 | `/assets/results/goblincore/interiors/interior6.jpg` | 736 × 981 | jpeg | 138 672 | 138 672 | 0 | unchanged |
| 183 | `/assets/results/goblincore/interiors/interior7.jpg` | 750 × 938 | jpeg | 191 319 | 191 319 | 0 | unchanged |
| 184 | `/assets/results/goblincore/interiors/interior8.jpg` | 900 × 1116 | jpeg | 165 164 | 161 524 | 3 640 | pixel-identical |
| 185 | `/assets/results/goblincore/interiors/interior9.jpg` | 848 × 1264 | jpeg | 183 897 | 181 231 | 2 666 | pixel-identical |
| 186 | `/assets/results/goblincore/moodboards/mood1.jpg` | 640 × 427 | jpeg | 54 664 | 54 664 | 0 | unchanged |
| 187 | `/assets/results/goblincore/moodboards/mood2.jpg` | 640 × 539 | jpeg | 65 991 | 65 991 | 0 | unchanged |
| 188 | `/assets/results/goblincore/moodboards/mood3.jpg` | 750 × 718 | jpeg | 65 473 | 65 473 | 0 | unchanged |
| 189 | `/assets/results/goblincore/moodboards/mood4.jpg` | 735 × 907 | jpeg | 57 928 | 57 928 | 0 | unchanged |
| 190 | `/assets/results/goblincore/moodboards/mood5.jpg` | 900 × 1125 | jpeg | 185 241 | 185 241 | 0 | unchanged |
| 191 | `/assets/results/goblincore/moodboards/mood6.jpg` | 900 × 1200 | jpeg | 172 785 | 172 785 | 0 | unchanged |
| 192 | `/assets/results/goblincore/moodboards/mood7.jpg` | 400 × 534 | jpeg | 59 642 | 59 642 | 0 | unchanged |
| 193 | `/assets/results/goblincore/outfits/outfit1.webp` | 555 × 675 | webp | 20 170 | 20 170 | 0 | unchanged |
| 194 | `/assets/results/goblincore/outfits/outfit10.webp` | 544 × 680 | webp | 45 820 | 45 820 | 0 | unchanged |
| 195 | `/assets/results/goblincore/outfits/outfit11.webp` | 900 × 900 | webp | 45 614 | 45 614 | 0 | unchanged |
| 196 | `/assets/results/goblincore/outfits/outfit12.webp` | 600 × 800 | webp | 23 874 | 23 874 | 0 | unchanged |
| 197 | `/assets/results/goblincore/outfits/outfit13.webp` | 900 × 900 | webp | 70 700 | 70 700 | 0 | unchanged |
| 198 | `/assets/results/goblincore/outfits/outfit14.webp` | 700 × 700 | webp | 29 018 | 29 018 | 0 | unchanged |
| 199 | `/assets/results/goblincore/outfits/outfit15.jpg` | 760 × 781 | jpeg | 68 138 | 68 138 | 0 | unchanged |
| 200 | `/assets/results/goblincore/outfits/outfit2.webp` | 464 × 797 | webp | 28 388 | 28 388 | 0 | unchanged |
| 201 | `/assets/results/goblincore/outfits/outfit3.webp` | 736 × 736 | webp | 39 862 | 39 862 | 0 | unchanged |
| 202 | `/assets/results/goblincore/outfits/outfit4.webp` | 700 × 700 | webp | 109 308 | 109 308 | 0 | unchanged |
| 203 | `/assets/results/goblincore/outfits/outfit5.webp` | 600 × 508 | webp | 35 924 | 35 924 | 0 | unchanged |
| 204 | `/assets/results/goblincore/outfits/outfit6.webp` | 900 × 720 | webp | 36 314 | 36 314 | 0 | unchanged |
| 205 | `/assets/results/goblincore/outfits/outfit7.webp` | 900 × 720 | webp | 10 414 | 10 414 | 0 | unchanged |
| 206 | `/assets/results/goblincore/outfits/outfit8.webp` | 900 × 720 | webp | 31 716 | 31 716 | 0 | unchanged |
| 207 | `/assets/results/goblincore/outfits/outfit9.webp` | 900 × 720 | webp | 39 374 | 39 374 | 0 | unchanged |
| 208 | `/assets/results/lightacademia/interiors/interior1.jpg` | 1200 × 1500 | jpeg | 290 570 | 290 570 | 0 | unchanged |
| 209 | `/assets/results/lightacademia/interiors/interior10.jpg` | 736 × 1308 | jpeg | 192 568 | 192 568 | 0 | unchanged |
| 210 | `/assets/results/lightacademia/interiors/interior11.jpg` | 1024 × 1536 | jpeg | 200 778 | 200 778 | 0 | unchanged |
| 211 | `/assets/results/lightacademia/interiors/interior2.jpg` | 1100 × 1885 | jpeg | 188 197 | 188 197 | 0 | unchanged |
| 212 | `/assets/results/lightacademia/interiors/interior3.jpg` | 736 × 954 | jpeg | 94 244 | 94 244 | 0 | unchanged |
| 213 | `/assets/results/lightacademia/interiors/interior4.jpg` | 1024 × 1024 | jpeg | 116 098 | 116 098 | 0 | unchanged |
| 214 | `/assets/results/lightacademia/interiors/interior5.jpg` | 1080 × 1350 | jpeg | 198 127 | 198 127 | 0 | unchanged |
| 215 | `/assets/results/lightacademia/interiors/interior6.jpg` | 1200 × 1552 | jpeg | 187 169 | 187 169 | 0 | unchanged |
| 216 | `/assets/results/lightacademia/interiors/interior7.jpg` | 1170 × 1428 | jpeg | 152 722 | 152 722 | 0 | unchanged |
| 217 | `/assets/results/lightacademia/interiors/interior8.jpg` | 600 × 900 | jpeg | 115 095 | 115 095 | 0 | unchanged |
| 218 | `/assets/results/lightacademia/interiors/interior9.jpg` | 564 × 705 | jpeg | 53 963 | 53 963 | 0 | unchanged |
| 219 | `/assets/results/lightacademia/moodboards/moodboard1.jpg` | 1179 × 1433 | jpeg | 161 370 | 161 370 | 0 | unchanged |
| 220 | `/assets/results/lightacademia/moodboards/moodboard10.jpg` | 906 × 1326 | jpeg | 218 859 | 218 859 | 0 | unchanged |
| 221 | `/assets/results/lightacademia/moodboards/moodboard11.jpg` | 1164 × 1846 | jpeg | 194 595 | 194 595 | 0 | unchanged |
| 222 | `/assets/results/lightacademia/moodboards/moodboard2.jpg` | 1170 × 1382 | jpeg | 105 491 | 104 911 | 580 | pixel-identical |
| 223 | `/assets/results/lightacademia/moodboards/moodboard3.jpg` | 832 × 1248 | jpeg | 89 101 | 89 101 | 0 | unchanged |
| 224 | `/assets/results/lightacademia/moodboards/moodboard4.jpg` | 474 × 677 | jpeg | 44 115 | 44 115 | 0 | unchanged |
| 225 | `/assets/results/lightacademia/moodboards/moodboard5.jpg` | 749 × 937 | jpeg | 116 218 | 116 218 | 0 | unchanged |
| 226 | `/assets/results/lightacademia/moodboards/moodboard6.jpg` | 736 × 1021 | jpeg | 171 207 | 146 397 | 24 810 | pixel-identical |
| 227 | `/assets/results/lightacademia/moodboards/moodboard7.jpg` | 1048 × 1528 | jpeg | 166 183 | 164 465 | 1 718 | pixel-identical |
| 228 | `/assets/results/lightacademia/moodboards/moodboard8.jpg` | 785 × 1142 | jpeg | 106 065 | 106 065 | 0 | unchanged |
| 229 | `/assets/results/lightacademia/moodboards/moodboard9.jpg` | 736 × 981 | jpeg | 114 377 | 114 377 | 0 | unchanged |
| 230 | `/assets/results/lightacademia/outfits/outfit1.webp` | 864 × 1152 | webp | 75 766 | 75 766 | 0 | unchanged |
| 231 | `/assets/results/lightacademia/outfits/outfit10.webp` | 936 × 913 | webp | 50 522 | 50 522 | 0 | unchanged |
| 232 | `/assets/results/lightacademia/outfits/outfit11.webp` | 840 × 1120 | webp | 33 490 | 33 490 | 0 | unchanged |
| 233 | `/assets/results/lightacademia/outfits/outfit12.webp` | 412 × 420 | webp | 29 234 | 29 234 | 0 | unchanged |
| 234 | `/assets/results/lightacademia/outfits/outfit13.webp` | 750 × 999 | webp | 26 068 | 26 068 | 0 | unchanged |
| 235 | `/assets/results/lightacademia/outfits/outfit14.webp` | 736 × 736 | webp | 15 478 | 15 478 | 0 | unchanged |
| 236 | `/assets/results/lightacademia/outfits/outfit15.webp` | 600 × 600 | webp | 24 106 | 24 106 | 0 | unchanged |
| 237 | `/assets/results/lightacademia/outfits/outfit16.webp` | 614 × 921 | webp | 83 388 | 83 388 | 0 | unchanged |
| 238 | `/assets/results/lightacademia/outfits/outfit2.webp` | 400 × 400 | webp | 18 582 | 18 582 | 0 | unchanged |
| 239 | `/assets/results/lightacademia/outfits/outfit3.webp` | 959 × 1180 | webp | 91 722 | 91 722 | 0 | unchanged |
| 240 | `/assets/results/lightacademia/outfits/outfit4.webp` | 1053 × 1505 | webp | 26 830 | 26 830 | 0 | unchanged |
| 241 | `/assets/results/lightacademia/outfits/outfit5.webp` | 910 × 1456 | webp | 62 636 | 62 636 | 0 | unchanged |
| 242 | `/assets/results/lightacademia/outfits/outfit6.webp` | 960 × 960 | webp | 36 918 | 36 918 | 0 | unchanged |
| 243 | `/assets/results/lightacademia/outfits/outfit7.webp` | 960 × 960 | webp | 38 368 | 38 368 | 0 | unchanged |
| 244 | `/assets/results/lightacademia/outfits/outfit8.webp` | 599 × 960 | webp | 83 410 | 83 410 | 0 | unchanged |
| 245 | `/assets/results/lightacademia/outfits/outfit9.webp` | 1200 × 1200 | webp | 33 686 | 33 686 | 0 | unchanged |
| 246 | `/assets/results/witchcore/interiors/interior1.jpg` | 768 × 1408 | jpeg | 143 272 | 143 272 | 0 | unchanged |
| 247 | `/assets/results/witchcore/interiors/interior2.jpg` | 800 × 820 | jpeg | 131 999 | 126 989 | 5 010 | pixel-identical |
| 248 | `/assets/results/witchcore/interiors/interior3.jpg` | 800 × 1200 | jpeg | 141 451 | 137 742 | 3 709 | pixel-identical |
| 249 | `/assets/results/witchcore/interiors/interior4.jpg` | 800 × 1024 | jpeg | 178 582 | 171 011 | 7 571 | pixel-identical |
| 250 | `/assets/results/witchcore/interiors/interior5.jpg` | 480 × 640 | jpeg | 57 322 | 57 322 | 0 | unchanged |
| 251 | `/assets/results/witchcore/interiors/interior6.jpg` | 768 × 960 | jpeg | 131 989 | 131 989 | 0 | unchanged |
| 252 | `/assets/results/witchcore/interiors/interior7.jpg` | 600 × 813 | jpeg | 104 193 | 104 193 | 0 | unchanged |
| 253 | `/assets/results/witchcore/interiors/interior8.jpg` | 800 × 1738 | jpeg | 221 741 | 221 741 | 0 | unchanged |
| 254 | `/assets/results/witchcore/moodboards/look1.jpg` | 736 × 981 | jpeg | 138 375 | 138 375 | 0 | unchanged |
| 255 | `/assets/results/witchcore/moodboards/look2.jpg` | 800 × 1066 | jpeg | 198 469 | 198 469 | 0 | unchanged |
| 256 | `/assets/results/witchcore/moodboards/look3.jpg` | 373 × 800 | jpeg | 26 682 | 26 682 | 0 | unchanged |
| 257 | `/assets/results/witchcore/moodboards/look4.jpg` | 800 × 1168 | jpeg | 118 146 | 115 101 | 3 045 | pixel-identical |
| 258 | `/assets/results/witchcore/moodboards/look5.jpg` | 750 × 1189 | jpeg | 87 083 | 87 083 | 0 | unchanged |
| 259 | `/assets/results/witchcore/moodboards/look6.jpg` | 808 × 1200 | jpeg | 92 352 | 92 352 | 0 | unchanged |
| 260 | `/assets/results/witchcore/moodboards/look7.jpg` | 800 × 1200 | jpeg | 168 126 | 162 291 | 5 835 | pixel-identical |
| 261 | `/assets/results/witchcore/moodboards/look8.jpg` | 564 × 1090 | jpeg | 179 689 | 150 792 | 28 897 | pixel-identical |
| 262 | `/assets/results/witchcore/moodboards/look9.jpg` | 1068 × 1275 | jpeg | 94 136 | 94 136 | 0 | unchanged |
| 263 | `/assets/results/witchcore/outfits/outfit1.webp` | 1200 × 1200 | webp | 38 504 | 38 504 | 0 | unchanged |
| 264 | `/assets/results/witchcore/outfits/outfit10.png` | 405 × 539 | png | 129 811 | 102 964 | 26 847 | pixel-identical |
| 265 | `/assets/results/witchcore/outfits/outfit11.webp` | 628 × 1000 | webp | 37 800 | 37 800 | 0 | unchanged |
| 266 | `/assets/results/witchcore/outfits/outfit12.webp` | 600 × 500 | webp | 36 438 | 36 438 | 0 | unchanged |
| 267 | `/assets/results/witchcore/outfits/outfit13.webp` | 474 × 940 | webp | 24 312 | 24 312 | 0 | unchanged |
| 268 | `/assets/results/witchcore/outfits/outfit14.png` | 420 × 420 | png | 67 567 | 42 240 | 25 327 | pixel-identical |
| 269 | `/assets/results/witchcore/outfits/outfit15.webp` | 600 × 801 | webp | 49 654 | 49 654 | 0 | unchanged |
| 270 | `/assets/results/witchcore/outfits/outfit16.webp` | 600 × 600 | webp | 19 744 | 19 744 | 0 | unchanged |
| 271 | `/assets/results/witchcore/outfits/outfit17.webp` | 750 × 685 | webp | 34 110 | 34 110 | 0 | unchanged |
| 272 | `/assets/results/witchcore/outfits/outfit2.webp` | 1200 × 1500 | webp | 69 398 | 69 398 | 0 | unchanged |
| 273 | `/assets/results/witchcore/outfits/outfit3.webp` | 768 × 768 | webp | 19 482 | 19 482 | 0 | unchanged |
| 274 | `/assets/results/witchcore/outfits/outfit4.webp` | 750 × 1000 | webp | 57 344 | 57 344 | 0 | unchanged |
| 275 | `/assets/results/witchcore/outfits/outfit5.webp` | 800 × 1422 | webp | 85 102 | 85 102 | 0 | unchanged |
| 276 | `/assets/results/witchcore/outfits/outfit6.webp` | 700 × 840 | webp | 39 642 | 39 642 | 0 | unchanged |
| 277 | `/assets/results/witchcore/outfits/outfit7.webp` | 720 × 1080 | webp | 61 356 | 61 356 | 0 | unchanged |
| 278 | `/assets/results/witchcore/outfits/outfit8.webp` | 600 × 920 | webp | 17 598 | 17 598 | 0 | unchanged |
| 279 | `/assets/results/witchcore/outfits/outfit9.webp` | 450 × 550 | webp | 50 570 | 50 570 | 0 | unchanged |

## Контрольные суммы и сведения по каждому файлу

Подробности включают все поля исходного отчёта. Отсутствующие поля не добавляются; адреса старых результатов приведены как исторические значения.

<details>
<summary>1. /assets/images/favicon.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/favicon.png` |
| Ширина, px | 192 |
| Высота, px | 192 |
| Формат | `png` |
| До оптимизации, байт | 60437 |
| После оптимизации, байт | 60437 |
| Статус | `unchanged` |
| SHA256 оригинала | `a358640e4c9576fb31785269618666665f4ae7c27ddd27a931c676a95118d109` |

</details>

<details>
<summary>2. /assets/images/home/about_author_bg.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/home/about_author_bg.jpg` |
| Ширина, px | 1200 |
| Высота, px | 675 |
| Формат | `jpeg` |
| До оптимизации, байт | 127587 |
| После оптимизации, байт | 122509 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `2189b65a86b2d72ba575a2d829e6ae12cf20ee467217d2db987cab97a93bff2e` |
| Результирующий адрес | `/assets/images/home/about_author_bg.jpg` |
| SHA256 результата | `f72e4206fc1b647b7ef9b9a05e0b21ae68d8f5d18195d75b8073b4fdbf438756` |
| SHA256 декодированных пикселей | `096fc99c7ba5eeac091d09014580d7f4f8093e51ccb8ade9c8bfdbe87cce62cd` |

</details>

<details>
<summary>3. /assets/images/home/book_olive.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/home/book_olive.webp` |
| Ширина, px | 880 |
| Высота, px | 586 |
| Формат | `webp` |
| До оптимизации, байт | 29070 |
| После оптимизации, байт | 29070 |
| Статус | `unchanged` |
| SHA256 оригинала | `c30e7b41350e0318c76bb9bdb19dd0c130b91f855e2103a1da68cb0d64aec648` |

</details>

<details>
<summary>4. /assets/images/home/hero_header.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/home/hero_header.jpg` |
| Ширина, px | 1400 |
| Высота, px | 875 |
| Формат | `jpeg` |
| До оптимизации, байт | 194382 |
| После оптимизации, байт | 194382 |
| Статус | `unchanged` |
| SHA256 оригинала | `5ff19e6df97b465ebf54540e8e609360c7feaebf06032dbfbd54fc0b3167d0ba` |

</details>

<details>
<summary>5. /assets/images/home/medallion_temp.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/home/medallion_temp.webp` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `webp` |
| До оптимизации, байт | 31980 |
| После оптимизации, байт | 31980 |
| Статус | `unchanged` |
| SHA256 оригинала | `5377331a8011b389e9072a19b1239587e78bbb6d4fc8d683c3badcf73d4e7c30` |

</details>

<details>
<summary>6. /assets/images/home/promo/promo-club.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/home/promo/promo-club.webp` |
| Ширина, px | 1024 |
| Высота, px | 577 |
| Формат | `webp` |
| До оптимизации, байт | 129886 |
| После оптимизации, байт | 129886 |
| Статус | `unchanged` |
| SHA256 оригинала | `2c84b5571e4078abfaba9293f394c6c3cc3263f1c30de37d81fc677fce12392b` |

</details>

<details>
<summary>7. /assets/images/home/promo/promo-feed.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/home/promo/promo-feed.webp` |
| Ширина, px | 1024 |
| Высота, px | 577 |
| Формат | `webp` |
| До оптимизации, байт | 99584 |
| После оптимизации, байт | 99584 |
| Статус | `unchanged` |
| SHA256 оригинала | `99fc2905c5d5b7d2ec3a21a74a6203a37729f1c0206b7bb036724dffde5a5389` |

</details>

<details>
<summary>8. /assets/images/home/promo/promo-quiz.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/home/promo/promo-quiz.webp` |
| Ширина, px | 1024 |
| Высота, px | 577 |
| Формат | `webp` |
| До оптимизации, байт | 126642 |
| После оптимизации, байт | 126642 |
| Статус | `unchanged` |
| SHA256 оригинала | `82bc8ebb83e83002d624dcf99e0d650486b7419bf40e19c4b1988618fc88e7fd` |

</details>

<details>
<summary>9. /assets/images/icon.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/icon.png` |
| Ширина, px | 512 |
| Высота, px | 512 |
| Формат | `png` |
| До оптимизации, байт | 393904 |
| После оптимизации, байт | 393904 |
| Статус | `unchanged` |
| SHA256 оригинала | `9c4dbaf22db61d81715f6563902b2d2397402d23fda17afccb45d5f94efead03` |

</details>

<details>
<summary>10. /assets/images/legal-documents-folder.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/images/legal-documents-folder.webp` |
| Ширина, px | 1024 |
| Высота, px | 819 |
| Формат | `webp` |
| До оптимизации, байт | 198028 |
| После оптимизации, байт | 198028 |
| Статус | `unchanged` |
| SHA256 оригинала | `bba3db096ef5d4e8e97194eb2c12a61e3bb6a22d3c91b1ebf7ba32e29baafa69` |

</details>

<details>
<summary>11. /assets/interactive/ivy-left.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/interactive/ivy-left.png` |
| Ширина, px | 540 |
| Высота, px | 432 |
| Формат | `png` |
| До оптимизации, байт | 125925 |
| После оптимизации, байт | 125925 |
| Статус | `unchanged` |
| SHA256 оригинала | `3d2c4be7fc90bc3a3dea8e7804f8ce828fec0bf28b9aa3626d1c06ef7be945d2` |

</details>

<details>
<summary>12. /assets/interactive/ivy-right.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/interactive/ivy-right.png` |
| Ширина, px | 540 |
| Высота, px | 432 |
| Формат | `png` |
| До оптимизации, байт | 125927 |
| После оптимизации, байт | 125927 |
| Статус | `unchanged` |
| SHA256 оригинала | `151947db3c8b0d8e87d82cfdc4dd388d58977ed38617d25f7347beb65283abf3` |

</details>

<details>
<summary>13. /assets/interactive/key-decor.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/interactive/key-decor.png` |
| Ширина, px | 360 |
| Высота, px | 288 |
| Формат | `png` |
| До оптимизации, байт | 44538 |
| После оптимизации, байт | 44538 |
| Статус | `unchanged` |
| SHA256 оригинала | `5c84b25a1df3d1d52e108e0717001a6522ec06ec528b0db904d847419e6a922b` |

</details>

<details>
<summary>14. /assets/interactive/quiz-cover.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/interactive/quiz-cover.jpg` |
| Ширина, px | 1200 |
| Высота, px | 840 |
| Формат | `jpeg` |
| До оптимизации, байт | 175311 |
| После оптимизации, байт | 169425 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `8e299d534173658351b51f7dc15e1687ebc3e5ac7070a7f854c449e49090b787` |
| Результирующий адрес | `/assets/interactive/quiz-cover.jpg` |
| SHA256 результата | `64ac13d0ee81f41719e8ca57ab74b2c01b813a784825d6af896e9df1ea5f5b73` |
| SHA256 декодированных пикселей | `d3905ae4ea90fc1265200b3b37ddb021a65574163febd958ec3f4e1a422eef72` |

</details>

<details>
<summary>15. /assets/quiz/animals/castlecore.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/animals/castlecore.png` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `png` |
| До оптимизации, байт | 109169 |
| После оптимизации, байт | 109169 |
| Статус | `unchanged` |
| SHA256 оригинала | `0da425153accac262241b45faae0cd5af47ccea20c065e796d3f1bb0262a3ba7` |

</details>

<details>
<summary>16. /assets/quiz/animals/cottagecore.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/animals/cottagecore.png` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `png` |
| До оптимизации, байт | 87978 |
| После оптимизации, байт | 87978 |
| Статус | `unchanged` |
| SHA256 оригинала | `ed9e48f56812ff399f3699d46dd8c02918fbe912301fb83af80e065d1d722105` |

</details>

<details>
<summary>17. /assets/quiz/animals/dark-academia.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/animals/dark-academia.png` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `png` |
| До оптимизации, байт | 155905 |
| После оптимизации, байт | 155905 |
| Статус | `unchanged` |
| SHA256 оригинала | `87326cb7df51a330597ee77b6ff8a4c0c2c130a8b1766c90303aebaeb2029b75` |

</details>

<details>
<summary>18. /assets/quiz/animals/fairycore.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/animals/fairycore.png` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `png` |
| До оптимизации, байт | 104075 |
| После оптимизации, байт | 104075 |
| Статус | `unchanged` |
| SHA256 оригинала | `617e54df5a52baf109aa40629ed53e7c76c4261ecc22d71dfee4b06527e80771` |

</details>

<details>
<summary>19. /assets/quiz/animals/goblincore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/animals/goblincore.webp` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `webp` |
| До оптимизации, байт | 33652 |
| После оптимизации, байт | 33652 |
| Статус | `unchanged` |
| SHA256 оригинала | `7cb57975d1105b238eba260bc6bf7d935752cd2377130ed1da6098d22d5f3553` |

</details>

<details>
<summary>20. /assets/quiz/animals/light-academia.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/animals/light-academia.png` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `png` |
| До оптимизации, байт | 155920 |
| После оптимизации, байт | 155920 |
| Статус | `unchanged` |
| SHA256 оригинала | `1e2660322e086dd3f68c54408614e47b3266addd462cfe685c0fa74217b03f03` |

</details>

<details>
<summary>21. /assets/quiz/animals/witchcore.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/animals/witchcore.png` |
| Ширина, px | 600 |
| Высота, px | 480 |
| Формат | `png` |
| До оптимизации, байт | 100739 |
| После оптимизации, байт | 100739 |
| Статус | `unchanged` |
| SHA256 оригинала | `f7df8ae5bba7e1138e69efd12058ae1bb75486c05f27c169062bc3773e3be9e8` |

</details>

<details>
<summary>22. /assets/quiz/artifacts/castlecore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/artifacts/castlecore.webp` |
| Ширина, px | 800 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 73984 |
| После оптимизации, байт | 73984 |
| Статус | `unchanged` |
| SHA256 оригинала | `61ed150e84c43571a51c4e214ecba0deeec8ced3820076bfd3b34e42deb6c951` |

</details>

<details>
<summary>23. /assets/quiz/artifacts/cottagecore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/artifacts/cottagecore.webp` |
| Ширина, px | 800 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 78232 |
| После оптимизации, байт | 78232 |
| Статус | `unchanged` |
| SHA256 оригинала | `ab4e41f6dc37ef81450c7fd3e0170d633e0771ca32a89636d982a2c1374552e7` |

</details>

<details>
<summary>24. /assets/quiz/artifacts/dark-academia.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/artifacts/dark-academia.webp` |
| Ширина, px | 800 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 56426 |
| После оптимизации, байт | 56426 |
| Статус | `unchanged` |
| SHA256 оригинала | `853eac8e50ab325e1bc4a172a69d9a8f0584df55e6df2f15aa07fa0ac393d934` |

</details>

<details>
<summary>25. /assets/quiz/artifacts/fairycore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/artifacts/fairycore.webp` |
| Ширина, px | 800 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 54442 |
| После оптимизации, байт | 54442 |
| Статус | `unchanged` |
| SHA256 оригинала | `3b3fa3144dfa81ec0195df99fa273e4e0b032ecd55b3f3a4d469f3733cc0ded5` |

</details>

<details>
<summary>26. /assets/quiz/artifacts/goblincore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/artifacts/goblincore.webp` |
| Ширина, px | 800 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 71978 |
| После оптимизации, байт | 71978 |
| Статус | `unchanged` |
| SHA256 оригинала | `c8a45a574e60701dc5f2bebd8ebf983a3cc2d15c89d9fd5657888ad77bda9fe5` |

</details>

<details>
<summary>27. /assets/quiz/artifacts/light-academia.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/artifacts/light-academia.webp` |
| Ширина, px | 800 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 56190 |
| После оптимизации, байт | 56190 |
| Статус | `unchanged` |
| SHA256 оригинала | `c1a98fbc4b7abdedb94be331b3945ccf02c454c56b34e4c1e0f175cf47933d5a` |

</details>

<details>
<summary>28. /assets/quiz/artifacts/witchcore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/artifacts/witchcore.webp` |
| Ширина, px | 800 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 70162 |
| После оптимизации, байт | 70162 |
| Статус | `unchanged` |
| SHA256 оригинала | `5c7daa40082177373b8b559ed1fbbe0d9b3f4c3cd4c4e475278f4486fb238d75` |

</details>

<details>
<summary>29. /assets/quiz/chest.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/chest.webp` |
| Ширина, px | 800 |
| Высота, px | 640 |
| Формат | `webp` |
| До оптимизации, байт | 32868 |
| После оптимизации, байт | 32868 |
| Статус | `unchanged` |
| SHA256 оригинала | `0b07e2db2cbf823dcbd55f49f5b8747234d850ba78e403081a784a1d42cf1cb8` |

</details>

<details>
<summary>30. /assets/quiz/houses/castlecore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/houses/castlecore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 145930 |
| После оптимизации, байт | 145930 |
| Статус | `unchanged` |
| SHA256 оригинала | `0e4699639b40f7e7519c78de66fbe5cea759dc03e8ba1fb4f2fca57e0bb41d71` |

</details>

<details>
<summary>31. /assets/quiz/houses/cottagecore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/houses/cottagecore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 183391 |
| После оптимизации, байт | 183391 |
| Статус | `unchanged` |
| SHA256 оригинала | `1ea7362bf512845db263f2ef0670b21aa146b439a56e2bbe2bca4792a5e66636` |

</details>

<details>
<summary>32. /assets/quiz/houses/dark-academia.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/houses/dark-academia.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 194760 |
| После оптимизации, байт | 194760 |
| Статус | `unchanged` |
| SHA256 оригинала | `5bd5e3fb84e1b610613f3e4cdacc3c8f1de6a43e2a84d4c1a22a2b6cb85755c7` |

</details>

<details>
<summary>33. /assets/quiz/houses/fairycore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/houses/fairycore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 210555 |
| После оптимизации, байт | 210555 |
| Статус | `unchanged` |
| SHA256 оригинала | `13aafaaf42f0c3e6dc6198aa9385cf0983f262341b414161b16eb31463bbfea9` |

</details>

<details>
<summary>34. /assets/quiz/houses/goblincore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/houses/goblincore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 166171 |
| После оптимизации, байт | 166171 |
| Статус | `unchanged` |
| SHA256 оригинала | `cb1c152296283f987c26b14a55428bfb77cba635e70e810a4944302d98339565` |

</details>

<details>
<summary>35. /assets/quiz/houses/light-academia.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/houses/light-academia.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 158226 |
| После оптимизации, байт | 158226 |
| Статус | `unchanged` |
| SHA256 оригинала | `d64da60a582b9a856264add70bb424b756240908e4803644132d2c72e6fa25c3` |

</details>

<details>
<summary>36. /assets/quiz/houses/witchcore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/houses/witchcore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 170418 |
| После оптимизации, байт | 170418 |
| Статус | `unchanged` |
| SHA256 оригинала | `3a21a5975a67501cf25ce6abd74285821a9fd5a8921c8df739645b85a7c4d528` |

</details>

<details>
<summary>37. /assets/quiz/landscapes/castlecore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/landscapes/castlecore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 156352 |
| После оптимизации, байт | 156352 |
| Статус | `unchanged` |
| SHA256 оригинала | `154a1e1c002786f0e29f8fd090b290696e17e2ead90593d5f435b43c2b492195` |

</details>

<details>
<summary>38. /assets/quiz/landscapes/cottagecore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/landscapes/cottagecore.jpg` |
| Ширина, px | 960 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 229890 |
| После оптимизации, байт | 229890 |
| Статус | `unchanged` |
| SHA256 оригинала | `7f383094c2d117c56af085436690514946c5c043eaad626cb5b69f41752c6f11` |

</details>

<details>
<summary>39. /assets/quiz/landscapes/dark-academia.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/landscapes/dark-academia.jpg` |
| Ширина, px | 960 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 174180 |
| После оптимизации, байт | 174180 |
| Статус | `unchanged` |
| SHA256 оригинала | `3e8c49d5bd32f0149b178a0154e608e2d862fbc5cc8639d8a22e926b45417506` |

</details>

<details>
<summary>40. /assets/quiz/landscapes/fairycore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/landscapes/fairycore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 155978 |
| После оптимизации, байт | 155978 |
| Статус | `unchanged` |
| SHA256 оригинала | `05479575e38577472654ee7d8171783e471983fb3cb0ee3df3c0a8ba07bd35fd` |

</details>

<details>
<summary>41. /assets/quiz/landscapes/goblincore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/landscapes/goblincore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 112448 |
| После оптимизации, байт | 112448 |
| Статус | `unchanged` |
| SHA256 оригинала | `88f7b65a563ce76825d4431373b664852f532a3c1611e6c0c10ff32536dc29eb` |

</details>

<details>
<summary>42. /assets/quiz/landscapes/light-academia.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/landscapes/light-academia.jpg` |
| Ширина, px | 960 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 196078 |
| После оптимизации, байт | 196078 |
| Статус | `unchanged` |
| SHA256 оригинала | `0e37d0cd1029991877d5791cb141ac16e107f6d997a4325ddbeff03e12c38db6` |

</details>

<details>
<summary>43. /assets/quiz/landscapes/witchcore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/landscapes/witchcore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 155407 |
| После оптимизации, байт | 155407 |
| Статус | `unchanged` |
| SHA256 оригинала | `c3fbc2136e300409c254bf9abf892f692f04c940137b42e5a835e154139d1a9d` |

</details>

<details>
<summary>44. /assets/quiz/outfits/castlecore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/outfits/castlecore.webp` |
| Ширина, px | 600 |
| Высота, px | 1301 |
| Формат | `webp` |
| До оптимизации, байт | 87326 |
| После оптимизации, байт | 87326 |
| Статус | `unchanged` |
| SHA256 оригинала | `f6ee1add985cf72e8668ffdeec6e8114e8890063148319438d1ec16746d82b3c` |

</details>

<details>
<summary>45. /assets/quiz/outfits/cottagecore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/outfits/cottagecore.webp` |
| Ширина, px | 600 |
| Высота, px | 1301 |
| Формат | `webp` |
| До оптимизации, байт | 66208 |
| После оптимизации, байт | 66208 |
| Статус | `unchanged` |
| SHA256 оригинала | `e884898885f2ec3afeaf7f63d702446b38735d4414309787b1a953f1fc589266` |

</details>

<details>
<summary>46. /assets/quiz/outfits/dark-academia.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/outfits/dark-academia.webp` |
| Ширина, px | 600 |
| Высота, px | 1301 |
| Формат | `webp` |
| До оптимизации, байт | 52534 |
| После оптимизации, байт | 52534 |
| Статус | `unchanged` |
| SHA256 оригинала | `666d8402a27084663e393c891e4f497d91cbf24c138a3230280191b5ade12c8e` |

</details>

<details>
<summary>47. /assets/quiz/outfits/fairycore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/outfits/fairycore.webp` |
| Ширина, px | 600 |
| Высота, px | 1301 |
| Формат | `webp` |
| До оптимизации, байт | 68536 |
| После оптимизации, байт | 68536 |
| Статус | `unchanged` |
| SHA256 оригинала | `bf6d41bb9a29f046e69e0ec2d1b46664d90129bd45eca7be5b37ae00a7a5e059` |

</details>

<details>
<summary>48. /assets/quiz/outfits/goblincore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/outfits/goblincore.webp` |
| Ширина, px | 600 |
| Высота, px | 1301 |
| Формат | `webp` |
| До оптимизации, байт | 74790 |
| После оптимизации, байт | 74790 |
| Статус | `unchanged` |
| SHA256 оригинала | `1d679c10b07129d747febae053b49910f93dc40d1e20c82d1eec2367867f286d` |

</details>

<details>
<summary>49. /assets/quiz/outfits/light-academia.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/outfits/light-academia.webp` |
| Ширина, px | 600 |
| Высота, px | 1301 |
| Формат | `webp` |
| До оптимизации, байт | 45610 |
| После оптимизации, байт | 45610 |
| Статус | `unchanged` |
| SHA256 оригинала | `1daab496b391f2dd5eefa4960a5947eb47a4c60b799e5b771aed334170870453` |

</details>

<details>
<summary>50. /assets/quiz/outfits/witchcore.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/outfits/witchcore.webp` |
| Ширина, px | 600 |
| Высота, px | 1301 |
| Формат | `webp` |
| До оптимизации, байт | 47854 |
| После оптимизации, байт | 47854 |
| Статус | `unchanged` |
| SHA256 оригинала | `63b3c9d7744bb6ff31b4ca69bf34a6e3f307762221cd3bb7211eb22e3d73db36` |

</details>

<details>
<summary>51. /assets/quiz/shelters/castlecore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/shelters/castlecore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 116821 |
| После оптимизации, байт | 116821 |
| Статус | `unchanged` |
| SHA256 оригинала | `d77ee205e6642c5ba4e1b5b3aa4b12d74f78390a007c22586699c339f1865183` |

</details>

<details>
<summary>52. /assets/quiz/shelters/cottagecore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/shelters/cottagecore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 146877 |
| После оптимизации, байт | 146877 |
| Статус | `unchanged` |
| SHA256 оригинала | `ca1396131e08c6592f99e497f3ac1afd36880584b9c6e259f0053ab664472e16` |

</details>

<details>
<summary>53. /assets/quiz/shelters/dark-academia.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/shelters/dark-academia.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 82465 |
| После оптимизации, байт | 82263 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `997f23ceea89b9145c29f1830ff0fc0cbfac358b15fbf88b0592c10bdfdafae4` |
| Результирующий адрес | `/assets/quiz/shelters/dark-academia.jpg` |
| SHA256 результата | `14f539ee894c11ecca12f5a66358c80f5e8c55978d28e7d670584ad7457eb040` |
| SHA256 декодированных пикселей | `b0ea579c422ba52091adb29726600afe59e4016f881248ad2aa1c36cb8bdad4b` |

</details>

<details>
<summary>54. /assets/quiz/shelters/fairycore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/shelters/fairycore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 162860 |
| После оптимизации, байт | 162860 |
| Статус | `unchanged` |
| SHA256 оригинала | `88991b6b5221c1ea64e2d87c562960b28cfcfff04b3c8cbb5a1e60a7210bd012` |

</details>

<details>
<summary>55. /assets/quiz/shelters/goblincore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/shelters/goblincore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 156863 |
| После оптимизации, байт | 156863 |
| Статус | `unchanged` |
| SHA256 оригинала | `1523808d836421c75ba461a757973a12bb1ff6e6dff3a630a7a18113f3dc09fa` |

</details>

<details>
<summary>56. /assets/quiz/shelters/light-academia.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/shelters/light-academia.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 124797 |
| После оптимизации, байт | 124797 |
| Статус | `unchanged` |
| SHA256 оригинала | `1aa86ba7258d9678ad338ca95b9b2b17e6c470c39ac5bbbe57c7e5a4c2b7035f` |

</details>

<details>
<summary>57. /assets/quiz/shelters/witchcore.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/shelters/witchcore.jpg` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 107211 |
| После оптимизации, байт | 107211 |
| Статус | `unchanged` |
| SHA256 оригинала | `b4ff8f6ab9da0f12207a01a42126442da61e7c1d07dc8994c811584234d46806` |

</details>

<details>
<summary>58. /assets/quiz/start-collage.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/quiz/start-collage.webp` |
| Ширина, px | 1000 |
| Высота, px | 800 |
| Формат | `webp` |
| До оптимизации, байт | 119232 |
| После оптимизации, байт | 119232 |
| Статус | `unchanged` |
| SHA256 оригинала | `39d3bbc9a3805ebb4b91e6cdc535c15b38d2d052cd90283256002f431cb6b4db` |

</details>

<details>
<summary>59. /assets/results/castlecore/interiors/interior1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior1.jpg` |
| Ширина, px | 668 |
| Высота, px | 844 |
| Формат | `jpeg` |
| До оптимизации, байт | 112339 |
| После оптимизации, байт | 112339 |
| Статус | `unchanged` |
| SHA256 оригинала | `5236ce95af3538f3068dabe84bf5ba8b1383be79c5e9f07f0683371585995bd6` |

</details>

<details>
<summary>60. /assets/results/castlecore/interiors/interior10.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior10.jpg` |
| Ширина, px | 500 |
| Высота, px | 633 |
| Формат | `jpeg` |
| До оптимизации, байт | 99519 |
| После оптимизации, байт | 88629 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `ef7ff22d3ae0857c92a665cab144be7072c8ddc963e1da53d9f0b91877bd3a31` |
| Результирующий адрес | `/assets/results/castlecore/interiors/interior10.jpg` |
| SHA256 результата | `2cac5a97b31ce4c6476dc2cb0d155c617a63d40b60296d9748242d2ff9bc1cf6` |
| SHA256 декодированных пикселей | `a3bad1843e4865080e566888e542c1a1a7b36de040ac78c52881df143306023c` |

</details>

<details>
<summary>61. /assets/results/castlecore/interiors/interior11.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior11.jpg` |
| Ширина, px | 531 |
| Высота, px | 648 |
| Формат | `jpeg` |
| До оптимизации, байт | 121151 |
| После оптимизации, байт | 100833 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `e6cd79f9db3e0b1826605a70a32276edbcca5ef8feb306a4feb11751addfa9d5` |
| Результирующий адрес | `/assets/results/castlecore/interiors/interior11.jpg` |
| SHA256 результата | `b8c65f2860b40c59b8fe046a862835c263908c011b102513a742c337ccef87f2` |
| SHA256 декодированных пикселей | `028409885f92b64b39d36d9d6ec14cdcf0961d3187fefc658923816ed0b633d2` |

</details>

<details>
<summary>62. /assets/results/castlecore/interiors/interior12.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior12.jpg` |
| Ширина, px | 474 |
| Высота, px | 711 |
| Формат | `jpeg` |
| До оптимизации, байт | 71527 |
| После оптимизации, байт | 71527 |
| Статус | `unchanged` |
| SHA256 оригинала | `e574ef8af19f261e16599ce95742b239ff542a6e4a566fbc3f10511c21479b13` |

</details>

<details>
<summary>63. /assets/results/castlecore/interiors/interior13.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior13.jpg` |
| Ширина, px | 736 |
| Высота, px | 1104 |
| Формат | `jpeg` |
| До оптимизации, байт | 119574 |
| После оптимизации, байт | 119574 |
| Статус | `unchanged` |
| SHA256 оригинала | `27bd3336a5631fcf4c66db0479fe91f68a0519169d19ec9dc99f5b8f59fe3f80` |

</details>

<details>
<summary>64. /assets/results/castlecore/interiors/interior2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior2.jpg` |
| Ширина, px | 974 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 193898 |
| После оптимизации, байт | 193898 |
| Статус | `unchanged` |
| SHA256 оригинала | `12a1517022930a176147f23bf915d3faea8f63b636f3870d70ad7c2b76a83f13` |

</details>

<details>
<summary>65. /assets/results/castlecore/interiors/interior3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior3.jpg` |
| Ширина, px | 750 |
| Высота, px | 1123 |
| Формат | `jpeg` |
| До оптимизации, байт | 54488 |
| После оптимизации, байт | 54488 |
| Статус | `unchanged` |
| SHA256 оригинала | `e4e1d18306a2edb536a9d9a393a1c75387eee65b1e258cf59850cf546f5849f3` |

</details>

<details>
<summary>66. /assets/results/castlecore/interiors/interior4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior4.jpg` |
| Ширина, px | 520 |
| Высота, px | 712 |
| Формат | `jpeg` |
| До оптимизации, байт | 112331 |
| После оптимизации, байт | 95928 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `90d6567bc43c1f8597048665d4e10e5790269f20bb08e7b9e1acd92465e8e0c0` |
| Результирующий адрес | `/assets/results/castlecore/interiors/interior4.jpg` |
| SHA256 результата | `0e28be36f6276ca685e9a589831b5834cfcfed9b7997fca4077f9df2f33ce3dd` |
| SHA256 декодированных пикселей | `764c6d432011ad11fb3b6c508a348dbdcb532502895fd198f27ad71f186c06e5` |

</details>

<details>
<summary>67. /assets/results/castlecore/interiors/interior5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior5.jpg` |
| Ширина, px | 400 |
| Высота, px | 500 |
| Формат | `jpeg` |
| До оптимизации, байт | 44322 |
| После оптимизации, байт | 44322 |
| Статус | `unchanged` |
| SHA256 оригинала | `062070855108a93c8ea8f018c0871b68d619042ab91b5d8843a7a1bcc36bd680` |

</details>

<details>
<summary>68. /assets/results/castlecore/interiors/interior6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior6.jpg` |
| Ширина, px | 523 |
| Высота, px | 800 |
| Формат | `jpeg` |
| До оптимизации, байт | 116157 |
| После оптимизации, байт | 98968 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `1af3fcfeb342c38a2220a4a95c797b6cec981f71f47eef39b1f542af9bddce0a` |
| Результирующий адрес | `/assets/results/castlecore/interiors/interior6.jpg` |
| SHA256 результата | `d29e0956b9f9b33bcd02e47df5ef7a061ec73bf44935eb65b9ce6c5948b091ce` |
| SHA256 декодированных пикселей | `b26f9722afeada2274b6d36405ff0879eda0050743e6dd3f1d44941787a0b2b4` |

</details>

<details>
<summary>69. /assets/results/castlecore/interiors/interior7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior7.jpg` |
| Ширина, px | 900 |
| Высота, px | 1567 |
| Формат | `jpeg` |
| До оптимизации, байт | 199073 |
| После оптимизации, байт | 199073 |
| Статус | `unchanged` |
| SHA256 оригинала | `3bc0b86264f73ffaf21565129fd6eb5f435d91c76f4dd9e5c9c37a084f53e69c` |

</details>

<details>
<summary>70. /assets/results/castlecore/interiors/interior8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior8.jpg` |
| Ширина, px | 750 |
| Высота, px | 1000 |
| Формат | `jpeg` |
| До оптимизации, байт | 107296 |
| После оптимизации, байт | 107296 |
| Статус | `unchanged` |
| SHA256 оригинала | `67d7b6ecdd8230dac821ca10c1da8ea12094e7aae923b5f760f2035ba78aa9ab` |

</details>

<details>
<summary>71. /assets/results/castlecore/interiors/interior9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/interiors/interior9.jpg` |
| Ширина, px | 900 |
| Высота, px | 1226 |
| Формат | `jpeg` |
| До оптимизации, байт | 158184 |
| После оптимизации, байт | 155374 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `574bd6b0570cb31c2b2b6eda08c404f295f82fd3586628621a412236ddf01d76` |
| Результирующий адрес | `/assets/results/castlecore/interiors/interior9.jpg` |
| SHA256 результата | `de08d65f068c486f33dda39cd28183b1fc7ac486b12dc13618e2a0a070f44127` |
| SHA256 декодированных пикселей | `8481ab0232c8438ebe41e9499993f049a7d040fb9d901dd0f02f8a5b52ea5236` |

</details>

<details>
<summary>72. /assets/results/castlecore/moodboards/mood1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood1.jpg` |
| Ширина, px | 506 |
| Высота, px | 686 |
| Формат | `jpeg` |
| До оптимизации, байт | 65709 |
| После оптимизации, байт | 65709 |
| Статус | `unchanged` |
| SHA256 оригинала | `e2cb3376d2596fdcffab30b752ac0e50aa99c165e2dabc58d84163275d62905a` |

</details>

<details>
<summary>73. /assets/results/castlecore/moodboards/mood2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood2.jpg` |
| Ширина, px | 1023 |
| Высота, px | 1537 |
| Формат | `jpeg` |
| До оптимизации, байт | 80507 |
| После оптимизации, байт | 80507 |
| Статус | `unchanged` |
| SHA256 оригинала | `6cf2c1941a650303b0648783957a48b83e1ed28446c558bdea8a008c1dd1f222` |

</details>

<details>
<summary>74. /assets/results/castlecore/moodboards/mood3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood3.jpg` |
| Ширина, px | 969 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 118452 |
| После оптимизации, байт | 118341 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `4b4d23f803330e33589718d2af7ab16d5423a8248c326a372d6e100bedfbc736` |
| Результирующий адрес | `/assets/results/castlecore/moodboards/mood3.jpg` |
| SHA256 результата | `d83a23b5cfb581b9304a764a735ff67ac5d210afdff3be3db33e9f76ac895527` |
| SHA256 декодированных пикселей | `4cc7a36ebe615c88c8ff80ecfead5eab05b4f32f4477f4a3fca1294e93c556c7` |

</details>

<details>
<summary>75. /assets/results/castlecore/moodboards/mood4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood4.jpg` |
| Ширина, px | 735 |
| Высота, px | 890 |
| Формат | `jpeg` |
| До оптимизации, байт | 62887 |
| После оптимизации, байт | 62887 |
| Статус | `unchanged` |
| SHA256 оригинала | `ef55a0652c4a74cb1c4309b8aa3edccd163596489b8925d2873fd6b400f7988f` |

</details>

<details>
<summary>76. /assets/results/castlecore/moodboards/mood5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood5.jpg` |
| Ширина, px | 1080 |
| Высота, px | 1440 |
| Формат | `jpeg` |
| До оптимизации, байт | 107992 |
| После оптимизации, байт | 107827 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `a844f48e00f3f88b6f881d54cb66405111c09e34b4fcc928fb849a6e43f6be78` |
| Результирующий адрес | `/assets/results/castlecore/moodboards/mood5.jpg` |
| SHA256 результата | `e4399995d17be5bcc2f4f85f277fbed5e627fbc66c30fd1dcb38369ce17f2a1c` |
| SHA256 декодированных пикселей | `46f90ac2d9b7dedf60e4c85d72c361a53fad75123d1cf46bd9066c58e54d1580` |

</details>

<details>
<summary>77. /assets/results/castlecore/moodboards/mood6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood6.jpg` |
| Ширина, px | 900 |
| Высота, px | 1000 |
| Формат | `jpeg` |
| До оптимизации, байт | 166675 |
| После оптимизации, байт | 162945 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `d2e660ee4a8475c171ec242f8881e63a964e8ce52672c3b260dde478145cd4af` |
| Результирующий адрес | `/assets/results/castlecore/moodboards/mood6.jpg` |
| SHA256 результата | `fa645d02d3a06a28e061a26c4d85086aa5b8b541f55fac57263403183664e1fd` |
| SHA256 декодированных пикселей | `9ba9bb7e3780f15a0c2c49e15402851a2af08902eeb45fd9bf7ce620259c06c9` |

</details>

<details>
<summary>78. /assets/results/castlecore/moodboards/mood7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood7.jpg` |
| Ширина, px | 828 |
| Высота, px | 1031 |
| Формат | `jpeg` |
| До оптимизации, байт | 108090 |
| После оптимизации, байт | 108090 |
| Статус | `unchanged` |
| SHA256 оригинала | `53b738e0da8b65d7b0dff3140660509c55ca3e19439be225dcc86635fffced08` |

</details>

<details>
<summary>79. /assets/results/castlecore/moodboards/mood8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood8.jpg` |
| Ширина, px | 1000 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| До оптимизации, байт | 116968 |
| После оптимизации, байт | 116968 |
| Статус | `unchanged` |
| SHA256 оригинала | `916902e9996b0626cbc3135b557199f71462b8304336195262b242d59b09e3ce` |

</details>

<details>
<summary>80. /assets/results/castlecore/moodboards/mood9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/moodboards/mood9.jpg` |
| Ширина, px | 750 |
| Высота, px | 750 |
| Формат | `jpeg` |
| До оптимизации, байт | 73833 |
| После оптимизации, байт | 73833 |
| Статус | `unchanged` |
| SHA256 оригинала | `f3394c7259c1c464a599078ea89fed406707a7f903e2669b90a3a525f1202bcd` |

</details>

<details>
<summary>81. /assets/results/castlecore/outfits/outfit1.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit1.webp` |
| Ширина, px | 749 |
| Высота, px | 999 |
| Формат | `webp` |
| До оптимизации, байт | 38084 |
| После оптимизации, байт | 38084 |
| Статус | `unchanged` |
| SHA256 оригинала | `da42cec55a13e6d7e5963ce462c8abdec0cc5b321581f875e669df54e2b6dd10` |

</details>

<details>
<summary>82. /assets/results/castlecore/outfits/outfit10.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit10.webp` |
| Ширина, px | 522 |
| Высота, px | 560 |
| Формат | `webp` |
| До оптимизации, байт | 32904 |
| После оптимизации, байт | 32904 |
| Статус | `unchanged` |
| SHA256 оригинала | `10b959a48b64ac7cf42fd58846140adfb6b605900f8a3a030b6d056cafda2c11` |

</details>

<details>
<summary>83. /assets/results/castlecore/outfits/outfit11.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit11.webp` |
| Ширина, px | 649 |
| Высота, px | 862 |
| Формат | `webp` |
| До оптимизации, байт | 73162 |
| После оптимизации, байт | 73162 |
| Статус | `unchanged` |
| SHA256 оригинала | `ed3203d4ea853924e2e08c5c10b0467cbb1b5034a8bfa0b26f5dd04e78811676` |

</details>

<details>
<summary>84. /assets/results/castlecore/outfits/outfit12.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit12.webp` |
| Ширина, px | 700 |
| Высота, px | 1121 |
| Формат | `webp` |
| До оптимизации, байт | 41976 |
| После оптимизации, байт | 41976 |
| Статус | `unchanged` |
| SHA256 оригинала | `61f459ac3cc2f7e5f366c46a40ee91806af8c1aa4783ba0a86c63a5fa4bbc5f1` |

</details>

<details>
<summary>85. /assets/results/castlecore/outfits/outfit2.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit2.webp` |
| Ширина, px | 600 |
| Высота, px | 953 |
| Формат | `webp` |
| До оптимизации, байт | 98554 |
| После оптимизации, байт | 98554 |
| Статус | `unchanged` |
| SHA256 оригинала | `9f1e0664a330f4726cedecef5c2a5bc59ae90467b62e3d542f0336152a8d8dcd` |

</details>

<details>
<summary>86. /assets/results/castlecore/outfits/outfit3.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit3.png` |
| Ширина, px | 580 |
| Высота, px | 580 |
| Формат | `png` |
| До оптимизации, байт | 177501 |
| После оптимизации, байт | 113658 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `371f9cea441548cbc9a9c98a919f7c53e0110a9eeac572f74b964f6c3ff7f3b2` |
| Результирующий адрес | `/assets/results/castlecore/outfits/outfit3.lossless.webp` |
| SHA256 результата | `8b25e902d5751ac59bd4bb6fac57d77556117e3dfd5d68c9c6c6d334da21dce5` |
| SHA256 декодированных пикселей | `29867c153843e3d83f7bc047418cce81359906ac30a4164c47f14bb28f37b142` |

</details>

<details>
<summary>87. /assets/results/castlecore/outfits/outfit4.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit4.webp` |
| Ширина, px | 736 |
| Высота, px | 981 |
| Формат | `webp` |
| До оптимизации, байт | 31328 |
| После оптимизации, байт | 31328 |
| Статус | `unchanged` |
| SHA256 оригинала | `7f4e425707a369a6851505d9f458c5da969bb37c9a1385884c0c5b151471bcca` |

</details>

<details>
<summary>88. /assets/results/castlecore/outfits/outfit5.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit5.webp` |
| Ширина, px | 900 |
| Высота, px | 1095 |
| Формат | `webp` |
| До оптимизации, байт | 43272 |
| После оптимизации, байт | 43272 |
| Статус | `unchanged` |
| SHA256 оригинала | `eb227c5a15da7c037253c55f766ea1035e05d7d095b81bf2ab59123fe8b1f8dd` |

</details>

<details>
<summary>89. /assets/results/castlecore/outfits/outfit6.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit6.webp` |
| Ширина, px | 1080 |
| Высота, px | 977 |
| Формат | `webp` |
| До оптимизации, байт | 38702 |
| После оптимизации, байт | 38702 |
| Статус | `unchanged` |
| SHA256 оригинала | `11eb648966dd8c157d140f48deb3ad0d5101325dd70744ef5424e64fbaa9dc49` |

</details>

<details>
<summary>90. /assets/results/castlecore/outfits/outfit7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit7.webp` |
| Ширина, px | 900 |
| Высота, px | 900 |
| Формат | `webp` |
| До оптимизации, байт | 55796 |
| После оптимизации, байт | 55796 |
| Статус | `unchanged` |
| SHA256 оригинала | `8b65ce3c30448675d5d969e1cb7adc2373d48426888af2abcf59e804380964e0` |

</details>

<details>
<summary>91. /assets/results/castlecore/outfits/outfit8.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit8.webp` |
| Ширина, px | 720 |
| Высота, px | 789 |
| Формат | `webp` |
| До оптимизации, байт | 22854 |
| После оптимизации, байт | 22854 |
| Статус | `unchanged` |
| SHA256 оригинала | `e85adad7e160f601130885aaaf9541493f5b2987c05fc837243e59b0b87ab4b3` |

</details>

<details>
<summary>92. /assets/results/castlecore/outfits/outfit9.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/castlecore/outfits/outfit9.webp` |
| Ширина, px | 700 |
| Высота, px | 889 |
| Формат | `webp` |
| До оптимизации, байт | 62232 |
| После оптимизации, байт | 62232 |
| Статус | `unchanged` |
| SHA256 оригинала | `b895a4235c9fd02dd5723a6a78bf0bb49b3b532ab7aa5a818931794a726eb86f` |

</details>

<details>
<summary>93. /assets/results/cottagecore/interiors/interior1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/interiors/interior1.jpg` |
| Ширина, px | 800 |
| Высота, px | 642 |
| Формат | `jpeg` |
| До оптимизации, байт | 172354 |
| После оптимизации, байт | 160283 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `9ccae6a19a4e972409c544732ef38b3ae1a10e2edce9594c0cc19ea303e7d593` |
| Результирующий адрес | `/assets/results/cottagecore/interiors/interior1.jpg` |
| SHA256 результата | `b3c36649e178c28ac1dcfab038d94053ab0d6ba306549e749daf5a84d21fa78b` |
| SHA256 декодированных пикселей | `f1eefa4bfe60266dc6a635c53abbb52467442b16bd1aad7b6ad8c5fbd0dad91b` |

</details>

<details>
<summary>94. /assets/results/cottagecore/interiors/interior2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/interiors/interior2.jpg` |
| Ширина, px | 750 |
| Высота, px | 1000 |
| Формат | `jpeg` |
| До оптимизации, байт | 129748 |
| После оптимизации, байт | 125536 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `a83a363ac78919f8f8f24a26c97bad4b23297ee21daadabf717c1da8a8c90318` |
| Результирующий адрес | `/assets/results/cottagecore/interiors/interior2.jpg` |
| SHA256 результата | `fd38218d19292c0e917d505eced24b99086848772a9011eb2d99897c49145337` |
| SHA256 декодированных пикселей | `f18ea624668f003a163a7b0c83b01e09cf921020f906f888fbed810cd2bcdd20` |

</details>

<details>
<summary>95. /assets/results/cottagecore/interiors/interior3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/interiors/interior3.jpg` |
| Ширина, px | 800 |
| Высота, px | 889 |
| Формат | `jpeg` |
| До оптимизации, байт | 167755 |
| После оптимизации, байт | 160026 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `c297390ce9aef0d62ff38d54ae7fcc405adf17dd070688121a0a842964363041` |
| Результирующий адрес | `/assets/results/cottagecore/interiors/interior3.jpg` |
| SHA256 результата | `d542fe6b4c028cfa3635d4c854c84874e64c3c91ee474ac4dfa6d7092c8808b5` |
| SHA256 декодированных пикселей | `e3a469df687fbf67bdb69ee2830a216d5b63ea5c94eb2bca1ab1733035fea696` |

</details>

<details>
<summary>96. /assets/results/cottagecore/interiors/interior4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/interiors/interior4.jpg` |
| Ширина, px | 800 |
| Высота, px | 1120 |
| Формат | `jpeg` |
| До оптимизации, байт | 193314 |
| После оптимизации, байт | 193314 |
| Статус | `unchanged` |
| SHA256 оригинала | `6a0351199b77623bdf8edf92ebbe58ba41a0e5152eea5cab73e14ed6c111e707` |

</details>

<details>
<summary>97. /assets/results/cottagecore/moodboards/moodboard1.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard1.png` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `png` |
| До оптимизации, байт | 108232 |
| После оптимизации, байт | 108232 |
| Статус | `unchanged` |
| SHA256 оригинала | `997cd4a7cec6c61cfac5c8a81444e1399b7f35b5e3886aa364232456648bd7fd` |

</details>

<details>
<summary>98. /assets/results/cottagecore/moodboards/moodboard2.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard2.webp` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `webp` |
| До оптимизации, байт | 37580 |
| После оптимизации, байт | 37580 |
| Статус | `unchanged` |
| SHA256 оригинала | `58d6df1968648234ac875f12da7d65ddeaf6fce633c31cd4886d0356ca301ccd` |

</details>

<details>
<summary>99. /assets/results/cottagecore/moodboards/moodboard3.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard3.png` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `png` |
| До оптимизации, байт | 123602 |
| После оптимизации, байт | 123602 |
| Статус | `unchanged` |
| SHA256 оригинала | `192cf43aa78971f3fdc4041627b7cb8a2e5c8b7b90c416bf120a0e5a48a645fd` |

</details>

<details>
<summary>100. /assets/results/cottagecore/moodboards/moodboard4.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard4.webp` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `webp` |
| До оптимизации, байт | 34422 |
| После оптимизации, байт | 34422 |
| Статус | `unchanged` |
| SHA256 оригинала | `e5ec4e2240cba08e4d1658d7107d70760ff3c003249d5e438c7810df77a2d37a` |

</details>

<details>
<summary>101. /assets/results/cottagecore/moodboards/moodboard5.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard5.png` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `png` |
| До оптимизации, байт | 117344 |
| После оптимизации, байт | 117344 |
| Статус | `unchanged` |
| SHA256 оригинала | `38083b1b52f0b448b7d3a8441bf68f99e4181eda5429fabd20a6c1eaacfdb3d4` |

</details>

<details>
<summary>102. /assets/results/cottagecore/moodboards/moodboard6.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard6.png` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `png` |
| До оптимизации, байт | 135818 |
| После оптимизации, байт | 135818 |
| Статус | `unchanged` |
| SHA256 оригинала | `5f01173bd4bce4c60f11e0bfa4ee83c3de8d052c954e6690f25062b2f7a72499` |

</details>

<details>
<summary>103. /assets/results/cottagecore/moodboards/moodboard7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard7.webp` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `webp` |
| До оптимизации, байт | 19836 |
| После оптимизации, байт | 19836 |
| Статус | `unchanged` |
| SHA256 оригинала | `dd6f18bbff743f8c84dd297c756ea247864a7a6cdcf29a007b81e2aafdb92bd4` |

</details>

<details>
<summary>104. /assets/results/cottagecore/moodboards/moodboard8.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard8.webp` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `webp` |
| До оптимизации, байт | 41256 |
| После оптимизации, байт | 41256 |
| Статус | `unchanged` |
| SHA256 оригинала | `2ea7429a2a7608dea570eeb1b7bc6ba53be001a4a08ffa879bd4bf6a49caadaf` |

</details>

<details>
<summary>105. /assets/results/cottagecore/moodboards/moodboard9.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/moodboards/moodboard9.png` |
| Ширина, px | 700 |
| Высота, px | 560 |
| Формат | `png` |
| До оптимизации, байт | 115036 |
| После оптимизации, байт | 115036 |
| Статус | `unchanged` |
| SHA256 оригинала | `aef071c37b62db7e9649c8e117e3865fd1add0572de4f7df9601d292a09ee73c` |

</details>

<details>
<summary>106. /assets/results/cottagecore/outfits/outfit1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit1.jpg` |
| Ширина, px | 600 |
| Высота, px | 869 |
| Формат | `jpeg` |
| До оптимизации, байт | 92027 |
| После оптимизации, байт | 88986 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `a01f10bcffe8cc9ecda4d6dccbd437b84d8e7937f27fcb273015ce23348082eb` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit1.jpg` |
| SHA256 результата | `757472b8407684e45cb1ca47ee6e4e66857d0171b5a20e2ee5295314a86014b3` |
| SHA256 декодированных пикселей | `6c198928de7b0e29dea6b6909333870e12bce1301200e959eedbbbfd8f7be6a0` |

</details>

<details>
<summary>107. /assets/results/cottagecore/outfits/outfit10.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit10.jpg` |
| Ширина, px | 600 |
| Высота, px | 818 |
| Формат | `jpeg` |
| До оптимизации, байт | 80099 |
| После оптимизации, байт | 77877 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `eac0df011efc222759640a9610935ed716fe7cf3b98cd62ca607df53615866e3` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit10.jpg` |
| SHA256 результата | `72024ade03dac332d2044204d42c9ab1711b84e9ffc01d1ac8c3e0a42583ba5f` |
| SHA256 декодированных пикселей | `7a4d7a952d3134ca6429469438fd7c6feef2d494e2f9bed5856df88fffedf3e9` |

</details>

<details>
<summary>108. /assets/results/cottagecore/outfits/outfit11.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit11.jpg` |
| Ширина, px | 600 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 23462 |
| После оптимизации, байт | 23462 |
| Статус | `unchanged` |
| SHA256 оригинала | `6ab158f52b249b9d342a6746c08a258863a656382fb64a35264b504ce72f4085` |

</details>

<details>
<summary>109. /assets/results/cottagecore/outfits/outfit12.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit12.jpg` |
| Ширина, px | 600 |
| Высота, px | 750 |
| Формат | `jpeg` |
| До оптимизации, байт | 31251 |
| После оптимизации, байт | 30313 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `fc6feddc48396bfef95f2870c306ac17e503c8bbcf8fec244fe166e31fdac939` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit12.jpg` |
| SHA256 результата | `0636c69107d186dae33dae475a90a041dd9d02c41630a606fdd836d3d297d2fc` |
| SHA256 декодированных пикселей | `6488243ea9dcd50f086af0bbc5579a96d445753f053f119fdc6e10ee0814aebe` |

</details>

<details>
<summary>110. /assets/results/cottagecore/outfits/outfit2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit2.jpg` |
| Ширина, px | 417 |
| Высота, px | 540 |
| Формат | `jpeg` |
| До оптимизации, байт | 73640 |
| После оптимизации, байт | 69172 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `b1bac78813a1bc60aff9ff49487603ef47b018188ecf7377da8ed78b60729d66` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit2.jpg` |
| SHA256 результата | `4290fa52b9302ccdc6b9e4c57ff735925535eeb4b7122b4e9b2f53763c054be3` |
| SHA256 декодированных пикселей | `8e5082149096eae97b6478e95f7253f668462b7546cd22637e99151df4667035` |

</details>

<details>
<summary>111. /assets/results/cottagecore/outfits/outfit3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit3.jpg` |
| Ширина, px | 600 |
| Высота, px | 899 |
| Формат | `jpeg` |
| До оптимизации, байт | 106397 |
| После оптимизации, байт | 102144 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `3c0d74145254adc9b04e342c709cab6c67285a468dfd65fb15d714eca1c92264` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit3.jpg` |
| SHA256 результата | `b890206d3cdf28ca9a25fccee475e44c5950407b44ccac7300f7fd5a06ae8891` |
| SHA256 декодированных пикселей | `0345171aec31b1ba5c7a4c35dbe34fa5a0fc585d15a69d39daaf6eb3f7314236` |

</details>

<details>
<summary>112. /assets/results/cottagecore/outfits/outfit4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit4.jpg` |
| Ширина, px | 600 |
| Высота, px | 704 |
| Формат | `jpeg` |
| До оптимизации, байт | 121523 |
| После оптимизации, байт | 114319 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `89ad0cc14bbdd47a7c84bddfe40257bd8569aacd2070e1acf80a82464abdf892` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit4.jpg` |
| SHA256 результата | `6029c3e7a130b927e54ba6cf9166ceab0d2eb6acf4b3e1690b53b55f77639966` |
| SHA256 декодированных пикселей | `48ca7015ec925712f35070ff58766f02c25fe04a47e2d93371914ed1cc773f18` |

</details>

<details>
<summary>113. /assets/results/cottagecore/outfits/outfit5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit5.jpg` |
| Ширина, px | 600 |
| Высота, px | 899 |
| Формат | `jpeg` |
| До оптимизации, байт | 122962 |
| После оптимизации, байт | 118733 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `f80de6ae731bceb970e0d38545dee1ac06bad99fbfcaf7ed74f9b946f04ed0a7` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit5.jpg` |
| SHA256 результата | `52daa54a0dfb37d814ee6678645b4b5f0a1fd39b153c508877d43d3a88a9a3a1` |
| SHA256 декодированных пикселей | `d26b1fa71bcebddf2338d0f91e6fc5f5c17528bd422418c9d2d130c841e2cc23` |

</details>

<details>
<summary>114. /assets/results/cottagecore/outfits/outfit6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit6.jpg` |
| Ширина, px | 600 |
| Высота, px | 855 |
| Формат | `jpeg` |
| До оптимизации, байт | 66407 |
| После оптимизации, байт | 65477 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `168fc997cf14039367d44655c4de073efb5216cfcec60447c6227f8b60f7fd7e` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit6.jpg` |
| SHA256 результата | `2dce119c8e4bd8acc2d4728606cc3a373387fddba31d94448c26afc206640480` |
| SHA256 декодированных пикселей | `062a4e1cfcc2053c88bd489ce93b83a73025aa248bec4c9c6b51af35095105f6` |

</details>

<details>
<summary>115. /assets/results/cottagecore/outfits/outfit7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit7.jpg` |
| Ширина, px | 600 |
| Высота, px | 877 |
| Формат | `jpeg` |
| До оптимизации, байт | 130660 |
| После оптимизации, байт | 124935 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `66ac551b4f5790192ca7bc8115cdf34aea6e7eb66eb3064c5bd2dd2ad8f7cf3f` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit7.jpg` |
| SHA256 результата | `97cbc2f9d8efbb71355de5aaece5fecdde14762c9cdf2b55f9aa06359bd9c066` |
| SHA256 декодированных пикселей | `ed6b3797873115d0d66f146b70aa560291857f0156928424adf92e56ed5339a4` |

</details>

<details>
<summary>116. /assets/results/cottagecore/outfits/outfit8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit8.jpg` |
| Ширина, px | 600 |
| Высота, px | 894 |
| Формат | `jpeg` |
| До оптимизации, байт | 128584 |
| После оптимизации, байт | 123146 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `e6b3eb24ecaac6fc91271afe3679d1d5b75538358142af6637be2ac09a596569` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit8.jpg` |
| SHA256 результата | `c49d328e31982f3ec85c9912820818908d6017101525bc7100cdf0dcb160b9a6` |
| SHA256 декодированных пикселей | `ca494ebda141b2da55a85c5edc226da38647df3dbd5651ca577809da057b46b0` |

</details>

<details>
<summary>117. /assets/results/cottagecore/outfits/outfit9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/cottagecore/outfits/outfit9.jpg` |
| Ширина, px | 600 |
| Высота, px | 750 |
| Формат | `jpeg` |
| До оптимизации, байт | 117783 |
| После оптимизации, байт | 111543 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `c8c694cd869d8a7c4092c8b5b3f067f8d66a31157c72f4b30e6bab9c31dc338e` |
| Результирующий адрес | `/assets/results/cottagecore/outfits/outfit9.jpg` |
| SHA256 результата | `a35af342715eac3afe97d2b2efa40b4221052273ad5b3831af47bc85b516fd34` |
| SHA256 декодированных пикселей | `dd1a16eda701cca9fc054c545046e412f4ec272ba8f324e8501c3d7a2a074e97` |

</details>

<details>
<summary>118. /assets/results/darkacademia/interiors/interior1.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior1.webp` |
| Ширина, px | 1024 |
| Высота, px | 1024 |
| Формат | `webp` |
| До оптимизации, байт | 53152 |
| После оптимизации, байт | 53152 |
| Статус | `unchanged` |
| SHA256 оригинала | `e6c457814ab160701d07fa6a774379f19c0f0747ecf665e99f93832788342d9b` |

</details>

<details>
<summary>119. /assets/results/darkacademia/interiors/interior2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior2.jpg` |
| Ширина, px | 474 |
| Высота, px | 842 |
| Формат | `jpeg` |
| До оптимизации, байт | 147577 |
| После оптимизации, байт | 122738 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `bcd19f4d6ba8184dcefbae406311315a296a6dadbbe34e7f217156fd9e638923` |
| Результирующий адрес | `/assets/results/darkacademia/interiors/interior2.jpg` |
| SHA256 результата | `fd0a4555747aeeae4f50bf1c7a62222139a358f496da3934ae5efb9a7269ab94` |
| SHA256 декодированных пикселей | `4d4175cd9921c553f77e7bdfde2b9cccb18966f03d98077bdaaca5b8ff189eff` |

</details>

<details>
<summary>120. /assets/results/darkacademia/interiors/interior3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior3.jpg` |
| Ширина, px | 564 |
| Высота, px | 846 |
| Формат | `jpeg` |
| До оптимизации, байт | 75683 |
| После оптимизации, байт | 75683 |
| Статус | `unchanged` |
| SHA256 оригинала | `e915bcac1b6622354fa416ed3e37dcdf25ce153d306e99e3f1cc76097742d89c` |

</details>

<details>
<summary>121. /assets/results/darkacademia/interiors/interior4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior4.jpg` |
| Ширина, px | 900 |
| Высота, px | 900 |
| Формат | `jpeg` |
| До оптимизации, байт | 141660 |
| После оптимизации, байт | 138054 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `ced4764f1a223529c21ac490190a2e853c6ebd2c02d9261e39ce5526dd9567a3` |
| Результирующий адрес | `/assets/results/darkacademia/interiors/interior4.jpg` |
| SHA256 результата | `ffc9302730e0bd457743dc69eb5937ad0f611ad3cc50011bf84671fae432f9a0` |
| SHA256 декодированных пикселей | `e684286ed43715ce3151954d52437f789ee741665e18f610ef8203949fff49a0` |

</details>

<details>
<summary>122. /assets/results/darkacademia/interiors/interior5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior5.jpg` |
| Ширина, px | 564 |
| Высота, px | 705 |
| Формат | `jpeg` |
| До оптимизации, байт | 53963 |
| После оптимизации, байт | 53963 |
| Статус | `unchanged` |
| SHA256 оригинала | `df256a85663b061c6285e2b65b8700a13586d77fd7a37a4c4416406ce122c28b` |

</details>

<details>
<summary>123. /assets/results/darkacademia/interiors/interior6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior6.jpg` |
| Ширина, px | 720 |
| Высота, px | 1280 |
| Формат | `jpeg` |
| До оптимизации, байт | 162209 |
| После оптимизации, байт | 162209 |
| Статус | `unchanged` |
| SHA256 оригинала | `4a8bb0405f61d42c37463a926fbf2dcc21f7afe3b45962ad2518be3a8ab3b56a` |

</details>

<details>
<summary>124. /assets/results/darkacademia/interiors/interior7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior7.webp` |
| Ширина, px | 700 |
| Высота, px | 1520 |
| Формат | `webp` |
| До оптимизации, байт | 75954 |
| После оптимизации, байт | 75954 |
| Статус | `unchanged` |
| SHA256 оригинала | `00751953595b98733b65cf55cf47018e49d570c0c0a4c806c6d434b244359e43` |

</details>

<details>
<summary>125. /assets/results/darkacademia/interiors/interior8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/interiors/interior8.jpg` |
| Ширина, px | 900 |
| Высота, px | 1350 |
| Формат | `jpeg` |
| До оптимизации, байт | 173014 |
| После оптимизации, байт | 173014 |
| Статус | `unchanged` |
| SHA256 оригинала | `13e76609bd68503b4ef4ad4c0e97c4ed33687e2e6979c3c4cef91ec060c3f91a` |

</details>

<details>
<summary>126. /assets/results/darkacademia/moodboards/moodboard1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard1.jpg` |
| Ширина, px | 419 |
| Высота, px | 552 |
| Формат | `jpeg` |
| До оптимизации, байт | 35711 |
| После оптимизации, байт | 35711 |
| Статус | `unchanged` |
| SHA256 оригинала | `7955c43adcb473150b72a91bca6ed899e9442337eb1acced7be3aabb09680b93` |

</details>

<details>
<summary>127. /assets/results/darkacademia/moodboards/moodboard2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard2.jpg` |
| Ширина, px | 736 |
| Высота, px | 1104 |
| Формат | `jpeg` |
| До оптимизации, байт | 125377 |
| После оптимизации, байт | 125377 |
| Статус | `unchanged` |
| SHA256 оригинала | `f6129276fb7250eee0e278538bae2b73d1f677c3ccd4a0095b106f0843a077e3` |

</details>

<details>
<summary>128. /assets/results/darkacademia/moodboards/moodboard3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard3.jpg` |
| Ширина, px | 736 |
| Высота, px | 1196 |
| Формат | `jpeg` |
| До оптимизации, байт | 168967 |
| После оптимизации, байт | 168967 |
| Статус | `unchanged` |
| SHA256 оригинала | `61e0c60cd367ba0935429e4d407becd8271500523e0899b14350e99396378940` |

</details>

<details>
<summary>129. /assets/results/darkacademia/moodboards/moodboard4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard4.jpg` |
| Ширина, px | 736 |
| Высота, px | 1086 |
| Формат | `jpeg` |
| До оптимизации, байт | 75841 |
| После оптимизации, байт | 75635 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `845f2dcdf1919b9c9dc85255715ff1e7b16409e92eae70fc6c0a0105838b0e96` |
| Результирующий адрес | `/assets/results/darkacademia/moodboards/moodboard4.jpg` |
| SHA256 результата | `41df3e7dccae210db1e311c2981bee543866fbf1540e8b3789d3ba7f3de0b852` |
| SHA256 декодированных пикселей | `76d666374d4b3f2b403570ae0791281d11dd10690025fc1bb5bc924e41055d34` |

</details>

<details>
<summary>130. /assets/results/darkacademia/moodboards/moodboard5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard5.jpg` |
| Ширина, px | 1200 |
| Высота, px | 1600 |
| Формат | `jpeg` |
| До оптимизации, байт | 243644 |
| После оптимизации, байт | 243644 |
| Статус | `unchanged` |
| SHA256 оригинала | `8ef531512d1b4675f2ac6800f8a982ea29f71794bff6cbcfa2cb6a0538703fc4` |

</details>

<details>
<summary>131. /assets/results/darkacademia/moodboards/moodboard6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard6.jpg` |
| Ширина, px | 900 |
| Высота, px | 1125 |
| Формат | `jpeg` |
| До оптимизации, байт | 161615 |
| После оптимизации, байт | 156085 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `5a9676a101107a9e885c71c158158d4b55d3b88265e80b026d58dcd4ce732ea4` |
| Результирующий адрес | `/assets/results/darkacademia/moodboards/moodboard6.jpg` |
| SHA256 результата | `efcc3050f2c4de65d129bddef445ba0addd9dad9c4bd4c96762dbff5eb07f702` |
| SHA256 декодированных пикселей | `8c8797a9e84be35f7fe9086702db0cb500f2ea92db8d5e0d308dbdba8ed26703` |

</details>

<details>
<summary>132. /assets/results/darkacademia/moodboards/moodboard7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard7.jpg` |
| Ширина, px | 1000 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| До оптимизации, байт | 108801 |
| После оптимизации, байт | 108801 |
| Статус | `unchanged` |
| SHA256 оригинала | `4a71fe7897a5d11287d6eeab588f9f6edabf195eb55e0cb460943d675f9ba168` |

</details>

<details>
<summary>133. /assets/results/darkacademia/moodboards/moodboard8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/moodboards/moodboard8.jpg` |
| Ширина, px | 553 |
| Высота, px | 779 |
| Формат | `jpeg` |
| До оптимизации, байт | 54802 |
| После оптимизации, байт | 54802 |
| Статус | `unchanged` |
| SHA256 оригинала | `b8a0b5147801f1c0caa7b138ca029b83fdcefa89525fecea835645d34e6936f8` |

</details>

<details>
<summary>134. /assets/results/darkacademia/outfits/outfit1.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit1.webp` |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| До оптимизации, байт | 37956 |
| После оптимизации, байт | 37956 |
| Статус | `unchanged` |
| SHA256 оригинала | `01b5ce7d5a655f0d5f20c1114003cfee84357d2bec633d4214f3bf132651e7bf` |

</details>

<details>
<summary>135. /assets/results/darkacademia/outfits/outfit10.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit10.webp` |
| Ширина, px | 640 |
| Высота, px | 626 |
| Формат | `webp` |
| До оптимизации, байт | 65850 |
| После оптимизации, байт | 65850 |
| Статус | `unchanged` |
| SHA256 оригинала | `5c26e76ad27bfef7b1ac9cab5ce58bc15158ec04014f11e9be4a9ee1fd643cc0` |

</details>

<details>
<summary>136. /assets/results/darkacademia/outfits/outfit11.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit11.webp` |
| Ширина, px | 510 |
| Высота, px | 680 |
| Формат | `webp` |
| До оптимизации, байт | 49574 |
| После оптимизации, байт | 49574 |
| Статус | `unchanged` |
| SHA256 оригинала | `d082c56ecb4a8d0b467527be5c2ffd46ab20b891c1e029c76ad23d5a454901b6` |

</details>

<details>
<summary>137. /assets/results/darkacademia/outfits/outfit12.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit12.webp` |
| Ширина, px | 700 |
| Высота, px | 674 |
| Формат | `webp` |
| До оптимизации, байт | 81676 |
| После оптимизации, байт | 81676 |
| Статус | `unchanged` |
| SHA256 оригинала | `c7052c25c91c187cfb06b3c3c10174adbbaebaff01214937868e02f21eb368b5` |

</details>

<details>
<summary>138. /assets/results/darkacademia/outfits/outfit13.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit13.png` |
| Ширина, px | 293 |
| Высота, px | 421 |
| Формат | `png` |
| До оптимизации, байт | 71723 |
| После оптимизации, байт | 47098 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `dfeee4c201f0508be486f81d35edc7389ec0d85900f0e5fd4356d95fb95fcb88` |
| Результирующий адрес | `/assets/results/darkacademia/outfits/outfit13.lossless.webp` |
| SHA256 результата | `3e9464dbfb70a9e24a377f4f062718b9d82c1066e9aff9c4e5812d40371f7092` |
| SHA256 декодированных пикселей | `e97d4b259be0589c30247dc75ce23de99dc56ccebbf7995b493f282d8b9d799b` |

</details>

<details>
<summary>139. /assets/results/darkacademia/outfits/outfit2.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit2.webp` |
| Ширина, px | 1200 |
| Высота, px | 960 |
| Формат | `webp` |
| До оптимизации, байт | 21274 |
| После оптимизации, байт | 21274 |
| Статус | `unchanged` |
| SHA256 оригинала | `ae527a883d170367081bf26c8ad00b81848b508dec28de825fc17b5994636c7b` |

</details>

<details>
<summary>140. /assets/results/darkacademia/outfits/outfit3.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit3.webp` |
| Ширина, px | 700 |
| Высота, px | 1050 |
| Формат | `webp` |
| До оптимизации, байт | 122018 |
| После оптимизации, байт | 122018 |
| Статус | `unchanged` |
| SHA256 оригинала | `a1cecdd950f2e37c1b0d6b085fb7eaab4ba8d7deefa7352871e8f54b5ff34aab` |

</details>

<details>
<summary>141. /assets/results/darkacademia/outfits/outfit4.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit4.webp` |
| Ширина, px | 900 |
| Высота, px | 900 |
| Формат | `webp` |
| До оптимизации, байт | 43134 |
| После оптимизации, байт | 43134 |
| Статус | `unchanged` |
| SHA256 оригинала | `a81c142e5e2b05bfa4e63dec8297a1f367cdb98d256db5a72ff5aff9dce7c5e1` |

</details>

<details>
<summary>142. /assets/results/darkacademia/outfits/outfit5.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit5.webp` |
| Ширина, px | 900 |
| Высота, px | 900 |
| Формат | `webp` |
| До оптимизации, байт | 17454 |
| После оптимизации, байт | 17454 |
| Статус | `unchanged` |
| SHA256 оригинала | `c1e223fdaafe19158bef68b6208b695feb15ba0ec9a4dfa694638e1e870d9b4b` |

</details>

<details>
<summary>143. /assets/results/darkacademia/outfits/outfit6.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit6.webp` |
| Ширина, px | 500 |
| Высота, px | 600 |
| Формат | `webp` |
| До оптимизации, байт | 35824 |
| После оптимизации, байт | 35824 |
| Статус | `unchanged` |
| SHA256 оригинала | `9d80acd3d663e78ea8720518e5fc3796ffb53ba0f3d123a848756cd075821169` |

</details>

<details>
<summary>144. /assets/results/darkacademia/outfits/outfit7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit7.webp` |
| Ширина, px | 600 |
| Высота, px | 942 |
| Формат | `webp` |
| До оптимизации, байт | 110714 |
| После оптимизации, байт | 110714 |
| Статус | `unchanged` |
| SHA256 оригинала | `e98d6be2102301ab544a417981222c08cd2c7aef73aafa55d5c1828b95eeda7e` |

</details>

<details>
<summary>145. /assets/results/darkacademia/outfits/outfit8.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit8.webp` |
| Ширина, px | 900 |
| Высота, px | 822 |
| Формат | `webp` |
| До оптимизации, байт | 24652 |
| После оптимизации, байт | 24652 |
| Статус | `unchanged` |
| SHA256 оригинала | `54d1bd9f0752a9c77143e2f3ce476094eb62ecad7f0a5f10fb359878e9784f54` |

</details>

<details>
<summary>146. /assets/results/darkacademia/outfits/outfit9.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/darkacademia/outfits/outfit9.webp` |
| Ширина, px | 600 |
| Высота, px | 600 |
| Формат | `webp` |
| До оптимизации, байт | 26950 |
| После оптимизации, байт | 26950 |
| Статус | `unchanged` |
| SHA256 оригинала | `2ce6bd7a69b6d49bb1cbf14154345a66ddfae6246dca3374f1b40e52e1731530` |

</details>

<details>
<summary>147. /assets/results/fairycore/interiors/interior1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior1.jpg` |
| Ширина, px | 720 |
| Высота, px | 888 |
| Формат | `jpeg` |
| До оптимизации, байт | 105558 |
| После оптимизации, байт | 105558 |
| Статус | `unchanged` |
| SHA256 оригинала | `4152093bbfcc0f95e071b3cd15018d23a857683daf96ccd63c0c3fd0f163fe02` |

</details>

<details>
<summary>148. /assets/results/fairycore/interiors/interior10.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior10.jpg` |
| Ширина, px | 710 |
| Высота, px | 712 |
| Формат | `jpeg` |
| До оптимизации, байт | 75829 |
| После оптимизации, байт | 75829 |
| Статус | `unchanged` |
| SHA256 оригинала | `03b3c65ef94ff13274b9c9b94cd3acdfebd5ddd27ab13e445a01cd1d19e38c1d` |

</details>

<details>
<summary>149. /assets/results/fairycore/interiors/interior2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior2.jpg` |
| Ширина, px | 900 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 220108 |
| После оптимизации, байт | 220108 |
| Статус | `unchanged` |
| SHA256 оригинала | `76c9215f3ecc189b635b2fea95c445e6373d2e883c5de2b756447d2d98643bc5` |

</details>

<details>
<summary>150. /assets/results/fairycore/interiors/interior3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior3.jpg` |
| Ширина, px | 736 |
| Высота, px | 993 |
| Формат | `jpeg` |
| До оптимизации, байт | 160295 |
| После оптимизации, байт | 160295 |
| Статус | `unchanged` |
| SHA256 оригинала | `3d9c6e6f469419d9ee74c5cf0f02266870dfac3656777d566eb6d9ce44b93096` |

</details>

<details>
<summary>151. /assets/results/fairycore/interiors/interior4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior4.jpg` |
| Ширина, px | 750 |
| Высота, px | 1125 |
| Формат | `jpeg` |
| До оптимизации, байт | 167214 |
| После оптимизации, байт | 167214 |
| Статус | `unchanged` |
| SHA256 оригинала | `09e7a3ebab2d23f080f40f5511f53b5615e7c5920213d5fc114186a5ccbd749b` |

</details>

<details>
<summary>152. /assets/results/fairycore/interiors/interior5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior5.jpg` |
| Ширина, px | 960 |
| Высота, px | 720 |
| Формат | `jpeg` |
| До оптимизации, байт | 124712 |
| После оптимизации, байт | 124712 |
| Статус | `unchanged` |
| SHA256 оригинала | `07653279d6ab6f2777af8694a04178bf50375b3c9263c76e273d7db1bbf6be96` |

</details>

<details>
<summary>153. /assets/results/fairycore/interiors/interior6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior6.jpg` |
| Ширина, px | 490 |
| Высота, px | 490 |
| Формат | `jpeg` |
| До оптимизации, байт | 93571 |
| После оптимизации, байт | 82702 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `76c2fe3a540e7856de9aa0d49c95e166c2440d1509eeea63ad65d1b696e86d30` |
| Результирующий адрес | `/assets/results/fairycore/interiors/interior6.jpg` |
| SHA256 результата | `7793299a858b48a7676d10a8d0bc1e643997ec5007b894c0e4f817b2ccddf141` |
| SHA256 декодированных пикселей | `a455d6ad4c7a43ddcce6e4a774735f21da3e88090f9fd0c312d7017413f759df` |

</details>

<details>
<summary>154. /assets/results/fairycore/interiors/interior7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior7.jpg` |
| Ширина, px | 736 |
| Высота, px | 1012 |
| Формат | `jpeg` |
| До оптимизации, байт | 152557 |
| После оптимизации, байт | 152557 |
| Статус | `unchanged` |
| SHA256 оригинала | `c06e60c3aa4b5c4bf8e5c83505d49f65331634b5ee3bfeea82cebba1b8862ed5` |

</details>

<details>
<summary>155. /assets/results/fairycore/interiors/interior8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior8.jpg` |
| Ширина, px | 683 |
| Высота, px | 879 |
| Формат | `jpeg` |
| До оптимизации, байт | 129835 |
| После оптимизации, байт | 129835 |
| Статус | `unchanged` |
| SHA256 оригинала | `e6087cc9b771fbd7acd8c5a9e29947d145c23e566a9b88d2a75fa6d6166aa928` |

</details>

<details>
<summary>156. /assets/results/fairycore/interiors/interior9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/interiors/interior9.jpg` |
| Ширина, px | 736 |
| Высота, px | 981 |
| Формат | `jpeg` |
| До оптимизации, байт | 136680 |
| После оптимизации, байт | 136680 |
| Статус | `unchanged` |
| SHA256 оригинала | `b1c54e01b70cf46774ca47a872dd416a661f417822ecb8ac5fb9bef802e98153` |

</details>

<details>
<summary>157. /assets/results/fairycore/moodboards/look1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look1.jpg` |
| Ширина, px | 554 |
| Высота, px | 758 |
| Формат | `jpeg` |
| До оптимизации, байт | 59351 |
| После оптимизации, байт | 59351 |
| Статус | `unchanged` |
| SHA256 оригинала | `bb838c34d73518629ecf76f2b92790a74a32395c6304d2d0a97905b25cb9b88e` |

</details>

<details>
<summary>158. /assets/results/fairycore/moodboards/look2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look2.jpg` |
| Ширина, px | 667 |
| Высота, px | 1000 |
| Формат | `jpeg` |
| До оптимизации, байт | 108522 |
| После оптимизации, байт | 108522 |
| Статус | `unchanged` |
| SHA256 оригинала | `96fe6a347ec6cef8281a5f0def75195862ec983687c288b4f704aa1e5b295135` |

</details>

<details>
<summary>159. /assets/results/fairycore/moodboards/look3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look3.jpg` |
| Ширина, px | 756 |
| Высота, px | 756 |
| Формат | `jpeg` |
| До оптимизации, байт | 106110 |
| После оптимизации, байт | 106110 |
| Статус | `unchanged` |
| SHA256 оригинала | `d9dd3c370822760187b24244805e1693c358ec02f4b77214aff9642255e27270` |

</details>

<details>
<summary>160. /assets/results/fairycore/moodboards/look4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look4.jpg` |
| Ширина, px | 860 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 191505 |
| После оптимизации, байт | 191505 |
| Статус | `unchanged` |
| SHA256 оригинала | `72901523c885cd3298beeeb6887dabcf7fec8944c2b823084e0736e2f35d94c8` |

</details>

<details>
<summary>161. /assets/results/fairycore/moodboards/look5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look5.jpg` |
| Ширина, px | 800 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 204713 |
| После оптимизации, байт | 204713 |
| Статус | `unchanged` |
| SHA256 оригинала | `c3aa471ab705c09809a32d000182c29de42af0eecea915cd7d2dbf482ba39050` |

</details>

<details>
<summary>162. /assets/results/fairycore/moodboards/look6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look6.jpg` |
| Ширина, px | 720 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 155138 |
| После оптимизации, байт | 150492 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `e6b8038539352560fc66a1b21189c23f3f48e2e4e8409f45f50a93e66e80ad28` |
| Результирующий адрес | `/assets/results/fairycore/moodboards/look6.jpg` |
| SHA256 результата | `3bf9bad08b9b90ba855c41c4a9112960eefee317e25161d3243ea96201972758` |
| SHA256 декодированных пикселей | `7091b4072422e33a88d91458c90b45aff9328b6ef9ea687526c06d93c39bc693` |

</details>

<details>
<summary>163. /assets/results/fairycore/moodboards/look7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look7.jpg` |
| Ширина, px | 828 |
| Высота, px | 1153 |
| Формат | `jpeg` |
| До оптимизации, байт | 133247 |
| После оптимизации, байт | 133247 |
| Статус | `unchanged` |
| SHA256 оригинала | `7654d0484de5a9fb75b67b3ec4a6dd14fe553ec7d394943140b4a4b168f16ee9` |

</details>

<details>
<summary>164. /assets/results/fairycore/moodboards/look8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/moodboards/look8.jpg` |
| Ширина, px | 720 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 116564 |
| После оптимизации, байт | 116420 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `c53ae8abb1aa82da6b898613e280b7a9098dd503e673d845072da7e7dde6227a` |
| Результирующий адрес | `/assets/results/fairycore/moodboards/look8.jpg` |
| SHA256 результата | `e866bd1aa519a4bb458b40b74aa71749c300ad3ed07f77986c582efdd371a5d0` |
| SHA256 декодированных пикселей | `1c9a0f45091fad31b12ad2684e10a3c1d9bb7aad10fed3f0874be96639d49b04` |

</details>

<details>
<summary>165. /assets/results/fairycore/outfits/outfit1.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit1.webp` |
| Ширина, px | 600 |
| Высота, px | 600 |
| Формат | `webp` |
| До оптимизации, байт | 59472 |
| После оптимизации, байт | 59472 |
| Статус | `unchanged` |
| SHA256 оригинала | `671bef38ab4edc5e14f3198b72ca0f8e01c5e005992e60a499dec8991cdb4904` |

</details>

<details>
<summary>166. /assets/results/fairycore/outfits/outfit10.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit10.webp` |
| Ширина, px | 1200 |
| Высота, px | 960 |
| Формат | `webp` |
| До оптимизации, байт | 61874 |
| После оптимизации, байт | 61874 |
| Статус | `unchanged` |
| SHA256 оригинала | `390a875df90b21f22050a549f2cb58f3a72cb366baf358b3056b2824aff0386c` |

</details>

<details>
<summary>167. /assets/results/fairycore/outfits/outfit11.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit11.webp` |
| Ширина, px | 500 |
| Высота, px | 500 |
| Формат | `webp` |
| До оптимизации, байт | 56524 |
| После оптимизации, байт | 56524 |
| Статус | `unchanged` |
| SHA256 оригинала | `8dbcd75a206fe9faec50a5d238a88b820636aa35135920d501bb7d6281b13a36` |

</details>

<details>
<summary>168. /assets/results/fairycore/outfits/outfit12.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit12.webp` |
| Ширина, px | 736 |
| Высота, px | 736 |
| Формат | `webp` |
| До оптимизации, байт | 53656 |
| После оптимизации, байт | 53656 |
| Статус | `unchanged` |
| SHA256 оригинала | `23fb3d08969034de75f475b7aa1255bdda4dbe0f1f462c9bc36dfc49eda0208c` |

</details>

<details>
<summary>169. /assets/results/fairycore/outfits/outfit2.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit2.webp` |
| Ширина, px | 900 |
| Высота, px | 1200 |
| Формат | `webp` |
| До оптимизации, байт | 78758 |
| После оптимизации, байт | 78758 |
| Статус | `unchanged` |
| SHA256 оригинала | `45b37373d069d117ed6e0163f81be03f062eff479f3dea9d294cc61ac289f593` |

</details>

<details>
<summary>170. /assets/results/fairycore/outfits/outfit3.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit3.webp` |
| Ширина, px | 800 |
| Высота, px | 1200 |
| Формат | `webp` |
| До оптимизации, байт | 62572 |
| После оптимизации, байт | 62572 |
| Статус | `unchanged` |
| SHA256 оригинала | `3cd7d1ac88efe709171569a99e035ea4d97e16c4846ec78f8031d7c35a8ae590` |

</details>

<details>
<summary>171. /assets/results/fairycore/outfits/outfit4.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit4.webp` |
| Ширина, px | 800 |
| Высота, px | 800 |
| Формат | `webp` |
| До оптимизации, байт | 78194 |
| После оптимизации, байт | 78194 |
| Статус | `unchanged` |
| SHA256 оригинала | `a12eb063b22c1872b7c0d672dcb52fb1a64b3125cd5418e3765c15ddc3bcd82b` |

</details>

<details>
<summary>172. /assets/results/fairycore/outfits/outfit5.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit5.png` |
| Ширина, px | 1200 |
| Высота, px | 960 |
| Формат | `png` |
| До оптимизации, байт | 191594 |
| После оптимизации, байт | 191594 |
| Статус | `unchanged` |
| SHA256 оригинала | `ef01db14f9d872a14a55bf04c4d1ecf7e170c50b4e3bdaa9546de562c75e82cf` |

</details>

<details>
<summary>173. /assets/results/fairycore/outfits/outfit6.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit6.webp` |
| Ширина, px | 1200 |
| Высота, px | 1244 |
| Формат | `webp` |
| До оптимизации, байт | 94724 |
| После оптимизации, байт | 94724 |
| Статус | `unchanged` |
| SHA256 оригинала | `7acfa9171ed9c17ae449f70f8097ba53d795a7be0042cb5f93a25e3b44a4aa79` |

</details>

<details>
<summary>174. /assets/results/fairycore/outfits/outfit7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit7.webp` |
| Ширина, px | 1200 |
| Высота, px | 960 |
| Формат | `webp` |
| До оптимизации, байт | 51402 |
| После оптимизации, байт | 51402 |
| Статус | `unchanged` |
| SHA256 оригинала | `39afae943f0fe757fe0098c11f9f2d068dc7e4f1d623f7f0ac2d8ab5352c7898` |

</details>

<details>
<summary>175. /assets/results/fairycore/outfits/outfit8.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit8.webp` |
| Ширина, px | 1200 |
| Высота, px | 960 |
| Формат | `webp` |
| До оптимизации, байт | 49306 |
| После оптимизации, байт | 49306 |
| Статус | `unchanged` |
| SHA256 оригинала | `ab62b860311bcff37cb7f4729c849fe669723869a85dcfe1f197c08674e8edd3` |

</details>

<details>
<summary>176. /assets/results/fairycore/outfits/outfit9.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/fairycore/outfits/outfit9.webp` |
| Ширина, px | 639 |
| Высота, px | 852 |
| Формат | `webp` |
| До оптимизации, байт | 38456 |
| После оптимизации, байт | 38456 |
| Статус | `unchanged` |
| SHA256 оригинала | `8930111fd73201fcecc33942003f459b3ce314f353089cdad4af11fa1b727218` |

</details>

<details>
<summary>177. /assets/results/goblincore/interiors/interior1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior1.jpg` |
| Ширина, px | 900 |
| Высота, px | 906 |
| Формат | `jpeg` |
| До оптимизации, байт | 159267 |
| После оптимизации, байт | 153379 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `e0caabaddd026b8c61bc594451df5fafb1682c9c72d944a35ef3a2f5b2fdb41c` |
| Результирующий адрес | `/assets/results/goblincore/interiors/interior1.jpg` |
| SHA256 результата | `f631aafc4d84bfe7c0a471efa0fc8ddff71b4ac2de8a28936e1cdac0dbc1b1a3` |
| SHA256 декодированных пикселей | `44174ad6d7cde68552b08d63aa5cf5a45b3d23fff01c00ca66b6a2ac5d8700a4` |

</details>

<details>
<summary>178. /assets/results/goblincore/interiors/interior2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior2.jpg` |
| Ширина, px | 680 |
| Высота, px | 680 |
| Формат | `jpeg` |
| До оптимизации, байт | 76691 |
| После оптимизации, байт | 76691 |
| Статус | `unchanged` |
| SHA256 оригинала | `bb9912a8bef217ec87ab744aa85f100b669a74af03c97b41c3dd9c46c62240e5` |

</details>

<details>
<summary>179. /assets/results/goblincore/interiors/interior3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior3.jpg` |
| Ширина, px | 900 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 190358 |
| После оптимизации, байт | 190358 |
| Статус | `unchanged` |
| SHA256 оригинала | `573a121fa17ed995fcd4995ddd6f2669e51b7bed86f17f430c7ccbd3c9cbd5a2` |

</details>

<details>
<summary>180. /assets/results/goblincore/interiors/interior4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior4.jpg` |
| Ширина, px | 1080 |
| Высота, px | 1340 |
| Формат | `jpeg` |
| До оптимизации, байт | 209207 |
| После оптимизации, байт | 209207 |
| Статус | `unchanged` |
| SHA256 оригинала | `89e29c6b0dff945810fb5e26e9bed9286f3819eed1057e56bc6997918e38691a` |

</details>

<details>
<summary>181. /assets/results/goblincore/interiors/interior5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior5.jpg` |
| Ширина, px | 900 |
| Высота, px | 1114 |
| Формат | `jpeg` |
| До оптимизации, байт | 155587 |
| После оптимизации, байт | 152380 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `7266598d9d9c9e0a75ff022ca4eebdcc1cad698afaf26ee73a818dff8419ad97` |
| Результирующий адрес | `/assets/results/goblincore/interiors/interior5.jpg` |
| SHA256 результата | `82c3b6a0b365dc34ba542ad323111a6729b505e69bf48cf8fe5d8305173f52eb` |
| SHA256 декодированных пикселей | `068c34370e42c94c19272433573d0a622a527b963fc3f94f66850a4187bfa749` |

</details>

<details>
<summary>182. /assets/results/goblincore/interiors/interior6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior6.jpg` |
| Ширина, px | 736 |
| Высота, px | 981 |
| Формат | `jpeg` |
| До оптимизации, байт | 138672 |
| После оптимизации, байт | 138672 |
| Статус | `unchanged` |
| SHA256 оригинала | `db6f62957ccdc904b457b4104e45d5fcf2be25604b20d563e1fe8e15c1e34051` |

</details>

<details>
<summary>183. /assets/results/goblincore/interiors/interior7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior7.jpg` |
| Ширина, px | 750 |
| Высота, px | 938 |
| Формат | `jpeg` |
| До оптимизации, байт | 191319 |
| После оптимизации, байт | 191319 |
| Статус | `unchanged` |
| SHA256 оригинала | `2f9b3c425c237b5a2387385dc2b8cde34e3ed988528093d61f96785ce68bf9bf` |

</details>

<details>
<summary>184. /assets/results/goblincore/interiors/interior8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior8.jpg` |
| Ширина, px | 900 |
| Высота, px | 1116 |
| Формат | `jpeg` |
| До оптимизации, байт | 165164 |
| После оптимизации, байт | 161524 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `f61e8db4c9dd46fdf54b2339bf64f23555a70fdca0216f8434b187201c14be3d` |
| Результирующий адрес | `/assets/results/goblincore/interiors/interior8.jpg` |
| SHA256 результата | `3ea7c83fc291f18eef4b8901029aee2b51869e2c47e1ced5984588cd5f554b55` |
| SHA256 декодированных пикселей | `76905c38975ee47f32abb8088320b0e8cbaa1f3318bdb7d6c04f7ea9200fb49c` |

</details>

<details>
<summary>185. /assets/results/goblincore/interiors/interior9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/interiors/interior9.jpg` |
| Ширина, px | 848 |
| Высота, px | 1264 |
| Формат | `jpeg` |
| До оптимизации, байт | 183897 |
| После оптимизации, байт | 181231 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `7fee6685d6f247d6f1df6d1df5a281d658596ee73f958a0bc60f4b1f788831ef` |
| Результирующий адрес | `/assets/results/goblincore/interiors/interior9.jpg` |
| SHA256 результата | `587e642af8b40ccac24cf78772f7e79300ee93da8522e82cb1e8ef514771828e` |
| SHA256 декодированных пикселей | `e031e80dbb64e775792ff7f3e66635c1a4b394f89ef9270e06cff1b55b60c252` |

</details>

<details>
<summary>186. /assets/results/goblincore/moodboards/mood1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/moodboards/mood1.jpg` |
| Ширина, px | 640 |
| Высота, px | 427 |
| Формат | `jpeg` |
| До оптимизации, байт | 54664 |
| После оптимизации, байт | 54664 |
| Статус | `unchanged` |
| SHA256 оригинала | `af8fced355d17682f53f663c7507f9327c02f87034ba96560e1406a3396f789f` |

</details>

<details>
<summary>187. /assets/results/goblincore/moodboards/mood2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/moodboards/mood2.jpg` |
| Ширина, px | 640 |
| Высота, px | 539 |
| Формат | `jpeg` |
| До оптимизации, байт | 65991 |
| После оптимизации, байт | 65991 |
| Статус | `unchanged` |
| SHA256 оригинала | `2c4ba5cc125ae8ec377002bad5b6d7b978f2a6e242959cc47c2677dc27c75b17` |

</details>

<details>
<summary>188. /assets/results/goblincore/moodboards/mood3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/moodboards/mood3.jpg` |
| Ширина, px | 750 |
| Высота, px | 718 |
| Формат | `jpeg` |
| До оптимизации, байт | 65473 |
| После оптимизации, байт | 65473 |
| Статус | `unchanged` |
| SHA256 оригинала | `4c81dffc49e6ff786400bab1d8856fadbff4f89cfe3bc16facf608c2c0c1f95c` |

</details>

<details>
<summary>189. /assets/results/goblincore/moodboards/mood4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/moodboards/mood4.jpg` |
| Ширина, px | 735 |
| Высота, px | 907 |
| Формат | `jpeg` |
| До оптимизации, байт | 57928 |
| После оптимизации, байт | 57928 |
| Статус | `unchanged` |
| SHA256 оригинала | `d346240aef3d49f75a52cea8b6dabc0c0fb1dfaaf98516c53a79a028d64e434c` |

</details>

<details>
<summary>190. /assets/results/goblincore/moodboards/mood5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/moodboards/mood5.jpg` |
| Ширина, px | 900 |
| Высота, px | 1125 |
| Формат | `jpeg` |
| До оптимизации, байт | 185241 |
| После оптимизации, байт | 185241 |
| Статус | `unchanged` |
| SHA256 оригинала | `548f46baa9d13cdf141260dff81eb7ba09a287b98102dfc1c183fbab053addf1` |

</details>

<details>
<summary>191. /assets/results/goblincore/moodboards/mood6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/moodboards/mood6.jpg` |
| Ширина, px | 900 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 172785 |
| После оптимизации, байт | 172785 |
| Статус | `unchanged` |
| SHA256 оригинала | `0efb706ba8cf36b9db55c00d7d1b75af866091598e072a7d309c8121489a05fe` |

</details>

<details>
<summary>192. /assets/results/goblincore/moodboards/mood7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/moodboards/mood7.jpg` |
| Ширина, px | 400 |
| Высота, px | 534 |
| Формат | `jpeg` |
| До оптимизации, байт | 59642 |
| После оптимизации, байт | 59642 |
| Статус | `unchanged` |
| SHA256 оригинала | `20431ece4108130273153d65ffffae97d92169842db24ba98ee1a1d391d51daf` |

</details>

<details>
<summary>193. /assets/results/goblincore/outfits/outfit1.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit1.webp` |
| Ширина, px | 555 |
| Высота, px | 675 |
| Формат | `webp` |
| До оптимизации, байт | 20170 |
| После оптимизации, байт | 20170 |
| Статус | `unchanged` |
| SHA256 оригинала | `43b25555b9ba320f15cbf21af96f372f0a3ce754aab1a1726b34f7b4b73369a0` |

</details>

<details>
<summary>194. /assets/results/goblincore/outfits/outfit10.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit10.webp` |
| Ширина, px | 544 |
| Высота, px | 680 |
| Формат | `webp` |
| До оптимизации, байт | 45820 |
| После оптимизации, байт | 45820 |
| Статус | `unchanged` |
| SHA256 оригинала | `995513f17d89ab6df28bbee2c0a0a93c36dd574b24627c3c6c31531f9ed71fe2` |

</details>

<details>
<summary>195. /assets/results/goblincore/outfits/outfit11.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit11.webp` |
| Ширина, px | 900 |
| Высота, px | 900 |
| Формат | `webp` |
| До оптимизации, байт | 45614 |
| После оптимизации, байт | 45614 |
| Статус | `unchanged` |
| SHA256 оригинала | `cafdfc4080166af0004c2c28ed127e018b6e206326bf485406ac7d61be87aea1` |

</details>

<details>
<summary>196. /assets/results/goblincore/outfits/outfit12.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit12.webp` |
| Ширина, px | 600 |
| Высота, px | 800 |
| Формат | `webp` |
| До оптимизации, байт | 23874 |
| После оптимизации, байт | 23874 |
| Статус | `unchanged` |
| SHA256 оригинала | `4e59864be620af3c1929d5033bec35bbcd8890ab810beddcdbe6b38012492078` |

</details>

<details>
<summary>197. /assets/results/goblincore/outfits/outfit13.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit13.webp` |
| Ширина, px | 900 |
| Высота, px | 900 |
| Формат | `webp` |
| До оптимизации, байт | 70700 |
| После оптимизации, байт | 70700 |
| Статус | `unchanged` |
| SHA256 оригинала | `533c0a018cf78abd7d823e360d58840d7f701c8d969faa7e30311b77bdd70801` |

</details>

<details>
<summary>198. /assets/results/goblincore/outfits/outfit14.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit14.webp` |
| Ширина, px | 700 |
| Высота, px | 700 |
| Формат | `webp` |
| До оптимизации, байт | 29018 |
| После оптимизации, байт | 29018 |
| Статус | `unchanged` |
| SHA256 оригинала | `cf589e830b0ef13d83926aa1ff646e16f2a5c780246f2cde83356c290595588a` |

</details>

<details>
<summary>199. /assets/results/goblincore/outfits/outfit15.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit15.jpg` |
| Ширина, px | 760 |
| Высота, px | 781 |
| Формат | `jpeg` |
| До оптимизации, байт | 68138 |
| После оптимизации, байт | 68138 |
| Статус | `unchanged` |
| SHA256 оригинала | `bc5149f193592ff834505ac2051d6fa67ec6e77b525d3f0dd862f86186b18fb5` |

</details>

<details>
<summary>200. /assets/results/goblincore/outfits/outfit2.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit2.webp` |
| Ширина, px | 464 |
| Высота, px | 797 |
| Формат | `webp` |
| До оптимизации, байт | 28388 |
| После оптимизации, байт | 28388 |
| Статус | `unchanged` |
| SHA256 оригинала | `1cf014ebb176da9af9d99aea6e2c9070eac7ee817c5227dc7138d98da5015398` |

</details>

<details>
<summary>201. /assets/results/goblincore/outfits/outfit3.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit3.webp` |
| Ширина, px | 736 |
| Высота, px | 736 |
| Формат | `webp` |
| До оптимизации, байт | 39862 |
| После оптимизации, байт | 39862 |
| Статус | `unchanged` |
| SHA256 оригинала | `67f8ebe3a65a0ad94fb194c17d05513c54fddfb31fea0abc5eac1f259b608beb` |

</details>

<details>
<summary>202. /assets/results/goblincore/outfits/outfit4.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit4.webp` |
| Ширина, px | 700 |
| Высота, px | 700 |
| Формат | `webp` |
| До оптимизации, байт | 109308 |
| После оптимизации, байт | 109308 |
| Статус | `unchanged` |
| SHA256 оригинала | `fa64e4a055d3e0a184feb79f92ed23dcb4c9744b06794debe4a5712e0eaeda66` |

</details>

<details>
<summary>203. /assets/results/goblincore/outfits/outfit5.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit5.webp` |
| Ширина, px | 600 |
| Высота, px | 508 |
| Формат | `webp` |
| До оптимизации, байт | 35924 |
| После оптимизации, байт | 35924 |
| Статус | `unchanged` |
| SHA256 оригинала | `684229b2aa8bd15ac99a12e21d59fd8715192bea50d7a060628fd5ae262c2be8` |

</details>

<details>
<summary>204. /assets/results/goblincore/outfits/outfit6.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit6.webp` |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| До оптимизации, байт | 36314 |
| После оптимизации, байт | 36314 |
| Статус | `unchanged` |
| SHA256 оригинала | `5c2b9c87d818e3b2be1f771e377b0d76823641ef417bb7979b0064062924d665` |

</details>

<details>
<summary>205. /assets/results/goblincore/outfits/outfit7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit7.webp` |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| До оптимизации, байт | 10414 |
| После оптимизации, байт | 10414 |
| Статус | `unchanged` |
| SHA256 оригинала | `1f454679e1392f44e52565b8e5b1113873738b56896e926e0c78fb985d1b904b` |

</details>

<details>
<summary>206. /assets/results/goblincore/outfits/outfit8.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit8.webp` |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| До оптимизации, байт | 31716 |
| После оптимизации, байт | 31716 |
| Статус | `unchanged` |
| SHA256 оригинала | `bac4f56269867781bef8704481ee14cb7da9098c1fe425d554e555225a73f3a4` |

</details>

<details>
<summary>207. /assets/results/goblincore/outfits/outfit9.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/goblincore/outfits/outfit9.webp` |
| Ширина, px | 900 |
| Высота, px | 720 |
| Формат | `webp` |
| До оптимизации, байт | 39374 |
| После оптимизации, байт | 39374 |
| Статус | `unchanged` |
| SHA256 оригинала | `48181397f8266091675b6855c4723fb862ced7d12aac7c0cc11f0ae28796de6a` |

</details>

<details>
<summary>208. /assets/results/lightacademia/interiors/interior1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior1.jpg` |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `jpeg` |
| До оптимизации, байт | 290570 |
| После оптимизации, байт | 290570 |
| Статус | `unchanged` |
| SHA256 оригинала | `c22ccf7893febec2719a7b5ac494d5fb6b8aa266e31404a19cb296b17231a93d` |

</details>

<details>
<summary>209. /assets/results/lightacademia/interiors/interior10.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior10.jpg` |
| Ширина, px | 736 |
| Высота, px | 1308 |
| Формат | `jpeg` |
| До оптимизации, байт | 192568 |
| После оптимизации, байт | 192568 |
| Статус | `unchanged` |
| SHA256 оригинала | `77435a063ae384b5d0d023f4fd14ec128c574f81bf6fa8b83b5157afc38bdd20` |

</details>

<details>
<summary>210. /assets/results/lightacademia/interiors/interior11.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior11.jpg` |
| Ширина, px | 1024 |
| Высота, px | 1536 |
| Формат | `jpeg` |
| До оптимизации, байт | 200778 |
| После оптимизации, байт | 200778 |
| Статус | `unchanged` |
| SHA256 оригинала | `ab7e12a1817ee0f50055677e4013d78d414e67003a1ed6812170fc469ce5554c` |

</details>

<details>
<summary>211. /assets/results/lightacademia/interiors/interior2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior2.jpg` |
| Ширина, px | 1100 |
| Высота, px | 1885 |
| Формат | `jpeg` |
| До оптимизации, байт | 188197 |
| После оптимизации, байт | 188197 |
| Статус | `unchanged` |
| SHA256 оригинала | `03f1260d99c4ed6170b79d7dd5326140abd39ded3d2b45d098babcda7a175200` |

</details>

<details>
<summary>212. /assets/results/lightacademia/interiors/interior3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior3.jpg` |
| Ширина, px | 736 |
| Высота, px | 954 |
| Формат | `jpeg` |
| До оптимизации, байт | 94244 |
| После оптимизации, байт | 94244 |
| Статус | `unchanged` |
| SHA256 оригинала | `3cbeabbff23f0ca73612d4d62aa0e45a9c31e28f8584dcec3f9ab4cbcadc5c0b` |

</details>

<details>
<summary>213. /assets/results/lightacademia/interiors/interior4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior4.jpg` |
| Ширина, px | 1024 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| До оптимизации, байт | 116098 |
| После оптимизации, байт | 116098 |
| Статус | `unchanged` |
| SHA256 оригинала | `c439f102fca57ea10a18c9f6f6b0a18893c8f0ed0a4aa9eeac641f954b879a59` |

</details>

<details>
<summary>214. /assets/results/lightacademia/interiors/interior5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior5.jpg` |
| Ширина, px | 1080 |
| Высота, px | 1350 |
| Формат | `jpeg` |
| До оптимизации, байт | 198127 |
| После оптимизации, байт | 198127 |
| Статус | `unchanged` |
| SHA256 оригинала | `11b24b92571c1f329faaf85bcfb521dc130cd9d259a772c6533a7a16bdaa9d23` |

</details>

<details>
<summary>215. /assets/results/lightacademia/interiors/interior6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior6.jpg` |
| Ширина, px | 1200 |
| Высота, px | 1552 |
| Формат | `jpeg` |
| До оптимизации, байт | 187169 |
| После оптимизации, байт | 187169 |
| Статус | `unchanged` |
| SHA256 оригинала | `f53bd1506e090f8188b25a8c9b548892958351086dc60e1994053a1a82d8e5ab` |

</details>

<details>
<summary>216. /assets/results/lightacademia/interiors/interior7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior7.jpg` |
| Ширина, px | 1170 |
| Высота, px | 1428 |
| Формат | `jpeg` |
| До оптимизации, байт | 152722 |
| После оптимизации, байт | 152722 |
| Статус | `unchanged` |
| SHA256 оригинала | `5a9c8783cfe1c327a910418e21ffb85e192722446ba055d8fc7ec4ae01ce0ed3` |

</details>

<details>
<summary>217. /assets/results/lightacademia/interiors/interior8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior8.jpg` |
| Ширина, px | 600 |
| Высота, px | 900 |
| Формат | `jpeg` |
| До оптимизации, байт | 115095 |
| После оптимизации, байт | 115095 |
| Статус | `unchanged` |
| SHA256 оригинала | `3d30e0a0d90faada269996366210516a0d7611763b4d9825e7afc5e8682fc3aa` |

</details>

<details>
<summary>218. /assets/results/lightacademia/interiors/interior9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/interiors/interior9.jpg` |
| Ширина, px | 564 |
| Высота, px | 705 |
| Формат | `jpeg` |
| До оптимизации, байт | 53963 |
| После оптимизации, байт | 53963 |
| Статус | `unchanged` |
| SHA256 оригинала | `df256a85663b061c6285e2b65b8700a13586d77fd7a37a4c4416406ce122c28b` |

</details>

<details>
<summary>219. /assets/results/lightacademia/moodboards/moodboard1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard1.jpg` |
| Ширина, px | 1179 |
| Высота, px | 1433 |
| Формат | `jpeg` |
| До оптимизации, байт | 161370 |
| После оптимизации, байт | 161370 |
| Статус | `unchanged` |
| SHA256 оригинала | `7af2e7cfc939749691ea994362e95ec72d4e22befc1096ee0880bfeeeb80a67d` |

</details>

<details>
<summary>220. /assets/results/lightacademia/moodboards/moodboard10.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard10.jpg` |
| Ширина, px | 906 |
| Высота, px | 1326 |
| Формат | `jpeg` |
| До оптимизации, байт | 218859 |
| После оптимизации, байт | 218859 |
| Статус | `unchanged` |
| SHA256 оригинала | `388a72837fe75dfd44b30fe4afbb1c6f2f7b95bfe9ac02ab5000044d01ca3971` |

</details>

<details>
<summary>221. /assets/results/lightacademia/moodboards/moodboard11.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard11.jpg` |
| Ширина, px | 1164 |
| Высота, px | 1846 |
| Формат | `jpeg` |
| До оптимизации, байт | 194595 |
| После оптимизации, байт | 194595 |
| Статус | `unchanged` |
| SHA256 оригинала | `d0064278984dbebded6ac12edb0ea6f0473c0725c1ee95fe54349f7ab51be6be` |

</details>

<details>
<summary>222. /assets/results/lightacademia/moodboards/moodboard2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard2.jpg` |
| Ширина, px | 1170 |
| Высота, px | 1382 |
| Формат | `jpeg` |
| До оптимизации, байт | 105491 |
| После оптимизации, байт | 104911 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `c331adc199a9a44f2630404eae50c00d0aabf6c5ce8a7cf2c057dd9a150d2a8f` |
| Результирующий адрес | `/assets/results/lightacademia/moodboards/moodboard2.jpg` |
| SHA256 результата | `f242d4668ff735e5f5da2440d95468909f158be8c7f6049248d53897b5b875b4` |
| SHA256 декодированных пикселей | `a6159279d2ee8d9605dfb286a77d3163eedbecce8826c3c1b8651ba396a26c3a` |

</details>

<details>
<summary>223. /assets/results/lightacademia/moodboards/moodboard3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard3.jpg` |
| Ширина, px | 832 |
| Высота, px | 1248 |
| Формат | `jpeg` |
| До оптимизации, байт | 89101 |
| После оптимизации, байт | 89101 |
| Статус | `unchanged` |
| SHA256 оригинала | `a97f614b748b6311a6692c2073363f760a60795210073e7749e8202f5643120c` |

</details>

<details>
<summary>224. /assets/results/lightacademia/moodboards/moodboard4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard4.jpg` |
| Ширина, px | 474 |
| Высота, px | 677 |
| Формат | `jpeg` |
| До оптимизации, байт | 44115 |
| После оптимизации, байт | 44115 |
| Статус | `unchanged` |
| SHA256 оригинала | `8d2c9d6c73cfe51aed047d22c7b4592269f5a5a5e8e80773e28fc88241d404ec` |

</details>

<details>
<summary>225. /assets/results/lightacademia/moodboards/moodboard5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard5.jpg` |
| Ширина, px | 749 |
| Высота, px | 937 |
| Формат | `jpeg` |
| До оптимизации, байт | 116218 |
| После оптимизации, байт | 116218 |
| Статус | `unchanged` |
| SHA256 оригинала | `d9409e270e9e28d8a8f0f9a5a516ef6876d711c68705793080192a1aa15ce81c` |

</details>

<details>
<summary>226. /assets/results/lightacademia/moodboards/moodboard6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard6.jpg` |
| Ширина, px | 736 |
| Высота, px | 1021 |
| Формат | `jpeg` |
| До оптимизации, байт | 171207 |
| После оптимизации, байт | 146397 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `b8aba005d383c558541e52de5a177e997bce39ba62a03bbd020aa08a4f7982fc` |
| Результирующий адрес | `/assets/results/lightacademia/moodboards/moodboard6.jpg` |
| SHA256 результата | `3d8666da182944e43e608ee81aa4909ebcb612b0ae8704352af0f8a57f4a12f2` |
| SHA256 декодированных пикселей | `a2a99975756af167e2f9bd4f575344d2152c2fc738a7e66ef391d6c24bcf8c70` |

</details>

<details>
<summary>227. /assets/results/lightacademia/moodboards/moodboard7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard7.jpg` |
| Ширина, px | 1048 |
| Высота, px | 1528 |
| Формат | `jpeg` |
| До оптимизации, байт | 166183 |
| После оптимизации, байт | 164465 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `22802fc375d7859a77e4bedc4344c6d7038a873c6ea24d7cd6cea7281acea8b9` |
| Результирующий адрес | `/assets/results/lightacademia/moodboards/moodboard7.jpg` |
| SHA256 результата | `a13554ca108c7b7f769648a1db9e0bf9783e23c77e78bed265b7fda7c52f8f0c` |
| SHA256 декодированных пикселей | `8b847eb3b23be87663a48fa4804ca9a80dd5d1739b5730c6a68442fa87425bf1` |

</details>

<details>
<summary>228. /assets/results/lightacademia/moodboards/moodboard8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard8.jpg` |
| Ширина, px | 785 |
| Высота, px | 1142 |
| Формат | `jpeg` |
| До оптимизации, байт | 106065 |
| После оптимизации, байт | 106065 |
| Статус | `unchanged` |
| SHA256 оригинала | `bc72bd447d0ad220893314142a44cbb00969e715a91a21375d3ae6389d30e0a2` |

</details>

<details>
<summary>229. /assets/results/lightacademia/moodboards/moodboard9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/moodboards/moodboard9.jpg` |
| Ширина, px | 736 |
| Высота, px | 981 |
| Формат | `jpeg` |
| До оптимизации, байт | 114377 |
| После оптимизации, байт | 114377 |
| Статус | `unchanged` |
| SHA256 оригинала | `9b46f113c503bf7e1239dea7e8e9997f1132d263ce67773de04d835dc7454319` |

</details>

<details>
<summary>230. /assets/results/lightacademia/outfits/outfit1.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit1.webp` |
| Ширина, px | 864 |
| Высота, px | 1152 |
| Формат | `webp` |
| До оптимизации, байт | 75766 |
| После оптимизации, байт | 75766 |
| Статус | `unchanged` |
| SHA256 оригинала | `a1fe393e397f38de60531816a7ed2e3d951c49dad92b4a411385e2e0068749e2` |

</details>

<details>
<summary>231. /assets/results/lightacademia/outfits/outfit10.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit10.webp` |
| Ширина, px | 936 |
| Высота, px | 913 |
| Формат | `webp` |
| До оптимизации, байт | 50522 |
| После оптимизации, байт | 50522 |
| Статус | `unchanged` |
| SHA256 оригинала | `e4fca4e2d0d771b31835d91ae61c34ad8746ca8dd0270eed72ad7b8bd20a0377` |

</details>

<details>
<summary>232. /assets/results/lightacademia/outfits/outfit11.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit11.webp` |
| Ширина, px | 840 |
| Высота, px | 1120 |
| Формат | `webp` |
| До оптимизации, байт | 33490 |
| После оптимизации, байт | 33490 |
| Статус | `unchanged` |
| SHA256 оригинала | `47d3efb5f7ee559f95a31cec77931299285fece93aa389fd3165dbdf422952da` |

</details>

<details>
<summary>233. /assets/results/lightacademia/outfits/outfit12.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit12.webp` |
| Ширина, px | 412 |
| Высота, px | 420 |
| Формат | `webp` |
| До оптимизации, байт | 29234 |
| После оптимизации, байт | 29234 |
| Статус | `unchanged` |
| SHA256 оригинала | `ea60bc5e95479351a25b105a51c81b1a4059be14bfdd0d3b67a0ebe21bf48be9` |

</details>

<details>
<summary>234. /assets/results/lightacademia/outfits/outfit13.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit13.webp` |
| Ширина, px | 750 |
| Высота, px | 999 |
| Формат | `webp` |
| До оптимизации, байт | 26068 |
| После оптимизации, байт | 26068 |
| Статус | `unchanged` |
| SHA256 оригинала | `3f6c16da4b306d5711cdfe853774be747010a12e017a71501e165398e476b5db` |

</details>

<details>
<summary>235. /assets/results/lightacademia/outfits/outfit14.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit14.webp` |
| Ширина, px | 736 |
| Высота, px | 736 |
| Формат | `webp` |
| До оптимизации, байт | 15478 |
| После оптимизации, байт | 15478 |
| Статус | `unchanged` |
| SHA256 оригинала | `46cd2006389b488758192389e2a9c077b0181352c8f35231b992f6462b8ff5ef` |

</details>

<details>
<summary>236. /assets/results/lightacademia/outfits/outfit15.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit15.webp` |
| Ширина, px | 600 |
| Высота, px | 600 |
| Формат | `webp` |
| До оптимизации, байт | 24106 |
| После оптимизации, байт | 24106 |
| Статус | `unchanged` |
| SHA256 оригинала | `08e6e3506aace6b72f3657ea5243eac29bd46d14db2d8bb23725236217359dd5` |

</details>

<details>
<summary>237. /assets/results/lightacademia/outfits/outfit16.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit16.webp` |
| Ширина, px | 614 |
| Высота, px | 921 |
| Формат | `webp` |
| До оптимизации, байт | 83388 |
| После оптимизации, байт | 83388 |
| Статус | `unchanged` |
| SHA256 оригинала | `21a6a4d22fe7ae97dd40b09a013088e587a5eda7e747953513ad6f834144555c` |

</details>

<details>
<summary>238. /assets/results/lightacademia/outfits/outfit2.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit2.webp` |
| Ширина, px | 400 |
| Высота, px | 400 |
| Формат | `webp` |
| До оптимизации, байт | 18582 |
| После оптимизации, байт | 18582 |
| Статус | `unchanged` |
| SHA256 оригинала | `bdb27e35cc8557b1f8dbf534dc5fe841dc106d9ba90b2b8bc0f06058291ff3a2` |

</details>

<details>
<summary>239. /assets/results/lightacademia/outfits/outfit3.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit3.webp` |
| Ширина, px | 959 |
| Высота, px | 1180 |
| Формат | `webp` |
| До оптимизации, байт | 91722 |
| После оптимизации, байт | 91722 |
| Статус | `unchanged` |
| SHA256 оригинала | `5afc8f93cd4af3ebb7ef87cb19b3d0f68a7b9c19a59fbd0848543e7a8d9f2ce8` |

</details>

<details>
<summary>240. /assets/results/lightacademia/outfits/outfit4.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit4.webp` |
| Ширина, px | 1053 |
| Высота, px | 1505 |
| Формат | `webp` |
| До оптимизации, байт | 26830 |
| После оптимизации, байт | 26830 |
| Статус | `unchanged` |
| SHA256 оригинала | `1f5177e2403a8753163266457bd42cf772fb364485bc8fe6eb766b41f2f5618b` |

</details>

<details>
<summary>241. /assets/results/lightacademia/outfits/outfit5.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit5.webp` |
| Ширина, px | 910 |
| Высота, px | 1456 |
| Формат | `webp` |
| До оптимизации, байт | 62636 |
| После оптимизации, байт | 62636 |
| Статус | `unchanged` |
| SHA256 оригинала | `a34aee0f5f3091a3138dcc29ff00c9a34209ee83797c21e1da82ecb76a52163c` |

</details>

<details>
<summary>242. /assets/results/lightacademia/outfits/outfit6.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit6.webp` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `webp` |
| До оптимизации, байт | 36918 |
| После оптимизации, байт | 36918 |
| Статус | `unchanged` |
| SHA256 оригинала | `578f958981e4dd9c13a5d7704adc80c9ddaa940369e57790ad9ba2bda34f761b` |

</details>

<details>
<summary>243. /assets/results/lightacademia/outfits/outfit7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit7.webp` |
| Ширина, px | 960 |
| Высота, px | 960 |
| Формат | `webp` |
| До оптимизации, байт | 38368 |
| После оптимизации, байт | 38368 |
| Статус | `unchanged` |
| SHA256 оригинала | `b58019438f1bc731532802da74734c7610280cb7a09b35215a61ec3edf0ec0fb` |

</details>

<details>
<summary>244. /assets/results/lightacademia/outfits/outfit8.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit8.webp` |
| Ширина, px | 599 |
| Высота, px | 960 |
| Формат | `webp` |
| До оптимизации, байт | 83410 |
| После оптимизации, байт | 83410 |
| Статус | `unchanged` |
| SHA256 оригинала | `9c4cbf67e904ebf2370caa74a1248c53a52878893781d7d6366b8cefb50ac776` |

</details>

<details>
<summary>245. /assets/results/lightacademia/outfits/outfit9.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/lightacademia/outfits/outfit9.webp` |
| Ширина, px | 1200 |
| Высота, px | 1200 |
| Формат | `webp` |
| До оптимизации, байт | 33686 |
| После оптимизации, байт | 33686 |
| Статус | `unchanged` |
| SHA256 оригинала | `b1ae652435bcee7c3f0e56ea4b2e0a3c7b54b777a05d3c444e4b130d8dc09083` |

</details>

<details>
<summary>246. /assets/results/witchcore/interiors/interior1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior1.jpg` |
| Ширина, px | 768 |
| Высота, px | 1408 |
| Формат | `jpeg` |
| До оптимизации, байт | 143272 |
| После оптимизации, байт | 143272 |
| Статус | `unchanged` |
| SHA256 оригинала | `fc50b7aea25771f8fde5a4d5c68f268e55bb1c87c166b52e6399b5b92faf4186` |

</details>

<details>
<summary>247. /assets/results/witchcore/interiors/interior2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior2.jpg` |
| Ширина, px | 800 |
| Высота, px | 820 |
| Формат | `jpeg` |
| До оптимизации, байт | 131999 |
| После оптимизации, байт | 126989 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `66f79708cba2cd7e12b770f1e16b69b87b478126754bb91557709cb63b535495` |
| Результирующий адрес | `/assets/results/witchcore/interiors/interior2.jpg` |
| SHA256 результата | `bdfb3d1ce60eaf8bc408a76ebf889185da0110b30f31d74386092ab303b31440` |
| SHA256 декодированных пикселей | `7fa409ab662b2aabf2920757f9b51ecdec09bd235d91577faea0ba5f7c6f163a` |

</details>

<details>
<summary>248. /assets/results/witchcore/interiors/interior3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior3.jpg` |
| Ширина, px | 800 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 141451 |
| После оптимизации, байт | 137742 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `9c878143970fe8d0795e46ebb5ba047e8d32a3e8dcbf7b7f98f4e27a60a3db70` |
| Результирующий адрес | `/assets/results/witchcore/interiors/interior3.jpg` |
| SHA256 результата | `9fc0c4f1981621ffb8211d3a852bc1fdaa8cfd13bb543572536020c55c4b1b63` |
| SHA256 декодированных пикселей | `764022d1eff61a8cd0e76929f6bb2a9e7dfc7615bc88668f9a4d532ccda2c58a` |

</details>

<details>
<summary>249. /assets/results/witchcore/interiors/interior4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior4.jpg` |
| Ширина, px | 800 |
| Высота, px | 1024 |
| Формат | `jpeg` |
| До оптимизации, байт | 178582 |
| После оптимизации, байт | 171011 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `aba3df66c037ab9e8da61cce1754155885b9b7f7046c3e26c0dbfeefde7e97ad` |
| Результирующий адрес | `/assets/results/witchcore/interiors/interior4.jpg` |
| SHA256 результата | `273baea87da44651219077859be5a3aea5d3fa8ddefef58881ebca808c19c4fe` |
| SHA256 декодированных пикселей | `cf6dbb6f9af0d87cf4d6a2e325425872e9aaedb43e477a55aef5ffb51dbe000f` |

</details>

<details>
<summary>250. /assets/results/witchcore/interiors/interior5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior5.jpg` |
| Ширина, px | 480 |
| Высота, px | 640 |
| Формат | `jpeg` |
| До оптимизации, байт | 57322 |
| После оптимизации, байт | 57322 |
| Статус | `unchanged` |
| SHA256 оригинала | `330933d8b6b68cac59cf74e145cd1335b9f2246b33e4c553028b342eee849258` |

</details>

<details>
<summary>251. /assets/results/witchcore/interiors/interior6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior6.jpg` |
| Ширина, px | 768 |
| Высота, px | 960 |
| Формат | `jpeg` |
| До оптимизации, байт | 131989 |
| После оптимизации, байт | 131989 |
| Статус | `unchanged` |
| SHA256 оригинала | `8971c91bc46550ec942b2b80183681bae91e99bfa05e61efceecfd581e101e15` |

</details>

<details>
<summary>252. /assets/results/witchcore/interiors/interior7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior7.jpg` |
| Ширина, px | 600 |
| Высота, px | 813 |
| Формат | `jpeg` |
| До оптимизации, байт | 104193 |
| После оптимизации, байт | 104193 |
| Статус | `unchanged` |
| SHA256 оригинала | `f75203c5effe496c6ea1e9b06f32cba9b0735f0de2e30dd3fddff72bf23981e1` |

</details>

<details>
<summary>253. /assets/results/witchcore/interiors/interior8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/interiors/interior8.jpg` |
| Ширина, px | 800 |
| Высота, px | 1738 |
| Формат | `jpeg` |
| До оптимизации, байт | 221741 |
| После оптимизации, байт | 221741 |
| Статус | `unchanged` |
| SHA256 оригинала | `848793ee8c3f2cdfa5bd4f66651f78684cbb47669dfc9a6b0996a7a150ba3b22` |

</details>

<details>
<summary>254. /assets/results/witchcore/moodboards/look1.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look1.jpg` |
| Ширина, px | 736 |
| Высота, px | 981 |
| Формат | `jpeg` |
| До оптимизации, байт | 138375 |
| После оптимизации, байт | 138375 |
| Статус | `unchanged` |
| SHA256 оригинала | `e7adf0ca3b227ec31eb28479b116a875f5131c717cb287ad616bee54aa3a61f7` |

</details>

<details>
<summary>255. /assets/results/witchcore/moodboards/look2.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look2.jpg` |
| Ширина, px | 800 |
| Высота, px | 1066 |
| Формат | `jpeg` |
| До оптимизации, байт | 198469 |
| После оптимизации, байт | 198469 |
| Статус | `unchanged` |
| SHA256 оригинала | `810a181139232448a2ec887d9e5ace4a68bb0f49aba5cf4a9ae2d568db2265a1` |

</details>

<details>
<summary>256. /assets/results/witchcore/moodboards/look3.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look3.jpg` |
| Ширина, px | 373 |
| Высота, px | 800 |
| Формат | `jpeg` |
| До оптимизации, байт | 26682 |
| После оптимизации, байт | 26682 |
| Статус | `unchanged` |
| SHA256 оригинала | `4c85817c9ecf380539a8e0bc5243f5c15ceb03622fce3f9ba060625a56394b55` |

</details>

<details>
<summary>257. /assets/results/witchcore/moodboards/look4.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look4.jpg` |
| Ширина, px | 800 |
| Высота, px | 1168 |
| Формат | `jpeg` |
| До оптимизации, байт | 118146 |
| После оптимизации, байт | 115101 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `7c09e9a8997d880aec9eab6d6d10bc82bee4f727a7d4a976fc3a04deb6463fe3` |
| Результирующий адрес | `/assets/results/witchcore/moodboards/look4.jpg` |
| SHA256 результата | `979d3e3eba21611540dcc25f17a625017f17616552bd28eb4437d255c120a517` |
| SHA256 декодированных пикселей | `a0fb64a2c0b618d3706aafdf08db17e77a65b10905eb3837b87d44b0e89b72f5` |

</details>

<details>
<summary>258. /assets/results/witchcore/moodboards/look5.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look5.jpg` |
| Ширина, px | 750 |
| Высота, px | 1189 |
| Формат | `jpeg` |
| До оптимизации, байт | 87083 |
| После оптимизации, байт | 87083 |
| Статус | `unchanged` |
| SHA256 оригинала | `711523052ce13b4bd437dd9d9223e934da3bca6cc3df459efce9657838cda8bf` |

</details>

<details>
<summary>259. /assets/results/witchcore/moodboards/look6.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look6.jpg` |
| Ширина, px | 808 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 92352 |
| После оптимизации, байт | 92352 |
| Статус | `unchanged` |
| SHA256 оригинала | `556c90f788f4e0176083b401525cbcfbf06afaeaaa88bb3428414fff1f9d2b03` |

</details>

<details>
<summary>260. /assets/results/witchcore/moodboards/look7.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look7.jpg` |
| Ширина, px | 800 |
| Высота, px | 1200 |
| Формат | `jpeg` |
| До оптимизации, байт | 168126 |
| После оптимизации, байт | 162291 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `8cb501042c6ecc30c5a8607993b0a58443a96cacedcf50bc4742bddf00326165` |
| Результирующий адрес | `/assets/results/witchcore/moodboards/look7.jpg` |
| SHA256 результата | `56e47b596e2d2925f96f5b415f4dd857c607eae8d02bbc2a187bc8155ee8dfee` |
| SHA256 декодированных пикселей | `a30d00583a70db7c7d055021277f521b5dd977e68ca786ae445bc647df13d2e8` |

</details>

<details>
<summary>261. /assets/results/witchcore/moodboards/look8.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look8.jpg` |
| Ширина, px | 564 |
| Высота, px | 1090 |
| Формат | `jpeg` |
| До оптимизации, байт | 179689 |
| После оптимизации, байт | 150792 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `2bbc906a2a48ec43ff4f963616503dbd7ff5dabe3f30b7e84b0f1e1afe34ac6c` |
| Результирующий адрес | `/assets/results/witchcore/moodboards/look8.jpg` |
| SHA256 результата | `65eabf0ecce74856a1946291d63ecc986ffc900b4d05f3f7d774da6cfa9566b1` |
| SHA256 декодированных пикселей | `aa2ca113f2b55c02b305c60b3fb859cced166be641b429acb36f0935f60122c4` |

</details>

<details>
<summary>262. /assets/results/witchcore/moodboards/look9.jpg</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/moodboards/look9.jpg` |
| Ширина, px | 1068 |
| Высота, px | 1275 |
| Формат | `jpeg` |
| До оптимизации, байт | 94136 |
| После оптимизации, байт | 94136 |
| Статус | `unchanged` |
| SHA256 оригинала | `a01582465d3f3bf6ce3b05d64be83e7ceb70ee66316e6a0ef5381ce6aeb7a087` |

</details>

<details>
<summary>263. /assets/results/witchcore/outfits/outfit1.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit1.webp` |
| Ширина, px | 1200 |
| Высота, px | 1200 |
| Формат | `webp` |
| До оптимизации, байт | 38504 |
| После оптимизации, байт | 38504 |
| Статус | `unchanged` |
| SHA256 оригинала | `7b79db4ae7910b9be848b4f1b5f511f10c1c47b0965e85f63be72573b7131d87` |

</details>

<details>
<summary>264. /assets/results/witchcore/outfits/outfit10.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit10.png` |
| Ширина, px | 405 |
| Высота, px | 539 |
| Формат | `png` |
| До оптимизации, байт | 129811 |
| После оптимизации, байт | 102964 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `246139be85fa7f4c6bc7f23c73ffd8f72a6dc42879c308a2db55ac063506fe6f` |
| Результирующий адрес | `/assets/results/witchcore/outfits/outfit10.lossless.webp` |
| SHA256 результата | `314e3b20121d064607b7d611b79a735242c56f85aa18743ec7518edab77cdfd2` |
| SHA256 декодированных пикселей | `43e678e57b9d65758bd09f22404f6279b9b231d409ce8238807bbca2cc5552b4` |

</details>

<details>
<summary>265. /assets/results/witchcore/outfits/outfit11.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit11.webp` |
| Ширина, px | 628 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 37800 |
| После оптимизации, байт | 37800 |
| Статус | `unchanged` |
| SHA256 оригинала | `9d54d2129b3c04dbfb57826c964515fa3921e217f0ac504fdc170a311eb9f971` |

</details>

<details>
<summary>266. /assets/results/witchcore/outfits/outfit12.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit12.webp` |
| Ширина, px | 600 |
| Высота, px | 500 |
| Формат | `webp` |
| До оптимизации, байт | 36438 |
| После оптимизации, байт | 36438 |
| Статус | `unchanged` |
| SHA256 оригинала | `13c46909f51fc361986a8cfd7b841e3fb19a1131dba76ce8beefcd1dd1f985a4` |

</details>

<details>
<summary>267. /assets/results/witchcore/outfits/outfit13.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit13.webp` |
| Ширина, px | 474 |
| Высота, px | 940 |
| Формат | `webp` |
| До оптимизации, байт | 24312 |
| После оптимизации, байт | 24312 |
| Статус | `unchanged` |
| SHA256 оригинала | `a43976dbb31d5307b8af2ce5a41da7b74ad5963be780e17effa9c0e89ff1e3cf` |

</details>

<details>
<summary>268. /assets/results/witchcore/outfits/outfit14.png</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit14.png` |
| Ширина, px | 420 |
| Высота, px | 420 |
| Формат | `png` |
| До оптимизации, байт | 67567 |
| После оптимизации, байт | 42240 |
| Статус | `pixel-identical` |
| SHA256 оригинала | `7b032456e88fd11b02e04f087f270e68729aa64f60735ce4e8e804932281516f` |
| Результирующий адрес | `/assets/results/witchcore/outfits/outfit14.lossless.webp` |
| SHA256 результата | `23edc06889758136b8db63b3b3ebf5e85ff9a222c5983f1173ccd44ec435a618` |
| SHA256 декодированных пикселей | `b55385b9a67287eff4c8779a13cd021a986e08b1a46fa2a5d4d4b86f165fb56e` |

</details>

<details>
<summary>269. /assets/results/witchcore/outfits/outfit15.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit15.webp` |
| Ширина, px | 600 |
| Высота, px | 801 |
| Формат | `webp` |
| До оптимизации, байт | 49654 |
| После оптимизации, байт | 49654 |
| Статус | `unchanged` |
| SHA256 оригинала | `1af9994424f3d3e86fff1ea367266e3849cdfc6a00341d8f266606047c25db78` |

</details>

<details>
<summary>270. /assets/results/witchcore/outfits/outfit16.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit16.webp` |
| Ширина, px | 600 |
| Высота, px | 600 |
| Формат | `webp` |
| До оптимизации, байт | 19744 |
| После оптимизации, байт | 19744 |
| Статус | `unchanged` |
| SHA256 оригинала | `8700b71c9b46402a2dfe6fad0c932e089d283e70a647f3f2ac8e97b185a71738` |

</details>

<details>
<summary>271. /assets/results/witchcore/outfits/outfit17.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit17.webp` |
| Ширина, px | 750 |
| Высота, px | 685 |
| Формат | `webp` |
| До оптимизации, байт | 34110 |
| После оптимизации, байт | 34110 |
| Статус | `unchanged` |
| SHA256 оригинала | `4e4f5fb6ff245dee5fde9b2994991e2fceb59f0684ed5e08dccb0244c9696045` |

</details>

<details>
<summary>272. /assets/results/witchcore/outfits/outfit2.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit2.webp` |
| Ширина, px | 1200 |
| Высота, px | 1500 |
| Формат | `webp` |
| До оптимизации, байт | 69398 |
| После оптимизации, байт | 69398 |
| Статус | `unchanged` |
| SHA256 оригинала | `a07c92d3c98cf8515aef7fd4be5a9779503d129c832cce1f4b808f77ce06893a` |

</details>

<details>
<summary>273. /assets/results/witchcore/outfits/outfit3.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit3.webp` |
| Ширина, px | 768 |
| Высота, px | 768 |
| Формат | `webp` |
| До оптимизации, байт | 19482 |
| После оптимизации, байт | 19482 |
| Статус | `unchanged` |
| SHA256 оригинала | `ab674795ff613c434730d67008b72607ce5da5a747d0b0a483e750815030dc55` |

</details>

<details>
<summary>274. /assets/results/witchcore/outfits/outfit4.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit4.webp` |
| Ширина, px | 750 |
| Высота, px | 1000 |
| Формат | `webp` |
| До оптимизации, байт | 57344 |
| После оптимизации, байт | 57344 |
| Статус | `unchanged` |
| SHA256 оригинала | `d3f5ae94be08fcb2b21c9cd8741f5f3301a3ac9b2988cad86910528da1086f1f` |

</details>

<details>
<summary>275. /assets/results/witchcore/outfits/outfit5.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit5.webp` |
| Ширина, px | 800 |
| Высота, px | 1422 |
| Формат | `webp` |
| До оптимизации, байт | 85102 |
| После оптимизации, байт | 85102 |
| Статус | `unchanged` |
| SHA256 оригинала | `43fcb3a744a9b6c2a876f97d2ec0b302ce596b104f59658fb75451a1064ac483` |

</details>

<details>
<summary>276. /assets/results/witchcore/outfits/outfit6.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit6.webp` |
| Ширина, px | 700 |
| Высота, px | 840 |
| Формат | `webp` |
| До оптимизации, байт | 39642 |
| После оптимизации, байт | 39642 |
| Статус | `unchanged` |
| SHA256 оригинала | `298a7c3f5702fedf436c3a983f9e3e6c602b4d06fd42bbe307d6eeeb1e33df7d` |

</details>

<details>
<summary>277. /assets/results/witchcore/outfits/outfit7.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit7.webp` |
| Ширина, px | 720 |
| Высота, px | 1080 |
| Формат | `webp` |
| До оптимизации, байт | 61356 |
| После оптимизации, байт | 61356 |
| Статус | `unchanged` |
| SHA256 оригинала | `d555be262f6fbe34c02acfcbfdae10691b977606f39aca89c8a655b47da8f191` |

</details>

<details>
<summary>278. /assets/results/witchcore/outfits/outfit8.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit8.webp` |
| Ширина, px | 600 |
| Высота, px | 920 |
| Формат | `webp` |
| До оптимизации, байт | 17598 |
| После оптимизации, байт | 17598 |
| Статус | `unchanged` |
| SHA256 оригинала | `8cb8d7aeff86cb3ef04baab1e127b1884425fcd1c3d88d5f68b24ad73e9db37d` |

</details>

<details>
<summary>279. /assets/results/witchcore/outfits/outfit9.webp</summary>

| Поле | Значение |
| --- | --- |
| Адрес файла | `/assets/results/witchcore/outfits/outfit9.webp` |
| Ширина, px | 450 |
| Высота, px | 550 |
| Формат | `webp` |
| До оптимизации, байт | 50570 |
| После оптимизации, байт | 50570 |
| Статус | `unchanged` |
| SHA256 оригинала | `8c9a49a63ec47585baf0364ad1cbd4ed7b39412715de97542d0b498a1974ec4d` |

</details>
