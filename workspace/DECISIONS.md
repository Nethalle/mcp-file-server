# Decision Log

## Decision 1: Use OAuth Authentication

**Decision:** Use OAuth authorization and bearer-token protection for remote MCP requests.

**Reason:** OAuth allows an MCP-compatible client to authorize access through a standard sign-in flow.

**Status:** Implemented and tested with Claude Desktop.

## Decision 2: Use Streamable HTTP Transport

**Decision:** Expose the MCP server through the `/mcp` endpoint using Streamable HTTP.

**Reason:** Remote clients can communicate with the server over HTTP.

**Status:** Implemented and tested.

## Decision 3: Restrict File Operations to the Workspace

**Decision:** Agents should only access files inside the configured workspace.

**Reason:** Workspace restrictions reduce the risk of unauthorized file access and path traversal.

**Status:** Implementation exists; security tests still need verification.

## Decision 4: Store OAuth Data Separately

**Decision:** Store local OAuth records in `data/oauth.json` and exclude that file from Git.

**Reason:** Local authentication records must not be published with source code.

**Status:** Git ignore rule added and verified.

## Decision 5: Maintain Handoff Documentation

**Decision:** Use PROJECT_STATE.md, PLAN_LOG.md, DECISIONS.md, and CHECKPOINTS/ to preserve progress between agent sessions.

**Reason:** Structured handoff information helps agents continue work without repeating completed steps.

**Status:** In progress.
