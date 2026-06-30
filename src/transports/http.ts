import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";
import { authContext } from "../context.js";
import pino from "pino";

const logger = pino();

export interface HttpTransportConfig {
  port?: number;
  host?: string;
}

export class HttpTransportHandler {
  private server: McpServer;
  private config: HttpTransportConfig;

  constructor(server: McpServer, config: HttpTransportConfig = {}) {
    this.server = server;
    this.config = config;
  }

  async connect(): Promise<void> {
    const port = this.config.port || 3000;
    const host = this.config.host || '0.0.0.0';

    // Configure transport for stateless mode
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await this.server.connect(transport);

    const httpServer = http.createServer(async (req, res) => {
      // CORS for n8n
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Baserow-Row-Id, X-Timezone');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
        return;
      }

      try {
        // Extract n8n injected headers
        const rowId = (req.headers['x-baserow-row-id'] as string) || '';
        const timezone = (req.headers['x-timezone'] as string) || 'UTC';

        // Wrap the MCP SDK request handler in our AsyncLocalStorage context.
        // The transport.handleRequest handles both GET /sse and POST /message.
        // Only POST /message will execute tools and thus need the context,
        // but wrapping both is safe.
        await authContext.run({ rowId, timezone }, async () => {
          await transport.handleRequest(req, res);
        });
      } catch (error) {
        logger.error({ err: error }, 'Error handling request');
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          }));
        }
      }
    });

    httpServer.listen(port, host, () => {
      logger.info(`Stateless GCal MCP Server listening on http://${host}:${port}`);
    });
  }
}