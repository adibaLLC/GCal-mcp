import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { convertGoogleEventToStructured } from "../../types/structured-responses.js";

interface RespondToEventArgs {
  calendarId: string;
  eventId: string;
  response: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

export class RespondToEventHandler extends BaseToolHandler {
    async runTool(args: RespondToEventArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarId = await this.resolveCalendarId(client, args.calendarId || 'primary');
        const calendar = this.getCalendar(client);
        
        try {
            const getResponse = await calendar.events.get({ calendarId, eventId: args.eventId });
            const event = getResponse.data;
            const userEmail = await this.getUserEmail(client);
            
            const attendees = event.attendees || [];
            const attendeeIndex = attendees.findIndex(a => a.email === userEmail || a.self);
            
            if (attendeeIndex === -1) {
                throw new Error(`User ${userEmail} is not an attendee of this event`);
            }
            
            attendees[attendeeIndex].responseStatus = args.response;
            const response = await calendar.events.patch({
                calendarId,
                eventId: args.eventId,
                requestBody: { attendees }
            });

            return createStructuredResponse({
                success: true,
                status: args.response,
                event: convertGoogleEventToStructured(response.data, calendarId, 'default')
            });
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
    
    private async getUserEmail(client: any): Promise<string> {
        try {
            const calendar = this.getCalendar(client);
            const calResponse = await calendar.calendars.get({ calendarId: 'primary' });
            return calResponse.data.id || '';
        } catch {
            return '';
        }
    }
}
