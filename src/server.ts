import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Import tool registry
import { ToolRegistry } from './tools/registry.js';
import { HttpTransportHandler, HttpTransportConfig } from './transports/http.js';
import { ServerConfig } from './config/TransportConfig.js';

const __server_dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_VERSION = JSON.parse(readFileSync(join(__server_dirname, '..', 'package.json'), 'utf-8')).version;

export class GoogleCalendarMcpServer {
  private server: McpServer;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new McpServer({
      name: "google-calendar",
      version: SERVER_VERSION
    });
  }

  async initialize(): Promise<void> {
    // Set up Modern Tool Definitions
    this.registerTools();
    this.setupGracefulShutdown();
  }

  private registerTools(): void {
    ToolRegistry.registerAll(this.server, this.executeWithHandler.bind(this), this.config);
  }

  private async executeWithHandler(handler: any, args: any): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    if (!args || typeof args.dentist_id !== 'string') {
      throw new Error("Missing required parameter: dentist_id");
    }

    const { authContext } = await import('./context.js');

    return await authContext.run({ rowId: args.dentist_id, timezone: 'UTC' }, async () => {
      return await handler.runTool(args);
    });
  }

  async start(): Promise<void> {
    const httpConfig: HttpTransportConfig = {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      host: '0.0.0.0'
    };
    const httpHandler = new HttpTransportHandler(this.server, httpConfig);
    await httpHandler.connect();
  }

  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      try {
        this.server.close();
        process.exit(0);
      } catch (error: unknown) {
        process.stderr.write(`Error during cleanup: ${error instanceof Error ? error.message : error}\n`);
        process.exit(1);
      }
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  // Expose server for testing
  getServer(): McpServer {
    return this.server;
  }
}
