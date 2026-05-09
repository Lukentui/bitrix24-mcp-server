# Bitrix24 MCP Server

This is a Model Context Protocol (MCP) server that provides tools for interacting with Bitrix24 via incoming webhooks. It allows AI agents (like Manus, Claude Desktop, etc.) to manage tasks, search for groups, and view user profiles.

## Features

- **get_profile**: Fetch current user profile information.
- **get_task**: Retrieve detailed information about a specific task by ID.
- **search_tasks**: Search for tasks by title with sorting and pagination.
- **get_group**: Get detailed information about a workgroup or project.
- **search_groups**: Search for workgroups or projects by name.

## Installation

You can run this server directly using `npx`:

```bash
npx -y @x0333/bitrix24-mcp-server
```

## Configuration

The server requires a Bitrix24 incoming webhook URL. You must set the `B24_BASE` environment variable.

### Example for Manus / Claude Desktop

Add this to your configuration:

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

## How to get Webhook URL

1. Go to your Bitrix24 portal.
2. Navigate to **Developer Resources** -> **Other** -> **Inbound Webhook**.
3. Select the required permissions (Tasks, Social Network, User).
4. Copy the **URL for REST API call** (it should look like `https://domain.bitrix24.ru/rest/1/abcdef12345/`).

## License

MIT
