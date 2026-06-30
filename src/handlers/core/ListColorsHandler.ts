import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { createStructuredResponse } from "../../utils/response-builder.js";

export class ListColorsHandler extends BaseToolHandler {
    async runTool(args: any): Promise<CallToolResult> {
        const client = await this.getClient();
        const calendar = this.getCalendar(client);
        
        try {
            const response = await calendar.colors.get();
            return createStructuredResponse({ colors: response.data });
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
