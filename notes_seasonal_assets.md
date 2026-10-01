# Seasonal Club Assets

## Tartan Backgrounds (for paid club)
- Autumn: https://files.manuscdn.com/user_upload_by_module/session_file/310519663475213159/NdnEHWCbQbNuKmyB.JPG
- Winter (from Nov 20): https://files.manuscdn.com/user_upload_by_module/session_file/310519663475213159/EhNRvSBlhxWjRXfT.JPG
- Spring: TBD
- Summer: TBD

## Autumn Forest Frame (transparent center)
- Oval cutout version: /home/ubuntu/webdev-static-assets/autumn-frame-oval.png
- Full forest v5 (soft center): /home/ubuntu/webdev-static-assets/autumn-forest-v5.png
- Original with tower: /home/ubuntu/upload/FF147EB5-8787-43BB-8F5A-D082849D2A62.jpg

## Season Switch Logic
- Autumn: default (March 20 - Nov 19)
- Winter: Nov 20 - March 19
- Implementation: getClubSeason() in components/club/club-subscribed.tsx
- Background opacity: 15% (imageStyle opacity: 0.15)
