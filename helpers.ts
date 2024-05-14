import { ChildProcess, exec, ExecException } from 'child_process'
import { Dirent, existsSync, mkdirSync, readFileSync } from 'fs'
import { readdir } from 'fs/promises'
import fetch from 'node-fetch'
import { EOL } from 'os'
import { resolve, sep } from 'path'

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
  if (!existsSync(dir)) {
    return []
  }
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
export function findMissing<T>(list: T[], sublist: T[], keys: Array<keyof (T)>) {
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
 * @param keys list of keys whose values must be equal on both objects to qualify as the same
 * @param spliceIndexFn function to get the correct index to splice new items in at
 */
export function upsertFields<T>(to: T[], from: T[], keys: Array<keyof (T)>, spliceIndexFn?: (obj: T, arr: T[]) => number) {
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
 * Removes objects from "main" that are specified in "toDelete" if they match by "keys"
 * @param main array to update
 * @param toDelete instructions on what to delete
 * @param keys list of keys whose values must be equal on both objects to qualify as the same
 */
export function removeFields<T>(main: T[], toDelete: T[], keys: Array<keyof (T)>) {
  if (!toDelete) return
  for (const obj of toDelete) {
    const existingIndex = main.findIndex(o => matcher(o, obj, keys))
    if (existingIndex === -1) continue
    main.splice(existingIndex, 1)
  }
}

/**
 * Determines similarity between two items based on their keys matching
 * @param item1 first object
 * @param item2 second object
 * @param keys an array of keys that must match on both objects to be considered the same
 * @returns true if all keys on both objects match
 */
export function matcher<T>(item1: T, item2: T, keys: Array<keyof (T)>) {
  for (const key of keys) {
    if (item1?.[key] !== item2?.[key]) {
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
export function format(template: string, ...args: Array<string | number>) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    template = template.replace(new RegExp(`\\{${i}\\}`, 'g'), String(arg))
  }

  return template
}

/**
 * Read environment variables from the ecm-ccd-docker/compose/.env and bin/env_variables_all.txt
 */
export function getEnvVarsFromFile(): Record<string, string> {
  const dotEnv = `${process.env.ECM_DOCKER_DIR}${sep}compose${sep}.env`
  const envAll = `${process.env.ECM_DOCKER_DIR}${sep}bin${sep}env_variables_all.txt`

  // Some people on the team don't run with this file even though the ecm-ccd-docker README says to create it
  const dotEnvContents = existsSync(dotEnv) ? readFileSync(dotEnv, 'utf-8') : ''
  const envAllContents = existsSync(envAll) ? readFileSync(envAll, 'utf-8') : ''

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
export async function execCommand(command: string, cwd?: string, rejectOnNonZeroExitCode = true): Promise<{ err: ExecException | null, stdout: string, stderr: string, code: number }> {
  if (process.env.DEBUG) {
    console.log('\x1b[2m', `Executing: ${command} in ${cwd || process.cwd()}}`, '\x1b[0m')
  }
  return await new Promise((resolve, reject) => {
    const env = process.env.CFTLIB ? {} : getEnvVarsFromFile() // Hack here to avoid loading ecm-ccd-docker vars when using cftlib
    const child: ChildProcess = exec(command, { maxBuffer: 1024 * 1024 * 50, cwd, env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      const out = { err, stdout, stderr, code: child.exitCode || 0, cwd: cwd || process.cwd() }
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
  return arr.reduce<Record<string, number>>((acc: Record<string, number>, obj: T) => {
    const accKey = String(obj[key])
    if (!acc[accKey]) {
      acc[accKey] = 0
    }
    acc[accKey]++
    return acc
  }, {})
}

/**
 * Calls getUniqueByKey but returns as an array instead of an object
 */
export function getUniqueByKeyAsArray<T>(arr: T[], key: keyof (T)) {
  return Object.keys(getUniqueByKey(arr, key))
}

export function groupBy<T>(arr: T[], key?: keyof T) {
  return arr.reduce((acc, obj) => {
    if (!key) {
      if (!acc[obj]) {
        // @ts-expect-error Setting this up to be added to later
        acc[obj] = []
      }
      acc[obj].push(obj)
      return acc
    }

    if (!acc[obj[key]]) {
      // @ts-expect-error Setting this up to be added to later
      acc[obj[key]] = []
    }

    acc[obj[key]].push(obj)
    return acc
  }, {} as Record<any, T[]>)
}

export function groupByKeys<T>(arr: T[], keys: Array<keyof T>) {
  return arr.reduce((acc, obj) => {
    const composite = keys.map(o => obj[o]).join('-')
    if (!acc[composite]) {
      acc[composite] = []
    }

    acc[composite].push(obj)
    return acc
  }, {} as Record<any, T[]>)
}

/** Clears the current terminal line and writes a new message with no ending newline */
export function temporaryLog(message: string, showDate = true) {
  clearCurrentLine()
  const msgNoNewLine = message.replace(/\n/g, '').substring(0, process.stdout.columns - 15)
  if (showDate) {
    return process.stdout.write(`${new Date().toLocaleTimeString()} || ${msgNoNewLine}`)
  }
  return process.stdout.write(msgNoNewLine)
}

/** Clears the current line by sending a special character command */
export function clearCurrentLine() {
  process.stdout.write('\r\x1b[K')
}

/** Gets height of terminal minus a couple of lines for the question and answer */
export function getIdealSizeForInquirer() {
  return process.stdout.rows - 2
}

export async function wait(ms: number) { return await new Promise(resolve => setTimeout(resolve, ms)) }

export async function isRunningInWsl() {
  const { stdout } = await execCommand('echo $WSL_DISTRO_NAME', undefined, false)
  return stdout.length > 1
}

export function remove<T>(arr: T[], item: T) {
  const index = arr.indexOf(item)
  if (index > -1) {
    arr.splice(index, 1)
  }
}

export function unescapeHtml(html: string): string {
  let returnText = html;
  returnText = returnText.replace(/&nbsp;/gi, ' ')
  returnText = returnText.replace(/&amp;/gi, '&')
  returnText = returnText.replace(/&quot;/gi, `"`)
  returnText = returnText.replace(/&quot;/gi, `'`)
  returnText = returnText.replace(/&lt;/gi, '<')
  returnText = returnText.replace(/&gt;/gi, '>')
  return returnText
}

export async function killOn(port: number | string) {
  return await execCommand(`lsof -i:${port} -Fp | head -n 1 | sed 's/^p//' | xargs kill`, undefined, false)
}

export async function startAndWaitForService(opts: { name: string, dir: string, cmd: string, timeoutMs?: number, successRegex?: RegExp }) {
  opts.timeoutMs ||= 600000
  opts.successRegex ||= /Started (.+?) in [\d.]+ seconds \(JVM/g

  return await new Promise((resolve, reject) => {
    const stdout: string[] = []
    const stderr: string[] = []
    const start = Date.now()

    const cleanupAndExit = (fn: () => void) => {
      clearInterval(interval)
      fn()
    }

    const interval = setInterval(() => {
      if (stdout.find(o => o.match(opts.successRegex))) {
        cleanupAndExit(() => resolve(child))
      }

      if (stdout.find(o => o.includes("APPLICATION FAILED TO START"))) {
        cleanupAndExit(() => reject(stdout.join('')))
      }

      if (Date.now() - start > opts.timeoutMs) {
        cleanupAndExit(() => reject(`Failed to start within ${opts.timeoutMs / 1000} seconds`))
      }
    }, 1000)

    const child: ChildProcess = exec(opts.cmd, { cwd: opts.dir, env: { ...process.env, ...getEnvVarsFromFile() } }, err => {
      if (err) {
        return cleanupAndExit(() => reject(err))
      }

      return cleanupAndExit(() => resolve(child))
    })

    child.stdout?.on('data', data => {
      stdout.push(data)
    })

    child.stderr?.on('data', data => {
      stderr.push(data)
    })
  })
}

export async function startSpringbootApp(name: string, dir: string, cmd?: string, timeoutMs: number = 60000) {
  return await startAndWaitForService({
    name,
    dir,
    cmd: cmd || `./gradlew bootRun --args='--spring.profiles.active=dev'`,
    timeoutMs
  })
}

/**
 * Same as calling fetch but will retry on failure infinitely
 */
export async function retryFetch(url: string, opts?: any) {
  try {
    if (process.env.DEBUG) {
      console.log('\x1b[2m', `Calling ${url}`, '\x1b[0m')
    }
    // opts.signal ||= AbortSignal.timeout(60_000)
    const res = await fetch(url, opts)
    if (res.status > 499) {
      const text = await res.text()
      console.warn(text)
      throw new Error(`Status code ${res.status}`)
    }
    return res
  } catch (e) {
    console.warn(`Fetch to ${url} failed with ${e.message}. Retrying in 5 seconds...`)
    await wait(5000)
    return await retryFetch(url, opts)
  }
}

export function underlineRow(contents: Record<string, string>) {
  return [
    contents,
    Object.keys(contents).reduce((acc, key) => {
      if (!contents[key].length) return acc
      acc[key] = "".padStart(contents[key].length + 1, "-")
      return acc
    }, {})
  ]
}

export function formatTableRows(contents: Record<string, string>[]) {
  const maxLengths = contents.reduce((acc, obj: Record<string, string>) => {
    for (const key in obj) {
      if (!acc[key] || acc[key] < (obj[key]?.length || 0)) {
        acc[key] = obj[key].length
      }
    }
    return acc
  }, {} as Record<string, number>)

  return contents.map(o => {
    for (const key in maxLengths) {
      if (!o[key]) continue
      o[key] = (o[key] as String).padEnd(maxLengths[key], " ")
    }
    return o
  })
}