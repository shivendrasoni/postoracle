import path from "path";
import fs from "fs/promises";

const VAULT_ROOT = path.resolve(process.cwd(), "../vault");

export function resolveVaultPath(...segments: string[]): string {
  const resolved = path.resolve(VAULT_ROOT, ...segments);
  if (!resolved.startsWith(VAULT_ROOT)) {
    throw new Error("Path traversal attempt blocked");
  }
  return resolved;
}

export async function readVaultFile(relativePath: string): Promise<string> {
  const fullPath = resolveVaultPath(relativePath);
  return fs.readFile(fullPath, "utf-8");
}

export async function readVaultJson<T>(relativePath: string): Promise<T> {
  const content = await readVaultFile(relativePath);
  return JSON.parse(content) as T;
}

export async function listVaultDir(
  relativePath: string
): Promise<{ name: string; isDirectory: boolean }[]> {
  const fullPath = resolveVaultPath(relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export async function vaultPathExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(resolveVaultPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function buildFileTree(
  relativePath: string,
  depth: number = 3
): Promise<import("./types").VaultFile[]> {
  if (depth <= 0) return [];
  const entries = await listVaultDir(relativePath);
  const tree: import("./types").VaultFile[] = [];

  for (const entry of entries) {
    const entryPath = path.join(relativePath, entry.name);
    const node: import("./types").VaultFile = {
      name: entry.name,
      path: entryPath,
      type: entry.isDirectory ? "directory" : "file",
    };
    if (entry.isDirectory) {
      node.children = await buildFileTree(entryPath, depth - 1);
    }
    tree.push(node);
  }
  return tree;
}
