/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // Kakao Developers "JavaScript" key — see .env.example.
  readonly VITE_KAKAO_MAP_JS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
