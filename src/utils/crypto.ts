import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const TAG_LENGTH = 16; // Authentication tag length

interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export const encryptKey = (text: string, key: string): string => {
  try {
    // Ensure key is exactly 32 bytes (256 bits) as required by aes-256-gcm
    // If key is not in hex format, use it directly as UTF-8
    const keyBuffer = key.length === 64 && /^[0-9a-f]+$/i.test(key) 
      ? Buffer.from(key, 'hex')
      : Buffer.from(key.padEnd(32, '0').slice(0, 32));
      
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    const result: EncryptedData = {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
    
    return Buffer.from(JSON.stringify(result)).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt key');
  }
};

export const decryptKey = (encryptedData: string, key: string): string => {
  try {
    const data: EncryptedData = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
    
    // Use the same key processing as in encryptKey
    const keyBuffer = key.length === 64 && /^[0-9a-f]+$/i.test(key) 
      ? Buffer.from(key, 'hex')
      : Buffer.from(key.padEnd(32, '0').slice(0, 32));
    
    const decipher = createDecipheriv(ALGORITHM, keyBuffer, Buffer.from(data.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt key');
  }
};

export const generateEncryptionKey = (): string => {
  return randomBytes(32).toString('hex');
};
