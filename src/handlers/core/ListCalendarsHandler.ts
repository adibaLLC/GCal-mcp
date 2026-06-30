import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { ListCalendarsResponse } from "../../types/structured-responses.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { calendar_v3 } from "googleapis";

export class ListCalendarsHandler extends BaseToolHandler {
    async runTool(args: any): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendar = this.getCalendar(client);

        try {
            const response = await calendar.calendarList.list();
            const calendars = response.data.items || [];

            const formattedCalendars = calendars.map(cal => this.convertCalendarToStructured(cal));

            const structuredResponse: ListCalendarsResponse = {
                calendars: formattedCalendars,
                totalCount: formattedCalendars.length
            };

            return createStructuredResponse(structuredResponse);
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }

    private convertCalendarToStructured(cal: calendar_v3.Schema$CalendarListEntry) {
        return {
            id: cal.id || '',
            summary: cal.summary ?? undefined,
            description: cal.description ?? undefined,
            location: cal.location ?? undefined,
            timeZone: cal.timeZone ?? undefined,
            summaryOverride: cal.summaryOverride ?? undefined,
            colorId: cal.colorId ?? undefined,
            backgroundColor: cal.backgroundColor ?? undefined,
            foregroundColor: cal.foregroundColor ?? undefined,
            hidden: cal.hidden ?? undefined,
            selected: cal.selected ?? undefined,
            accessRole: cal.accessRole ?? undefined,
            defaultReminders: cal.defaultReminders?.map(r => ({
                method: (r.method as 'email' | 'popup') || 'popup',
                minutes: r.minutes || 0
            })),
            notificationSettings: cal.notificationSettings ? {
                notifications: cal.notificationSettings.notifications?.map(n => ({
                    type: n.type ?? undefined,
                    method: n.method ?? undefined
                }))
            } : undefined,
            primary: cal.primary ?? undefined,
            deleted: cal.deleted ?? undefined,
            conferenceProperties: cal.conferenceProperties ? {
                allowedConferenceSolutionTypes: cal.conferenceProperties.allowedConferenceSolutionTypes ?? undefined
            } : undefined
        };
    }
}
