/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK: string
  readonly VITE_PACKAGE_ID: string
  readonly VITE_PACKAGE_ID_V4: string
  readonly VITE_LEDGER_ID: string
  readonly VITE_STAKING_MANAGER_ID: string
  readonly VITE_CONFIG_ID: string
  readonly VITE_ORACLE_ID: string
  readonly VITE_SUINS_PARENT_OBJECT_ID: string
  readonly VITE_SUINS_PARENT_DOMAIN_NAME: string
  readonly VITE_ENABLE_SPONSORED_TRANSACTIONS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 