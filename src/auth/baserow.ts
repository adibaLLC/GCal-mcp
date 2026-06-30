import { decryptToken } from './crypto.js';

export interface BaserowCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

/**
 * Fetches the encrypted token from Baserow and decrypts it.
 * @param rowId The Baserow row ID
 */
export async function fetchBaserowToken(rowId: string): Promise<BaserowCredentials> {
  const baseUrl = process.env.BASEROW_API_URL;
  const apiToken = process.env.BASEROW_API_TOKEN;

  if (!baseUrl || !apiToken) {
    throw new Error('BASEROW_API_URL and BASEROW_API_TOKEN must be set');
  }

  // Optional: remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  const response = await fetch(`${cleanBaseUrl}/api/database/rows/table/759/${rowId}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch from Baserow: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;

  // Assuming Baserow returns the encrypted token in a field named 'GCal_Refresh_Token'
  // Also assuming client_id and client_secret are provided in the environment or in the row
  // Wait, the plan only specifies decrypting 'GCal_Refresh_Token'. 
  // Let's assume the Google OAuth Client ID and Secret are loaded from the environment 
  // to avoid storing them repeatedly in Baserow if they are global for the SaaS, 
  // or if they are in Baserow, we can fetch them. 
  // Usually, a SaaS uses a single Google OAuth app. Let's use env vars for client id/secret.
  
  const encryptedRefreshToken = data.GCal_Refresh_Token;
  if (!encryptedRefreshToken) {
    throw new Error('GCal_Refresh_Token field is missing in Baserow response');
  }

  const refreshToken = decryptToken(encryptedRefreshToken);
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment');
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  };
}
