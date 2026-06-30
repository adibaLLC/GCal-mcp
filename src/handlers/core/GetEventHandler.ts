import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { convertGoogleEventToStructured } from "../../types/structured-responses.js";

interface GetEventArgs {
  eventId: string;
  calendarId?: string;
  fields?: string[];
}

export class GetEventHandler extends BaseToolHandler {
    async runTool(args: GetEventArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarId = await this.resolveCalendarId(client, args.calendarId || 'primary');
        const calendar = this.getCalendar(client);
        
        try {
            const response = await calendar.events.get({
                calendarId,
                eventId: args.eventId,
                ...(args.fields && { fields: args.fields.join(',') })
            });

            const event = response.data;
            const structuredEvent = convertGoogleEventToStructured(event, calendarId, 'default');

            return createStructuredResponse({ event: structuredEvent });
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
