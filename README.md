# Bitrix24 MCP Server

MCP-сервер для работы с Bitrix24 через входящий вебхук.

Он позволяет подключить Bitrix24 к MCP-совместимым AI-клиентам, например Manus, Claude Desktop и другим инструментам, которые умеют работать с Model Context Protocol.

Сервер ходит в REST API Bitrix24 через webhook URL и отдаёт данные в формате, удобном для AI-агента.

## Что умеет

Сейчас сервер предоставляет такие инструменты:

- **get_profile** — получить профиль текущего пользователя Bitrix24.
- **get_task** — получить подробную информацию о задаче по её ID.
- **search_tasks** — найти задачи по названию. Поддерживает сортировку и пагинацию.
- **get_group** — получить подробную информацию о рабочей группе или проекте.
- **search_groups** — найти рабочие группы или проекты по названию.

## Установка и запуск

Пакет можно запускать напрямую через `npx`:

```bash
npx -y @x0333/bitrix24-mcp-server
```

Для работы нужно передать переменную окружения `B24_BASE`.

Это базовый URL входящего вебхука Bitrix24:

```bash
B24_BASE="https://your-domain.bitrix24.ru/rest/USER_ID/WEBHOOK_CODE/"
```

Пример запуска:

```bash
B24_BASE="https://your-domain.bitrix24.ru/rest/USER_ID/WEBHOOK_CODE/" npx -y @x0333/bitrix24-mcp-server
```

## Конфигурация для Manus / Claude Desktop

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

## Как получить Webhook URL в Bitrix24

1. Откройте свой портал Bitrix24.
2. Перейдите в раздел **Разработчикам** / **Developer Resources**.
3. Создайте **Входящий вебхук** / **Inbound Webhook**.
4. Выдайте вебхуку нужные права:
   - задачи;
   - рабочие группы / проекты;
   - пользователи.
5. Скопируйте **URL для вызова REST API**.

Обычно он выглядит примерно так:

```text
https://domain.bitrix24.ru/rest/1/abcdef12345/
```

Именно этот URL нужно передать в переменную `B24_BASE`.

## Разработка

В проекте используется `pnpm`.

Установить зависимости:

```bash
pnpm install
```

Запустить сервер локально:

```bash
B24_BASE="https://your-domain.bitrix24.ru/rest/USER_ID/WEBHOOK_CODE/" node index.js
```

Сервер работает через `stdio`, поэтому обычно его запускают не напрямую из терминала, а из MCP-клиента.

Для локальной проверки можно указать путь к проекту в конфиге MCP-клиента и запускать `node index.js`:

```json
{
  "mcpServers": {
    "bitrix24-local": {
      "command": "node",
      "args": ["/path/to/bitrix24-mcp-server/index.js"],
      "env": {
        "B24_BASE": "https://your-domain.bitrix24.ru/rest/USER_ID/WEBHOOK_CODE/"
      }
    }
  }
}
```

## Переменные окружения

| Переменная | Обязательная | Описание |
|---|---:|---|
| `B24_BASE` | Да | Базовый URL входящего вебхука Bitrix24. |

## License

MIT
