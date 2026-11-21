# AI Review frontend

React 19, Vite 8, Tailwind v4, ChaiUI components (`src/components/ui`,
installed with the shadcn CLI from the `@chaiui` registry) and a self-hosted
Monaco editor.

```bash
npm install
npm run dev     # proxies /api to http://localhost:3000 (VITE_PROXY_TARGET to change)
npm run build   # output in dist/, served by the Express app in production
npm run lint
```

Set `VITE_API_URL` at build time only when the API runs on another domain.
See the root [README](../README.md) for the full picture.
