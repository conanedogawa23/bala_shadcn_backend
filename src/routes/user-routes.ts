import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { 
  authenticate, 
  requireAdmin, 
  requireManager,
  requireSelfOrAdmin,
  requirePermission
} from '../middleware/authMiddleware';

const router = Router();

/**
 * Admin User Management Routes
 * All routes require authentication and appropriate permissions
 */

// Get all users with filtering and pagination
router.get('/', 
  authenticate,
  requirePermission('canManageUsers'),
  UserController.getAllUsers
);

// Get user statistics and analytics
router.get('/stats', 
  authenticate,
  requireManager,
  UserController.getUserStats
);

// Get user by ID
router.get('/:id', 
  authenticate,
  requireSelfOrAdmin('id'),
  UserController.getUserById
);

// Create new user (Admin only)
router.post('/', 
  authenticate,
  requireAdmin,
  UserController.createUser
);

// Update user (Admin or self)
router.put('/:id', 
  authenticate,
  requireSelfOrAdmin('id'),
  UserController.updateUser
);

// Delete user (Admin only)
router.delete('/:id', 
  authenticate,
  requireAdmin,
  UserController.deleteUser
);

// Update user status (Admin only)
router.put('/:id/status', 
  authenticate,
  requireAdmin,
  UserController.updateUserStatus
);

// Unlock user account (Admin only)
router.put('/:id/unlock', 
  authenticate,
  requireAdmin,
  UserController.unlockUser
);

export default router;
