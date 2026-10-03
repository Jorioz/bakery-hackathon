/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin. Leave unset in dev to use the Vite proxy. */
  readonly VITE_API_URL?: string
}
