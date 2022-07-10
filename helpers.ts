import { existsSync, mkdirSync } from "fs"
import { readdir } from "fs/promises"
import { resolve } from "path"

/**
 * Ensures a path exists by creating its parent directories and then itself
 * @param {String} dir Path to a folder that may or may not exist
 */
 export function ensurePathExists(dir: string) {
  const normalized = dir.replace(/\\/g, '/')
  const parts = normalized.split('/')
  let builder = ''
  for (let i = 0; i < parts.length; i++) {
    const dirPart = parts[i]
    builder += dirPart + '/'
    if (!existsSync(builder)) {
      mkdirSync(builder)
    }
  }
}

export async function getFiles(dir: string) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files: any[] = await Promise.all(dirents.map((dirent: any) => {
    const res = resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}
