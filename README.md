# NOVUS — AI-агент для бизнеса

Лендинг NOVUS с двумя сменяющимися фотографиями, анимацией заголовков, примерами переписки в Telegram и работающей формой заявки.

## Запуск Docker

Требуется Docker Engine с Compose v2.

```bash
git clone https://github.com/Bazai9807/AI-agent-site.git
cd AI-agent-site
cp .env.example .env
docker compose up -d --build
```

Откройте http://localhost:3000 (на сервере — http://IP-СЕРВЕРА:3000).
Порт меняется через `PORT` в `.env`. При работе за HTTPS-прокси укажите точный `PUBLIC_ORIGIN`, например `https://novus.example.com`. Прокси должен передавать исходный заголовок Host. После изменения настроек: `docker compose up -d`.

```bash
docker compose logs -f novus
docker compose ps
docker compose down
```

`docker compose down` сохраняет заявки. `docker compose down -v` удаляет том и все заявки — не используйте его для обычного обновления.

## Заявки

SQLite хранится в Docker-томе `novus_data`, внутри контейнера — `/app/data/leads.sqlite`. Данные переживают пересоздание контейнера. Форма сохраняет имя, контакт, задачу и время. Отправка уведомлений в Telegram/email не подключена. Публичного API чтения заявок нет.

Посмотреть заявки из терминала администратора:

```bash
docker compose exec novus node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('/app/data/leads.sqlite'); console.table(db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 50').all()); db.close()"
```

Резервная копия (не копируйте только основной файл работающей WAL-базы):

```bash
docker compose exec novus node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('/app/data/leads.sqlite'); db.exec(\"VACUUM INTO '/app/data/backup.sqlite'\"); db.close()"
docker compose cp novus:/app/data/backup.sqlite ./backup.sqlite
```

Для повторного бэкапа используйте новое имя файла. Бэкапы содержат контакты клиентов: не добавляйте их в Git.

## Локальная разработка и проверка

Node.js 24+, pnpm 11.25.0:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm start
```

`pnpm dev` запускает Vite с прокси `/api` на отдельно запущенный `pnpm start` (порт 3000). В Docker используется компактный Node-сервер без dev-зависимостей. `GET /api/health` проверяет доступность SQLite.

## Состав

- `src/` — React-интерфейс и стили.
- `public/` — фотографии, логотип и демонстрационные переписки.
- `server.mjs` — статические файлы и серверная обработка заявок.
- `Dockerfile`, `compose.yaml` — сборка и запуск.

Это лендинг, не сам AI-агент: демонстрационные отчёты не подключены к реальным звонкам и закупкам. Исходные заявки из прежнего хостинга в репозиторий не переносились. Для защиты публичной формы от массового спама рекомендуется ограничение частоты запросов на вашем reverse proxy.
