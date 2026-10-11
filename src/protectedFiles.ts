
import path from "node:path";

const PROTECTED_FILES = new Set([
  "project_state.md",
  "plan_log.md",
  "decisions.md",
  "agents.md"
]);

const REPLACE_BLOCKED_FILES = new Set([
  "plan_log.md",
  "agents.md"
]);

function getFileName(filePath: string): string {
  return path.basename(filePath).toLowerCase();
}

/**
 * Blocks write_file and delete_file from modifying handoff files.
 */
export function assertNotProtectedFile(filePath: string): void {
  const fileName = getFileName(filePath);

  if (PROTECTED_FILES.has(fileName)) {
    throw new Error(
      `Modifications to ${path.basename(filePath)} are blocked by the handoff-file protection policy.`
    );
  }
}

/**
 * Allows str_replace on PROJECT_STATE.md and DECISIONS.md,
 * while keeping PLAN_LOG.md and AGENTS.md protected.
 */
export function assertStrReplaceAllowed(filePath: string): void {
  const fileName = getFileName(filePath);

  if (REPLACE_BLOCKED_FILES.has(fileName)) {
    throw new Error(
      `str_replace is blocked for ${path.basename(filePath)} by the handoff-file protection policy.`
    );
  }
}
