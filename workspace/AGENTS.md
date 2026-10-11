# Agent Handoff Protocol

## Purpose
This file defines how an AI agent should work on this project and hand off progress to the next session.

## Before Starting Work
1. Read `PROJECT_STATE.md` to understand the current project status.
2. Read `PLAN_LOG.md` for completed work and planned tasks.
3. Read `DECISIONS.md` before changing architecture or project conventions.
4. Review relevant files in `CHECKPOINTS/` when continuing an earlier task.
5. Inspect the current Git status before making changes.

## Working Rules
- Work only within the configured workspace unless explicitly authorized otherwise.
- Do not read, expose, or commit secrets.
- Inspect existing files before modifying them.
- Make focused changes that match the current plan.
- Do not claim a feature or security test works until it has been verified.
- Preserve unrelated files and user changes.
- Ask for confirmation before destructive operations when required by the tool's safety rules.
- Record important discoveries, decisions, and unfinished work.

## Before Ending a Session
1. Summarize what was completed and what remains.
2. Update `PROJECT_STATE.md` with the current status and next steps.
3. Add meaningful progress to `PLAN_LOG.md`.
4. Record architectural or workflow decisions in `DECISIONS.md`.
5. Add a checkpoint in `CHECKPOINTS/` when it will help the next session resume work.
6. Check Git status and report any uncommitted changes.

## Security Verification
- Test path traversal and symlink protections before marking sandbox security as verified.
- Verify file-size limits and protected-file rules before claiming they are enforced.
- Verify delete confirmation behavior before claiming destructive operations are protected.
- Verify tool-call logging before claiming every call is recorded.
- Never include access tokens, passwords, OAuth credentials, or other secrets in handoff files.