import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { BatchRequestHandler } from "./BatchRequestHandler.js";
import { buildListFieldMask } from "../../utils/field-mask-builder.js";
import { createStructuredResponse } from "../../utils/response-builder.js";
import { ListEventsResponse, StructuredEvent, convertGoogleEventToStructured, ExtendedEvent } from "../../types/structured-responses.js";

interface ListEventsArgs {
  calendarId: string | string[];
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
  fields?: string[];
  privateExtendedProperty?: string[];
  sharedExtendedProperty?: string[];
}

export class ListEventsHandler extends BaseToolHandler {
    async runTool(args: ListEventsArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarNamesOrIds = Array.isArray(args.calendarId) ? args.calendarId : [args.calendarId];
        const calendarIds = await this.resolveCalendarIds(client, calendarNamesOrIds);
        
        const events = await this.fetchEvents(client, calendarIds, args);
        const structuredEvents: StructuredEvent[] = events.map(event =>
            convertGoogleEventToStructured(event, event.calendarId, 'default')
        );

        const response: ListEventsResponse = {
            events: structuredEvents,
            totalCount: events.length,
            calendars: calendarIds.length > 1 ? calendarIds : undefined
        };

        return createStructuredResponse(response);
    }

    private async fetchEvents(
        client: OAuth2Client,
        calendarIds: string[],
        options: Omit<ListEventsArgs, 'calendarId'>
    ): Promise<ExtendedEvent[]> {
        if (calendarIds.length === 1) {
            return this.fetchSingleCalendarEvents(client, calendarIds[0], options);
        }
        return this.fetchMultipleCalendarEvents(client, calendarIds, options);
    }

    private async fetchSingleCalendarEvents(
        client: OAuth2Client,
        calendarId: string,
        options: Omit<ListEventsArgs, 'calendarId'>
    ): Promise<ExtendedEvent[]> {
        try {
            const calendar = this.getCalendar(client);
            const { timeMin, timeMax } = await this.normalizeTimeRange(options.timeMin, options.timeMax, options.timeZone);
            const fieldMask = buildListFieldMask(options.fields);
            
            const response = await calendar.events.list({
                calendarId,
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: 'startTime',
                ...(fieldMask && { fields: fieldMask }),
                ...(options.privateExtendedProperty && { privateExtendedProperty: options.privateExtendedProperty as any }),
                ...(options.sharedExtendedProperty && { sharedExtendedProperty: options.sharedExtendedProperty as any })
            });
            
            return (response.data.items || []).map(event => ({ ...event, calendarId }));
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }

    private async fetchMultipleCalendarEvents(
        client: OAuth2Client,
        calendarIds: string[],
        options: Omit<ListEventsArgs, 'calendarId'>
    ): Promise<ExtendedEvent[]> {
        const batchHandler = new BatchRequestHandler(client);
        const requests = await Promise.all(calendarIds.map(async (calendarId) => ({
            method: "GET" as const,
            path: await this.buildEventsPath(calendarId, options)
        })));
        
        const responses = await batchHandler.executeBatch(requests);
        const { events, errors } = this.processBatchResponses(responses, calendarIds);
        
        if (errors.length > 0) {
            process.stderr.write(`Some calendars had errors: ${errors.map(e => `${e.calendarId}: ${e.error}`).join(', ')}\n`);
        }
        
        return this.sortEventsByStartTime(events);
    }

    private async buildEventsPath(calendarId: string, options: Omit<ListEventsArgs, 'calendarId'>): Promise<string> {
        const { timeMin, timeMax } = await this.normalizeTimeRange(options.timeMin, options.timeMax, options.timeZone);
        const fieldMask = buildListFieldMask(options.fields);
        const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime" });
        if (timeMin) params.set('timeMin', timeMin);
        if (timeMax) params.set('timeMax', timeMax);
        if (fieldMask) params.set('fields', fieldMask);
        if (options.privateExtendedProperty) {
            for (const kv of options.privateExtendedProperty) params.append('privateExtendedProperty', kv);
        }
        if (options.sharedExtendedProperty) {
            for (const kv of options.sharedExtendedProperty) params.append('sharedExtendedProperty', kv);
        }
        return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    }

    private processBatchResponses(responses: any[], calendarIds: string[]) {
        const events: ExtendedEvent[] = [];
        const errors: Array<{ calendarId: string; error: string }> = [];
        responses.forEach((response, index) => {
            const calendarId = calendarIds[index];
            if (response.statusCode === 200 && response.body?.items) {
                events.push(...response.body.items.map((event: any) => ({ ...event, calendarId })));
            } else {
                errors.push({ calendarId, error: response.body?.error?.message || `HTTP ${response.statusCode}` });
            }
        });
        return { events, errors };
    }
}
