import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";

interface DeleteEventArgs {
  eventId: string;
  calendarId?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export class DeleteEventHandler extends BaseToolHandler {
    async runTool(args: DeleteEventArgs): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendarId = await this.resolveCalendarId(client, args.calendarId || 'primary');
        const calendar = this.getCalendar(client);
        
        try {
            await calendar.events.delete({
                calendarId,
                eventId: args.eventId,
                ...(args.sendUpdates && { sendUpdates: args.sendUpdates })
            });

            return createStructuredResponse({
                success: true,
                message: `Event ${args.eventId} deleted successfully`
            });
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
