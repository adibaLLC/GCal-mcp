import crypto from 'crypto';

/**
 * Decrypts an AES-256-CBC encrypted string.
 * @param cipherText Format: hex(iv):hex(encryptedData)
 * @returns Decrypted string
 */
export function decryptToken(cipherText: string): string {
  if (!cipherText) return '';
  
  const encryptionKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('MASTER_ENCRYPTION_KEY environment variable is missing.');
  }

  // Ensure key is exactly 32 bytes (256 bits)
  const key = Buffer.from(encryptionKey, 'utf-8');
  if (key.length !== 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must be exactly 32 bytes long.');
  }

  const parts = cipherText.split(':');
  if (parts.length < 2) {
    throw new Error('Invalid cipherText format. Expected iv:encryptedData');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const encryptedText = Buffer.from(parts[1], 'base64');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf-8');
}
