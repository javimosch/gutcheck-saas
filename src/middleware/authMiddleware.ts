import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get email from body, headers, or query parameters
      let email = req.body?.email || req.headers['x-user-email'] || req.query.email;
      
      const ip = req.ip || req.connection.remoteAddress || 'unknown';

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      // Decode email if it's base64 encoded (from localStorage)
      let decodedEmail: string;
      try {
        decodedEmail = this.authService.decodeEmailFromStorage(email);
      } catch {
        // If decoding fails, assume it's plain text email
        decodedEmail = email;
      }

      const authResult = await this.authService.findOrCreateUser(decodedEmail, ip);
      
      if (!authResult.success || !authResult.user) {
        res.status(401).json({ error: authResult.error || 'Authentication failed' });
        return;
      }

      // Check usage limits
      const usageCheck = await this.authService.checkUsageLimit(decodedEmail, ip);
      
      if (!usageCheck.allowed) {
        res.status(429).json({ 
          error: usageCheck.error || 'Usage limit exceeded',
          usageCount: usageCheck.usageCount,
          maxUsage: 10
        });
        return;
      }

      req.user = authResult.user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  checkIPUsage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      // For initial access, allow first request without email
      // This will be used to determine if registration is required
      next();
    } catch (error) {
      console.error('IP check middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
