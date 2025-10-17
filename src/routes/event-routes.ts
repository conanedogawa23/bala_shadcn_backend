import { Router } from 'express';
import { EventController } from '../controllers/EventController';

const router = Router();

// Public routes (read-only access to approved public events)
router.get('/public', EventController.getPublicEvents);
router.get('/upcoming', EventController.getUpcomingEvents);
router.get('/calendar', EventController.getEventsForCalendar);
router.get('/search', EventController.searchEvents);
router.get('/stats/overview', EventController.getEventStats);
router.get('/frontend-compatible', EventController.getEventsForFrontend);

// Administrative routes (require authentication)
// TODO: Add authentication middleware when auth system is implemented
router.get('/pending-approval', EventController.getPendingApprovalEvents);
router.get('/date-range', EventController.getEventsByDateRange);
router.get('/client/:clientId', EventController.getEventsByClient);
router.get('/category/:categoryId', EventController.getEventsByCategory);
router.get('/clinic/:clinicName', EventController.getEventsByClinic);
router.get('/event-id/:eventId', EventController.getEventByEventId);

// General event management
router.get('/', EventController.getAllEvents);
router.get('/:id', EventController.getEventById);

// Write operations (require authentication)
router.post('/', EventController.createEvent);
router.put('/:id', EventController.updateEvent);
router.put('/:id/approve', EventController.approveEvent);
router.put('/:id/toggle-visibility', EventController.toggleEventVisibility);
router.delete('/:id', EventController.deleteEvent);

export default router;
