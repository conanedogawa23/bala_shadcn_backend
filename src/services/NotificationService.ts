import Notification, {
  INotification,
  NotificationType,
  NotificationCategory,
  NotificationAction,
  INotificationMetadata
} from '../models/Notification';
import { Types } from 'mongoose';
import { logger } from '../utils/logger';

// Service input interfaces
export interface CreateNotificationInput {
  type: NotificationType;
  category: NotificationCategory;
  action: NotificationAction;
  title: string;
  message: string;
  clinicName: string;
  entityId: string;
  entityType: 'Payment' | 'Order' | 'Appointment';
  metadata?: INotificationMetadata;
  createdBy?: string | Types.ObjectId;
}

export interface GetNotificationsOptions {
  page?: number;
  limit?: number;
  read?: boolean;
  category?: NotificationCategory;
}

export interface NotificationServiceResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

class NotificationServiceClass {
  /**
   * Create a new notification
   */
  async createNotification(
    input: CreateNotificationInput
  ): Promise<NotificationServiceResponse<INotification>> {
    try {
      const notification = new Notification({
        type: input.type,
        category: input.category,
        action: input.action,
        title: input.title,
        message: input.message,
        clinicName: input.clinicName,
        entityId: input.entityId,
        entityType: input.entityType,
        metadata: input.metadata || {},
        createdBy: input.createdBy ? new Types.ObjectId(input.createdBy as string) : undefined,
        read: false,
        readBy: []
      });

      await notification.save();

      logger.info(`[NotificationService] Created notification: ${notification.notificationId}`, {
        category: input.category,
        action: input.action,
        clinicName: input.clinicName
      });

      return {
        success: true,
        data: notification,
        message: 'Notification created successfully'
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error creating notification:', error);
      return {
        success: false,
        error: error.message || 'Failed to create notification'
      };
    }
  }

  /**
   * Get notifications for a clinic with filtering and pagination
   */
  async getClinicNotifications(
    clinicName: string,
    options: GetNotificationsOptions = {}
  ): Promise<NotificationServiceResponse<INotification[]>> {
    try {
      const {
        page = 1,
        limit = 20,
        read,
        category
      } = options;

      const skip = (page - 1) * limit;

      // Build query
      const query: any = { clinicName };

      if (read !== undefined) {
        query.read = read;
      }

      if (category) {
        query.category = category;
      }

      // Execute query with pagination
      const [notifications, total] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'username email profile.firstName profile.lastName')
          .lean(),
        Notification.countDocuments(query)
      ]);

      const pages = Math.ceil(total / limit);

