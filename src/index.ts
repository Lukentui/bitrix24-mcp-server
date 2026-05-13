#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { createRequire } from "node:module";

/**
 * Bitrix24 MCP Server
 * 
 * This server implements the Model Context Protocol (MCP) to provide
 * Bitrix24 integration for AI agents.
 */

const B24_BASE = process.env.B24_BASE;
const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

if (!B24_BASE) {
  console.error("Error: B24_BASE environment variable is not set.");
  console.error("Please set it to your Bitrix24 webhook URL (e.g., https://domain.bitrix24.ru/rest/1/abcde/).");
  process.exit(1);
}

function bitrixPortalUrlFromBase(base: string): string | null {
  try {
    const u = new URL(String(base).trim());
    if (!u.host) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

const B24_PORTAL_URL = bitrixPortalUrlFromBase(B24_BASE);
if (!B24_PORTAL_URL) {
  console.error("Error: B24_BASE must be a valid absolute URL with a host (e.g., https://domain.bitrix24.ru/rest/1/abcde/).");
  process.exit(1);
}

const taskViewUrlPrefix = `${B24_PORTAL_URL}/company/personal/user/0/tasks/task/view/`;
const taskPortalLinkHowto =
  `When the user needs a link to a task (or to paste one), use ${taskViewUrlPrefix}<task-id>/ — substitute only <task-id> with the numeric task ID from the API. Example: ${taskViewUrlPrefix}9483/`;
const mcpInstructions = `Bitrix24 address: ${B24_PORTAL_URL}. ${taskPortalLinkHowto}`;

const server = new Server(
  {
    name: "bitrix24-mcp-server",
    version: packageJson.version,
  },
  {
    capabilities: {
      tools: {},
    },
    instructions: mcpInstructions,
  }
);

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };
type ToolArgs = Record<string, unknown>;

type BitrixResponse = JsonObject & {
  result?: unknown;
  error?: unknown;
  error_description?: unknown;
};

type TaskItem = JsonObject & {
  chatId?: unknown;
  CHAT_ID?: unknown;
  chat?: JsonObject & {
    id?: unknown;
    ID?: unknown;
  };
};

type SlimTaskChatMessage = {
  id: unknown;
  author_id: unknown;
  text: unknown;
  date: unknown;
};

type SlimImUser = {
  id: unknown;
  name: unknown;
  work_position: unknown;
  email: unknown;
};

const bitrixBaseUrl = B24_BASE.replace(/\/$/, "");

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function positiveNumber(value: unknown, fieldName: string): number {
  const numberValue = optionalNumber(value);
  if (numberValue === null || numberValue <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return numberValue;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function stringArrayOrDefault(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : fallback;
}

function requestArgs(args: unknown): ToolArgs {
  return asObject(args) ?? {};
}

// If B24_BASE is legacy .../rest/{user}/{webhook}/ (without /api/), new task fields
// like chatId are returned from .../rest/api/{user}/{webhook}/ only.
function bitrixRestApiBaseFromLegacy(): string | null {
  const b = bitrixBaseUrl;
  if (/\/rest\/api\//.test(b)) return null;
  if (/\/rest\/\d+\//.test(b)) return b.replace("/rest/", "/rest/api/");
  return null;
}

async function callBitrix(method: string, body: JsonObject, baseUrl = bitrixBaseUrl): Promise<BitrixResponse> {
  const url = `${baseUrl.replace(/\/$/, "")}/${method}`;
  try {
    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
    });
    return asObject(response.data) ?? { result: response.data as JsonValue };
  } catch (error: unknown) {
    const msg = axios.isAxiosError(error) && error.response
      ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error instanceof Error
        ? error.message
        : String(error);
    throw new Error(msg);
  }
}

const IM_MESSAGES_LIMIT_MAX = 50;

function pickTaskItem(taskGetResult: BitrixResponse): TaskItem | null {
  const result = asObject(taskGetResult.result);
  if (!result) return null;
  return asObject(result.item) ?? asObject(result.task) ?? null;
}

function resolveTaskChatId(item: TaskItem | null): number | null {
  if (!item) return null;
  return optionalNumber(item.chatId ?? item.CHAT_ID ?? item.chat?.id ?? item.chat?.ID);
}

function slimTaskChatMessages(messages: unknown): SlimTaskChatMessage[] {
  const list = Array.isArray(messages) ? messages : [];
  return list.map((message) => {
    const m = asObject(message) ?? {};
    return {
      id: m.id,
      author_id: m.author_id,
      text: m.text,
      date: m.date,
    };
  });
}

function slimImUsers(users: unknown): SlimImUser[] {
  const list = Array.isArray(users) ? users : [];
  return list.map((user) => {
    const u = asObject(user) ?? {};
    return {
      id: u.id,
      name: u.name,
      work_position: u.work_position ?? null,
      email: u.email ?? null,
    };
  });
}

function throwIfBitrixError(data: BitrixResponse, context: string): void {
  if (!Object.prototype.hasOwnProperty.call(data, "error") || data.error == null) return;
  const code = typeof data.error === "object" ? JSON.stringify(data.error) : String(data.error);
  const desc = data.error_description != null ? String(data.error_description) : "";
  throw new Error(`${context}: ${code}${desc ? ` — ${desc}` : ""}`);
}

/**
 * Define available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_profile",
        description: "Fetch current user profile information from Bitrix24",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_task",
        description:
          "Retrieve task details by ID from Bitrix24. " +
          taskPortalLinkHowto +
          " The tool response JSON includes agent_instructions with the same rule plus a direct link for the requested task id.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "The unique ID of the task" },
            select: { 
              type: "array", 
              items: { type: "string" }, 
              description: "Fields to return (default: ['*'])" 
            },
          },
          required: ["id"],
        },
      },
      {
        name: "search_tasks",
        description:
          "Search tasks in Bitrix24: by title substring (%TITLE), by Kanban stage id (filter STAGE_ID), or both.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Substring of the task title to search for" },
            stage_id: {
              type: "number",
              description: "Kanban stage ID (tasks.task.list filter STAGE_ID)",
            },
            order: { type: "string", description: "Field to sort by (default: 'ID')" },
            dir: { type: "string", enum: ["asc", "desc"], description: "Sort direction (default: 'desc')" },
            start: { type: "number", description: "Pagination offset (default: 0)" },
          },
        },
      },
      {
        name: "search_groups",
        description: "Search for workgroups or projects by name in Bitrix24",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Substring of the group name to search for" },
          },
          required: ["name"],
        },
      },
      {
        name: "get_group",
        description: "Retrieve detailed information about a workgroup or project by ID",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "The unique ID of the group" },
          },
          required: ["id"],
        },
      },
      {
        name: "get_kanban_stages_by_group",
        description:
          "Get task Kanban stages for a workgroup or project (task.stages.get). entityId is the group ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "The unique ID of the group (entityId for task kanban)" },
          },
          required: ["id"],
        },
      },
      {
        name: "get_task_comments",
        description:
          "Comments for a task on the new task card (module tasks 25.700.0+): messages come from the task chat via im.dialog.messages.get, newest first when no cursors are passed. " +
          "Arrays are trimmed: messages only id, author_id, text, date; users only id, name, work_position, email. " +
          "author_id 0 means system/service chat messages (stage changes, time tracking, joins, etc.) — not a user comment; do not expect a matching row in users. " +
          "For author_id > 0, match message.author_id to users[].id to resolve author name. " +
          "ИИ: author_id 0 = системные сообщения чата (не комментарий человека), в users не сопоставлять; для author_id > 0 сопоставляй с users[].id. В теле ответа см. agent_instructions. " +
          "Pagination: limit 1–50 (default 20). first_id = Bitrix FIRST_ID (next page of older messages). last_id = Bitrix LAST_ID (messages newer than id). Do not send both first_id and last_id.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: { type: "number", description: "Task ID" },
            limit: {
              type: "number",
              description: `Page size (1–${IM_MESSAGES_LIMIT_MAX}, default 20). Bitrix im.dialog.messages.get LIMIT`,
            },
            first_id: {
              type: "number",
              description:
                "Optional. Bitrix FIRST_ID: load messages older than this id (next page toward history). Typically set to the smallest message id from the previous response.",
            },
            last_id: {
              type: "number",
              description:
                "Optional. Bitrix LAST_ID: load messages newer than this id. Do not combine with first_id.",
            },
          },
          required: ["task_id"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const args = requestArgs(request.params.arguments);

  try {
    switch (name) {
      case "get_profile": {
        const data = await callBitrix("profile", {});
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_task": {
        const taskId = positiveNumber(args.id, "get_task: id");
        const body = { taskId, select: stringArrayOrDefault(args.select, ["*"]) };
        const data = await callBitrix("tasks.task.get", body);
        throwIfBitrixError(data, "tasks.task.get");
        const payload = {
          ...data,
          agent_instructions: `${taskPortalLinkHowto} For this task: ${taskViewUrlPrefix}${taskId}/`,
        };
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      }

      case "search_tasks": {
        const title = optionalString(args.title);
        const stageId = optionalNumber(args.stage_id);
        const hasStageInput = args.stage_id !== undefined && args.stage_id !== null;
        const hasTitle = title !== null;
        const hasStage = hasStageInput && stageId !== null;
        if (hasStageInput && stageId === null) {
          throw new Error("search_tasks: stage_id must be a number");
        }
        if (!hasTitle && !hasStage) {
          throw new Error("search_tasks requires at least one of: title, stage_id");
        }
        const filter: JsonObject = {};
        if (hasTitle) {
          filter["%TITLE"] = title;
        }
        if (hasStage) {
          filter.STAGE_ID = stageId;
        }
        const orderField = optionalString(args.order) ?? "ID";
        const direction = optionalString(args.dir)?.toLowerCase() === "asc" ? "ASC" : "DESC";
        const start = optionalNumber(args.start) ?? 0;
        const body = {
          order: { [orderField]: direction },
          filter,
          select: ["ID", "TITLE", "STATUS", "RESPONSIBLE_ID", "GROUP_ID", "STAGE_ID"],
          start,
        };
        const data = await callBitrix("tasks.task.list", body);
        throwIfBitrixError(data, "tasks.task.list");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "search_groups": {
        const name = optionalString(args.name);
        if (!name) {
          throw new Error("search_groups: name must be a non-empty string");
        }
        const body = {
          FILTER: { "%NAME": name },
        };
        const data = await callBitrix("sonet_group.get.json", body);
        throwIfBitrixError(data, "sonet_group.get.json");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_group": {
        const body = { FILTER: { ID: positiveNumber(args.id, "get_group: id") } };
        const data = await callBitrix("sonet_group.get.json", body);
        throwIfBitrixError(data, "sonet_group.get.json");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_kanban_stages_by_group": {
        const body = { entityId: positiveNumber(args.id, "get_kanban_stages_by_group: id") };
        const data = await callBitrix("task.stages.get", body);
        throwIfBitrixError(data, "task.stages.get");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_task_comments": {
        const taskId = positiveNumber(args.task_id, "get_task_comments: task_id");
        const hasFirst = args.first_id !== undefined && args.first_id !== null;
        const hasLast = args.last_id !== undefined && args.last_id !== null;
        if (hasFirst && hasLast) {
          throw new Error("get_task_comments: pass only one of first_id or last_id, not both");
        }
        let limit = args.limit === undefined || args.limit === null ? 20 : Number(args.limit);
        if (!Number.isFinite(limit)) limit = 20;
        limit = Math.min(IM_MESSAGES_LIMIT_MAX, Math.max(1, Math.floor(limit)));

        const taskSelect = ["id", "chatId", "chat.id"];
        let taskRaw = await callBitrix("tasks.task.get", {
          id: taskId,
          select: taskSelect,
        });
        throwIfBitrixError(taskRaw, "tasks.task.get");
        let item = pickTaskItem(taskRaw);
        let chatId = resolveTaskChatId(item);
        const apiBase = bitrixRestApiBaseFromLegacy();
        if (!chatId && apiBase) {
          taskRaw = await callBitrix(
            "tasks.task.get",
            { id: taskId, select: taskSelect },
            apiBase
          );
          throwIfBitrixError(taskRaw, "tasks.task.get (rest/api)");
          item = pickTaskItem(taskRaw);
          chatId = resolveTaskChatId(item);
        }
        if (!chatId) {
          throw new Error(
            "get_task_comments: task has no chatId (new-card comments unavailable, no access, or set B24_BASE to .../rest/api/...)"
          );
        }

        const imBody: JsonObject = {
          DIALOG_ID: `chat${chatId}`,
          LIMIT: limit,
        };
        if (hasFirst) imBody.FIRST_ID = positiveNumber(args.first_id, "get_task_comments: first_id");
        if (hasLast) imBody.LAST_ID = positiveNumber(args.last_id, "get_task_comments: last_id");

        const imRaw = await callBitrix("im.dialog.messages.get", imBody);
        throwIfBitrixError(imRaw, "im.dialog.messages.get");
        const imResult = asObject(imRaw.result) ?? {};
        const slimMessages = slimTaskChatMessages(imResult.messages);
        const ids = slimMessages
          .map((message) => optionalNumber(message.id))
          .filter((id): id is number => id !== null);
        const minId = ids.length ? Math.min(...ids) : null;
        const maxId = ids.length ? Math.max(...ids) : null;

        const payload = {
          task_id: taskId,
          chat_id: imResult.chat_id ?? chatId,
          messages: slimMessages,
          users: slimImUsers(imResult.users),
          pagination: {
            limit,
            first_id_sent: hasFirst ? Number(args.first_id) : null,
            last_id_sent: hasLast ? Number(args.last_id) : null,
            suggested_next_first_id:
              !hasLast && slimMessages.length > 0 ? minId : null,
            suggested_next_last_id:
              !hasFirst && slimMessages.length > 0 ? maxId : null,
            note:
              "If suggested_next_first_id is set and you need older messages, call again with first_id equal to that value. If suggested_next_last_id is set and you need newer messages, call again with last_id equal to that value. Empty page or short page means no more in that direction (heuristic).",
          },
          agent_instructions:
            "author_id 0 — это системные сообщения чата Битрикс24 (смена стадии, учёт времени, приглашения и т.п.), а не пользовательский комментарий; не ищи для них запись в users. " +
            "Для author_id > 0 сопоставь author_id с users[].id и бери имя/должность из найденного user. Текст сообщения в messages[].text.",
        };

        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bitrix24 MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
