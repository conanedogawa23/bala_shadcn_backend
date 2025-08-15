import { ContactHistoryModel, IContactHistory } from '@/models/ContactHistory';
import { ClientModel } from '@/models/Client';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError, DatabaseError } from '@/utils/errors';

export interface ContactHistoryQuery {
  page?: number;
  limit?: number;
  clinicName?: string;
  clientId?: string;
  contactType?: string;
  direction?: string;
  priority?: string;
  followUpRequired?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface ContactHistoryStats {
  totalContacts: number;
  contactsByType: Record<string, number>;
  contactsByDirection: Record<string, number>;
  contactsByPriority: Record<string, number>;
  followUpsRequired: number;
  overdueFollowUps: number;
  averageResponseTime: number;
  recentActivity: number;
}

export class ContactHistoryService {
  /**
   * Get contact history with filtering and pagination
   * Uses efficient aggregation instead of forEach
   */
  static async getContactHistory(query: ContactHistoryQuery) {
    try {
      const {
        page = 1,
        limit = 50,
        clinicName,
        clientId,
        contactType,
        direction,
        priority,
        followUpRequired,
        startDate,
        endDate,
        search
      } = query;

      // Build filter efficiently
      const filter: any = { isActive: true };

      if (clinicName) {filter.clinicName = clinicName;}
      if (clientId) {filter.clientId = clientId;}
      if (contactType) {filter.contactType = contactType;}
      if (direction) {filter.direction = direction;}
      if (priority) {filter.priority = priority;}
      if (followUpRequired !== undefined) {filter.followUpRequired = followUpRequired;}

      // Date range filter
      if (startDate || endDate) {
        filter.contactDate = {};
        if (startDate) {filter.contactDate.$gte = startDate;}
        if (endDate) {filter.contactDate.$lte = endDate;}
      }

      // Text search filter
      if (search) {
        filter.$text = { $search: search };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute queries in parallel for performance
      const [contacts, total] = await Promise.all([
        ContactHistoryModel.find(filter)
          .sort({ contactDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ContactHistoryModel.countDocuments(filter)
      ]);

      logger.info(`📞 Retrieved ${contacts.length} contact history records`);

      return {
        contacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error retrieving contact history:', error);
      throw new DatabaseError('Failed to retrieve contact history');
    }
  }

  /**
   * Get contact history by ID
   */
  static async getContactHistoryById(id: number) {
    try {
      const contact = await ContactHistoryModel.findOne({ id, isActive: true }).lean();

      if (!contact) {
        throw new NotFoundError(`Contact history with ID ${id} not found`);
      }

      logger.info(`📞 Retrieved contact history: ${id}`);
      return contact;
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error retrieving contact history by ID:', error);
      throw new DatabaseError('Failed to retrieve contact history');
    }
  }

  /**
   * Create new contact history record
   */
  static async createContactHistory(contactData: Partial<IContactHistory>) {
    try {
      // Validate required fields
      if (!contactData.contactType || !contactData.contactDate) {
        throw new ValidationError('Contact type and date are required');
      }

      // Validate client exists if provided
      if (contactData.clientId) {
        const clientExists = await ClientModel.findOne({ 
          clientId: contactData.clientId, 
          isActive: true 
        }).lean();

        if (!clientExists) {
          throw new ValidationError(`Client ${contactData.clientId} not found`);
        }
      }

      // Get next ID efficiently
      const lastContact = await ContactHistoryModel.findOne({}, { id: 1 })
        .sort({ id: -1 })
        .lean();
      
      const nextId = (lastContact?.id || 0) + 1;

      const newContact = new ContactHistoryModel({
        ...contactData,
        id: nextId,
        isActive: true,
        createdAt: new Date()
      });

      const savedContact = await newContact.save();
      logger.info(`📞 Created contact history: ${savedContact.id}`);

      return savedContact;
    } catch (error) {
      if (error instanceof ValidationError) {throw error;}
      logger.error('Error creating contact history:', error);
      throw new DatabaseError('Failed to create contact history');
    }
  }

  /**
   * Update contact history record
   */
  static async updateContactHistory(id: number, updateData: Partial<IContactHistory>) {
    try {
      const contact = await ContactHistoryModel.findOne({ id, isActive: true });

      if (!contact) {
        throw new NotFoundError(`Contact history with ID ${id} not found`);
      }

      // Update fields efficiently using Object.assign
      Object.assign(contact, updateData, { modifiedAt: new Date() });

      const updatedContact = await contact.save();
      logger.info(`📞 Updated contact history: ${id}`);

      return updatedContact;
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error updating contact history:', error);
      throw new DatabaseError('Failed to update contact history');
    }
  }

  /**
   * Delete contact history (soft delete)
   */
  static async deleteContactHistory(id: number) {
    try {
      const contact = await ContactHistoryModel.findOne({ id, isActive: true });

      if (!contact) {
        throw new NotFoundError(`Contact history with ID ${id} not found`);
      }

      contact.isActive = false;
      contact.modifiedAt = new Date();
      await contact.save();

      logger.info(`📞 Deleted contact history: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error deleting contact history:', error);
      throw new DatabaseError('Failed to delete contact history');
    }
  }

  /**
   * Get contact history by client with optimized aggregation
   */
  static async getContactHistoryByClient(clientId: string, limit = 50) {
    try {
      const contacts = await ContactHistoryModel.findByClient(clientId, limit);
      
      logger.info(`📞 Retrieved ${contacts.length} contacts for client: ${clientId}`);
      return contacts;
    } catch (error) {
      logger.error('Error retrieving client contact history:', error);
      throw new DatabaseError('Failed to retrieve client contact history');
    }
  }

  /**
   * Get contact history by clinic with efficient querying
   */
  static async getContactHistoryByClinic(clinicName: string, limit = 100) {
    try {
      const contacts = await ContactHistoryModel.findByClinic(clinicName, limit);
      
      logger.info(`📞 Retrieved ${contacts.length} contacts for clinic: ${clinicName}`);
      return contacts;
    } catch (error) {
      logger.error('Error retrieving clinic contact history:', error);
      throw new DatabaseError('Failed to retrieve clinic contact history');
    }
  }

  /**
   * Get follow-ups required with efficient filtering
   */
  static async getFollowUpsRequired(clinicName?: string) {
    try {
      const followUps = await ContactHistoryModel.findFollowUpsRequired(clinicName);
      
      logger.info(`📞 Retrieved ${followUps.length} follow-ups required`);
      return followUps;
    } catch (error) {
      logger.error('Error retrieving follow-ups:', error);
      throw new DatabaseError('Failed to retrieve follow-ups');
    }
  }

  /**
   * Mark follow-up as completed
   */
  static async markFollowUpCompleted(id: number, notes?: string) {
    try {
      const contact = await ContactHistoryModel.findOne({ id, isActive: true });

      if (!contact) {
        throw new NotFoundError(`Contact history with ID ${id} not found`);
      }

      contact.markAsFollowedUp();
      
      if (notes) {
        contact.description = contact.description ? 
          `${contact.description}\n\nFollow-up completed: ${notes}` : 
          `Follow-up completed: ${notes}`;
      }

      await contact.save();
      logger.info(`📞 Marked follow-up completed: ${id}`);

      return contact;
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error marking follow-up completed:', error);
      throw new DatabaseError('Failed to mark follow-up completed');
    }
  }

  /**
   * Get contact history statistics with efficient aggregation
   */
  static async getContactHistoryStats(clinicName?: string, days = 30): Promise<ContactHistoryStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const matchStage: any = {
        isActive: true,
        contactDate: { $gte: startDate }
      };

      if (clinicName) {
        matchStage.clinicName = clinicName;
      }

      // Use efficient aggregation pipeline instead of multiple queries
      const [statsResult] = await ContactHistoryModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalContacts: { $sum: 1 },
            contactsByType: {
              $push: '$contactType'
            },
            contactsByDirection: {
              $push: '$direction'
            },
            contactsByPriority: {
              $push: '$priority'
            },
            followUpsRequired: {
              $sum: { $cond: ['$followUpRequired', 1, 0] }
            },
            overdueFollowUps: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      '$followUpRequired',
                      { $lt: ['$followUpDate', new Date()] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      // Process contact type counts efficiently
      const contactsByType = statsResult?.contactsByType.reduce((acc: Record<string, number>, type: string) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}) || {};

      const contactsByDirection = statsResult?.contactsByDirection.reduce((acc: Record<string, number>, dir: string) => {
        acc[dir] = (acc[dir] || 0) + 1;
        return acc;
      }, {}) || {};

      const contactsByPriority = statsResult?.contactsByPriority.reduce((acc: Record<string, number>, priority: string) => {
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      }, {}) || {};

      // Get recent activity count
      const recentActivity = await ContactHistoryModel.countDocuments({
        ...matchStage,
        contactDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      const stats: ContactHistoryStats = {
        totalContacts: statsResult?.totalContacts || 0,
        contactsByType,
        contactsByDirection,
        contactsByPriority,
        followUpsRequired: statsResult?.followUpsRequired || 0,
        overdueFollowUps: statsResult?.overdueFollowUps || 0,
        averageResponseTime: 0, // TODO: Calculate from appointment/response data
        recentActivity
      };

      logger.info(`📊 Generated contact history stats: ${stats.totalContacts} total contacts`);
      return stats;
    } catch (error) {
      logger.error('Error generating contact history stats:', error);
      throw new DatabaseError('Failed to generate contact history stats');
    }
  }

  /**
   * Add tag to contact history
   */
  static async addTag(id: number, tag: string) {
    try {
      const contact = await ContactHistoryModel.findOne({ id, isActive: true });

      if (!contact) {
        throw new NotFoundError(`Contact history with ID ${id} not found`);
      }

      contact.addTag(tag);
      await contact.save();

      logger.info(`📞 Added tag "${tag}" to contact: ${id}`);
      return contact;
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error adding tag to contact history:', error);
      throw new DatabaseError('Failed to add tag to contact history');
    }
  }

  /**
   * Get recent activity with efficient date filtering
   */
  static async getRecentActivity(clinicName?: string, days = 7) {
    try {
      const recentContacts = await ContactHistoryModel.getRecentActivity(clinicName, days);
      
      logger.info(`📞 Retrieved ${recentContacts.length} recent activity records`);
      return recentContacts;
    } catch (error) {
      logger.error('Error retrieving recent activity:', error);
      throw new DatabaseError('Failed to retrieve recent activity');
    }
  }
}
