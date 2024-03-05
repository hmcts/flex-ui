declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ENGWALES_DEF_DIR: string
      SCOTLAND_DEF_DIR: string
      ADMIN_DEF_DIR: string
      ECM_DOCKER_DIR: string
      DATA_MODEL_DIR: string
      ET_CCD_CALLBACKS_DIR: string
      ET_SYA_FRONTEND_DIR: string
      ET_SYA_API_DIR: string
      ET_HEARINGS_API_DIR: string
      ET_WA_TASK_CONFIGURATION_DIR: string
      ET_COMMON_DIR: string
      ET_MESSAGE_HANDLER_DIR: string
      TEAM: string
      CFTLIB: string
      DEBUG: string

      LOCAL_EXUI_USER: string
      LOCAL_EXUI_PASS: string
      LOCAL_EXUI_URL: string
      LOCAL_CUI_BASE_URL: string
      LOCAL_CUI_USER: string
      LOCAL_CUI_PASS: string
      LOCAL_IMPORT_USER: string
      LOCAL_IMPORT_PASS: string
      LOCAL_IMPORT_URL: string
      LOCAL_LEGALREP_USER: string
      LOCAL_LEGALREP_PASS: string
      LOCAL_MANAGE_ORG_URL: string
    }
  }
}

export { }
