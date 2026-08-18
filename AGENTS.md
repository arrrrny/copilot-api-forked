# AGENTS.md

## Build, Lint, and Test Commands

- **Build:**  
  `bun run build` (uses tsup)
- **Dev:**  
  `bun run dev`
- **Lint:**  
  `bun run lint` (uses the local flat config in `eslint.config.js`)
- **Lint & Fix staged files:**  
  `bunx lint-staged`
- **Test all:**  
   `bun test`
- **Test single file:**  
   `bun test tests/claude-request.test.ts`
- **Start (prod):**  
  `bun run start`

## Code Style Guidelines

- **Imports:**  
  Use ESNext syntax. Prefer absolute imports via `~/*` for `src/*` (see `tsconfig.json`).
- **Formatting:**  
  Follows Prettier (with `prettier-plugin-packagejson`). Run `bun run lint` to auto-fix.
- **Types:**  
  Strict TypeScript (`strict: true`). Avoid `any`; use explicit types and interfaces.
- **Naming:**  
  Use `camelCase` for variables/functions, `PascalCase` for types/classes.
- **Error Handling:**  
  Use explicit error classes (see `src/lib/error.ts`). Avoid silent failures.
- **Unused:**  
  Unused imports/variables are errors (`noUnusedLocals`, `noUnusedParameters`).
- **Switches:**  
  No fallthrough in switch statements.
- **Modules:**  
  Use ESNext modules, no CommonJS.
- **Testing:**  
   Use Bun's built-in test runner. Place tests in `tests/`, name as `*.test.ts`.
- **Linting:**  
  Uses the local flat config in `eslint.config.js`. Includes JavaScript recommended rules, TypeScript recommended type-checked rules, unused import cleanup, and Prettier.
- **Paths:**  
  Use path aliases (`~/*`) for imports from `src/`.

---

This file is tailored for agentic coding agents. For more details, see the configs in `eslint.config.js` and `tsconfig.json`. No Cursor or Copilot rules detected.

# Shared terminal (`pallet`)
Long-running or user-visible commands (e.g. `flutter run`, `dart run build_runner build`, `bun run watch:dev`) should run in the **shared `pallet` tmux session** so both the human and agents see the same terminal. The human attaches with `pallet up` (in their terminal, e.g. Zap); agents drive it via the `pallet` CLI or the `pallet` MCP server (`~/Developer/forklift/scripts/pallet/pallet_mcp_server.dart`):

```bash
pallet ensure                 # create the shared session if missing
pallet run -n 'cmd'           # run in a fresh window (visible to the human)
pallet wait -w N              # wait until that window goes idle
pallet read -w N              # capture the window's output
```

See `~/Developer/forklift/scripts/pallet/README.md` for the full workflow
and CLI reference.

