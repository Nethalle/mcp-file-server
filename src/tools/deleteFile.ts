
import fs from "node:fs/promises";
import { z } from "zod";
import { resolveSafePath } from "../sandbox.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDeleteFile(server: McpServer) {
  server.registerTool(
    "delete_file",
    {
      description:
        "Delete a file inside the workspace. Requires explicit confirmation.",
      inputSchema: {
        path: z.string().min(1).describe("Workspace-relative file path"),
        confirm: z
          .boolean()
          .describe("Must be true to confirm deletion"),
      },
    },
    async ({ path: userPath, confirm }) => {
      try {
        if (confirm !== true) {
          throw new Error("Deletion cancelled. Set confirm to true to proceed.");
        }

        const safePath = await resolveSafePath(userPath);
        const stats = await fs.lstat(safePath);

        if (stats.isSymbolicLink()) {
          throw new Error("Deleting symbolic links is not allowed.");
        }

        if (!stats.isFile()) {
          throw new Error("Only files can be deleted. Directories are not allowed.");
        }

        await fs.unlink(safePath);

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully deleted ${userPath}.`,
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
                  ? `delete_file failed: ${error.message}`
                  : "Unable to delete the file.",
            },
          ],
        };
      }
    }
  );
}