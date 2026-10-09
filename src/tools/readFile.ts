
import fs from "node:fs/promises";
import { z } from "zod";
import { resolveSafePath } from "../sandbox.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerReadFile(server: McpServer) {
  server.registerTool(
    "read_file",
    {
      description:
        "Read a limited section of a text file inside the workspace.",
      inputSchema: {
        path: z.string().min(1),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(500).default(100)
      }
    },
    async ({ path: userPath, offset, limit }) => {
      try {
        const safePath = await resolveSafePath(userPath);
        const content = await fs.readFile(safePath, "utf8");
        const lines = content.split(/\r?\n/);
        const selected = lines.slice(offset, offset + limit);

        return {
          content: [{
            type: "text" as const,
            text: selected.join("\n") ||
              "(no lines in the requested range)"
          }]
        };
      } catch {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: "Unable to read the file. Check that it exists inside workspace."
          }]
        };
      }
    }
  );
}