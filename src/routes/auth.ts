import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { AuthMiddleware } from '../middleware/authMiddleware';

const router = Router();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();

// POST /auth/register - Register user with email and optional BYOK
router.post('/register', authController.register);

// POST /auth/check - Check authentication status and usage limits
router.post('/check', authController.checkAuth);

// PUT /auth/settings - Update user settings (API key and model preference)
router.put('/settings', authMiddleware.requireAuth, authController.updateUserSettings);

// GET /auth/settings - Get user settings
router.get('/settings', authMiddleware.requireAuth, authController.getUserSettings);

export default router;
