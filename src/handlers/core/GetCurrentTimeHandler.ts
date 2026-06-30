import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";

export class GetCurrentTimeHandler extends BaseToolHandler {
    async runTool(args: { timeZone?: string }): Promise<CallToolResult> {
        const now = new Date();
        const targetTimezone = args.timeZone || this.getTimezone();
        
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: targetTimezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZoneName: 'short'
            });
            const localTime = formatter.format(now);
            
            return createStructuredResponse({
                currentTime: now.toISOString(),
                timezone: targetTimezone,
                localTime,
                unixTimestamp: Math.floor(now.getTime() / 1000)
            });
        } catch (error: any) {
            // Fallback to UTC if timezone is invalid
            return createStructuredResponse({
                currentTime: now.toISOString(),
                timezone: 'UTC',
                localTime: now.toUTCString(),
                unixTimestamp: Math.floor(now.getTime() / 1000),
                warning: `Invalid timezone '${targetTimezone}', fell back to UTC.`
            });
        }
    }
}
