# 🔌 Bitrix24 Stdio MCP Server

MCP-сервер для работы с Bitrix24 через входящий вебхук.

Он позволяет подключить Bitrix24 к Stdio MCP-совместимым AI-клиентам, например Manus, Claude Desktop и другим инструментам, которые умеют работать с Model Context Protocol.

Сервер ходит в REST API Bitrix24 через webhook URL и отдаёт данные в формате, удобном для AI-агента.

## ⚙️ Что умеет

Сейчас сервер предоставляет такие инструменты:

- **get_profile** — профиль пользователя, от имени которого создан вебхук (`profile`).
- **get_task** — карточка задачи по ID (`tasks.task.get`), опционально список полей `select`.
- **search_tasks** — список задач (`tasks.task.list`). Нужен **хотя бы один** критерий:
  - `**title`** — подстрока в названии (`%TITLE` в фильтре);
  - `**stage_id**` — ID колонки канбана задач (`STAGE_ID` в фильтре).
  Можно передать оба параметра одновременно (условия объединяются). Дополнительно: `**order**`, `**dir**` (сортировка), `**start**` (смещение для пагинации).
- **search_groups** — рабочие группы и проекты по подстроке имени (`sonet_group.get.json`, фильтр `%NAME`). Параметр: `**name`**. Ответ — полный ответ Bitrix (как у REST).
- **get_group** — одна или несколько групп/проектов по ID.
  - Параметр: `**ids`** — массив положительных чисел, **от 1 до 10** за вызов (дубликаты убираются).
  - Запрос: `sonet_group.get.json`, `FILTER: { ID: [ … ] }` (массив ID; не используйте `@ID` — в Bitrix24 это не «IN»).
  - Ответ: `{ "groups": [ … ] }` — элементы из `result` API (поля группы: `ID`, `NAME`, `PROJECT`, `DESCRIPTION` и др.).
  - Пример аргументов: `{ "ids": [286, 190] }`.
- **get_kanban_stages_by_group** — стадии канбана задач для одной или нескольких групп.
  - Параметр: `**ids`** — массив ID групп, **от 1 до 10** за вызов.
  - Запрос: для каждого ID отдельный `task.stages.get` с `entityId` = ID группы (параллельно).
  - Ответ: `{ "kanban_stages": [ { "group_id": 286, "stages": { "1264": { "ID", "TITLE", "SORT", … }, … } }, … ] }` — `stages` — объект, ключи — ID стадий.
  - Пример аргументов: `{ "ids": [286, 190] }`.
- **get_task_comments** — «комментарии» задачи в **новой карточке задач** (чат задачи): цепочка `tasks.task.get` → `im.dialog.messages.get`. Сначала **самые свежие** сообщения, если не передавать курсоры пагинации.
  - Параметры: `**task_id`** (обязательно), `**limit**` (1–50, по умолчанию 20), опционально `**first_id**` (Bitrix `FIRST_ID`, следующая страница **старее**) или `**last_id`** (`LAST_ID`, сообщения **новее** id) — оба курсора одновременно нельзя.
  - В ответе урезанные массивы: `**messages`** — только `id`, `author_id`, `text`, `date`; `**users**` — только `id`, `name`, `work_position`, `email`. Есть `**agent_instructions**` для модели и `**pagination**` с подсказками `suggested_next_first_id` / `suggested_next_last_id`.
  - `**author_id === 0**` — системные сообщения чата (смена стадии, учёт времени и т.п.), это **не** пользовательский комментарий; в `**users`** для них строки обычно нет. Для `**author_id > 0**` сопоставляй с `**users[].id**`.

Если в `tasks.task.get` на обычном URL `.../rest/USER/WEBHOOK/` нет `**chatId**`, сервер **сам** повторит запрос к `.../rest/api/USER/WEBHOOK/` (тот же вебхук, другой префикс пути).

Все вызовы к Bitrix24 идут как `POST` на `{B24_BASE}/{метод}` с JSON-телом, как в документации REST.

## 🚀 Установка и запуск

### 🧩 Конфигурация для Manus / Claude Desktop / Cursor

Пример MCP-конфига:

```json
{
  "mcpServers": {
    "bitrix24": {
      "command": "npx",
      "args": ["-y", "@x0333/bitrix24-mcp-server"],
      "env": {
        "B24_BASE": "https://your-domain.bitrix24.ru/rest/USER_ID/WEBHOOK_CODE/"
      }
    }
  }
}
```

После этого AI-клиент сможет вызывать инструменты сервера и получать данные из Bitrix24.

## 🔑 Как получить Webhook URL в Bitrix24

1. Откройте свой портал Bitrix24.
2. Перейдите в раздел **Разработчикам**.
3. Создайте **Входящий вебхук**.
4. Выдайте вебхуку нужные права (минимум для текущих инструментов):
  - задачи (в т.ч. стадии канбана групповых задач);
  - рабочие группы / проекты;
  - пользователи (для профиля);
  - **чаты и мессенджер (im)** — для `**get_task_comments`** (`im.dialog.messages.get`).
5. Скопируйте **URL для вызова REST API**.

Обычно он выглядит примерно так:

```text
https://domain.bitrix24.ru/rest/1/abcdef12345/
```

Именно этот URL нужно передать в переменную `B24_BASE`.

## 🛠️ Разработка

Стек: Node.js ≥ 20, TypeScript, [FastMCP](https://github.com/punkpeye/fastmcp).

```bash
pnpm install
pnpm build      # tsc → dist/
pnpm start      # нужен B24_BASE
pnpm typecheck
```

Локальный запуск:

```bash
B24_BASE="https://your-domain.bitrix24.ru/rest/USER_ID/WEBHOOK_CODE/" pnpm start
```

Публикация в npm — workflow `[.github/workflows/publish-npm.yml](.github/workflows/publish-npm.yml)` при пуше в `main` с изменением `package.json` (версия должна быть выше, чем на npm).

## 📄 License

MIT