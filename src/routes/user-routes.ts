import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { 
  authenticate, 
  requireSelfOrPermission,
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
  requirePermission('canManageUsers'),
  UserController.getUserStats
);

// Get user by ID
router.get('/:id', 
  authenticate,
  requireSelfOrPermission('id', 'canManageUsers'),
  UserController.getUserById
);

// Create new user (Admin only)
router.post('/', 
  authenticate,
  requirePermission('canManageUsers'),
  UserController.createUser
);

// Update user (Admin or self)
router.put('/:id', 
  authenticate,
  requireSelfOrPermission('id', 'canManageUsers'),
  UserController.updateUser
);

// Delete user (Admin only)
router.delete('/:id', 
  authenticate,
  requirePermission('canManageUsers'),
  UserController.deleteUser
);

// Update user status (Admin only)
router.put('/:id/status', 
  authenticate,
  requirePermission('canManageUsers'),
  UserController.updateUserStatus
);

// Unlock user account (Admin only)
router.put('/:id/unlock', 
  authenticate,
  requirePermission('canManageUsers'),
  UserController.unlockUser
);

export default router;
