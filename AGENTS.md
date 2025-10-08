# Repository Guidelines

## Project Structure & Module Organization
The TypeScript entry point lives in `server.ts`, which registers all Model Context Protocol tools and shared helpers. Tests reside in `tests/` and mirror server features via `*.test.ts` files run by Vitest. Runtime build artifacts compile to `dist/` through the TypeScript compiler; never edit them manually. Support utilities and smoke checks are under `scripts/`, including the live API verifier.

## Build, Test, and Development Commands
Run `npm install` once to sync dependencies. `npm run build` transpiles TypeScript to `dist/` using `tsc`. `npm start` executes `dist/server.js` for local agent validation (requires env vars below). `npm test` runs the Vitest suite in watchless mode. `npm run live-check` hits the Fellow API with the configured credentials to ensure transport parity (requires `FELLOW_SUBDOMAIN` and `FELLOW_API_KEY` env-vars).

## Coding Style & Naming Conventions
Stick to strict TypeScript with ES2022 modules; keep two-space indentation and trailing commas per existing code. Export helpers with descriptive camelCase names (`call`, `fetchNoteById`) and group schemas near their tools. Avoid console output on stdio transports; propagate errors instead. `tsconfig.json` enforces `strict` typing—resolve any new compile warnings before committing.

## Testing Guidelines
Write Vitest specs beside related features in `tests/`, naming files `<subject>.test.ts`. Prefer `describe` blocks that mirror tool names and include regression cases for API retries and pagination. Mock outbound HTTP via `vi.mock('axios')` patterns already present. Always run `npm test` before opening a pull request and add coverage for new failure paths.

## Commit & Pull Request Guidelines
Follow Conventional Commit prefixes observed in history (`fix:`, `test:`, `chore:`) and use present-tense summaries under 72 characters. Each PR should link relevant Fellow issues, describe user-facing changes, and note any new env requirements. Confirm `npm test` and, when credentials allow, `npm run live-check`, and attach outputs or screenshots when behavior changes.

## Environment & Secrets
Set `FELLOW_SUBDOMAIN` and `FELLOW_API_KEY` in your shell or `.env.local` before running builds or live checks; never commit secrets. For CI or shared environments, use scoped API keys and rotate them after debugging sessions.