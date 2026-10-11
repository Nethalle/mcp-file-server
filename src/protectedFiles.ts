
import path from "node:path";

const PROTECTED_FILES = new Set([
  "project_state.md",
  "plan_log.md",
  "decisions.md",
  "agents.md"
]);

/**
 * Throws if the target is a protected handoff file.
 * The basename check is case-insensitive.
 */
export function assertNotProtectedFile(filePath: string): void {
  const fileName = path.basename(filePath).toLowerCase();

  if (PROTECTED_FILES.has(fileName)) {
    throw new Error(
      `Modifications to ${path.basename(filePath)} are blocked by the handoff-file protection policy.`
    );
  }
}
