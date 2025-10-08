# Repository Guidelines

## Project Structure & Module Organization
`server.ts` contains the entire Model Context Protocol server: tool registration, resource templates, and the Axios client used to talk to Fellow. Compiled JavaScript lives in `dist/` after a build, and should never be edited directly. `tsconfig.json` keeps the compiler on ES2022 modules with strict type checking and only includes `server.ts`. `package.json` defines the build/start scripts and lists the small dependency surface (`@modelcontextprotocol/sdk`, `axios`, `zod`); `package-lock.json` should remain committed to pin versions.

## Build, Test, and Development Commands
Run `npm install` once to pull dependencies. `npm run build` transpiles TypeScript via `tsc`, refreshing `dist/server.js`. Launch the MCP server with `FELLOW_SUBDOMAIN=<team> FELLOW_API_KEY=<token> npm start`; the binary reads from stdio, so use an MCP-compatible client to exercise it. For rapid iterations, `npx tsc --watch` keeps recompiling while you edit.

## Coding Style & Naming Conventions
Match the existing two-space indentation, trailing commas where legal, and single quotes. Favor concise, descriptive tool IDs using snake_case (e.g. `sync_meetings`) and camelCase for variables/functions. Keep environment-specific constants in the config block at the top of `server.ts`, and co-locate helper utilities near the tools that consume them. Type all inputs/outputs with `zod` schemas to enforce validation at the edge.

## Testing Guidelines
There is no automated test suite yet; rely on TypeScript’s strict mode plus manual validation. Always run `npm run build` before opening a PR to catch type regressions. When adding or modifying tools, start the server with test credentials and confirm each tool’s happy-path and error-path responses through your MCP client (capture request payloads and structured responses for the PR). Consider adding lightweight integration harnesses under a future `tests/` directory if recurring manual flows appear.

## Commit & Pull Request Guidelines
With no shared history, default to Conventional Commits (`feat: add agenda search tool`, `fix: handle 429 backoff jitter`). Keep commits focused and include context about upstream Fellow endpoints touched. PRs should explain the change, document required environment variables or new scopes, list manual verification steps, and include screenshots or captured responses when they clarify behavior. Link to any tracking issues and flag breaking changes prominently.

## Environment & Security Notes
Never commit secrets. Load `FELLOW_SUBDOMAIN` and `FELLOW_API_KEY` through your shell or an `.env.local` excluded from git. Avoid writing debug output to stdout/stderr—throw errors instead so MCP clients surface them cleanly.
