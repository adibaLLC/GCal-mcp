import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { convertGoogleEventToStructured } from "../../types/structured-responses.js";

interface UpdateEventArgs {
  calendarId?: string;
  eventId: string;
  summary?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  timeZone?: string;
  attendees?: string[];
  sendUpdates?: 'all' | 'externalOnly' | 'none';
  recurrence?: string[];
  colorId?: string;
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  transparency?: 'opaque' | 'transparent';
  reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
}

export class UpdateEventHandler extends BaseToolHandler {
    async runTool(args: UpdateEventArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarId = await this.resolveCalendarId(client, args.calendarId || 'primary');
        const calendar = this.getCalendar(client);
        
        try {
            // First get the existing event to preserve fields not being updated
            const existingEvent = await calendar.events.get({ calendarId, eventId: args.eventId });
            
            const event: any = {
                ...existingEvent.data,
                sequence: (existingEvent.data.sequence || 0) + 1
            };

            if (args.summary !== undefined) event.summary = args.summary;
            if (args.description !== undefined) event.description = args.description;
            if (args.location !== undefined) event.location = args.location;
            if (args.colorId !== undefined) event.colorId = args.colorId;
            if (args.visibility !== undefined) event.visibility = args.visibility;
            if (args.transparency !== undefined) event.transparency = args.transparency;
            if (args.reminders !== undefined) event.reminders = args.reminders;
            if (args.recurrence !== undefined) event.recurrence = args.recurrence;

            if (args.startTime || args.endTime || args.timeZone) {
                const { timeMin, timeMax, timezone } = await this.normalizeTimeRange(
                    args.startTime || event.start?.dateTime || event.start?.date,
                    args.endTime || event.end?.dateTime || event.end?.date,
                    args.timeZone || event.start?.timeZone
                );
                
                if (args.startTime) event.start = { dateTime: timeMin, timeZone: timezone };
                if (args.endTime) event.end = { dateTime: timeMax, timeZone: timezone };
            }

            if (args.attendees !== undefined) {
                event.attendees = args.attendees.map(email => ({ email }));
            }

            const response = await calendar.events.update({
                calendarId,
                eventId: args.eventId,
                requestBody: event,
                ...(args.sendUpdates && { sendUpdates: args.sendUpdates })
            });

            return createStructuredResponse({
                success: true,
                event: convertGoogleEventToStructured(response.data, calendarId, 'default')
            });
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
