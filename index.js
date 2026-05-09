#!/usr/bin/env node
"use strict";

/*
 * CLI entry point for the Bitrix24 skill.
 *
 * This version uses axios for HTTP requests and commander for argument parsing.
 * Users can call this binary via `npx bitrix24-skill` once published.
 *
 * Each command prints the JSON response from Bitrix24 to stdout so it can be
 * consumed by downstream tools (including AI models) without additional
 * formatting. If the base URL is not provided via the --base option, the
 * environment variable B24_BASE will be used as a fallback. See README for
 * usage examples.
 */

const axios = require("axios");
const { Command } = require("commander");

/**
 * Helper to send a POST request to a Bitrix24 REST method.
 *
 * @param {string} method The name of the method (e.g. "profile", "tasks.task.get").
 * @param {object} body The request payload, encoded as JSON.
 * @param {string} base The base URL of the Bitrix24 webhook (no trailing slash).
 * @returns {Promise<any>} Resolves with the parsed JSON data from the response.
 */
async function callBitrix(method, body, base) {
  const baseUrl = (base || process.env.B24_BASE || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error(
      "Base URL for Bitrix24 webhook is not set. Use --base option or set B24_BASE environment variable."
    );
  }
  const url = `${baseUrl}/${method}`;
  try {
    const response = await axios.post(url, body, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (err) {
    // Rethrow with a human‑readable message
    const msg = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    throw new Error(msg);
  }
}

/**
 * Parse a comma‑separated list into an array. Returns undefined if the input
 * is falsy.
 *
 * @param {string|undefined} value The comma‑separated string.
 */
function parseList(value) {
  if (!value) return undefined;
  return value
    .split(/,/) // split on commas
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const program = new Command();
  program
    .name("bitrix24-skill")
    .description(
      "CLI for interacting with Bitrix24 via incoming webhook. Provides commands to query profile, tasks, and workgroups."
    )
    .option(
      "--base <base>",
      "Base URL for Bitrix24 webhook (e.g. https://domain.bitrix24.ru/rest/USER_ID/WEBHOOK_CODE). Defaults to environment variable B24_BASE.",
      undefined
    );

  // Profile command
  program
    .command("profile")
    .description("Fetch current user profile information")
    .action(async (cmdOptions) => {
      const opts = program.opts();
      const data = await callBitrix("profile", {}, opts.base);
      console.log(JSON.stringify(data, null, 2));
    });

  // Get task by ID
  program
    .command("get-task")
    .description("Retrieve task details by ID")
    .requiredOption("--id <id>", "Task identifier")
    .option(
      "--select <fields>",
      "Comma‑separated list of fields to select (default '*')",
      undefined
    )
    .action(async (options) => {
      const opts = program.opts();
      const taskId = Number(options.id);
      if (isNaN(taskId)) {
        throw new Error("The --id option must be a number");
      }
      const select = parseList(options.select) || ["*"];
      const body = { taskId, select };
      const data = await callBitrix("tasks.task.get", body, opts.base);
      console.log(JSON.stringify(data, null, 2));
    });

  // Search tasks by title
  program
    .command("search-task")
    .description("Search tasks by part of the title")
    .requiredOption("--title <title>", "Substring of the task title to search for")
    .option(
      "--select <fields>",
      "Comma‑separated list of fields to select (default ID,TITLE,STATUS,RESPONSIBLE_ID,GROUP_ID,CREATED_DATE,CHANGED_DATE)",
      undefined
    )
    .option(
      "--order <field>",
      "Field to sort by (default: ID)",
      "ID"
    )
    .option(
      "--dir <direction>",
      "Sort direction: asc or desc (default: desc)",
      "desc"
    )
    .option(
      "--start <offset>",
      "Pagination offset (multiple of 50; default 0)",
      (value) => Number(value),
      0
    )
    .action(async (options) => {
      const opts = program.opts();
      const select =
        parseList(options.select) || [
          "ID",
          "TITLE",
          "STATUS",
          "RESPONSIBLE_ID",
          "GROUP_ID",
          "CREATED_DATE",
          "CHANGED_DATE",
        ];
      const order = { [options.order]: options.dir.toUpperCase() };
      const body = {
        order,
        filter: { "%TITLE": options.title },
        select,
        start: options.start,
      };
      const data = await callBitrix("tasks.task.list", body, opts.base);
      console.log(JSON.stringify(data, null, 2));
    });

  // Search workgroup by name
  program
    .command("search-group")
    .description("Search workgroups/projects by part of the name")
    .requiredOption("--name <name>", "Substring of the group name to search for")
    .option(
      "--select <fields>",
      "Comma‑separated list of fields to select (default ID,NAME,PROJECT,ACTIVE,VISIBLE,CLOSED)",
      undefined
    )
    .option(
      "--order <field>",
      "Field to sort by (default: ID)",
      "ID"
    )
    .option(
      "--dir <direction>",
      "Sort direction: ASC or DESC (default: DESC)",
      "DESC"
    )
    .option(
      "--start <offset>",
      "Pagination offset (multiple of 50; default 0)",
      (value) => Number(value),
      0
    )
    .action(async (options) => {
      const opts = program.opts();
      const select =
        parseList(options.select) || [
          "ID",
          "NAME",
          "PROJECT",
          "ACTIVE",
          "VISIBLE",
          "CLOSED",
        ];
      const order = { [options.order]: options.dir.toUpperCase() };
      const body = {
        filter: { "%NAME": options.name },
        select,
        order,
        start: options.start,
      };
      const data = await callBitrix(
        "socialnetwork.api.workgroup.list",
        body,
        opts.base
      );
      console.log(JSON.stringify(data, null, 2));
    });

  // Get workgroup by ID
  program
    .command("get-group")
    .description("Retrieve detailed information about a workgroup/project by ID")
    .requiredOption("--id <id>", "Workgroup identifier")
    .option(
      "--select <fields>",
      "Comma‑separated list of fields to select (default includes common fields)",
      undefined
    )
    .action(async (options) => {
      const opts = program.opts();
      const groupId = Number(options.id);
      if (isNaN(groupId)) {
        throw new Error("The --id option must be a number");
      }
      const select =
        parseList(options.select) || [
          "ACTIONS",
          "AVATAR",
          "AVATAR_DATA",
          "COUNTERS",
          "DATE_CREATE",
          "DEPARTMENTS",
          "EFFICIENCY",
          "FEATURES",
          "GROUP_MEMBERS_LIST",
          "LIST_OF_MEMBERS",
          "OWNER_DATA",
          "PRIVACY_TYPE",
          "SUBJECT_DATA",
          "TAGS",
          "USER_DATA",
        ];
      const body = { params: { groupId, select } };
      const data = await callBitrix(
        "socialnetwork.api.workgroup.get",
        body,
        opts.base
      );
      console.log(JSON.stringify(data, null, 2));
    });

  // Parse command line arguments. Use async to allow await inside actions.
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});