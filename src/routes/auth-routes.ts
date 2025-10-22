import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { 
  authenticate,  
  trackActivity 
} from '../middleware/authMiddleware';

const router = Router();

/**
 * Public Authentication Routes
 * No authentication required
 */

// User Registration
router.post('/register',
  AuthController.register
);

// User Login
router.post('/login',
  AuthController.login
);

// Refresh Access Token
router.post('/refresh', 
  AuthController.refreshToken
);

// Forgot Password - Send reset email
router.post('/forgot-password', 
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
