import { Request, Response } from 'express';
import { EventService } from '../services/EventService';
import { EventView } from '../views/EventView';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';

export class EventController {
  /**
   * Get all events
   * GET /api/events
   */
  static getAllEvents = asyncHandler(async (req: Request, res: Response) => {
    const {
      clientId,
      categoryId,
      userId,
      clinicName,
      isPublic,
      isApproved,
      startDate,
      endDate,
      upcoming,
      page = 1,
      limit = 50
    } = req.query as any;

    const filters = {
      clientId,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      userId: userId ? parseInt(userId) : undefined,
      clinicName,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      isApproved: isApproved !== undefined ? isApproved === 'true' : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      upcoming: upcoming === 'true',
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await EventService.getAllEvents(filters);
    const response = EventView.formatEventList({
      ...result,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      message: 'Events retrieved successfully',
      data: response
    });
  });

  /**
   * Get event by ID
   * GET /api/events/:id
   */
  static getEventById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const event = await EventService.getEventById(id);
    
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const response = EventView.formatEvent(event);

    res.json({
      success: true,
      message: 'Event retrieved successfully',
      data: response
    });
  });

  /**
   * Get event by event ID (MSSQL key)
   * GET /api/events/event-id/:eventId
   */
  static getEventByEventId = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;

    const event = await EventService.getEventByEventId(parseInt(eventId));
    
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const response = EventView.formatEvent(event);

    res.json({
      success: true,
      message: 'Event retrieved successfully',
      data: response
    });
  });

  /**
   * Get upcoming events
   * GET /api/events/upcoming
   */
  static getUpcomingEvents = asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as any;

    const events = await EventService.getUpcomingEvents(limit ? parseInt(limit) : undefined);
    const response = EventView.formatEvents(events);

    res.json({
      success: true,
      message: 'Upcoming events retrieved successfully',
      data: {
        events: response,
        count: response.length
      }
    });
  });

  /**
   * Get events by date range
   * GET /api/events/date-range
   */
  static getEventsByDateRange = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as any;

    if (!startDate || !endDate) {
      throw new AppError('Start date and end date are required', 400);
    }

    const events = await EventService.getEventsByDateRange(
      new Date(startDate),
      new Date(endDate)
    );
    const response = EventView.formatEvents(events);

    res.json({
      success: true,
      message: 'Events retrieved successfully',
      data: {
        events: response,
        count: response.length,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  });

  /**
   * Get events for a specific client
   * GET /api/events/client/:clientId
   */
  static getEventsByClient = asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;

    const events = await EventService.getEventsByClient(clientId);
    const response = EventView.formatClientEvents(clientId, events);

    res.json({
      success: true,
      message: 'Client events retrieved successfully',
      data: response
    });
  });

  /**
   * Get events by category
   * GET /api/events/category/:categoryId
   */
  static getEventsByCategory = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;

    const events = await EventService.getEventsByCategory(parseInt(categoryId));
    const response = EventView.formatEvents(events);

    res.json({
      success: true,
      message: 'Category events retrieved successfully',
      data: {
        categoryId: parseInt(categoryId),
        events: response,
        count: response.length
      }
    });
  });

  /**
   * Get events by clinic
   * GET /api/events/clinic/:clinicName
   */
  static getEventsByClinic = asyncHandler(async (req: Request, res: Response) => {
    const { clinicName } = req.params;

    const events = await EventService.getEventsByClinic(clinicName);
    const response = EventView.formatEvents(events);

    res.json({
      success: true,
      message: 'Clinic events retrieved successfully',
      data: {
        clinic: clinicName,
        events: response,
        count: response.length
      }
    });
  });

  /**
   * Get public events
   * GET /api/events/public
   */
  static getPublicEvents = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as any;

    const events = await EventService.getPublicEvents(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    const response = EventView.formatEvents(events);

    res.json({
      success: true,
      message: 'Public events retrieved successfully',
      data: {
        events: response,
        count: response.length
      }
    });
  });

  /**
   * Get events pending approval
   * GET /api/events/pending-approval
   */
  static getPendingApprovalEvents = asyncHandler(async (req: Request, res: Response) => {
    const events = await EventService.getPendingApprovalEvents();
    const response = EventView.formatEvents(events);

    res.json({
      success: true,
      message: 'Pending approval events retrieved successfully',
      data: {
        events: response,
        count: response.length
      }
    });
  });

  /**
   * Search events
   * GET /api/events/search
   */
  static searchEvents = asyncHandler(async (req: Request, res: Response) => {
    const {
      q: searchTerm,
      isPublic,
      isApproved,
      startDate,
      endDate,
      limit = 50
    } = req.query as any;

    if (!searchTerm) {
      throw new AppError('Search term is required', 400);
    }

    const filters = {
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      isApproved: isApproved !== undefined ? isApproved === 'true' : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit)
    };

    const events = await EventService.searchEvents(searchTerm, filters);
    const response = EventView.formatSearchResults(events, searchTerm);

    res.json({
      success: true,
      message: 'Event search completed successfully',
      data: response
    });
  });

  /**
   * Get events for calendar view
   * GET /api/events/calendar
   */
  static getEventsForCalendar = asyncHandler(async (req: Request, res: Response) => {
    const {
      startDate,
      endDate,
      isPublic,
      isApproved = 'true',
      clinicName
    } = req.query as any;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      isApproved: isApproved === 'true',
      clinicName,
      limit: 1000 // High limit for calendar view
    };

    const result = await EventService.getAllEvents(filters);
    const response = EventView.formatEventsForCalendar(result.events);

    res.json({
      success: true,
      message: 'Calendar events retrieved successfully',
      data: response
    });
  });

  /**
   * Create new event
   * POST /api/events
   */
  static createEvent = asyncHandler(async (req: Request, res: Response) => {
    const eventData = req.body;

    const event = await EventService.createEvent(eventData);
    const response = EventView.formatEvent(event);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: response
    });
  });

  /**
   * Update event
   * PUT /api/events/:id
   */
  static updateEvent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const event = await EventService.updateEvent(id, updateData);
    
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const response = EventView.formatEvent(event);

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: response
    });
  });

  /**
   * Delete event
   * DELETE /api/events/:id
   */
  static deleteEvent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const deleted = await EventService.deleteEvent(id);
    
    if (!deleted) {
      throw new AppError('Event not found', 404);
    }

    res.json({
      success: true,
      message: 'Event deleted successfully',
      data: { deleted: true }
    });
  });

  /**
   * Approve event
   * PUT /api/events/:id/approve
   */
  static approveEvent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const event = await EventService.approveEvent(id);
    
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const response = EventView.formatEvent(event);

    res.json({
      success: true,
      message: 'Event approved successfully',
      data: response
    });
  });

  /**
   * Toggle event visibility
   * PUT /api/events/:id/toggle-visibility
   */
  static toggleEventVisibility = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const event = await EventService.toggleEventVisibility(id);
    
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    const response = EventView.formatEvent(event);

    res.json({
      success: true,
      message: 'Event visibility toggled successfully',
      data: response
    });
  });

  /**
   * Get event statistics
   * GET /api/events/stats/overview
   */
  static getEventStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await EventService.getEventStats();
    const response = EventView.formatEventStats(stats);

    res.json({
      success: true,
      message: 'Event statistics retrieved successfully',
      data: response
    });
  });

  /**
   * Get events for frontend compatibility
   * GET /api/events/frontend-compatible
   */
  static getEventsForFrontend = asyncHandler(async (req: Request, res: Response) => {
    const {
      upcoming,
      isPublic = 'true',
      isApproved = 'true',
      limit = 100
    } = req.query as any;

    const filters = {
      upcoming: upcoming === 'true',
      isPublic: isPublic === 'true',
      isApproved: isApproved === 'true',
      page: 1,
      limit: parseInt(limit)
    };

    const result = await EventService.getAllEvents(filters);
    const response = EventView.formatEventsForFrontend(result.events);

    res.json({
      success: true,
      message: 'Events retrieved for frontend',
      data: response,
      meta: {
        total: result.total,
        returned: response.length
      }
    });
  });
}
