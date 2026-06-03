#!/usr/bin/env node
import axios from "axios";
import { FastMCP, type ContentResult, type Logger } from "fastmcp";
import { createRequire } from "node:module";
import { z } from "zod";

const B24_BASE = process.env.B24_BASE;
const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: `${number}.${number}.${number}` };

if (!B24_BASE) {
  console.error("Error: B24_BASE environment variable is not set.");
  console.error("Please set it to your Bitrix24 webhook URL (e.g., https://domain.bitrix24.ru/rest/1/abcde/).");
  process.exit(1);
}

function bitrixPortalUrlFromBase(base: string): string | null {
  try {
    const u = new URL(base.trim());
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

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };

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
const IM_MESSAGES_LIMIT_MAX = 50;

const stderrLogger: Logger = {
  debug: (...args) => console.error(...args),
  error: (...args) => console.error(...args),
  info: (...args) => console.error(...args),
  log: (...args) => console.error(...args),
  warn: (...args) => console.error(...args),
};

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

function jsonText(data: unknown): ContentResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

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

const server = new FastMCP({
  instructions: mcpInstructions,
  logger: stderrLogger,
  name: "bitrix24-mcp-server",
  version: packageJson.version,
});

server.addTool({
  annotations: { readOnlyHint: true, openWorldHint: true },
  description: "Fetch current user profile information from Bitrix24",
  name: "get_profile",
  parameters: z.object({}),
  execute: async () => {
    const data = await callBitrix("profile", {});
    throwIfBitrixError(data, "profile");
    return jsonText(data);
  },
});

server.addTool({
  annotations: { readOnlyHint: true, openWorldHint: true },
  description:
    "Retrieve task details by ID from Bitrix24. " +
    taskPortalLinkHowto +
    " The tool response JSON includes agent_instructions with the same rule plus a direct link for the requested task id.",
  name: "get_task",
  parameters: z.object({
    id: z.number().positive().describe("The unique ID of the task"),
    select: z.array(z.string()).optional().describe("Fields to return (default: ['*'])"),
  }),
  execute: async ({ id, select }) => {
    const taskId = positiveNumber(id, "get_task: id");
    const data = await callBitrix("tasks.task.get", {
      taskId,
      select: select ?? ["*"],
    });
    throwIfBitrixError(data, "tasks.task.get");
    return jsonText({
      ...data,
      agent_instructions: `${taskPortalLinkHowto} For this task: ${taskViewUrlPrefix}${taskId}/`,
    });
  },
});

server.addTool({
  annotations: { readOnlyHint: true, openWorldHint: true },
  description:
    "Search tasks in Bitrix24: by title substring (%TITLE), by Kanban stage id (filter STAGE_ID), or both.",
  name: "search_tasks",
  parameters: z.object({
    title: z.string().trim().min(1).optional().describe("Substring of the task title to search for"),
    stage_id: z.number().optional().describe("Kanban stage ID (tasks.task.list filter STAGE_ID)"),
    order: z.string().trim().min(1).default("ID").describe("Field to sort by (default: 'ID')"),
    dir: z.enum(["asc", "desc"]).default("desc").describe("Sort direction (default: 'desc')"),
    start: z.number().nonnegative().default(0).describe("Pagination offset (default: 0)"),
  }),
  execute: async ({ title, stage_id, order, dir, start }) => {
    if (!title && stage_id === undefined) {
      throw new Error("search_tasks requires at least one of: title, stage_id");
    }

    const filter: JsonObject = {};
    if (title) filter["%TITLE"] = title;
    if (stage_id !== undefined) filter.STAGE_ID = stage_id;

    const data = await callBitrix("tasks.task.list", {
      order: { [order]: dir.toUpperCase() },
      filter,
      select: ["ID", "TITLE", "STATUS", "RESPONSIBLE_ID", "GROUP_ID", "STAGE_ID"],
      start,
    });
    throwIfBitrixError(data, "tasks.task.list");
    return jsonText(data);
  },
});

server.addTool({
  annotations: { readOnlyHint: true, openWorldHint: true },
  description: "Search for workgroups or projects by name in Bitrix24",
  name: "search_groups",
  parameters: z.object({
    name: z.string().trim().min(1).describe("Substring of the group name to search for"),
  }),
  execute: async ({ name }) => {
    const data = await callBitrix("sonet_group.get.json", {
      FILTER: { "%NAME": name },
    });
    throwIfBitrixError(data, "sonet_group.get.json");
    return jsonText(data);
  },
});

server.addTool({
  annotations: { readOnlyHint: true, openWorldHint: true },
  description:
    "Retrieve information about one or more workgroups or projects by ID (up to 10 IDs per call).",
  name: "get_group",
  parameters: z.object({
    ids: z
      .array(z.number().positive())
      .min(1)
      .max(10)
      .describe("One or more group IDs (1–10 per request)"),
  }),
  execute: async ({ ids }) => {
    const groupIds = [...new Set(ids.map((id) => positiveNumber(id, "get_group: ids[]")))];
    const data = await callBitrix("sonet_group.get.json", {
      FILTER: { ID: groupIds },
    });
    throwIfBitrixError(data, "sonet_group.get.json");
    const groups = Array.isArray(data.result) ? data.result : [];
    return jsonText({ groups });
  },
});

server.addTool({
  annotations: { readOnlyHint: true, openWorldHint: true },
  description:
    "Get task Kanban stages for one or more workgroups or projects (task.stages.get, up to 10 group IDs per call). entityId is the group ID.",
  name: "get_kanban_stages_by_group",
  parameters: z.object({
    ids: z
      .array(z.number().positive())
      .min(1)
      .max(10)
      .describe("One or more group IDs (1–10 per request, entityId for task kanban)"),
  }),
  execute: async ({ ids }) => {
    const groupIds = [
      ...new Set(ids.map((id) => positiveNumber(id, "get_kanban_stages_by_group: ids[]"))),
    ];
    const kanbanStages = await Promise.all(
      groupIds.map(async (groupId) => {
        const data = await callBitrix("task.stages.get", { entityId: groupId });
        throwIfBitrixError(data, `task.stages.get (entityId=${groupId})`);
        return {
          group_id: groupId,
          stages: data.result ?? {},
        };
      }),
    );
    return jsonText({ kanban_stages: kanbanStages });
  },
});

server.addTool({
  annotations: { readOnlyHint: true, openWorldHint: true },
  description:
    "Comments for a task on the new task card (module tasks 25.700.0+): messages come from the task chat via im.dialog.messages.get, newest first when no cursors are passed. " +
    "Arrays are trimmed: messages only id, author_id, text, date; users only id, name, work_position, email. " +
    "author_id 0 means system/service chat messages (stage changes, time tracking, joins, etc.) — not a user comment; do not expect a matching row in users. " +
    "For author_id > 0, match message.author_id to users[].id to resolve author name. " +
    "ИИ: author_id 0 = системные сообщения чата (не комментарий человека), в users не сопоставлять; для author_id > 0 сопоставляй с users[].id. В теле ответа см. agent_instructions. " +
    "Pagination: limit 1–50 (default 20). first_id = Bitrix FIRST_ID (next page of older messages). last_id = Bitrix LAST_ID (messages newer than id). Do not send both first_id and last_id.",
  name: "get_task_comments",
  parameters: z.object({
    task_id: z.number().positive().describe("Task ID"),
    limit: z.number().int().min(1).max(IM_MESSAGES_LIMIT_MAX).default(20)
      .describe(`Page size (1–${IM_MESSAGES_LIMIT_MAX}, default 20). Bitrix im.dialog.messages.get LIMIT`),
    first_id: z.number().positive().optional()
      .describe("Optional. Bitrix FIRST_ID: load messages older than this id (next page toward history). Typically set to the smallest message id from the previous response."),
    last_id: z.number().positive().optional()
      .describe("Optional. Bitrix LAST_ID: load messages newer than this id. Do not combine with first_id."),
  }),
  execute: async ({ task_id, limit, first_id, last_id }) => {
    if (first_id !== undefined && last_id !== undefined) {
      throw new Error("get_task_comments: pass only one of first_id or last_id, not both");
    }

    const taskId = positiveNumber(task_id, "get_task_comments: task_id");
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
    if (first_id !== undefined) imBody.FIRST_ID = first_id;
    if (last_id !== undefined) imBody.LAST_ID = last_id;

    const imRaw = await callBitrix("im.dialog.messages.get", imBody);
    throwIfBitrixError(imRaw, "im.dialog.messages.get");

    const imResult = asObject(imRaw.result) ?? {};
    const slimMessages = slimTaskChatMessages(imResult.messages);
    const ids = slimMessages
      .map((message) => optionalNumber(message.id))
      .filter((id): id is number => id !== null);
    const minId = ids.length ? Math.min(...ids) : null;
    const maxId = ids.length ? Math.max(...ids) : null;

    return jsonText({
      task_id: taskId,
      chat_id: imResult.chat_id ?? chatId,
      messages: slimMessages,
      users: slimImUsers(imResult.users),
      pagination: {
        limit,
        first_id_sent: first_id ?? null,
        last_id_sent: last_id ?? null,
        suggested_next_first_id:
          last_id === undefined && slimMessages.length > 0 ? minId : null,
        suggested_next_last_id:
          first_id === undefined && slimMessages.length > 0 ? maxId : null,
        note:
          "If suggested_next_first_id is set and you need older messages, call again with first_id equal to that value. If suggested_next_last_id is set and you need newer messages, call again with last_id equal to that value. Empty page or short page means no more in that direction (heuristic).",
      },
      agent_instructions:
        "author_id 0 — это системные сообщения чата Битрикс24 (смена стадии, учёт времени, приглашения и т.п.), а не пользовательский комментарий; не ищи для них запись в users. " +
        "Для author_id > 0 сопоставь author_id с users[].id и бери имя/должность из найденного user. Текст сообщения в messages[].text.",
    });
  },
});

server.start({ transportType: "stdio" }).catch((error: unknown) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
