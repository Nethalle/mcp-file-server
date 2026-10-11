
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveSafePath } from "../sandbox.js";
import { assertNotProtectedFile } from "../protectedFiles.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const MAX_FILE_SIZE = 1024 * 1024; // 1 MiB

export function registerWriteFile(server: McpServer) {
  server.registerTool(
    "write_file",
    {
      description:
        "Create or overwrite a text file inside the workspace. Maximum size: 1 MiB in UTF-8 bytes. Handoff files are protected.",
      inputSchema: {
        path: z.string().min(1).describe("Workspace-relative file path"),
        content: z.string().describe("Text to write; maximum 1 MiB in UTF-8 bytes")
      }
    },
    async ({ path: userPath, content }) => {
      try {
        if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) {
          throw new Error("Content exceeds the 1 MiB size limit.");
        }

        const safePath = await resolveSafePath(userPath);
        assertNotProtectedFile(safePath);

        await fs.mkdir(path.dirname(safePath), { recursive: true });

        // Re-resolve and recheck after creating the parent directory.
        const verifiedPath = await resolveSafePath(userPath);
        assertNotProtectedFile(verifiedPath);

        // Reject existing symlinks and non-file targets.
        try {
          const stats = await fs.lstat(verifiedPath);

          if (stats.isSymbolicLink()) {
            throw new Error("Writing to symbolic links is not allowed.");
          }

          if (!stats.isFile()) {
            throw new Error("The target must be a regular file.");
          }
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
          ) {
            // A new file is allowed if its parent path resolves safely.
          } else {
            throw error;
          }
        }

        await fs.writeFile(verifiedPath, content, {
          encoding: "utf8",
          flag: "w"
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully wrote ${Buffer.byteLength(content, "utf8")} bytes to ${userPath}.`
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
