import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { convertGoogleEventToStructured, StructuredEvent } from "../../types/structured-responses.js";

interface CreateEventsArgs {
  calendarId?: string;
  events: Array<{
    summary: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    timeZone?: string;
    attendees?: string[];
    colorId?: string;
    visibility?: 'default' | 'public' | 'private' | 'confidential';
    transparency?: 'opaque' | 'transparent';
    reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
  }>;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
  timeZone?: string;
}

export class CreateEventsHandler extends BaseToolHandler {
    async runTool(args: CreateEventsArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarId = await this.resolveCalendarId(client, args.calendarId || 'primary');
        const calendar = this.getCalendar(client);
        
        try {
            const defaultTimezone = args.timeZone || this.getTimezone();
            const results: StructuredEvent[] = [];
            const errors: any[] = [];
            
            // Note: Not using BatchRequestHandler here to keep it ponytail since 
            // the upstream SDK provides events.insert, and batching writes can be tricky.
            // A simple sequential loop is more robust and easier to maintain.
            for (let i = 0; i < args.events.length; i++) {
                const eventArg = args.events[i];
                try {
                    const { timeMin, timeMax, timezone } = await this.normalizeTimeRange(
                        eventArg.startTime, eventArg.endTime, eventArg.timeZone || defaultTimezone
                    );
                    
                    const event: any = {
                        summary: eventArg.summary,
                        description: eventArg.description,
                        location: eventArg.location,
                        start: { dateTime: timeMin, timeZone: timezone },
                        end: { dateTime: timeMax, timeZone: timezone },
                        attendees: eventArg.attendees?.map(email => ({ email })),
                        colorId: eventArg.colorId,
                        visibility: eventArg.visibility,
                        transparency: eventArg.transparency,
                        reminders: eventArg.reminders
                    };

                    const response = await calendar.events.insert({
                        calendarId,
                        requestBody: event,
                        ...(args.sendUpdates && { sendUpdates: args.sendUpdates })
                    });
                    
                    results.push(convertGoogleEventToStructured(response.data, calendarId, 'default'));
                } catch (e: any) {
                    errors.push({ index: i, error: e.message || String(e) });
                }
            }

            return createStructuredResponse({
                success: errors.length === 0,
                createdCount: results.length,
                failedCount: errors.length,
                events: results,
                ...(errors.length > 0 && { errors })
            });
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
