import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();
const authController = new AuthController();

// POST /auth/register - Register user with email and optional BYOK
router.post('/register', authController.register);

// POST /auth/check - Check authentication status and usage limits
router.post('/check', authController.checkAuth);

export default router;
