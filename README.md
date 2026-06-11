# 🔌 Bitrix24 Stdio MCP Server

MCP-сервер для работы с Bitrix24 через входящий вебхук.

Он позволяет подключить Bitrix24 к Stdio MCP-совместимым AI-клиентам, например Manus, Claude Desktop и другим инструментам, которые умеют работать с Model Context Protocol.

Сервер ходит в REST API Bitrix24 через webhook URL и отдаёт данные в формате, удобном для AI-агента.

## ⚙️ Что умеет

Сейчас сервер предоставляет такие инструменты:

- **get_me** — профиль пользователя, от имени которого создан вебхук (`profile`).
- **get_task** — одна или несколько задач по ID (до 10 за вызов).
  - Пример аргументов: `{ "id": [9483, 9484] }`.
- **search_tasks** — задачи, поиск.
- **search_groups** — рабочие группы и проекты, поиск.
- **get_group** — одна или несколько групп/проектов по ID.
  - Пример аргументов: `{ "ids": [286, 190] }`.
- **get_kanban_stages_by_group** — стадии канбана задач для одной или нескольких групп.
  - Пример аргументов: `{ "ids": [286, 190] }`.
- **get_task_comments** — «комментарии» задачи в **новой карточке задач** (чат задачи).

## 🚀 Установка и запуск

### 🧩 Конфигурация для Manus / Claude Desktop / Cursor

Пример MCP-конфига:

```json
{
  "mcpServers": {
    "bitrix24": {
      "command": "npx",
      "args": ["-y", "@x0333/bitrix24-mcp-server@latest"],
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
2. Перейдите в раздел **Разработчикам**(`https://your-bitrix-domain.com/devops/`).
3. **Другое** -> **Входящий вебхук**.
4. Выдайте вебхуку нужные права(какие точно - я не уверен, выбирайте из логики и безопасности)
5. Скопируйте **URL для вызова REST API**.

Обычно он выглядит примерно так:

```text
https://domain.bitrix24.ru/rest/1/abcdef12345/
```

Именно этот URL нужно передать в переменную `B24_BASE` при добавлении MCP сервера.

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