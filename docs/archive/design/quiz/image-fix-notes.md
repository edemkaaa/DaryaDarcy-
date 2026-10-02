> Архивный материал: сохранён для истории, не является текущей инструкцией запуска, деплоя или источником состояния проекта. Актуальная навигация — [документация](../../../README.md).

# Quiz Image Fix Notes

## Problem
The landscape files (cottagecore.jpg, goblincore.jpg, castlecore.jpg, fairycore.jpg) contain SHOP screenshots (552x1200) instead of actual landscape images.

These were likely overwritten during the image compression step - the compression script may have picked up wrong source files.

## Files that ARE correct:
- landscapes/witchcore.jpg (790x1200) - dark mossy forest with stone arch (from IMG_2789.JPG)
- landscapes/dark-academia.jpg (736x927) - dark alley with lanterns (from IMG_2804.JPG)
- landscapes/light-academia.jpg (1200x1479) - bookshop "The Story of Books" (from IMG_2808.JPG)

## Files that need to be RE-COPIED from uploads:
- landscapes/cottagecore.jpg - needs the original cottagecore landscape
- landscapes/goblincore.jpg - needs the original goblincore landscape
- landscapes/castlecore.jpg - needs the original castlecore landscape
- landscapes/fairycore.jpg - needs the original fairycore landscape

## Original source files from earlier session (need to identify):
The original landscape images were uploaded earlier. Need to check /home/ubuntu/upload/ for the correct source files.
