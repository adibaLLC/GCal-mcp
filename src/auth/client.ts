import { OAuth2Client } from 'google-auth-library';
import { fetchBaserowToken } from './baserow.js';

/**
 * Initializes an OAuth2Client securely and statelessly for a given Baserow row.
 * Fetches encrypted tokens, decrypts them in-memory, and sets up the Google Client.
 * 
 * @param rowId The Baserow row ID
 * @returns Configured OAuth2Client ready for Google API calls
 */
export async function getAuthenticatedClient(rowId: string): Promise<OAuth2Client> {
  const credentials = await fetchBaserowToken(rowId);
  
  const client = new OAuth2Client({
    clientId: credentials.client_id,
    clientSecret: credentials.client_secret,
  });

  client.setCredentials({
    access_token: credentials.access_token || undefined,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date ? Number(credentials.expiry_date) : undefined
  });

  return client;
}