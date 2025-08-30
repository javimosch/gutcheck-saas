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

interface GroqUsageCheckResult {
  allowed: boolean;
  user?: IUser;
  groqUsageCount: number;
  error?: string;
}

interface UpdateSettingsParams {
  apiKey?: string;
  groqApiKey?: string;
  preferredModel?: string;
}

export class AuthService {
  private readonly MAX_FREE_USAGE = 10;
  private readonly MAX_FREE_GROQ_USAGE = 10;

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

  async checkGroqUsageLimit(email: string, ip: string): Promise<GroqUsageCheckResult> {
    try {
      const sanitizedEmail = sanitizeEmail(email);
      const user = await User.findOne({ email: sanitizedEmail });

      if (!user) {
        return { allowed: false, groqUsageCount: 0, error: 'User not found' };
      }

      const hasCustomGroqKey = !!user.groqKeyEncrypted;
      const groqUsageCount = user.groqUsageCount || 0;

      // Allow unlimited usage if user has BYOK Groq key
      if (hasCustomGroqKey) {
        return { allowed: true, user, groqUsageCount };
      }

      // Check free Groq usage limit
      if (groqUsageCount >= this.MAX_FREE_GROQ_USAGE) {
        return { 
          allowed: false, 
          user, 
          groqUsageCount,
          error: 'Free transcription limit reached. Please provide your own Groq API key to continue using voice features.' 
        };
      }

      return { allowed: true, user, groqUsageCount };
    } catch (error) {
      console.error('Groq usage check error:', error);
      return { allowed: false, groqUsageCount: 0, error: 'Groq usage check failed' };
    }
  }

  async incrementGroqUsage(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, { $inc: { groqUsageCount: 1 } });
    } catch (error) {
      console.error('Groq usage increment error:', error);
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

  async getGroqKey(user: IUser): Promise<string | null> {
    try {
      if (!user.groqKeyEncrypted) {
        return null;
      }

      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('Server encryption not configured');
      }

      return decryptKey(user.groqKeyEncrypted, encryptionKey);
    } catch (error) {
      console.error('Groq key decryption error:', error);
      return null;
    }
  }

  encodeEmailForStorage(email: string): string {
    return encodeEmail(email);
  }

  decodeEmailFromStorage(encodedEmail: string): string {
    return decodeEmail(encodedEmail);
  }

  async getUserById(userId: string): Promise<IUser | null> {
    try {
      return await User.findById(userId);
    } catch (error) {
      console.error('Get user by ID error:', error);
      return null;
    }
  }

  async updateUserSettings(userId: string, params: UpdateSettingsParams): Promise<AuthResult> {
    try {
      console.log('AuthService - updateUserSettings called with:', { userId, params });

      const user = await User.findById(userId);

      if (!user) {
        console.error('User not found:', userId);
        return { success: false, error: 'User not found' };
      }

      const setData: Partial<IUser> = {};
      const unsetData: { [key: string]: string } = {};

      // Update API key if provided
      if (params.apiKey !== undefined) {
        console.log('Updating API key:', params.apiKey ? 'setting new key' : 'removing key');
        if (params.apiKey) {
          // Encrypt the new API key
          const encryptionKey = process.env.ENCRYPTION_KEY;
          if (!encryptionKey) {
            return { success: false, error: 'Server encryption not configured' };
          }
          setData.llmKeyEncrypted = encryptKey(params.apiKey, encryptionKey);
        } else {
          // If empty string is provided, remove the API key
          unsetData.llmKeyEncrypted = "";
        }
      }

      // Update Groq API key if provided
      if (params.groqApiKey !== undefined) {
        console.log('Updating Groq API key:', params.groqApiKey ? 'setting new key' : 'removing key');
        if (params.groqApiKey) {
          // Encrypt the new Groq API key
          const encryptionKey = process.env.ENCRYPTION_KEY;
          if (!encryptionKey) {
            return { success: false, error: 'Server encryption not configured' };
          }
          setData.groqKeyEncrypted = encryptKey(params.groqApiKey, encryptionKey);
        } else {
          // If empty string is provided, remove the Groq API key
          unsetData.groqKeyEncrypted = "";
        }
      }

      // Update preferred model if provided
      if (params.preferredModel !== undefined) {
        console.log('Updating preferred model:', params.preferredModel || 'removing model');
        if (params.preferredModel) {
          setData.preferredModel = params.preferredModel;
        } else {
          // If empty string is provided, remove the preferred model
          unsetData.preferredModel = "";
        }
      }

      console.log('Set data:', setData);
      console.log('Unset data:', unsetData);

      // Build the update operation
      const updateOperation: any = {};
      if (Object.keys(setData).length > 0) {
        updateOperation.$set = setData;
      }
      if (Object.keys(unsetData).length > 0) {
        updateOperation.$unset = unsetData;
      }

      console.log('Update operation:', updateOperation);

      // Update the user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateOperation,
        { new: true }
      );

      console.log('Update result - user found:', !!updatedUser);
      if (updatedUser) {
        console.log('Updated user data:', {
          llmKeyEncrypted: !!updatedUser.llmKeyEncrypted,
          groqKeyEncrypted: !!updatedUser.groqKeyEncrypted,
          preferredModel: updatedUser.preferredModel
        });
      }

      return { success: true, user: updatedUser || undefined };
    } catch (error) {
      console.error('Update user settings error:', error);
      return { success: false, error: 'Failed to update user settings' };
    }
  }
}
