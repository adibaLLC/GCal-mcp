# Stateless Google Calendar MCP Proxy

This is a heavily streamlined, stateless implementation of the Google Calendar Model Context Protocol (MCP) server, designed exclusively for headless integration with orchestrators like n8n.

By aggressively adhering to the "ponytail rule" (lazy senior dev: extreme simplicity, YAGNI, no speculative complexity), all stateful components—such as SQLite databases, embedded web interfaces, complex local multi-tenancy mappings, and internal token refreshing background jobs—have been stripped out.

Instead, this server acts as a thin, highly reliable proxy between the MCP standard and the Google Calendar API, leveraging an external Baserow database as the single source of truth for Google OAuth credentials.

## Architecture

* **Stateless by Design:** This application does not persist any local state.
* **HTTP/SSE Transport:** Instead of using standard `stdio` (which lacks the ability to pass per-request metadata like headers in a multi-tenant environment), this server implements the MCP `StreamableHTTPServerTransport`. It listens on a specified port (default `3000`) for standard HTTP-based MCP connections (e.g. `/sse` endpoint).
* **Context Injection:** When n8n makes a request to execute a tool, it MUST inject the `X-Baserow-Row-Id` header (and optionally `X-Timezone`).
* **Async Context:** The Node `AsyncLocalStorage` safely isolates the authentication context for each incoming request, preventing race conditions.
* **Baserow Auth Engine:** Before a tool accesses Google Calendar, the handler fetches the `X-Baserow-Row-Id` from the context, securely pulls the Google OAuth credentials directly from Baserow via the REST API, instantiates a headless Google `OAuth2Client`, and performs the requested operation.

## Prerequisites

1. **Baserow Database:** A Baserow table configured with fields to store `client_id`, `client_secret`, `access_token`, `refresh_token`, and `expiry_date`.
2. **Environment Variables:**
   Create a `.env` file containing the connection details for your Baserow instance:
   ```env
   BASEROW_URL=https://api.baserow.io
   BASEROW_DATABASE_TOKEN=your_database_token_here
   BASEROW_TABLE_ID=your_table_id_here
   PORT=3000
   ```

## Installation and Execution

```bash
# Install dependencies
npm ci

# Build the project
npm run build

# Start the server (runs on port 3000 by default)
npm start
```

Alternatively, use the provided `Dockerfile` to build and deploy to any container platform:

```bash
docker build -t gcal-mcp-stateless .
docker run -p 3000:3000 --env-file .env gcal-mcp-stateless
```

## Integrating with n8n

When configuring the MCP node or the HTTP Client in your n8n workflow, you must connect to this server using the Server-Sent Events (SSE) / HTTP URL (e.g., `http://localhost:3000/sse`) and supply the following HTTP headers:

| Header | Required? | Description |
| :--- | :--- | :--- |
| `X-Baserow-Row-Id` | **Yes** | The exact Row ID in your Baserow table containing the user's Google OAuth credentials. |
| `X-Timezone` | No | A standard IANA Timezone string (e.g., `America/Los_Angeles`). Defaults to `UTC`. Used for relative datetime calculations. |

Because n8n will dynamically inject these headers for each execution based on the user running the workflow, this server seamlessly supports infinite users without requiring multi-tenancy logic.

## Tools Available

This MCP server exposes the following Google Calendar tools. Note that `account` mapping parameters have been entirely removed; `calendarId` is directly passed as-is to the Google API.

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
