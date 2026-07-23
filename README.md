# Stateless Google Calendar MCP Proxy

This is a heavily streamlined, stateless implementation of the Google Calendar Model Context Protocol (MCP) server, designed exclusively for headless integration with orchestrators like n8n.

By aggressively adhering to the "ponytail rule" (lazy senior dev: extreme simplicity, YAGNI, no speculative complexity), all stateful components—such as SQLite databases, embedded web interfaces, complex local multi-tenancy mappings, and internal token refreshing background jobs—have been stripped out.

Instead, this server acts as a thin, highly reliable proxy between the MCP standard and the Google Calendar API, leveraging an external Baserow database as the single source of truth for Google OAuth credentials.

## Architecture

* **Stateless by Design:** This application does not persist any local state.
* **HTTP/SSE Transport:** This server implements the MCP `StreamableHTTPServerTransport`. It listens on a specified port (default `3000`) for standard HTTP-based MCP connections (e.g., `/sse` endpoint).
* **Application Layer Authentication:** Multi-tenancy is handled at the tool schema level. Every tool exposed to the LLM requires a `dentist_id` parameter. 
* **Baserow Auth Engine:** Before a tool accesses Google Calendar, the handler intercepts the `dentist_id` argument, securely pulls the tenant's encrypted Google OAuth credentials directly from Baserow via the REST API, decrypts them in-memory, instantiates a headless Google `OAuth2Client`, and performs the requested operation.
* **Global App Credentials:** The Google Cloud application credentials (`client_id` and `client_secret`) are shared globally and stored in environment variables, keeping the Baserow table lean.

## Setup Guide

### 1. Prerequisites

You need a **Baserow Database** configured with a table (e.g., Table 759) containing the following fields for per-tenant Google OAuth credentials:
- `GCal_access_token` (Base64 encrypted)
- `GCal_refresh_token` (Base64 encrypted)
- `expiry_date`
- `GCal_Auth_Status` (Optional, object containing a value, e.g., 'Revoked')

### 2. Configuration

Create a `.env` file in the root of the project with your connection and encryption details:

```env
# Baserow Setup
BASEROW_API_URL=https://api.baserow.io
BASEROW_API_TOKEN=your_secure_database_token

# Encryption
MASTER_ENCRYPTION_KEY=your_32_byte_aes_256_key_here

# Google Cloud Global App Credentials
GOOGLE_CLIENT_ID=your_global_google_app_client_id
GOOGLE_CLIENT_SECRET=your_global_google_app_client_secret

# Server Port
PORT=3000
```

### 3. Installation & Execution

#### Option A: Local Node.js
```bash
# Install dependencies
npm ci

# Build the project
npm run build

# Start the server
npm start
```

#### Option B: Docker with Traefik via Portainer

To deploy the Google Calendar MCP on a Docker environment managed by Portainer and routed via Traefik, you can use a Stack with the following `docker-compose.yml`:

```yaml
version: "3.8"

services:
  gcal-mcp:
    build: .
    container_name: gcal-mcp
    restart: unless-stopped
    env_file: stack.env # Used by Portainer natively
    networks:
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gcal-mcp.rule=Host(`gcal-mcp.yourdomain.com`)"
      - "traefik.http.routers.gcal-mcp.entrypoints=websecure"
      - "traefik.http.routers.gcal-mcp.tls.certresolver=letsencrypt" 
      - "traefik.http.services.gcal-mcp.loadbalancer.server.port=3000"

networks:
  proxy:
    external: true
```

**Portainer Setup Steps:**
1. Open Portainer and navigate to your Environment -> **Stacks**.
2. Click **Add stack** and give it a name (e.g., `gcal-mcp`).
3. Paste the `docker-compose.yml` snippet into the Web editor (adjust the `Host` rule as needed).
4. Under the **Environment variables** section, use the **Advanced mode** to paste the contents of your `.env` file.
5. Make sure the external network (`proxy`) matches your Traefik network.
6. Click **Deploy the stack**.

### 4. Integration with n8n

To use this server in your n8n workflow, configure your MCP node as follows:

1. **Connection URL:** Connect to the Server-Sent Events (SSE) endpoint: `http://localhost:3000/sse`
2. **Tool Execution:** When the LLM calls a calendar tool (like `create-event`), it will automatically prompt for the `dentist_id` argument based on the tool schema. N8n simply passes the prompt and the LLM fulfills it. No custom headers (`X-Baserow-Row-Id`) are required at the HTTP layer.

## Tools Available

This MCP server exposes the following Google Calendar tools. Note that every tool requires a `dentist_id` parameter.

* `list-calendars`: Fetch calendars the authenticated user has access to.
* `list-events`: Fetch events from a calendar.
* `search-events`: Free-text search across a calendar.
* `get-event`: Retrieve a specific event by ID.
* `create-event`: Insert a new event.
* `create-events`: Bulk insert multiple events.
* `update-event`: Patch an existing event.
* `delete-event`: Remove an event.
* `get-freebusy`: Check free/busy availability.
* `get-current-time`: Helpful for LLMs to understand the relative local time.
* `respond-to-event`: Accept, decline, or mark tentative for invitations.

## Developer Note (Ponytail Architecture)
If you are extending this server:
1. Do not add state.
2. Do not add caching layers for tokens; let Baserow handle the data persistence. If performance becomes an issue, implement caching *at the n8n layer*.
3. Keep handlers simple. Extract data from `this.getClient()`, use `googleapis`, format the response, and return.
