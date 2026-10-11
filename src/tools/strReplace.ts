
import fs from "node:fs/promises";
import { z } from "zod";
import { resolveSafePath } from "../sandbox.js";
import { assertNotProtectedFile } from "../protectedFiles.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MAX_FILE_SIZE = 1024 * 1024; // 1 MiB

export function registerStrReplace(server: McpServer) {
  server.registerTool(
    "str_replace",
    {
      description:
        "Replace an exact, unique text match in a workspace file. Protected handoff files cannot be modified.",
      inputSchema: {
        path: z.string().min(1),
        old_text: z.string().min(1),
        new_text: z.string()
      }
    },
    async ({ path: userPath, old_text, new_text }) => {
      try {
        const safePath = await resolveSafePath(userPath);

        // Block changes to protected handoff files.
        assertNotProtectedFile(safePath);

        const content = await fs.readFile(safePath, "utf8");

        if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) {
          throw new Error("File exceeds the 1 MiB size limit.");
        }

        const firstIndex = content.indexOf(old_text);

        if (firstIndex === -1) {
          throw new Error(
            "The old_text was not found. Check the exact text."
          );
        }

        // Require exactly one matching occurrence.
        if (
          content.indexOf(old_text, firstIndex + old_text.length) !== -1
        ) {
          throw new Error(
            "The old_text occurs more than once. Provide a unique text match."
          );
        }

        const updated =
          content.slice(0, firstIndex) +
          new_text +
          content.slice(firstIndex + old_text.length);

        if (Buffer.byteLength(updated, "utf8") > MAX_FILE_SIZE) {
          throw new Error("Updated file would exceed the 1 MiB size limit.");
        }

        await fs.writeFile(safePath, updated, "utf8");

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully replaced the matching text in ${userPath}.`
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
                  ? `str_replace failed: ${error.message}`
                  : "Replacement failed. Check the file path and try again."
            }
          ]
        };
      }
    }
  );
}
