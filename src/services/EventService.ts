import { EventModel, IEvent } from '../models/Event';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class EventService {
  /**
   * Get all events with optional filtering
   */
  static async getAllEvents(filters: {
    clientId?: string;
    categoryId?: number;
    userId?: number;
    clinicName?: string;
    isPublic?: boolean;
    isApproved?: boolean;
    startDate?: Date;
    endDate?: Date;
    upcoming?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    events: IEvent[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, limit = 50, startDate, endDate, upcoming, ...filterParams } = filters;
      const skip = (page - 1) * limit;
      
      // Build query
      const query: any = {};
      
      // Apply filters using for...of (avoiding forEach per coding standards)
      for (const [key, value] of Object.entries(filterParams)) {
        if (value !== undefined && value !== null) {
          if (key === 'clinicName') {
            query.clientClinicName = new RegExp(value as string, 'i');
          } else {
            query[key] = value;
          }
        }
      }
      
      // Date filtering
      if (upcoming) {
        query.eventDate = { $gte: new Date() };
      } else if (startDate && endDate) {
        query.eventDate = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        query.eventDate = { $gte: startDate };
      } else if (endDate) {
        query.eventDate = { $lte: endDate };
      }
      
      const [events, total] = await Promise.all([
        EventModel.find(query)
          .sort({ eventDate: upcoming ? 1 : -1, eventTime: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        EventModel.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      logger.info(`Retrieved ${events.length} events (page ${page}/${totalPages})`);
      
      return {
        events,
        total,
        page,
        totalPages
      };
    } catch (error) {
      logger.error('Error getting events:', error);
      throw new AppError('Failed to retrieve events', 500);
    }
  }

  /**
   * Get event by ID
   */
  static async getEventById(id: string): Promise<IEvent | null> {
    try {
      const event = await EventModel.findById(id).lean();
      
      if (!event) {
        logger.warn(`Event not found: ${id}`);
        return null;
      }
      
      logger.info(`Retrieved event: ${event.title}`);
      return event;
    } catch (error) {
      logger.error(`Error getting event ${id}:`, error);
      throw new AppError('Failed to retrieve event', 500);
    }
  }

  /**
   * Get event by event ID (MSSQL key)
   */
  static async getEventByEventId(eventId: number): Promise<IEvent | null> {
    try {
      const event = await EventModel.findOne({ eventId }).lean();
      
      if (!event) {
        logger.warn(`Event not found for eventId: ${eventId}`);
        return null;
      }
      
      logger.info(`Retrieved event by eventId: ${event.title}`);
      return event;
    } catch (error) {
      logger.error(`Error getting event by eventId ${eventId}:`, error);
      throw new AppError('Failed to retrieve event', 500);
    }
  }

  /**
   * Get upcoming events
   */
  static async getUpcomingEvents(limit?: number): Promise<IEvent[]> {
    try {
      const query = EventModel.findUpcoming(limit);
      const events = await query.lean();
      
      logger.info(`Retrieved ${events.length} upcoming events`);
      return events;
    } catch (error) {
      logger.error('Error getting upcoming events:', error);
      throw new AppError('Failed to retrieve upcoming events', 500);
    }
  }

  /**
   * Get events by date range
   */
  static async getEventsByDateRange(startDate: Date, endDate: Date): Promise<IEvent[]> {
    try {
      const events = await EventModel.findByDateRange(startDate, endDate).lean();
      
      logger.info(`Retrieved ${events.length} events between ${startDate.toDateString()} and ${endDate.toDateString()}`);
      return events;
    } catch (error) {
      logger.error('Error getting events by date range:', error);
      throw new AppError('Failed to retrieve events by date range', 500);
    }
  }

  /**
   * Get events for a specific client
   */
  static async getEventsByClient(clientId: string): Promise<IEvent[]> {
    try {
      const events = await EventModel.findByClient(clientId).lean();
      
      logger.info(`Retrieved ${events.length} events for client: ${clientId}`);
      return events;
    } catch (error) {
      logger.error(`Error getting events for client ${clientId}:`, error);
      throw new AppError('Failed to retrieve client events', 500);
    }
  }

  /**
   * Get events by category
   */
  static async getEventsByCategory(categoryId: number): Promise<IEvent[]> {
    try {
      const events = await EventModel.findByCategory(categoryId).lean();
      
      logger.info(`Retrieved ${events.length} events for category: ${categoryId}`);
      return events;
    } catch (error) {
      logger.error(`Error getting events for category ${categoryId}:`, error);
      throw new AppError('Failed to retrieve category events', 500);
    }
  }

  /**
   * Get events by clinic
   */
  static async getEventsByClinic(clinicName: string): Promise<IEvent[]> {
    try {
      const events = await EventModel.findByClinic(clinicName).lean();
      
      logger.info(`Retrieved ${events.length} events for clinic: ${clinicName}`);
      return events;
    } catch (error) {
      logger.error(`Error getting events for clinic ${clinicName}:`, error);
      throw new AppError('Failed to retrieve clinic events', 500);
    }
  }

  /**
   * Get public events
   */
  static async getPublicEvents(startDate?: Date, endDate?: Date): Promise<IEvent[]> {
    try {
      const events = await EventModel.findPublicEvents(startDate, endDate).lean();
      
      logger.info(`Retrieved ${events.length} public events`);
      return events;
    } catch (error) {
      logger.error('Error getting public events:', error);
      throw new AppError('Failed to retrieve public events', 500);
    }
  }

  /**
   * Get events pending approval
   */
  static async getPendingApprovalEvents(): Promise<IEvent[]> {
    try {
      const events = await EventModel.findPendingApproval().lean();
      
      logger.info(`Retrieved ${events.length} events pending approval`);
      return events;
    } catch (error) {
      logger.error('Error getting pending approval events:', error);
      throw new AppError('Failed to retrieve pending approval events', 500);
    }
  }

  /**
   * Create new event
   */
  static async createEvent(eventData: Partial<IEvent>): Promise<IEvent> {
    try {
      // Check if event ID already exists (if provided)
      if (eventData.eventId) {
        const existing = await EventModel.findOne({ eventId: eventData.eventId });
        if (existing) {
          throw new AppError(`Event with ID ${eventData.eventId} already exists`, 409);
        }
      }
      
      const event = new EventModel(eventData);
      await event.save();
      
      logger.info(`Created event: ${event.title} (ID: ${event.eventId})`);
      return event.toObject();
    } catch (error) {
      if (error instanceof AppError) {throw error;}
      
      logger.error('Error creating event:', error);
      throw new AppError('Failed to create event', 500);
    }
  }

  /**
   * Update event
   */
  static async updateEvent(id: string, updateData: Partial<IEvent>): Promise<IEvent | null> {
    try {
      // Don't allow updating the unique eventId
      delete updateData.eventId;
      
      const event = await EventModel.findByIdAndUpdate(
        id,
        { ...updateData, dateModified: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!event) {
        logger.warn(`Event not found for update: ${id}`);
        return null;
      }
      
      logger.info(`Updated event: ${event.title}`);
      return event.toObject();
    } catch (error) {
      logger.error(`Error updating event ${id}:`, error);
      throw new AppError('Failed to update event', 500);
    }
  }

  /**
   * Delete event
   */
  static async deleteEvent(id: string): Promise<boolean> {
    try {
      const result = await EventModel.findByIdAndDelete(id);
      
      if (!result) {
        logger.warn(`Event not found for deletion: ${id}`);
        return false;
      }
      
      logger.info(`Deleted event: ${result.title}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting event ${id}:`, error);
      throw new AppError('Failed to delete event', 500);
    }
  }

  /**
   * Approve event
   */
  static async approveEvent(id: string): Promise<IEvent | null> {
    try {
      const event = await EventModel.findByIdAndUpdate(
        id,
        { isApproved: true, dateModified: new Date() },
        { new: true }
      );
      
      if (!event) {
        logger.warn(`Event not found for approval: ${id}`);
        return null;
      }
      
      logger.info(`Approved event: ${event.title}`);
      return event.toObject();
    } catch (error) {
      logger.error(`Error approving event ${id}:`, error);
      throw new AppError('Failed to approve event', 500);
    }
  }

  /**
   * Toggle event visibility (public/private)
   */
  static async toggleEventVisibility(id: string): Promise<IEvent | null> {
    try {
      const event = await EventModel.findById(id);
      
      if (!event) {
        logger.warn(`Event not found for visibility toggle: ${id}`);
        return null;
      }
      
      event.isPublic = !event.isPublic;
      event.dateModified = new Date();
      await event.save();
      
      logger.info(`Toggled event visibility: ${event.title} (Public: ${event.isPublic})`);
      return event.toObject();
    } catch (error) {
      logger.error(`Error toggling event visibility ${id}:`, error);
      throw new AppError('Failed to toggle event visibility', 500);
    }
  }

  /**
   * Get event statistics
   */
  static async getEventStats(): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    publicEvents: number;
    pendingApproval: number;
    eventsWithClients: number;
    categoriesCount: number;
    topCategories: Array<{ categoryId: number; count: number }>;
    topClinics: Array<{ clinic: string; count: number }>;
  }> {
    try {
      const [
        totalEvents,
        upcomingEvents,
        publicEvents,
        pendingApproval,
        eventsWithClients,
        categoriesAgg,
        clinicsAgg
      ] = await Promise.all([
        EventModel.countDocuments(),
        EventModel.countDocuments({ eventDate: { $gte: new Date() } }),
        EventModel.countDocuments({ isPublic: true }),
        EventModel.countDocuments({ isApproved: false }),
        EventModel.countDocuments({ $and: [{ clientId: { $ne: null } }, { clientId: { $ne: '' } }] }),
        EventModel.aggregate([
          { $match: { categoryId: { $ne: null } } },
          { $group: { _id: '$categoryId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        EventModel.aggregate([
          { $match: { $and: [{ clientClinicName: { $ne: null } }, { clientClinicName: { $ne: '' } }] } },
          { $group: { _id: '$clientClinicName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
      ]);
      
      const topCategories = categoriesAgg.map(item => ({
        categoryId: item._id,
        count: item.count
      }));
      
      const topClinics = clinicsAgg.map(item => ({
        clinic: item._id,
        count: item.count
      }));
      
      const stats = {
        totalEvents,
        upcomingEvents,
        publicEvents,
        pendingApproval,
        eventsWithClients,
        categoriesCount: topCategories.length,
        topCategories,
        topClinics
      };
      
      logger.info('Retrieved event statistics');
      return stats;
    } catch (error) {
      logger.error('Error getting event statistics:', error);
      throw new AppError('Failed to retrieve event statistics', 500);
    }
  }

  /**
   * Search events by text
   */
  static async searchEvents(searchTerm: string, filters: {
    isPublic?: boolean;
    isApproved?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<IEvent[]> {
    try {
      const { limit = 50, startDate, endDate, ...otherFilters } = filters;
      
      const query: any = {
        $text: { $search: searchTerm },
        ...otherFilters
      };
      
      if (startDate && endDate) {
        query.eventDate = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        query.eventDate = { $gte: startDate };
      } else if (endDate) {
        query.eventDate = { $lte: endDate };
      }
      
      const events = await EventModel.find(query)
        .sort({ score: { $meta: 'textScore' }, eventDate: -1 })
        .limit(limit)
        .lean();
      
      logger.info(`Found ${events.length} events matching search: "${searchTerm}"`);
      return events;
    } catch (error) {
      logger.error(`Error searching events for "${searchTerm}":`, error);
      throw new AppError('Failed to search events', 500);
    }
  }
}
