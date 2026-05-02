# MEXC Futures Scanner

## Самый простой запуск через Vercel

1. Создай аккаунт на https://github.com
2. Создай новый repository, например `mexc-futures-scanner`
3. Нажми Add file -> Upload files
4. Перетащи все файлы из этой папки
5. Нажми Commit changes
6. Зайди на https://vercel.com
7. Add New -> Project -> Import свой GitHub repo
8. Нажми Deploy
9. Получишь ссылку на сайт

## Что показывает

- Фьючерсные пары MEXC
- Max position $ по формуле `maxVol * contractSize * price`
- Max leverage
- Maker/Taker fee
- 0 fee tag
- Поиск и сортировка

## Важно

Полные risk tiers по плечам могут требовать private endpoint MEXC или парсинг страницы Risk Limit.
