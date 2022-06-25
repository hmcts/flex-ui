declare global {
  namespace NodeJS {
    interface ProcessEnv {
      propertyOnProcessEnv: string
    }
  }
}

export {}
