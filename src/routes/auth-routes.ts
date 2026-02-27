import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { AuthController } from '../controllers/AuthController';
import { 
  authenticate,  
  trackActivity 
} from '../middleware/authMiddleware';

const router = Router();
const authRateLimitWindowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10);

const createAuthRateLimiter = (maxRequests: number, errorCode: string, errorMessage: string) => rateLimit({
  windowMs: authRateLimitWindowMs,
  max: maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage
    }
  }
});

const loginRateLimiter = createAuthRateLimiter(
  parseInt(process.env.AUTH_LOGIN_MAX_REQUESTS || '10', 10),
  'TOO_MANY_LOGIN_ATTEMPTS',
  'Too many login attempts. Please try again later.'
);

const registerRateLimiter = createAuthRateLimiter(
  parseInt(process.env.AUTH_REGISTER_MAX_REQUESTS || '5', 10),
  'TOO_MANY_REGISTRATIONS',
  'Too many registration attempts. Please try again later.'
);

const forgotPasswordRateLimiter = createAuthRateLimiter(
  parseInt(process.env.AUTH_FORGOT_PASSWORD_MAX_REQUESTS || '5', 10),
  'TOO_MANY_PASSWORD_RESET_REQUESTS',
  'Too many password reset requests. Please try again later.'
);

const tokenRefreshRateLimiter = createAuthRateLimiter(
  parseInt(process.env.AUTH_REFRESH_MAX_REQUESTS || '30', 10),
  'TOO_MANY_TOKEN_REFRESH_REQUESTS',
  'Too many token refresh requests. Please try again later.'
);

/**
 * Public Authentication Routes
 * No authentication required
 */

// User Registration
router.post('/register',
  registerRateLimiter,
  AuthController.register
);

// User Login
router.post('/login',
  loginRateLimiter,
  AuthController.login
);

// Refresh Access Token
router.post('/refresh', 
  tokenRefreshRateLimiter,
  AuthController.refreshToken
);

// Forgot Password - Send reset email
router.post('/forgot-password', 
  forgotPasswordRateLimiter,
  AuthController.forgotPassword
);

// Reset Password with token
router.post('/reset-password', 
  AuthController.resetPassword
);

// Verify Email with token
router.get('/verify-email/:token', 
  AuthController.verifyEmail
);

/**
 * Protected Authentication Routes
 * Require authentication
 */

// Get current user profile
router.get('/profile', 
  authenticate,
  trackActivity,
  AuthController.getProfile
);

// User Logout (current session)
router.post('/logout', 
  authenticate,
  AuthController.logout
);

// Logout from all devices/sessions
router.post('/logout-all', 
  authenticate,
  AuthController.logoutAll
);

// Change Password
router.put('/password', 
  authenticate,
  AuthController.changePassword
);

/**
 * Admin Routes
 * Require admin privileges (will be implemented later)
 */

// Admin routes for user management would go here
// router.get('/users', authenticate, requireAdmin, UserController.getAllUsers);
// router.put('/users/:id/status', authenticate, requireAdmin, UserController.updateUserStatus);
// etc.

export default router;
