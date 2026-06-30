import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { convertGoogleEventToStructured } from "../../types/structured-responses.js";

interface CreateEventArgs {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  timeZone?: string;
  attendees?: string[];
  sendUpdates?: 'all' | 'externalOnly' | 'none';
  recurrence?: string[];
  colorId?: string;
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  transparency?: 'opaque' | 'transparent';
  reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: string };
    }
  };
}

export class CreateEventHandler extends BaseToolHandler {
    async runTool(args: CreateEventArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarId = await this.resolveCalendarId(client, args.calendarId || 'primary');
        const calendar = this.getCalendar(client);
        
        try {
            const { timeMin, timeMax, timezone } = await this.normalizeTimeRange(args.startTime, args.endTime, args.timeZone);
            
            const event: any = {
                summary: args.summary,
                description: args.description,
                location: args.location,
                start: { dateTime: timeMin, timeZone: timezone },
                end: { dateTime: timeMax, timeZone: timezone },
                attendees: args.attendees?.map(email => ({ email })),
                recurrence: args.recurrence,
                colorId: args.colorId,
                visibility: args.visibility,
                transparency: args.transparency,
                reminders: args.reminders,
                conferenceData: args.conferenceData
            };

            const response = await calendar.events.insert({
                calendarId,
                requestBody: event,
                ...(args.sendUpdates && { sendUpdates: args.sendUpdates }),
                ...(args.conferenceData && { conferenceDataVersion: 1 })
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
