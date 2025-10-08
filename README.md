## Fellow MCP Server

This repository hosts a Model Context Protocol (MCP) server that lets MCP-compatible clients interact with Fellow.ai using a shared toolset defined in `server.ts`.

## Prerequisites

- Node.js 18 or newer
- npm (bundled with Node.js)
- A Fellow API key scoped for the actions you plan to perform

## Setup

```bash
git clone https://github.com/avnersender/fellow-ai-mcp
cd fellow-ai-mcp
npm install
```

## Configuration

The server requires two environment variables:

- `FELLOW_SUBDOMAIN` – the workspace subdomain (e.g. `acme` for `https://acme.fellow.app`)
- `FELLOW_API_KEY` – the API key generated from Fellow → User Settings → Developer Tools

Env-vars are configured  directly in your MCP client (see below).

## Build & Run

- Development: `npx -y tsx server.ts`
- Production build: `npm run build`
- Start compiled server: `npm start` (after running the build)

## Testing & Smoke Checks

- Unit tests: `npm test`
- Live API verification (requires valid key and domain as env-vars): `npm run live-check`

Run the test suite before opening a pull request. The live check exercises the deployed Fellow API and is optional unless you need end-to-end validation.

## MCP Client Configuration Examples

- **Codex CLI (Linux/macOS/WSL)**
  ```toml
  [mcp_servers."fellow-ai"]
  command = "npx"
  args = ["-y", "tsx", "/home/<user>/mcp-fellow/server.ts"]

  [mcp_servers."fellow-ai".env]
  FELLOW_SUBDOMAIN = "domain_name"
  FELLOW_API_KEY   = "..."
  ```

- **Claude Desktop (Windows + WSL)**
  ```json
  {
    "mcpServers": {
      "fellow-ai": {
        "command": "wsl",
        "args": [
          "bash",
          "-c",
          "cd /home/<user>/mcp-fellow && FELLOW_SUBDOMAIN=domain_name FELLOW_API_KEY=... node dist/server.js"
        ]
      }
    }
  }
  ```
  Run `npm run build` inside WSL so `dist/server.js` is available.

- **Claude Desktop (macOS)**
  ```json
  {
    "mcpServers": {
      "fellow-ai": {
        "command": "node",
        "args": [
          "/Users/<user>/mcp-fellow/dist/server.js"
        ],
        "env": {
          "FELLOW_SUBDOMAIN": "domain_name",
          "FELLOW_API_KEY": "..."
        }
      }
    }
  }
  ```

Adjust paths to match your installation. Other MCP clients can be wired similarly by pointing to either `npx -y tsx server.ts` (development) or the built `dist/server.js`.
