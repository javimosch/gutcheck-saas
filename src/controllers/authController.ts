import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { isValidEmail } from "../utils/validate";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

interface RegisterRequest extends Request {
  body: {
    email: string;
    byokKey?: string;
  };
}

interface UpdateSettingsRequest extends Request {
  user?: any;
  body: {
    apiKey?: string;
    groqApiKey?: string;
    preferredModel?: string;
  };
}

interface UserSettingsResponse {
  hasApiKey: boolean;
  hasGroqApiKey: boolean;
  preferredModel?: string;
  groqUsageCount: number;
  maxGroqUsage: number;
}

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: RegisterRequest, res: Response): Promise<void> => {
    try {
      const { email, byokKey } = req.body;
      const ip = req.ip || req.connection.remoteAddress || "unknown";

      if (!email || !isValidEmail(email)) {
        res.status(400).json({ error: "Valid email is required" });
        return;
      }

      const result = await this.authService.findOrCreateUser(
        email,
        ip,
        byokKey,
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      const encodedEmail = this.authService.encodeEmailForStorage(email);

      res.status(201).json({
        success: true,
        user: {
          email: encodedEmail,
          usageCount: result.user?.usageCount || 0,
          groqUsageCount: result.user?.groqUsageCount || 0,
          hasCustomKey: !!result.user?.llmKeyEncrypted,
          hasGroqKey: !!result.user?.groqKeyEncrypted,
        },
      });
    } catch (error) {
      console.error("Register controller error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  checkAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      const ip = req.ip || req.connection.remoteAddress || "unknown";

      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      let decodedEmail: string;
      try {
        decodedEmail = this.authService.decodeEmailFromStorage(email);
      } catch {
        decodedEmail = email;
      }

      if (!isValidEmail(decodedEmail)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }

      const usageCheck = await this.authService.checkUsageLimit(
        decodedEmail,
        ip,
      );

      const groqUsageCheck = await this.authService.checkGroqUsageLimit(
        decodedEmail,
        ip,
      );

      res.json({
        success: true,
        allowed: usageCheck.allowed,
        usageCount: usageCheck.usageCount,
        maxUsage: 10,
        groqUsageCount: groqUsageCheck.groqUsageCount,
        maxGroqUsage: 10,
        hasCustomKey: !!usageCheck.user?.llmKeyEncrypted,
        hasGroqKey: !!usageCheck.user?.groqKeyEncrypted,
        preferredModel: usageCheck.user?.preferredModel,
        error: usageCheck.error,
      });
    } catch (error) {
      console.error("Check auth controller error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  updateUserSettings = async (
    req: UpdateSettingsRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        console.error('No user found in request');
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      console.log('Update user settings - user ID:', req.user._id);
      console.log('Update user settings - request body:', req.body);

      const { apiKey, groqApiKey, preferredModel } = req.body;
      const userId = req.user._id.toString(); // Convert ObjectId to string

      const result = await this.authService.updateUserSettings(userId, {
        apiKey,
        groqApiKey,
        preferredModel,
      });

      if (!result.success) {
        console.error('Update user settings failed:', result.error);
        res.status(400).json({ error: result.error });
        return;
      }

      console.log('Update user settings success:', {
        hasCustomKey: !!result.user?.llmKeyEncrypted,
        hasGroqKey: !!result.user?.groqKeyEncrypted,
        preferredModel: result.user?.preferredModel,
      });

      res.json({
        success: true,
        hasCustomKey: !!result.user?.llmKeyEncrypted,
        hasGroqKey: !!result.user?.groqKeyEncrypted,
        preferredModel: result.user?.preferredModel,
      });
    } catch (error) {
      console.error("Update user settings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  getUserSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        console.error('No user found in request');
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      console.log('Get user settings - user ID:', req.user._id);
      const userId = req.user._id.toString(); // Convert ObjectId to string

      const user = await this.authService.getUserById(userId);

      if (!user) {
        console.error('User not found:', userId);
        res.status(404).json({ error: "User not found" });
        return;
      }

      console.log('Retrieved user data:', {
        llmKeyEncrypted: !!user.llmKeyEncrypted,
        groqKeyEncrypted: !!user.groqKeyEncrypted,
        preferredModel: user.preferredModel,
        groqUsageCount: user.groqUsageCount
      });

      const response: UserSettingsResponse = {
        hasApiKey: !!user.llmKeyEncrypted,
        hasGroqApiKey: !!user.groqKeyEncrypted,
        preferredModel: user.preferredModel,
        groqUsageCount: user.groqUsageCount || 0,
        maxGroqUsage: 10
      };

      res.json({
        success: true,
        ...response
      });
    } catch (error) {
      console.error("Get user settings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
