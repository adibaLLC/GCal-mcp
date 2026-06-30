import { fileURLToPath } from "url";
import { GoogleCalendarMcpServer } from './server.js';
import { parseArgs } from './config/TransportConfig.js';
import { readFileSync } from "fs";
import { join, dirname } from "path";

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

// --- Main Application Logic --- 
async function main() {
  try {
    // Parse command line arguments
    const config = parseArgs(process.argv.slice(2));
    
    // Create and initialize the server
    const server = new GoogleCalendarMcpServer(config);
    await server.initialize();
    
    // Start the server with the appropriate transport
    await server.start();

  } catch (error: unknown) {
    process.stderr.write(`Failed to start server: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

function showHelp(): void {
  process.stdout.write(`
Google Calendar Headless MCP Server v${VERSION}

Usage:
  npx @cocal/google-calendar-mcp [command] [options]

Commands:
  start              Start the HTTP MCP server proxy (default)
  version            Show version information
  help               Show this help message

Options:
  --enable-tools <list>   Comma-separated list of tools to enable (whitelist)
`);
}

function showVersion(): void {
  process.stdout.write(`Google Calendar Headless MCP Server v${VERSION}\n`);
}

// Parse CLI arguments
function parseCliArgs(): { command: string | undefined } {
  const args = process.argv.slice(2);
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle special version/help flags as commands
    if (arg === '--version' || arg === '-v' || arg === '--help' || arg === '-h') {
      command = arg;
      continue;
    }

    // Skip transport options and their values
    if (arg === '--transport' || arg === '--port' || arg === '--host' || arg === '--enable-tools') {
      i++; // Skip the next argument (the value)
      continue;
    }

    // Skip other flags
    if (arg === '--debug') {
      continue;
    }

    // Check for command (first non-option argument)
    if (!command && !arg.startsWith('--')) {
      command = arg;
      continue;
    }
  }

  return { command };
}

// CLI logic here (run always)
const { command } = parseCliArgs();

switch (command) {
  case "start":
  case void 0:
    main().catch((error) => {
      process.stderr.write(`Failed to start server: ${error}\n`);
      process.exit(1);
    });
    break;
  case "version":
  case "--version":
  case "-v":
    showVersion();
    break;
  case "help":
  case "--help":
  case "-h":
    showHelp();
    break;
  default:
    process.stderr.write(`Unknown command: ${command}\n`);
    showHelp();
    process.exit(1);
}