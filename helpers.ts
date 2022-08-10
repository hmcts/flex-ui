import { existsSync, mkdirSync } from "fs"
import { readdir } from "fs/promises"
import { resolve } from "path"
import fuzzy from "fuzzy"

/**
 * Ensures a path exists by creating its parent directories and then itself
 * @param {String} dir Path to a folder that may or may not exist
 */
export function ensurePathExists(dir: string) {
  const normalized = dir.replace(/\\/g, '/')
  const parts = normalized.split('/')
  let builder = ''
  for (const element of parts) {
    const dirPart = element
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

export function deduplicateAddFields<T>(to: T[], from: T[], keys: (keyof (T))[]) {
  for (const obj of from) {
    const existing = to.find(o => matcher(o, obj, keys))
    if (existing) continue
    to.push(obj)
  }
}

export function findMissing<T>(to: T[], from: T[], keys: (keyof (T))[]) {
  const missing: T[] = []
  for (const obj of from) {
    const existingIndex = to.findIndex(o => matcher(o, obj, keys))
    if (existingIndex === -1) {
      missing.push(obj)
    }
  }
  return missing
}


export function upsertFields<T>(to: T[], from: T[], keys: (keyof (T))[], spliceIndexFn?: (obj: T, arr: T[]) => number) {
  for (const obj of from) {
    const existingIndex = to.findIndex(o => matcher(o, obj, keys))
    if (existingIndex === -1) {
      if (spliceIndexFn) {
        const chosenIndex = spliceIndexFn(obj, to)
        to.splice(chosenIndex, 0, obj)
      } else {
        to.push(obj)
      }
      continue
    }
    to.splice(existingIndex, 1, obj)
  }
}

export function findMissingItems<T>(superlist: T[], list: T[], keys: (keyof (T))[]) {
  const missing = []
  for (const obj of list) {
    const existing = superlist.find(o => matcher(o, obj, keys))
    if (existing) continue
    missing.push(obj)
  }
  return missing
}

export function matcher<T>(item1: T, item2: T, keys: (keyof (T))[]) {
  for (const key of keys) {
    if (item1[key] !== item2[key]) {
      return false
    }
  }
  return true
}

export function findLastIndex<T>(arr: T[], predicate: (value: T, index: number, obj: T[]) => unknown) {
  const reversed = [...arr].reverse()
  const indexReversed = reversed.findIndex(predicate)

  return arr.length - indexReversed - 1
}

export function format(template: string, ...args: (string | number)[]) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    template = template.replace(new RegExp(`\\{${i}\\}`, 'g'), String(arg))
  }

  return template
}