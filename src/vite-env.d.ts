/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // Naver Cloud Platform Maps "Client ID" (JavaScript key) — see .env.example.
  readonly VITE_NAVER_MAP_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
