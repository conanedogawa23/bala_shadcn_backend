import { Router } from 'express';
import NotificationController from '../controllers/NotificationController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

/**
 * Notification Routes
 * All routes require authentication
 */

// Get all notifications (with filtering and pagination)
router.get('/', authenticate, NotificationController.getNotifications);

// Get latest notifications
router.get('/latest', authenticate, NotificationController.getLatest);

// Get unread notification count
router.get('/unread/count', authenticate, NotificationController.getUnreadCount);

// Get single notification by ID
router.get('/:id', authenticate, NotificationController.getNotificationById);

// Mark notification as read
router.put('/:id/read', authenticate, NotificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', authenticate, NotificationController.markAllAsRead);

// Delete notification
router.delete('/:id', authenticate, NotificationController.deleteNotification);

export default router;
