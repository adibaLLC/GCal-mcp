import { decryptToken } from './crypto.js';

export interface BaserowCredentials {
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  expiry_date?: string;
}

/**
 * Fetches the encrypted token from Baserow and decrypts it.
 * @param rowId The Baserow row ID
 */
export async function fetchBaserowToken(rowId: string): Promise<BaserowCredentials> {
  const baseUrl = process.env.BASEROW_API_URL || 'https://api.baserow.io';
  const apiToken = process.env.BASEROW_API_TOKEN;

  if (!apiToken) {
    throw new Error('BASEROW_API_TOKEN must be set');
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const url = `${cleanBaseUrl}/api/database/rows/table/759/${rowId}/?user_field_names=true`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`DATABASE_ERROR: Dentist ID ${rowId} not found in Table 759.`);
    }
    throw new Error(`DATABASE_ERROR: Baserow API returned status ${response.status}`);
  }

  const data = await response.json() as any;

  if (data.GCal_Auth_Status?.value === 'Revoked') {
    throw new Error("ERR_GOOGLE_AUTH_REVOKED");
  }

  const encryptedAccess = data['GCal_access_token'] || data['GCal_ access_token'] || data['access_token'];
  const encryptedRefresh = data['GCal_refresh_token'] || data['GCal_ refresh_token'] || data['refresh_token'];
  
  if (!encryptedRefresh) {
    throw new Error('GCal_refresh_token field is missing in Baserow response');
  }

  const accessToken = encryptedAccess ? decryptToken(encryptedAccess) : '';
  const refreshToken = decryptToken(encryptedRefresh);
  const expiryDate = data['expiry_date'] || data['GCal_token_expiry'];
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment');
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate
  };
}
