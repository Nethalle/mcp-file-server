import express from "express";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";

import { z } from "zod";
import { WORKSPACE, resolveSafePath } from "./sandbox.js";
import { FileServerOAuthProvider } from "./oauth/provider.js";

import { registerReadFile } from "./tools/readFile.js";
import { registerWriteFile } from "./tools/writeFile.js";
import { registerStrReplace } from "./tools/strReplace.js";
import { registerDeleteFile } from "./tools/deleteFile.js";
import { registerSearch } from "./tools/search.js";
import { registerGitTools } from "./tools/gitTools.js";

dotenv.config();

const BASE_URL = process.env.BASE_URL;

if (!BASE_URL) {
  throw new Error("Missing BASE_URL in .env");
}

const issuerUrl = new URL(BASE_URL);
const MCP_URL = new URL("/mcp", BASE_URL);

const provider = new FileServerOAuthProvider();

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

  // Existing file tools
  registerReadFile(server);
  registerWriteFile(server);
  registerStrReplace(server);
  registerDeleteFile(server);
  registerSearch(server);
  registerGitTools(server);

  return server;
}

const app = express();

// Required when running behind ngrok
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// OAuth authorization and discovery endpoints
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl,
    resourceServerUrl: MCP_URL,
    scopesSupported: ["files"],
  })
);

// Rate-limit owner-password attempts
app.post(
  "/consent",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  (req, res) => provider.approve(req, res)
);

// Require a valid OAuth bearer token for MCP requests
const bearerAuth = requireBearerAuth({
  verifier: provider,
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(MCP_URL),
  expectedResource: MCP_URL,
});

app.get("/", (_req, res) => {
  res.send("MCP File Server is running.");
});

// Protect the existing MCP endpoint
app.post("/mcp", bearerAuth, async (req, res) => {
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

// This server uses stateless POST requests for MCP
app.get("/mcp", (_req, res) => {
  res.status(405).end();
});

app.delete("/mcp", (_req, res) => {
  res.status(405).end();
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`MCP File Server running on port ${PORT}`);
  console.log(`Workspace: ${WORKSPACE}`);
  console.log(`OAuth issuer: ${issuerUrl.origin}`);
});