import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// Monaco's TypeScript worker manager references its worker (~7 MB) with
// `new Worker(new URL('ts.worker.js', import.meta.url))`, so Vite would bundle
// it even though src/lib/monaco.js switches every TS language feature off and
// it is never started. Removing that one reference keeps it out of dist.
const TS_WORKER_REF = `new Worker(new URL('ts.worker.js', import.meta.url), { type: "module" })`;
const dropMonacoTsWorker = {
  name: "drop-monaco-ts-worker",
  enforce: "pre",
  transform(code, id) {
    if (!/monaco-editor[\\/]esm[\\/]vs[\\/]languages[\\/]features[\\/]typescript[\\/]workerManager\.js$/.test(id)) return;
    if (!code.includes(TS_WORKER_REF)) {
      this.warn("Monaco's TS worker reference changed; the TS worker will be bundled.");
      return;
    }
    return code.replace(TS_WORKER_REF, `(() => { throw new Error("TypeScript worker is disabled"); })()`);
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [dropMonacoTsWorker, react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // In development the API runs separately; proxying keeps requests
    // same-origin so the app never needs a hardcoded API URL.
    proxy: { "/api": process.env.VITE_PROXY_TARGET || "http://localhost:3000" },
  },
  build: {
    target: "es2022",
    // Monaco is large by nature; it is split into its own lazily loaded chunk.
    chunkSizeWarningLimit: 4500,
  },
});