      return {
        success: true,
        data: notifications as INotification[],
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error getting clinic notifications:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch notifications'
      };
    }
  }

  /**
   * Get latest notifications for a clinic
   */
  async getLatestNotifications(
    clinicName: string,
    limit: number = 2
  ): Promise<NotificationServiceResponse<INotification[]>> {
    try {
      const notifications = await Notification.find({ clinicName })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('createdBy', 'username email profile.firstName profile.lastName')
        .lean();

      return {
        success: true,
        data: notifications as INotification[]
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error getting latest notifications:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch latest notifications'
      };
    }
  }

  /**
   * Mark a notification as read by a specific user
   */
  async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<NotificationServiceResponse<INotification>> {
    try {
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return {
          success: false,
          error: 'Notification not found'
        };
      }

      await notification.markAsRead(userId);

      return {
        success: true,
        data: notification,
        message: 'Notification marked as read'
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error marking notification as read:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark notification as read'
      };
    }
  }

  /**
   * Mark all notifications as read for a user in a clinic
   */
  async markAllAsRead(
    clinicName: string,
    userId: string
  ): Promise<NotificationServiceResponse<{ count: number }>> {
    try {
      const userObjectId = new Types.ObjectId(userId);

      // Find all unread notifications for this clinic that user hasn't read
      const notifications = await Notification.find({
        clinicName,
        readBy: { $ne: userObjectId }
      });

      let count = 0;
      for (const notification of notifications) {
        await notification.markAsRead(userId);
        count++;
      }

      logger.info(`[NotificationService] Marked ${count} notifications as read for user ${userId} in clinic ${clinicName}`);

      return {
        success: true,
        data: { count },
        message: `Marked ${count} notifications as read`
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error marking all notifications as read:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark all notifications as read'
      };
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: string
  ): Promise<NotificationServiceResponse> {
    try {
      const result = await Notification.findByIdAndDelete(notificationId);

      if (!result) {
        return {
          success: false,
          error: 'Notification not found'
        };
      }

      logger.info(`[NotificationService] Deleted notification: ${notificationId}`);

      return {
        success: true,
        message: 'Notification deleted successfully'
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error deleting notification:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete notification'
      };
    }
  }

  /**
   * Get unread notification count for a clinic and optional user
   */
  async getUnreadCount(
    clinicName: string,
    userId?: string
  ): Promise<NotificationServiceResponse<{ count: number }>> {
    try {
      let count: number;

      if (userId) {
        const userObjectId = new Types.ObjectId(userId);
        // Count notifications that the user hasn't read
        count = await Notification.countDocuments({
          clinicName,
          readBy: { $ne: userObjectId }
        });
      } else {
        // Count all unread notifications
        count = await Notification.countDocuments({
          clinicName,
          read: false
        });
      }

      return {
        success: true,
        data: { count }
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error getting unread count:', error);
      return {
        success: false,
        error: error.message || 'Failed to get unread count'
      };
    }
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(
    notificationId: string
  ): Promise<NotificationServiceResponse<INotification>> {
    try {
      const notification = await Notification.findById(notificationId)
        .populate('createdBy', 'username email profile.firstName profile.lastName')
        .lean();

      if (!notification) {
        return {
          success: false,
          error: 'Notification not found'
        };
      }

      return {
        success: true,
        data: notification as INotification
      };
    } catch (error: any) {
      logger.error('[NotificationService] Error getting notification by ID:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch notification'
      };
    }
  }

  /**
   * Helper: Build notification message based on action and entity
   */
  buildNotificationMessage(
    category: NotificationCategory,
    action: NotificationAction,
    metadata: INotificationMetadata
  ): string {
    const { clientName, orderNumber, paymentNumber, amount, status, oldStatus, newStatus } = metadata;

    switch (category) {
      case NotificationCategory.PAYMENT:
        switch (action) {
          case NotificationAction.CREATED:
            return `Payment${paymentNumber ? ` ${paymentNumber}` : ''} of $${amount?.toFixed(2) || '0.00'} received${clientName ? ` from ${clientName}` : ''}`;
          case NotificationAction.UPDATED:
            return `Payment${paymentNumber ? ` ${paymentNumber}` : ''} has been updated`;
          case NotificationAction.DELETED:
            return `Payment${paymentNumber ? ` ${paymentNumber}` : ''} has been deleted`;
          case NotificationAction.REFUNDED:
            return `Payment${paymentNumber ? ` ${paymentNumber}` : ''} of $${amount?.toFixed(2) || '0.00'} has been refunded`;
          default:
            return `Payment ${action}`;
        }

      case NotificationCategory.ORDER:
        switch (action) {
          case NotificationAction.CREATED:
            return `New order${orderNumber ? ` ${orderNumber}` : ''} created${clientName ? ` for ${clientName}` : ''}`;
          case NotificationAction.UPDATED:
            return `Order${orderNumber ? ` ${orderNumber}` : ''} has been updated`;
          case NotificationAction.DELETED:
            return `Order${orderNumber ? ` ${orderNumber}` : ''} has been deleted`;
          case NotificationAction.STATUS_CHANGED:
            return `Order${orderNumber ? ` ${orderNumber}` : ''} status changed${oldStatus && newStatus ? ` from ${oldStatus} to ${newStatus}` : newStatus ? ` to ${newStatus}` : ''}`;
          case NotificationAction.COMPLETED:
            return `Order${orderNumber ? ` ${orderNumber}` : ''} has been completed`;
          case NotificationAction.CANCELLED:
            return `Order${orderNumber ? ` ${orderNumber}` : ''} has been cancelled`;
          default:
            return `Order ${action}`;
        }

      case NotificationCategory.APPOINTMENT:
        switch (action) {
          case NotificationAction.CREATED:
            return `New appointment scheduled${clientName ? ` for ${clientName}` : ''}`;
          case NotificationAction.UPDATED:
            return `Appointment${clientName ? ` for ${clientName}` : ''} has been updated`;
          case NotificationAction.DELETED:
            return `Appointment${clientName ? ` for ${clientName}` : ''} has been deleted`;
          case NotificationAction.STATUS_CHANGED:
            return `Appointment status changed${oldStatus && newStatus ? ` from ${oldStatus} to ${newStatus}` : newStatus ? ` to ${newStatus}` : ''}`;
          case NotificationAction.COMPLETED:
            return `Appointment${clientName ? ` for ${clientName}` : ''} has been completed`;
          case NotificationAction.CANCELLED:
            return `Appointment${clientName ? ` for ${clientName}` : ''} has been cancelled`;
          default:
            return `Appointment ${action}`;
        }

      default:
        return `${category} ${action}`;
    }
  }

  /**
   * Helper: Determine notification type based on action
   */
  determineNotificationType(action: NotificationAction): NotificationType {
    switch (action) {
      case NotificationAction.CREATED:
      case NotificationAction.COMPLETED:
        return NotificationType.SUCCESS;
      case NotificationAction.DELETED:
      case NotificationAction.CANCELLED:
      case NotificationAction.REFUNDED:
        return NotificationType.WARNING;
      case NotificationAction.UPDATED:
      case NotificationAction.STATUS_CHANGED:
        return NotificationType.INFO;
      default:
        return NotificationType.INFO;
    }
  }
}

export const NotificationService = new NotificationServiceClass();
export default NotificationService;
