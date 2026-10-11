# MCP File Server

An MCP (Model Context Protocol) file-server connector that provides file-management tools through Streamable HTTP transport, OAuth authentication, and support for multi-agent workflows.

## Features

- **MCP over HTTP:** Exposes MCP tools through the Streamable HTTP transport.
- **OAuth authentication:** Supports OAuth-based client authorization and bearer-token protection for MCP requests.
- **File management:** Provides tools for listing, reading, writing, replacing, and deleting files.
- **Search:** Supports searching files in the workspace.
- **Git integration:** Provides tools for checking Git status, viewing diffs, and reading commit history.
- **Workspace configuration:** Uses environment variables to configure the workspace and server.
- **Process management:** Can run under PM2 for process monitoring and restart management.

## Available Tools

The server currently exposes these MCP tools:

| Tool | Purpose |
|---|---|
| `list_files` | List files in the workspace |
| `read_file` | Read a file |
| `write_file` | Write file contents |
| `str_replace` | Replace text in a file |
| `delete_file` | Delete a file |
| `search` | Search workspace content |
| `git_status` | Check Git status |
| `git_diff` | View Git changes |
| `git_log` | View Git commit history |

## Requirements

- Node.js and npm
- Git
- ngrok for exposing the local server through HTTPS
- An MCP-compatible client that supports remote connections and OAuth

## Installation

Clone the repository and open the project directory:

```bash
git clone <YOUR_REPOSITORY_URL>
cd mcp-file-server
npm install
```

Replace `<YOUR_REPOSITORY_URL>` with your actual repository URL.

## Environment Configuration

Create a local `.env` file using `.env.example` as a reference.

Configure the variables required by your implementation:

```dotenv
PORT=3000
WORKSPACE_ROOT=./workspace
BASE_URL=https://your-ngrok-domain.ngrok-free.dev
OWNER_PASSWORD=replace-with-a-strong-random-password
DATA_DIR=./data
```

These are example values, not production credentials. Use your actual public HTTPS URL for `BASE_URL` in your local `.env` configuration.

Never commit `.env`, real passwords, access tokens, refresh tokens, or other credentials.

## Run Locally

Start the development server:

```bash
npm run dev
```

Build the TypeScript project:

```bash
npm run build
```

Start the compiled server:

```bash
npm start
```

## OAuth Authentication

The server uses OAuth to authorize MCP clients.

The general authorization flow is:

1. The MCP client discovers the server's OAuth metadata.
2. The client registers or identifies its OAuth client.
3. The user completes the authorization and consent flow.
4. The client obtains an access token.
5. The client sends authorized MCP requests using a bearer token.

The MCP endpoint is:

```text
https://your-ngrok-domain.ngrok-free.dev/mcp
```

Replace the example domain with your configured public HTTPS URL.

OAuth metadata endpoints include:

```text
/.well-known/oauth-authorization-server
/.well-known/oauth-protected-resource/mcp
```

The MCP endpoint requires valid bearer-token authorization.

## PM2 Deployment

After building the project, you can run the compiled server using PM2:

```bash
pm2 start dist/index.js --name mcp-files
pm2 status
pm2 logs mcp-files
```

After rebuilding, restart the process:

```bash
pm2 restart mcp-files
```

The server's public HTTPS access also depends on the ngrok tunnel being available and correctly configured.

## Security Notes

- Keep `.env` out of version control.
- Keep `data/oauth.json` private because it may contain OAuth client records, authorization data, and token-related records.
- Do not publish OAuth access tokens, refresh tokens, passwords, or ngrok authentication tokens.
- Keep file operations restricted to the configured workspace.
- Test path traversal protections and file-operation safeguards before relying on the server in production.
- Use strong credentials and review access controls before exposing the server publicly.

## Project Status

This project includes MCP tools, Streamable HTTP transport, OAuth authentication, and remote-client connectivity.

Additional security testing, deployment verification, and project documentation should be completed as development continues.
