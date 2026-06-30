import { CallToolResult, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { GaxiosError } from 'gaxios';
import { calendar_v3, google } from "googleapis";
import { authContext } from "../../context.js";
import { getAuthenticatedClient } from "../../auth/client.js";
import { convertToRFC3339 } from "../../utils/datetime.js";

export abstract class BaseToolHandler<TArgs = any> {
    abstract runTool(args: TArgs): Promise<CallToolResult>;

    protected async getClient(): Promise<OAuth2Client> {
        const context = authContext.getStore();
        if (!context || !context.rowId) {
            throw new McpError(ErrorCode.InvalidRequest, "Missing authentication context. n8n must inject X-Baserow-Row-Id header.");
        }
        try {
            return await getAuthenticatedClient(context.rowId);
        } catch (error) {
            throw new McpError(ErrorCode.InternalError, `Auth failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    protected getCalendar(auth: OAuth2Client): calendar_v3.Calendar {
        return google.calendar({ version: 'v3', auth, timeout: 5000 });
    }

    protected getTimezone(): string {
        const context = authContext.getStore();
        return context?.timezone || 'UTC';
    }

    protected async normalizeTimeRange(
        timeMin?: string,
        timeMax?: string,
        timeZone?: string
    ): Promise<{ timeMin?: string; timeMax?: string; timezone: string }> {
        const timezone = timeZone || this.getTimezone();
        return {
            timeMin: timeMin ? convertToRFC3339(timeMin, timezone) : undefined,
            timeMax: timeMax ? convertToRFC3339(timeMax, timezone) : undefined,
            timezone
        };
    }

    protected async resolveCalendarId(client: OAuth2Client, nameOrId: string): Promise<string> {
        if (nameOrId === 'primary' || nameOrId.includes('@')) return nameOrId;
        try {
            const calendar = this.getCalendar(client);
            const response = await calendar.calendarList.list();
            const calendars = response.data.items || [];
            const lowerName = nameOrId.toLowerCase();
            let match = calendars.find(cal => cal.summaryOverride === nameOrId) ||
                        calendars.find(cal => cal.summaryOverride?.toLowerCase() === lowerName) ||
                        calendars.find(cal => cal.summary === nameOrId) ||
                        calendars.find(cal => cal.summary?.toLowerCase() === lowerName);
            if (match && match.id) return match.id;
            throw new McpError(ErrorCode.InvalidRequest, `Calendar "${nameOrId}" not found.`);
        } catch (error) {
            if (error instanceof McpError) throw error;
            throw this.handleGoogleApiError(error);
        }
    }

    protected async resolveCalendarIds(client: OAuth2Client, namesOrIds: string[]): Promise<string[]> {
        const validInputs = namesOrIds.filter(item => item && item.trim().length > 0);
        if (validInputs.length === 0) throw new McpError(ErrorCode.InvalidRequest, 'At least one calendar identifier is required');
        if (!validInputs.some(item => item !== 'primary' && !item.includes('@'))) return validInputs;
        
        const calendar = this.getCalendar(client);
        const response = await calendar.calendarList.list();
        const calendars = response.data.items || [];
        
        const overrideToIdMap = new Map<string, string>();
        const summaryToIdMap = new Map<string, string>();
        const lowerOverrideToIdMap = new Map<string, string>();
        const lowerSummaryToIdMap = new Map<string, string>();

        for (const cal of calendars) {
            if (cal.id) {
                if (cal.summaryOverride) {
                    overrideToIdMap.set(cal.summaryOverride, cal.id);
                    lowerOverrideToIdMap.set(cal.summaryOverride.toLowerCase(), cal.id);
                }
                if (cal.summary) {
                    summaryToIdMap.set(cal.summary, cal.id);
                    lowerSummaryToIdMap.set(cal.summary.toLowerCase(), cal.id);
                }
            }
        }

        const resolvedIds: string[] = [];
        const errors: string[] = [];

        for (const nameOrId of validInputs) {
            if (nameOrId === 'primary' || nameOrId.includes('@')) {
                resolvedIds.push(nameOrId);
                continue;
            }
            const lowerName = nameOrId.toLowerCase();
            const id = overrideToIdMap.get(nameOrId) || 
                       lowerOverrideToIdMap.get(lowerName) || 
                       summaryToIdMap.get(nameOrId) || 
                       lowerSummaryToIdMap.get(lowerName);
            if (id) resolvedIds.push(id);
            else errors.push(nameOrId);
        }

        if (errors.length > 0) throw new McpError(ErrorCode.InvalidRequest, `Calendar(s) not found: ${errors.join(', ')}`);
        return resolvedIds;
    }

    protected sortEventsByStartTime<T extends calendar_v3.Schema$Event>(events: T[]): T[] {
        return events.sort((a, b) => {
            const aStart = a.start?.dateTime || a.start?.date || '';
            const bStart = b.start?.dateTime || b.start?.date || '';
            return aStart.localeCompare(bStart);
        });
    }

    protected handleGoogleApiError(error: unknown): never {
        if (error instanceof GaxiosError) {
            const status = error.response?.status;
            if (status === 401 || error.response?.data?.error === 'invalid_grant') {
                throw new McpError(ErrorCode.InvalidRequest, 'ERR_GOOGLE_AUTH_REVOKED');
            }
            if (status === 403) throw new McpError(ErrorCode.InvalidRequest, `Access denied: Insufficient permissions`);
            if (status === 404) throw new McpError(ErrorCode.InvalidRequest, `Resource not found`);
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new McpError(ErrorCode.InvalidRequest, `Google API error: ${errorMessage}`);
        }
        if (error instanceof Error) throw new McpError(ErrorCode.InternalError, `Internal error: ${error.message}`);
        throw new McpError(ErrorCode.InternalError, 'An unknown error occurred');
    }

    protected formatGoogleApiError(error: unknown): string {
        try {
            this.handleGoogleApiError(error);
        } catch (e: any) {
            return e.message;
        }
    }
}
