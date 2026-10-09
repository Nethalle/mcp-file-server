
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT = 20_000;

// Resolve the Git repository root.
// This file is located at src/tools/gitTools.ts.
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const GIT_ROOT = path.resolve(currentDirectory, "../../");

async function runGit(args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: GIT_ROOT,
    windowsHide: true,
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });

  return stdout;
}

export function registerGitTools(server: McpServer) {
  // Tool 7: Check Git repository status
  server.registerTool(
    "git_status",
    {
      description: "Show the Git status of the repository root.",
      inputSchema: {},
    },
    async () => {
      try {
        const output = await runGit([
          "status",
          "--short",
          "--branch",
          "--untracked-files=normal",
        ]);

        return {
          content: [
            {
              type: "text" as const,
              text: output.trim() || "Working tree clean.",
            },
          ],
        };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                "git_status failed. Make sure Git is installed and GIT_ROOT points to a Git repository.",
            },
          ],
        };
      }
    }
  );

  // Tool 8: Show working-tree changes
  server.registerTool(
    "git_diff",
    {
      description:
        "Show Git changes that have not been committed. Does not change files.",
      inputSchema: {
        staged: z
          .boolean()
          .default(false)
          .describe("Set true to show staged changes"),
      },
    },
    async ({ staged }) => {
      try {
        const args = ["diff", "--no-ext-diff"];

        if (staged) {
          args.push("--cached");
        }

        args.push("--");

        const output = await runGit(args);

        if (!output.trim()) {
          return {
            content: [
              {
                type: "text" as const,
                text: staged
                  ? "No staged changes found."
                  : "No unstaged changes found.",
              },
            ],
          };
        }

        const truncated = output.length > MAX_OUTPUT;

        return {
          content: [
            {
              type: "text" as const,
              text:
                output.slice(0, MAX_OUTPUT) +
                (truncated ? "\n\n[Output truncated.]" : ""),
            },
          ],
        };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                "git_diff failed. Make sure Git is installed and GIT_ROOT points to a Git repository.",
            },
          ],
        };
      }
    }
  );

  // Tool 9: Show recent Git commits
  server.registerTool(
    "git_log",
    {
      description: "Show recent Git commits in the repository.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5)
          .describe("Number of recent commits to display (1–20)"),
      },
    },
    async ({ limit }) => {
      try {
        const output = await runGit([
          "log",
          `-${limit}`,
          "--date=short",
          "--pretty=format:%h | %ad | %s",
        ]);

        return {
          content: [
            {
              type: "text" as const,
              text: output.trim() || "No commits found.",
            },
          ],
        };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                "git_log failed. Make sure GIT_ROOT is a Git repository with at least one commit.",
            },
          ],
        };
      }
    }
  );
}