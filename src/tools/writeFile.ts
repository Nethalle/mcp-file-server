
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveSafePath } from "../sandbox.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

export function registerWriteFile(server: McpServer) {
  server.registerTool(
    "write_file",
    {
      description:
        "Create or overwrite a text file inside the workspace. Maximum size: 1 MB.",
      inputSchema: {
        path: z.string().min(1).describe("Workspace-relative file path"),
        content: z.string().max(MAX_FILE_SIZE).describe("Text to write")
      }
    },
    async ({ path: userPath, content }) => {
      try {
        const safePath = await resolveSafePath(userPath);

        // Do not allow writing to a directory.
        if (path.extname(safePath) === "" && safePath.endsWith(path.sep)) {
          throw new Error("A file path is required.");
        }

        // Keep important handoff files protected from overwriting.
        const protectedFiles = [
          "PROJECT_STATE.md",
          "PLAN_LOG.md",
          "DECISIONS.md"
        ];

        const fileName = path.basename(safePath).toUpperCase();

        if (protectedFiles.includes(fileName)) {
          throw new Error(
            "This handoff file is protected from write_file. Use append or str_replace instead."
          );
        }

        await fs.mkdir(path.dirname(safePath), { recursive: true });

        // Resolve again after creating the parent directory.
        const verifiedPath = await resolveSafePath(userPath);

        await fs.writeFile(verifiedPath, content, {
          encoding: "utf8",
          flag: "w"
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully wrote ${content.length} characters to ${userPath}.`
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                error instanceof Error
                  ? `Unable to write file: ${error.message}`
                  : "Unable to write file. Check the path and try again."
            }
          ]
        };
      }
    }
  );
}