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

  // Since we only have a refresh token, we set it directly. 
  // The Google auth library will automatically fetch a new access_token when making requests.
  client.setCredentials({
    refresh_token: credentials.refresh_token
  });

  return client;
}