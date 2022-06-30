declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ENGWALES_DEF_DIR: string
      SCOTLAND_DEF_DIR: string
      ECM_DOCKER_DIR: string
    }
  }
}

export {}
