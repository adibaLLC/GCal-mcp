import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { buildListFieldMask } from "../../utils/field-mask-builder.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { ListEventsResponse, convertGoogleEventToStructured } from "../../types/structured-responses.js";

interface SearchEventsArgs {
  query: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
  fields?: string[];
  maxResults?: number;
}

export class SearchEventsHandler extends BaseToolHandler {
    async runTool(args: SearchEventsArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarId = await this.resolveCalendarId(client, args.calendarId || 'primary');
        const calendar = this.getCalendar(client);
        
        try {
            const { timeMin, timeMax } = await this.normalizeTimeRange(args.timeMin, args.timeMax, args.timeZone);
            const fieldMask = buildListFieldMask(args.fields);
            
            const response = await calendar.events.list({
                calendarId,
                q: args.query,
                timeMin,
                timeMax,
                maxResults: args.maxResults || 10,
                singleEvents: true,
                orderBy: 'startTime',
                ...(fieldMask && { fields: fieldMask })
            });

            const items = response.data.items || [];
            const structuredEvents = items.map(event => convertGoogleEventToStructured(event, calendarId, 'default'));

            const result: ListEventsResponse = {
                events: structuredEvents,
                totalCount: items.length
            };

            return createStructuredResponse(result);
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
