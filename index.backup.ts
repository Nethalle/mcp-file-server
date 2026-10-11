
import express from "express";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { WORKSPACE, resolveSafePath } from "./sandbox.js";

import { registerReadFile } from "./tools/readFile.js";
import { registerWriteFile } from "./tools/writeFile.js";
import { registerStrReplace } from "./tools/strReplace.js";
import { registerDeleteFile } from "./tools/deleteFile.js";
import { registerSearch } from "./tools/search.js";
import { registerGitTools } from "./tools/gitTools.js";

dotenv.config();

function createMcpServer() {
  const server = new McpServer({
    name: "mcp-file-server",
    version: "1.0.0",
  });

  // Tool 1: List files and directories
  server.registerTool(
    "list_files",
    {
      description: "List files and folders inside the workspace.",
      inputSchema: {
        path: z
          .string()
          .default(".")
          .describe("Workspace-relative directory path"),
      },
    },
    async ({ path: userPath }) => {
      try {
        const safePath = await resolveSafePath(userPath);

        const entries = await fs.readdir(safePath, {
          withFileTypes: true,
        });

        const result = entries
          .map((entry) =>
            entry.isDirectory() ? `${entry.name}/` : entry.name
          )
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: result || "(empty directory)",
            },
          ],
        };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Unable to list this directory. Check that the path exists inside workspace.",
            },
          ],
        };
      }
    }
  );

  // Tool 2: Read a section of a file
  registerReadFile(server);

  // Tool 3: Create or overwrite a file
  registerWriteFile(server);

  // Tool 4: Replace an exact, unique text match
  registerStrReplace(server);

  // Tool 5: Delete a file with explicit confirmation
  registerDeleteFile(server);

  // Tool 6: Search text inside workspace files
  registerSearch(server);

  // Tool 7 and 8: Git status and Git diff
  registerGitTools(server);

  return server;
}

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("MCP File Server is running.");
});

app.post("/mcp", async (req, res) => {
  const server = createMcpServer();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed.",
      });
    }

    await server.close();
  }
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`MCP File Server running on port ${PORT}`);
  console.log(`Workspace: ${WORKSPACE}`);
});