#!/usr/bin/env node
"use strict";

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const axios = require("axios");

/**
 * Bitrix24 MCP Server
 * 
 * This server implements the Model Context Protocol (MCP) to provide
 * Bitrix24 integration for AI agents.
 */

const B24_BASE = process.env.B24_BASE;

if (!B24_BASE) {
  console.error("Error: B24_BASE environment variable is not set.");
  console.error("Please set it to your Bitrix24 webhook URL (e.g., https://domain.bitrix24.ru/rest/1/abcde/).");
  process.exit(1);
}

const server = new Server(
  {
    name: "bitrix24-mcp-server",
    version: "2.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Helper to call Bitrix24 REST API
 */
async function callBitrix(method, body) {
  const url = `${B24_BASE.replace(/\/$/, "")}/${method}`;
  try {
    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    throw new Error(msg);
  }
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
        description: "Retrieve task details by ID from Bitrix24",
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
            start: { type: "number", description: "Pagination offset (default: 0)" },
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
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_profile": {
        const data = await callBitrix("profile", {});
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_task": {
        const body = { taskId: args.id, select: args.select || ["*"] };
        const data = await callBitrix("tasks.task.get", body);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "search_tasks": {
        const hasTitle = args.title != null && String(args.title).trim() !== "";
        const hasStage =
          args.stage_id !== undefined && args.stage_id !== null && !Number.isNaN(Number(args.stage_id));
        if (!hasTitle && !hasStage) {
          throw new Error("search_tasks requires at least one of: title, stage_id");
        }
        const filter = {};
        if (hasTitle) {
          filter["%TITLE"] = args.title;
        }
        if (hasStage) {
          filter.STAGE_ID = Number(args.stage_id);
        }
        const body = {
          order: { [args.order || "ID"]: (args.dir || "desc").toUpperCase() },
          filter,
          select: ["ID", "TITLE", "STATUS", "RESPONSIBLE_ID", "GROUP_ID", "STAGE_ID"],
          start: args.start || 0,
        };
        const data = await callBitrix("tasks.task.list", body);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "search_groups": {
        const body = {
          filter: { "%NAME": args.name },
          order: { ID: "DESC" },
          start: args.start || 0,
        };
        const data = await callBitrix("socialnetwork.api.workgroup.list", body);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_group": {
        const body = { params: { groupId: args.id } };
        const data = await callBitrix("socialnetwork.api.workgroup.get", body);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_kanban_stages_by_group": {
        const body = { entityId: args.id };
        const data = await callBitrix("task.stages.get", body);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
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
