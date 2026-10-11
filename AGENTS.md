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

<<<<<<< Updated upstream
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
=======
<!-- local-ci:begin -->
## Running CI locally — `scripts/local_ci.sh`

GitHub Actions is billing-blocked on our private repos: every workflow run ends in
~3s with **zero steps executed**, so a red check here means nothing. Run the same
gate locally instead:

```bash
./scripts/local_ci.sh              # every job of the pull_request workflow
./scripts/local_ci.sh --plan       # print every step that would run, run nothing
./scripts/local_ci.sh --list       # workflows, triggers and jobs in this repo
./scripts/local_ci.sh --job <id>   # one job only
./scripts/local_ci.sh --event push # simulate the push-triggered workflow
./scripts/local_ci.sh --keep-going # do not stop at the first failure
./scripts/local_ci.sh -v           # echo each command before running it
```

It reads `.github/workflows/*` at run time and executes that workflow's jobs and
steps in order, so it cannot drift from CI — it is not a second copy of the gate.
Edit the workflow and the local run changes with it. Exit 0 means every executed
step passed.

What it cannot reproduce, and prints on startup instead of guessing:

- **Linux.** CI runs `ubuntu-latest`; this runs on macOS. The step set is the
  same, the platform is not. `sudo apt-get install` steps are mapped to a local
  presence probe rather than silently passed.
- **GitHub context.** A step needing `${{ secrets.* }}`, `${{ inputs.* }}`,
  `${{ vars.* }}`, `${{ steps.* }}` or `${{ github.event.* }}` is SKIPPED with the
  reason printed, never run with a guessed value.
- **`uses:` actions** are not executed. Toolchain setups (`setup-dart`,
  `setup-node`, `flutter-action`, `rust-toolchain`, …) become a version assertion
  against the local tool; checkout/cache/artifact are noted as no-ops; anything
  else is skipped by name. A Windows-runner job is skipped outright.
- **`container:`** jobs run on the host toolchain, not in the declared image.
- **`continue-on-error: true`** steps are advisory locally, exactly as in CI.
- **Local-only checkout state.** CI checks out the committed tree; this checkout
  also has gitignored and untracked paths, which whole-tree commands (e.g.
  `dart analyze .`) see. A step that fails naming only such paths is reported as
  a LOCAL-ONLY failure, not as a CI failure — pass `--strict` to count it anyway.
  A step that would `git clone` over a sibling checkout that already exists here
  is skipped; `--allow-outside-clone` forces it.

Canonical copy: `arrrrny/forklift` → `scripts/local_ci.sh` (reference:
`docs/forklift-scripts.md`).
<!-- local-ci:end -->

>>>>>>> Stashed changes

