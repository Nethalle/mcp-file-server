
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

// Only allow file operations inside the project's workspace folder.
export const WORKSPACE = path.resolve(
  currentDirectory,
  "../workspace"
);

export async function resolveSafePath(
  userPath: string
): Promise<string> {
  if (
    userPath.includes("\0") ||
    path.isAbsolute(userPath) ||
    /^[a-zA-Z]:/.test(userPath) ||
    userPath.startsWith("\\\\") ||
    userPath.split(/[\\/]+/).includes("..")
  ) {
    throw new Error(
      "Unsafe path. Use a path inside workspace."
    );
  }

  await fs.mkdir(WORKSPACE, { recursive: true });

  const root = await fs.realpath(WORKSPACE);
  const target = path.resolve(root, userPath || ".");

  const isInside = (candidate: string): boolean => {
    const relative = path.relative(root, candidate);

    return (
      relative === "" ||
      (!relative.startsWith("..") &&
        !path.isAbsolute(relative))
    );
  };

  if (!isInside(target)) {
    throw new Error("Path is outside the workspace.");
  }

  let existing = target;

  while (true) {
    try {
      const realExisting = await fs.realpath(existing);

      if (!isInside(realExisting)) {
        throw new Error(
          "Symlink escapes the workspace."
        );
      }

      break;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Symlink escapes the workspace."
      ) {
        throw error;
      }

      const parent = path.dirname(existing);

      if (parent === existing) {
        throw new Error("Unable to resolve safe path.");
      }

      existing = parent;
    }
  }

  return target;
}