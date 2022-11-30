declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ENGWALES_DEF_DIR: string
      SCOTLAND_DEF_DIR: string
      ECM_DOCKER_DIR: string
      ET_CCD_CALLBACKS_DIR: string
      DEMO_ADMIN_USER: string
      DEMO_ADMIN_PASS: string
    }
  }
}

export {}
