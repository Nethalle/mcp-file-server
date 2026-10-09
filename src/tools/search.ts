
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { WORKSPACE, resolveSafePath } from "../sandbox.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_RESULTS = 100;

export function registerSearch(server: McpServer) {
  server.registerTool(
    "search",
    {
      description:
        "Search for a text string inside files in the workspace.",
      inputSchema: {
        query: z.string().min(1).max(500).describe("Text to search for"),
        path: z.string().default(".").describe("Workspace-relative directory"),
      },
    },
    async ({ query, path: userPath }) => {
      try {
        const safeRoot = await resolveSafePath(userPath);
        const rootStats = await fs.stat(safeRoot);

        if (!rootStats.isDirectory()) {
          throw new Error("The search path must be a directory.");
        }

        const results: string[] = [];
        let filesScanned = 0;
        let truncated = false;

        async function walk(directory: string): Promise<void> {
          const entries = await fs.readdir(directory, {
            withFileTypes: true,
          });

          for (const entry of entries) {
            if (results.length >= MAX_RESULTS) {
              truncated = true;
              return;
            }

            // Skip symbolic links to avoid following them outside the workspace.
            if (entry.isSymbolicLink()) continue;

            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
              await walk(fullPath);
            } else if (entry.isFile()) {
              // Search text-like files only.
              if (path.extname(entry.name).toLowerCase() === "") continue;

              try {
                const stats = await fs.stat(fullPath);
                if (stats.size > MAX_FILE_SIZE) continue;

                const content = await fs.readFile(fullPath, "utf8");

                // Skip files that appear to contain binary data.
                if (content.includes("\u0000")) continue;

                filesScanned++;
                const lines = content.split(/\r?\n/);

                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes(query)) {
                    const relativePath = path.relative(WORKSPACE, fullPath);
                    results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);

                    if (results.length >= MAX_RESULTS) {
                      truncated = true;
                      return;
                    }
                  }
                }
              } catch {
                // Ignore unreadable or changing files.
              }
            }
          }
        }

        await walk(safeRoot);

        const output = results.length
          ? results.join("\n")
          : "No matches found.";

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Search completed. Files scanned: ${filesScanned}.\n` +
                output +
                (truncated ? "\nResults limited to the first 100 matches." : ""),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                error instanceof Error
                  ? `Search failed: ${error.message}`
                  : "Search failed. Check the directory and try again.",
            },
          ],
        };
      }
    }
  );
}