import { Request, Response } from 'express';
import NotificationService, { GetNotificationsOptions } from '../services/NotificationService';
import { AuthRequest } from './AuthController';
import { logger } from '../utils/logger';

/**
 * NotificationController
 * Handles all notification-related HTTP requests
 */
class NotificationControllerClass {
  /**
   * Get all notifications for a clinic with filtering and pagination
   * GET /api/v1/notifications?clinicName=&page=&limit=&read=&category=
   */
  async getNotifications(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName, page, limit, read, category } = req.query;

      if (!clinicName || typeof clinicName !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CLINIC',
            message: 'Clinic name is required'
          }
        });
      }

      const options: GetNotificationsOptions = {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        read: read !== undefined ? read === 'true' : undefined,
        category: category as any
      };

      const result = await NotificationService.getClinicNotifications(clinicName, options);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: result.error || 'Failed to fetch notifications'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      logger.error('[NotificationController] Error in getNotifications:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get latest notifications for a clinic
   * GET /api/v1/notifications/latest?clinicName=&limit=
   */
  async getLatest(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName, limit } = req.query;

      if (!clinicName || typeof clinicName !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CLINIC',
            message: 'Clinic name is required'
          }
        });
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 2;

      const result = await NotificationService.getLatestNotifications(clinicName, limitNum);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: result.error || 'Failed to fetch latest notifications'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error: any) {
      logger.error('[NotificationController] Error in getLatest:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/v1/notifications/unread/count?clinicName=
   */
  async getUnreadCount(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.query;

      if (!clinicName || typeof clinicName !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CLINIC',
            message: 'Clinic name is required'
          }
        });
      }

      const userId = req.user?._id ? String(req.user._id) : undefined;

      const result = await NotificationService.getUnreadCount(clinicName, userId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: result.error || 'Failed to get unread count'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error: any) {
      logger.error('[NotificationController] Error in getUnreadCount:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get a single notification by ID
   * GET /api/v1/notifications/:id
   */
  async getNotificationById(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ID',
            message: 'Notification ID is required'
          }
        });
      }

      const result = await NotificationService.getNotificationById(id);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: result.error || 'Notification not found'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error: any) {
      logger.error('[NotificationController] Error in getNotificationById:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Mark a notification as read
   * PUT /api/v1/notifications/:id/read
   */
  async markAsRead(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = req.user?._id ? String(req.user._id) : undefined;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ID',
            message: 'Notification ID is required'
          }
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
      }

      const result = await NotificationService.markAsRead(id, userId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: result.error || 'Failed to mark notification as read'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error: any) {
      logger.error('[NotificationController] Error in markAsRead:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Mark all notifications as read for a clinic
   * PUT /api/v1/notifications/read-all
   */
  async markAllAsRead(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.body;
      const userId = req.user?._id ? String(req.user._id) : undefined;

      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CLINIC',
            message: 'Clinic name is required'
          }
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
      }

      const result = await NotificationService.markAllAsRead(clinicName, userId);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: result.error || 'Failed to mark all notifications as read'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } catch (error: any) {
      logger.error('[NotificationController] Error in markAllAsRead:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Delete a notification
   * DELETE /api/v1/notifications/:id
   */
  async deleteNotification(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ID',
            message: 'Notification ID is required'
          }
        });
      }

      const result = await NotificationService.deleteNotification(id);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: result.error || 'Failed to delete notification'
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error: any) {
      logger.error('[NotificationController] Error in deleteNotification:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  }
}

export const NotificationController = new NotificationControllerClass();
export default NotificationController;
