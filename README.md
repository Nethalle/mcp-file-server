# MCP File Server

A remote **Model Context Protocol (MCP)** file-server connector. It lets authorized AI agents list, read, write, edit and search files in a restricted workspace, and inspect the project's Git state, over **Streamable HTTP** with **OAuth** authorization. A handoff protocol stored in the workspace lets several agent sessions continue the same project.

> Course project: *Midterms Pt 1: Build Your Own* (BSCS-3B, Model Context Protocol).

---

## Table of contents

1. [Project status](#1-project-status)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Tech stack](#4-tech-stack)
5. [Repository layout](#5-repository-layout)
6. [Prerequisites](#6-prerequisites)
7. [Installation](#7-installation)
8. [Configuration](#8-configuration)
9. [Running the server](#9-running-the-server)
10. [Tools reference](#10-tools-reference)
11. [OAuth authentication](#11-oauth-authentication)
12. [Connecting a client](#12-connecting-a-client)
13. [Deployment with ngrok and PM2](#13-deployment-with-ngrok-and-pm2)
14. [Agent handoff protocol](#14-agent-handoff-protocol)
15. [Security safeguards](#15-security-safeguards)
16. [Tool-call logging](#16-tool-call-logging)
17. [Testing and verification](#17-testing-and-verification)
18. [Known limitations](#18-known-limitations)
19. [Troubleshooting](#19-troubleshooting)
20. [Design decisions](#20-design-decisions)
21. [Future work](#21-future-work)
22. [Author and license](#22-author-and-license)

---

## 1. Project status

| Milestone | Status | Summary |
|---|---|---|
| M1 | Completed (October 9, 2026) | Basic MCP server and initial file tools |
| M2 | Completed (October 9, 2026) | Core file tools and workspace sandbox protections. Targeted path traversal tests passed; symlink verification is incomplete |
| M3 | Completed (October 11, 2026) | OAuth-protected remote connection tested with Claude Desktop; server runs under PM2 behind an ngrok tunnel |
| M4 | Completed (October 11, 2026) | Handoff protocol, protected-file rules, file-size limits, delete confirmation and tool-call logging |
| M5 | In progress | Final documentation and repository review for submission |

Verification evidence for M4 is recorded in [`workspace/CHECKPOINTS/M4-verification.md`](workspace/CHECKPOINTS/M4-verification.md) (commit `193912d`).

---

## 2. Features

- **MCP over HTTP:** MCP tools are served through the Streamable HTTP transport at `/mcp`.
- **OAuth authentication:** Clients are authorized through OAuth, and MCP requests are protected with bearer tokens. This replaced the original static `AUTH_TOKEN` design.
- **File management:** list, read, write, replace text in, and delete files.
- **Search:** search workspace content.
- **Git integration:** status, diff and commit history.
- **Workspace sandbox:** file operations are restricted to the configured workspace.
- **Safeguards:** protected handoff files, a 1 MiB write limit, and delete confirmation.
- **Logging:** each tool call is logged without recording argument values.
- **Agent handoff:** `PROJECT_STATE`, `PLAN_LOG`, `DECISIONS`, `AGENTS` and `CHECKPOINTS/` preserve progress between sessions.
- **Process management:** runs under PM2 for monitoring and automatic restart.

---

## 3. Architecture

```
 MCP client (tested with Claude Desktop)
        │
        │  MCP over Streamable HTTP
        │  Authorization: Bearer <access token>
        ▼
 https://<your-domain>.ngrok-free.dev        ngrok tunnel
        │
        ▼
 PM2 process (mcp-files)
        │
 ┌──────▼─────────────────────────────────────────────┐
 │ Node.js + TypeScript server (Express)              │
 │                                                    │
 │  OAuth        discovery, registration, consent,    │
 │               token issue, bearer verification     │
 │  MCP          Streamable HTTP transport at /mcp    │
 │  Tools        file, search and git tools           │
 │  Safeguards   sandbox, protected files, size limit │
 │  Logging      calls.log                            │
 └──────┬──────────────────────────┬──────────────────┘
        │                          │
        ▼                          ▼
 workspace/  (agent-visible)    data/oauth.json  (server-private,
   AGENTS.md                      excluded from Git)
   PROJECT_STATE.md
   PLAN_LOG.md
   DECISIONS.md
   CHECKPOINTS/
```

### Request flow

1. The client sends an MCP request to `/mcp`.
2. Without a valid bearer token, the server rejects it and the client starts OAuth discovery.
3. The client discovers the server's OAuth metadata and registers or identifies its OAuth client.
4. The user completes the authorization and consent step.
5. The client obtains an access token.
6. The client sends authorized MCP requests with the bearer token.
7. For each tool call, the server validates the input, applies the sandbox and safeguard checks, runs the operation, and writes a log entry.

---

## 4. Tech stack

| Layer | Choice |
|---|---|
| Runtime and language | Node.js and TypeScript |
| Web framework | Express |
| Protocol | Model Context Protocol, Streamable HTTP transport |
| Authentication | OAuth with bearer-token protection |
| Exposure | ngrok HTTPS tunnel |
| Process manager | PM2 |
| Version control | Git, hosted on GitHub |
| Testing | `npm run build`, targeted tests, live MCP calls from a real client |

---

## 5. Repository layout

```
mcp-file-server/
├─ src/                 TypeScript source (server, OAuth, tools, safeguards)
├─ workspace/           Agent sandbox (WORKSPACE_ROOT)
│  ├─ AGENTS.md
│  ├─ PROJECT_STATE.md
│  ├─ PLAN_LOG.md
│  ├─ DECISIONS.md
│  └─ CHECKPOINTS/
│     └─ M4-verification.md
├─ data/                OAuth records (DATA_DIR), excluded from Git
├─ calls.log            Tool-call log (repository root)
├─ .env.example         Template for local configuration
├─ .gitignore
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 6. Prerequisites

- Node.js and npm
- Git
- An ngrok account with a static domain
- PM2 (`npm install -g pm2`)
- An MCP client that supports remote servers and OAuth

---

## 7. Installation

```bash
git clone <YOUR_REPOSITORY_URL>
cd mcp-file-server
npm install
```

Create your local configuration from the template:

```bash
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
```

Then edit `.env` as described in the next section.

---

## 8. Configuration

Configuration is read from environment variables.

| Variable | Example | Description |
|---|---|---|
| `PORT` | `3000` | Local port the server listens on |
| `WORKSPACE_ROOT` | `./workspace` | The directory agents are allowed to work in |
| `BASE_URL` | `https://your-ngrok-domain.ngrok-free.dev` | Public HTTPS origin of the server. Use your actual ngrok domain, with no trailing slash and no `/mcp` |
| `OWNER_PASSWORD` | *(strong random value)* | Password used when authorizing a client |
| `DATA_DIR` | `./data` | Where local OAuth records (`oauth.json`) are stored |

These are example values, not real credentials. Generate a strong password with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Rules**

- Never commit `.env`, passwords, access or refresh tokens, OAuth credentials, or ngrok auth tokens.
- `data/oauth.json` is listed in `.gitignore`.
- After changing `.env`, restart with `pm2 restart mcp-files --update-env`.

---

## 9. Running the server

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |

For normal operation, use PM2 (see [section 13](#13-deployment-with-ngrok-and-pm2)).

---

## 10. Tools reference

The server exposes nine tools.

| Tool | Purpose | Notes |
|---|---|---|
| `list_files` | List files and folders in the workspace | Used for live smoke tests |
| `read_file` | Read a file | |
| `write_file` | Create or overwrite a file | 1 MiB limit; blocked on protected handoff files |
| `str_replace` | Replace text in a file | 1 MiB limit; allowed on `PROJECT_STATE.md` and `DECISIONS.md`; blocked on `PLAN_LOG.md` and `AGENTS.md` |
| `delete_file` | Delete a file | Requires explicit confirmation; blocked on protected handoff files even when confirmed |
| `search` | Search workspace content | |
| `git_status` | Show the repository's Git status | |
| `git_diff` | Show uncommitted changes | |
| `git_log` | Show commit history | |

Every tool is subject to the workspace sandbox and is recorded in the tool-call log.

The file tools work with text. Binary files (for example `.pptx` or images) are not supported.

---

## 11. OAuth authentication

The server uses OAuth to authorize MCP clients, replacing the original static `AUTH_TOKEN` design.

### Flow

1. The MCP client discovers the server's OAuth metadata.
2. The client registers or identifies its OAuth client.
3. The user completes the authorization and consent flow.
4. The client obtains an access token.
5. The client sends MCP requests with a bearer token.

### Endpoints

| Endpoint | Purpose |
|---|---|
| `/mcp` | MCP endpoint; requires valid bearer-token authorization |
| `/.well-known/oauth-authorization-server` | OAuth authorization server metadata |
| `/.well-known/oauth-protected-resource/mcp` | Protected-resource metadata for `/mcp` |

The public MCP URL is:

```text
https://<your-ngrok-domain>/mcp
```

### Storage

OAuth client records and token-related data are kept in `data/oauth.json`. This file is excluded from Git and must stay private.

### Check discovery

```bash
curl https://<your-ngrok-domain>/.well-known/oauth-authorization-server
curl https://<your-ngrok-domain>/.well-known/oauth-protected-resource/mcp
```

---

## 12. Connecting a client

The connection has been **tested with Claude Desktop**: MCP initialization, tool listing and live `list_files` calls succeeded over the OAuth-protected endpoint. Other MCP clients that support remote Streamable HTTP servers and OAuth should work but have not been tested.

### Claude (custom connector)

1. Open the connector settings and add a custom connector.
2. Enter a name and the URL `https://<your-ngrok-domain>/mcp`.
3. Click connect, then complete the authorization page served by your server.
4. Enable the connector in a chat and ask Claude to list the workspace files.

### Other clients

Use the same `/mcp` URL and complete the OAuth flow when prompted.

---

## 13. Deployment with ngrok and PM2

### Start the tunnel

```bash
ngrok http --url=<your-static-domain>.ngrok-free.dev 3000
```

The public HTTPS access depends on the tunnel being available and correctly configured.

### Run under PM2

```bash
npm run build
pm2 start dist/index.js --name mcp-files
pm2 status
pm2 logs mcp-files
```

After rebuilding:

```bash
pm2 restart mcp-files
```

After changing `.env`:

```bash
pm2 restart mcp-files --update-env
```

Start PM2 from the project folder so relative paths such as `./workspace` and `./data` resolve correctly.

---

## 14. Agent handoff protocol

Agents carry no memory between sessions, so progress is stored in the workspace. The protocol is defined in `workspace/AGENTS.md`.

### Handoff files

| File | Purpose | MCP tool access |
|---|---|---|
| `AGENTS.md` | Rules and handoff protocol for agents | `write_file`, `delete_file` and `str_replace` blocked |
| `PROJECT_STATE.md` | Goal, milestone status, verification results, limitations, next steps | `str_replace` allowed; `write_file` and `delete_file` blocked |
| `PLAN_LOG.md` | Chronological record of completed work and plans | `write_file`, `delete_file` and `str_replace` blocked |
| `DECISIONS.md` | Architecture and workflow decisions with reasons | `str_replace` allowed; `write_file` and `delete_file` blocked |
| `CHECKPOINTS/` | Session summaries (for example `M4-verification.md`) | Not one of the protected files |

`PLAN_LOG.md` and `AGENTS.md` are protected from changes made through MCP tools, so they are updated directly in the repository by the project owner.

### Before starting work

1. Read `PROJECT_STATE.md`.
2. Read `PLAN_LOG.md`.
3. Read `DECISIONS.md` before changing architecture or conventions.
4. Review relevant files in `CHECKPOINTS/` when continuing earlier work.
5. Inspect the Git status before making changes.

### Working rules

- Work only within the configured workspace.
- Do not read, expose or commit secrets.
- Inspect existing files before modifying them.
- Make focused changes that match the plan.
- Do not claim a feature or security test works until it has been verified.
- Preserve unrelated files and user changes.
- Ask for confirmation before destructive operations.

### Before ending a session

1. Summarize what was completed and what remains.
2. Update `PROJECT_STATE.md` with the status and next steps.
3. Record decisions in `DECISIONS.md`.
4. Add a checkpoint in `CHECKPOINTS/` when it will help the next session.
5. Check Git status and report any uncommitted changes.

---

## 15. Security safeguards

| Safeguard | Description | Verification status |
|---|---|---|
| OAuth and bearer tokens | `/mcp` requires authorization | Tested with Claude Desktop |
| Workspace sandbox | File operations are restricted to `WORKSPACE_ROOT` | Targeted traversal cases rejected; see limitations |
| Protected handoff files | Rules in [section 14](#14-agent-handoff-protocol) | Handler tests passed |
| File-size limit | `write_file` and `str_replace` enforce a 1 MiB limit | Tests passed |
| Delete confirmation | `delete_file` requires explicit confirmation | Tested; handoff files stay protected even when confirmed |
| Tool-call logging | Metadata only, no argument values | Verified with live calls |
| Secrets handling | Configuration through environment variables; `.env` and `data/oauth.json` excluded from Git | Git ignore rule added and verified |
| Separate OAuth storage | OAuth records live in `data/`, outside the workspace | Implemented |

### Operational guidance

- Keep `.env` and `data/oauth.json` private.
- Do not publish tokens, passwords, OAuth credentials or ngrok auth tokens.
- Use a strong `OWNER_PASSWORD`.
- Review Git changes for secrets before every commit.
- Do not run destructive tests against the real handoff files.

---

## 16. Tool-call logging

Each tool call is written to `calls.log` in the repository root. An entry records:

- timestamp
- tool name
- argument **keys**
- outcome

Argument **values** are not recorded, so file contents, paths and credentials do not end up in the log. This was verified with fresh live `list_files` calls through Claude Desktop.

---

## 17. Testing and verification

### Recorded results (M4, October 11, 2026)

| Check | Result |
|---|---|
| `npm run build` | Passed |
| Direct path traversal tests | Tested unsafe paths rejected |
| Protected-file helper tests | Passed |
| Real `str_replace` handler tests | `PROJECT_STATE.md` and `DECISIONS.md` pass the check; `PLAN_LOG.md` and `AGENTS.md` are blocked |
| Real `write_file` and `delete_file` handler tests | `AGENTS.md` protected, including when delete confirmation is true |
| File-size limit tests | Passed for `write_file` and `str_replace` |
| Delete confirmation | Verified |
| Live MCP `list_files` calls | Succeeded through Claude Desktop |
| Tool-call logging | Verified from `calls.log` |
| `git diff --check` | No errors |
| Repository state | Committed and pushed; `main` matched `origin/main` with a clean working tree |

### Commands

```bash
npm run build
git diff --check
git status
```

### Manual checks

1. Send an unauthenticated request and confirm it is rejected:
   ```bash
   curl -i -X POST https://<your-ngrok-domain>/mcp
   ```
2. Fetch both `.well-known` metadata URLs.
3. Connect a client, complete OAuth, and list the workspace files.
4. Check that `calls.log` gained an entry without argument values.
5. Run `pm2 restart mcp-files` and confirm the client still works.

---

## 18. Known limitations

- **Symlink security is not fully verified.** The required Windows test needed elevated permissions and could not be completed.
- **Safe handling of symlinks inside the workspace is not fully verified.**
- **Race conditions are untested.** Time-of-check/time-of-use behavior needs further testing.
- Passing the tested path traversal cases does **not** prove that every possible sandbox escape has been prevented.
- Only Claude Desktop has been tested as an MCP client.
- File tools are text-only.
- `data/oauth.json` is a local file store suited to a single-owner deployment.

---

## 19. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Client cannot register or authorize | Check that `BASE_URL` is the exact public HTTPS origin, then fetch both `.well-known` URLs with `curl` |
| `401` from `/mcp` | Missing or expired token; reconnect the client |
| Works, then fails after a restart | PM2 started from a different folder, or `DATA_DIR` is not the same location as before |
| Changed `.env` but nothing changed | Run `pm2 restart mcp-files --update-env` |
| Public URL not reachable | Confirm the ngrok tunnel is running with the right domain and port |
| Browser warning page from ngrok | Click through it; common on free domains |
| `write_file` or `delete_file` refused on a handoff file | Expected; see the protection table in [section 14](#14-agent-handoff-protocol) |
| Write refused for size | The 1 MiB limit applies to `write_file` and `str_replace` |
| Cannot save a `.pptx` or image | File tools are text-only |

---

## 20. Design decisions

| Decision | Reason | Status |
|---|---|---|
| Use OAuth authentication | Standard sign-in flow for MCP-compatible clients | Implemented; tested with Claude Desktop |
| Use Streamable HTTP at `/mcp` | Remote clients can communicate over HTTP | Implemented and tested |
| Restrict file operations to the workspace | Reduces the risk of unauthorized file access and path traversal | Implemented; verification incomplete (see limitations) |
| Store OAuth data in `data/oauth.json`, excluded from Git | Authentication records must not be published | Ignore rule added and verified |
| Maintain handoff documentation | Lets agents continue without repeating work | Implemented in M4 |
| Protect handoff files from write and delete | Prevents accidental loss of project records | Implemented and tested |
| Log metadata only | Avoids storing file contents or credentials in logs | Implemented and verified |

---

## 21. Future work

- Complete symlink and time-of-check/time-of-use testing, then update the limitations section.
- Add `if_version` locking so two agents cannot silently overwrite each other.
- Add `search_code` and a generated repository map.
- Add a guarded `git_commit` tool.
- Add a size-capped binary write tool.
- Test additional MCP clients.
- Add automated tests for the OAuth flow and the tools.

---

## 22. Author and license

- **Author:** *Fedoc, Cyrene Nathalie B.*
- **Course:** BSCS-3B, Model Context Protocol
- **License:** *For coursework use only"*
