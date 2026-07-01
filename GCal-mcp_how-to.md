# Google Calendar MCP Setup Guide

This guide provides the essential steps to get the stateless Google Calendar MCP server up and running quickly.

## 1. Prerequisites

You need a **Baserow Database** configured with a table containing the following fields for Google OAuth credentials:
- `client_id`
- `client_secret`
- `access_token`
- `refresh_token`
- `expiry_date`

## 2. Configuration

Create a `.env` file in the root of the project with your Baserow connection details:

```env
BASEROW_URL=https://api.baserow.io
BASEROW_DATABASE_TOKEN=your_database_token_here
BASEROW_TABLE_ID=your_table_id_here
PORT=3000 # Optional, defaults to 3000
```

## 3. Installation & Execution

### Option A: Local Node.js
```bash
# Install dependencies
npm ci

# Build the project
npm run build

# Start the server
npm start
```

### Option B: Docker with Traefik via Portainer

To deploy the Google Calendar MCP on a Docker environment managed by Portainer and routed via Traefik, you can use a Stack with the following `docker-compose.yml`:

```yaml
version: "3.8"

services:
  gcal-mcp:
    # Build from source or specify your published image
    build: .
    # image: ghcr.io/yourusername/gcal-mcp-stateless:latest
    container_name: gcal-mcp
    restart: unless-stopped
    env_file: stack.env # Used by Portainer natively
    networks:
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gcal-mcp.rule=Host(`gcal-mcp.yourdomain.com`)"
      - "traefik.http.routers.gcal-mcp.entrypoints=websecure"
      - "traefik.http.routers.gcal-mcp.tls.certresolver=letsencrypt" # Adjust if your resolver differs
      # OPTIONAL: To restrict access to the local VPS/network only (internal), uncomment these lines:
      # - "traefik.http.middlewares.local-only.ipwhitelist.sourcerange=127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
      # - "traefik.http.routers.gcal-mcp.middlewares=local-only"
      - "traefik.http.services.gcal-mcp.loadbalancer.server.port=3000"

networks:
  proxy:
    external: true
```

**Portainer Setup Steps:**
1. Open Portainer and navigate to your Environment -> **Stacks**.
2. Click **Add stack** and give it a name (e.g., `gcal-mcp`).
3. Paste the `docker-compose.yml` snippet into the Web editor (adjust the `Host` rule as needed).
4. Under the **Environment variables** section, use the **Advanced mode** to paste the contents of your `.env` file (`BASEROW_URL`, `BASEROW_DATABASE_TOKEN`, `BASEROW_TABLE_ID`).
5. Make sure the external network (`proxy`) matches your Traefik network.
6. Click **Deploy the stack**.

## 4. Integration with n8n

To use this server in your n8n workflow, configure your MCP node or HTTP Client as follows:

1. **Connection URL:** Connect to the Server-Sent Events (SSE) endpoint: `http://localhost:3000/sse`
2. **Required Header:** You **must** supply the following HTTP header to authenticate requests dynamically:
   - `X-Baserow-Row-Id`: The exact Row ID in your Baserow table containing the user's Google OAuth credentials.
3. **Optional Header:**
   - `X-Timezone`: A standard IANA Timezone string (e.g., `America/Los_Angeles`). Defaults to `UTC` if not provided.

The server will use the injected `X-Baserow-Row-Id` to securely fetch the credentials for each request, keeping the MCP server completely stateless.
