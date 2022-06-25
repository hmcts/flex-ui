declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ENGWALES_DEF_DIR: string
      SCOTLAND_DEF_DIR: string
    }
  }
}

export {}
