# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files already read unless the file may have changed.
- Skip files over 100KB unless explicitly required.
- Suggest `/cost` when a session runs long to monitor cache ratio.
- Recommend starting a new session when switching to an unrelated task.
- Test code before declaring done (`npm run build` minimum).
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

## Commands
```bash
npm run dev    # Electron + Vite dev mode (launches window)
npm run build  # Compile main/preload/renderer to out/
```
> `npm run dev` deletes `ELECTRON_RUN_AS_NODE` before launching — required because Claude Code sets it, which breaks Electron's API in child processes.

## Architecture
**3 processes — strict separation:**

- **Main** (`src/main/`) — Node.js. DB, filesystem, thermal printer. Registers `ipcMain.handle()`.
- **Preload** (`src/preload/index.ts`) — Bridge via `contextBridge.exposeInMainWorld('electronAPI', {...})`. Never expose full Node.js.
- **Renderer** (`src/renderer/`) — React + TypeScript. Calls `window.electronAPI.*()` only. No direct Node access.

**Adding a feature with DB/hardware access:** handler in main → expose in preload → call from renderer.

## Database
- `sql.js` (SQLite compiled to WASM — no native compilation needed)
- File: `userData/pos.db` → `C:\Users\<user>\AppData\Roaming\punto-de-venta\pos.db`
- Sync API (no async/await). Helpers: `queryAll`, `queryOne`, `execute`, `executeRaw`, `runInTransaction`, `persist`
- Schema: `categorias`, `productos`, `ventas`, `venta_items`, `configuracion`
- Categories are dynamic (table-driven), not a fixed enum

## Key conventions
- `contextIsolation: true` + `nodeIntegration: false` — never change
- SCSS modules + CSS custom properties (`--bg-primary`, `--blue`, `--border`, etc.)
- State-based routing in `App.tsx` via `useState<PageName>`
- `GrupoProducto = string` (dynamic categories from DB)
- `UnidadPeso = 'kg' | '100g'`
