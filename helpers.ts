import { ChildProcess, exec, ExecException } from "child_process"
import { Dirent, existsSync, mkdirSync, readFileSync } from "fs"
import { readdir } from "fs/promises"
import { EOL } from "os"
import { resolve, sep } from "path"

/**
 * Ensures a path exists by creating its parent directories and then itself
 * @param {String} dir Path to a folder that may or may not exist
 */
export function ensurePathExists(dir: string) {
  const normalized = dir.replace(/\\/g, '/')
  const parts = normalized.split('/')
  let builder = ''
  for (const element of parts) {
    builder += element + '/'
    if (!existsSync(builder)) {
      mkdirSync(builder)
    }
  }
}

/**
 * Recursively reads files in a directory. Returns as an array of files relative to the start dir
 */
export async function getFiles(dir: string): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true })
  const files: unknown[] = await Promise.all(dirents.map((dirent: Dirent) => {
    const res = resolve(dir, dirent.name)
    return dirent.isDirectory() ? getFiles(res) : res
  }))
  return Array.prototype.concat(...files)
}

/**
 * Finds items present in "list" and missing in "sublist"
 * @param list array with all items
 * @param sublist array to check parity with
 * @param keys list of keys whose values must be equal on both objects to qualify as unique
 * @returns an array of items present in list but missing in sublist
 */
export function findMissing<T>(list: T[], sublist: T[], keys: (keyof (T))[]) {
  const missing: T[] = []
  for (const obj of sublist) {
    const existingIndex = list.findIndex(o => matcher(o, obj, keys))
    if (existingIndex === -1) {
      missing.push(obj)
    }
  }
  return missing
}

/**
 * Adds or updates objects in the "to" array if they are new or changed in "from" array
 * @param to array to update
 * @param from array to take from
 * @param keys list of keys whose values must be equal on both objects to qualify as unique
 * @param spliceIndexFn function to get the correct index to splice new items in at
 */
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

/**
 * Determines similarity between two items based on their keys matching
 * @param item1 first object
 * @param item2 second object
 * @param keys an array of keys that must match on both objects to be considered the same
 * @returns true if all keys on both objects match
 */
export function matcher<T>(item1: T, item2: T, keys: (keyof (T))[]) {
  for (const key of keys) {
    if (item1[key] !== item2[key]) {
      return false
    }
  }
  return true
}

/**
 * finds the last index where a predicate is true
 */
export function findLastIndex<T>(arr: T[], predicate: (value: T, index: number, obj: T[]) => unknown) {
  const reversed = [...arr].reverse()
  const indexReversed = reversed.findIndex(predicate)

  return arr.length - indexReversed - 1
}

/**
 * Similar to string.format in C#. Extends template literals by resolving their values at time of call
 */
export function format(template: string, ...args: (string | number)[]) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    template = template.replace(new RegExp(`\\{${i}\\}`, 'g'), String(arg))
  }

  return template
}

/**
 * Read environment variables from the ecm-ccd-docker/compose/.env and bin/env_variables_all.txt
 */
export function getEnvVarsfromFile(): Record<string, string> {
  const dotEnv = `${process.env.ECM_DOCKER_DIR}${sep}compose${sep}.env`
  const envAll = `${process.env.ECM_DOCKER_DIR}${sep}bin${sep}env_variables_all.txt`

  const dotEnvContents = readFileSync(dotEnv, 'utf-8')
  const envAllContents = readFileSync(envAll, 'utf-8')

  return `${dotEnvContents}${EOL}${envAllContents}`
    .split(EOL)
    .filter(o => o)
    .reduce((acc, obj) => {
      const regex = /(.+?)=(.+)/.exec(obj)
      if (!regex) return acc
      acc[regex[1]] = regex[2]
      return acc
    }, {})
}

/**
 * Executes a command in a child process. Waits until the child has exited
 * @returns an object with stdout, stderr and the exit code
 */
export function execCommand(command: string, cwd?: string, rejectOnNonZeroExitCode = true): Promise<{ err: ExecException | null, stdout: string, stderr: string, code: number }> {
  return new Promise((resolve, reject) => {
    const env = getEnvVarsfromFile()
    const child: ChildProcess = exec(command, { cwd, env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      const out = { err, stdout, stderr, code: child.exitCode || 0 }
      if (rejectOnNonZeroExitCode && child.exitCode && child.exitCode > 0) {
        return reject(out)
      }
      return resolve(out)
    })
  })
}

/**
 * Gets a record of unique items in an array given an array of keys to match
 */
export function getUniqueByKey<T>(arr: T[], key: keyof (T)) {
  return arr.reduce((acc: Record<string, number>, obj: T) => {
    const accKey = String(obj[key])
    if (!acc[accKey]) {
      acc[accKey] = 0
    }
    acc[accKey]++
    return acc
  }, {} as Record<string, number>)
}

/**
 * Calls getUniqueByKey but returns as an array instead of an object
 */
export function getUniqueByKeyAsArray<T>(arr: T[], key: keyof (T)) {
  return Object.keys(getUniqueByKey(arr, key))
}

/** Clears the current terminal line and writes a new message with no ending newline */
export function temporaryLog(message: string) {
  clearCurrentLine()
  process.stdout.write(`${new Date().toLocaleTimeString()} || ${message}`)
}

/** Clears the current line by sending a special character command */
export function clearCurrentLine() {
  process.stdout.write('\r\x1b[K')
}

/** Gets height of terminal minus a couple of lines for the question and answer */
export function getIdealSizeForInquirer() {
  return process.stdout.rows - 2
}