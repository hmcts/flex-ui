export type CookieJar = Record<string, string>

const jars: { [username: string]: CookieJar } = {}

export function getCookieJar(username: string) {
  if (!jars[username]) jars[username] = {}
  return jars[username]
}

export function cookieJarToString(jar: CookieJar) {
  return Object.keys(jar).map(o => `${o}=${jar[o]}`).join('; ')
}

export function addToCookieJarFromRawSetCookieHeader(rawHeader: string[], jar: CookieJar = {}) {
  return rawHeader?.reduce((acc, obj) => {
    const [, key, value] = /(.+?)=((.+?);|(.+))/g.exec(obj) || []
    if (!key || !value) return acc
    acc[key] = value.replace(';', '')
    return acc
  }, jar) || jar
}