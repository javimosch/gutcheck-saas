import { User, IUser } from '../models/userModel';
import { isValidEmail, sanitizeEmail, encodeEmail, decodeEmail } from '../utils/validate';
import { encryptKey, decryptKey } from '../utils/crypto';

interface AuthResult {
  success: boolean;
  user?: IUser;
  error?: string;
}

interface UsageCheckResult {
  allowed: boolean;
  user?: IUser;
  usageCount: number;
  error?: string;
}

export class AuthService {
  private readonly MAX_FREE_USAGE = 10;

  async findOrCreateUser(email: string, ip: string, byokKey?: string): Promise<AuthResult> {
    try {
      if (!isValidEmail(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const sanitizedEmail = sanitizeEmail(email);
      
      let user = await User.findOne({ email: sanitizedEmail });
      
      if (!user) {
        const userData: Partial<IUser> = {
          email: sanitizedEmail,
          ip,
          usageCount: 0
        };

        if (byokKey) {
          const encryptionKey = process.env.ENCRYPTION_KEY;
          if (!encryptionKey) {
            return { success: false, error: 'Server encryption not configured' };
          }
          userData.llmKeyEncrypted = encryptKey(byokKey, encryptionKey);
        }

        user = await User.create(userData);
      }

      return { success: true, user };
    } catch (error) {
      console.error('Auth service error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  async checkUsageLimit(email: string, ip: string): Promise<UsageCheckResult> {
    try {
      const sanitizedEmail = sanitizeEmail(email);
      const user = await User.findOne({ email: sanitizedEmail });

      if (!user) {
        return { allowed: false, usageCount: 0, error: 'User not found' };
      }

      const hasCustomKey = !!user.llmKeyEncrypted;
      const usageCount = user.usageCount;

      // Allow unlimited usage if user has BYOK key
      if (hasCustomKey) {
        return { allowed: true, user, usageCount };
      }

      // Check free usage limit
      if (usageCount >= this.MAX_FREE_USAGE) {
        return { 
          allowed: false, 
          user, 
          usageCount,
          error: 'Free usage limit reached. Please provide your own OpenRouter API key.' 
        };
      }

      return { allowed: true, user, usageCount };
    } catch (error) {
      console.error('Usage check error:', error);
      return { allowed: false, usageCount: 0, error: 'Usage check failed' };
    }
  }

  async incrementUsage(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { $inc: { usageCount: 1 } });
    } catch (error) {
      console.error('Usage increment error:', error);
    }
  }

  async getUserKey(user: IUser): Promise<string | null> {
    try {
      if (!user.llmKeyEncrypted) {
        return null;
      }

      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('Server encryption not configured');
      }

      return decryptKey(user.llmKeyEncrypted, encryptionKey);
    } catch (error) {
      console.error('Key decryption error:', error);
      return null;
    }
  }

  encodeEmailForStorage(email: string): string {
    return encodeEmail(email);
  }

  decodeEmailFromStorage(encodedEmail: string): string {
    return decodeEmail(encodedEmail);
  }
}
