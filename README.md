## MCP Client Configuration

### Obtain Fellow.app API Key

- **Login to (https://fellow.app/)**  
  Once logged in, in the top-left click the user-icon -> User Settings -> Developer Tools -> Create New API Key

### Configure Client (examples)

- **Codex CLI (WSL/Linux/macOS)**  
  Configure `~\.codex\config.toml` with:
  ```yaml
  [mcp_servers."fellow-ai"]
  command = "npx"
  args = ["-y", "tsx", "~/mcp-fellow/server.ts"]
  
  # Put env in the dedicated env table (don’t pass via --env args)
  [mcp_servers."fellow-ai".env]
  FELLOW_SUBDOMAIN = "domain_name"
  FELLOW_API_KEY   = "***"
  ```

- **Claude Desktop (Windows + WSL)**  
  Configure `claude_desktop_config.json` with:  
  ```json
  {
    "mcpServers": {
      "fellow-ai": {
        "command": "wsl",
        "args": [
          "bash",
          "-c",
          "cd /home/avner/mcp/mcp-fellow && FELLOW_SUBDOMAIN=domain_name FELLOW_API_KEY=*** node dist/server.js"
        ]
      }
    }
  }
  ```

## ChatGPT GPT Builder Action

- Import `contracts/fellow.gpt.json` when wiring the Fellow API as a custom Action. The schema mirrors the MCP contract, references the public OpenAPI description, and documents the required `FELLOW_SUBDOMAIN` and `FELLOW_API_KEY` variables for authenticated requests.
  Build with `npm run build` inside WSL so `dist/server.js` exists.

- **Claude Desktop (macOS)**  
  After `npm run build`, configure:  
  ```json
  {
    "mcpServers": {
      "fellow-ai": {
        "command": "node",
        "args": [
          "/Users/<user>/mcp/mcp-fellow/dist/server.js"
        ],
        "env": {
          "FELLOW_SUBDOMAIN": "domain_name",
          "FELLOW_API_KEY": "..."
        }
      }
    }
  }
  ```
