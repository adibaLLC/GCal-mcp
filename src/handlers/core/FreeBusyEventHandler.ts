import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";

interface FreeBusyArgs {
  timeMin: string;
  timeMax: string;
  items: Array<{ id: string }>;
  timeZone?: string;
}

export class FreeBusyEventHandler extends BaseToolHandler {
    async runTool(args: FreeBusyArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendar = this.getCalendar(client);
        
        try {
            const { timeMin, timeMax, timezone } = await this.normalizeTimeRange(args.timeMin, args.timeMax, args.timeZone);
            
            // Resolve calendar IDs
            const resolvedItems = [];
            for (const item of args.items) {
                try {
                    const resolvedId = await this.resolveCalendarId(client, item.id);
                    resolvedItems.push({ id: resolvedId });
                } catch {
                    resolvedItems.push(item);
                }
            }

            const response = await calendar.freebusy.query({
                requestBody: {
                    timeMin,
                    timeMax,
                    timeZone: timezone,
                    items: resolvedItems
                }
            });

            return createStructuredResponse({ freebusy: response.data });
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
