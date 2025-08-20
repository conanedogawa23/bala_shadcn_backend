import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { AppointmentController } from '@/controllers/AppointmentController';

const router = Router();

// Validation middleware
const appointmentIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID format')
];

const resourceIdValidation = [
  param('resourceId')
    .isInt({ min: 1 })
    .withMessage('Resource ID must be a positive integer')
];

const clientIdValidation = [
  param('clientId')
    .notEmpty()
    .trim()
    .withMessage('Client ID is required')
];

const clinicNameValidation = [
  param('clinicName')
    .notEmpty()
    .trim()
    .withMessage('Clinic name is required')
];

const dateValidation = [
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in ISO 8601 format (YYYY-MM-DD)')
];

const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const appointmentFiltersValidation = [
  query('status')
    .optional()
    .isInt({ min: 0, max: 4 })
    .withMessage('Status must be between 0 and 4'),
  query('resourceId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Resource ID must be a positive integer'),
  query('clientId')
    .optional()
    .trim()
];

const createAppointmentValidation = [
  body('startDate')
    .isISO8601()
    .withMessage('Start date is required and must be in ISO 8601 format'),
  body('endDate')
    .isISO8601()
    .withMessage('End date is required and must be in ISO 8601 format'),
  body('clientId')
    .notEmpty()
    .trim()
    .withMessage('Client ID is required'),
  body('resourceId')
    .isInt({ min: 1 })
    .withMessage('Resource ID is required and must be a positive integer'),
  body('clinicName')
    .notEmpty()
    .trim()
    .withMessage('Clinic name is required'),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must be less than 200 characters'),
  body('type')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Type must be a non-negative integer'),
  body('status')
    .optional()
    .isInt({ min: 0, max: 4 })
    .withMessage('Status must be between 0 and 4'),
  body('label')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Label must be a non-negative integer'),
  body('duration')
    .optional()
    .isInt({ min: 15 })
    .withMessage('Duration must be at least 15 minutes'),
  body('allDay')
    .optional()
    .isBoolean()
    .withMessage('All day must be a boolean'),
  body('readyToBill')
    .optional()
    .isBoolean()
    .withMessage('Ready to bill must be a boolean'),
  body('advancedBilling')
    .optional()
    .isBoolean()
    .withMessage('Advanced billing must be a boolean')
];

const updateAppointmentValidation = [
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format'),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location must be less than 200 characters'),
  body('status')
    .optional()
    .isInt({ min: 0, max: 4 })
    .withMessage('Status must be between 0 and 4'),
  body('duration')
    .optional()
    .isInt({ min: 15 })
    .withMessage('Duration must be at least 15 minutes'),
  body('readyToBill')
    .optional()
    .isBoolean()
    .withMessage('Ready to bill must be a boolean')
];

const cancelAppointmentValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason must be less than 500 characters')
];

const completeAppointmentValidation = [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
];

// Routes

/**
 * @route   GET /api/v1/appointments/clinic/:clinicName
 * @desc    Get appointments by clinic with filtering and pagination
 * @access  Public
 */
router.get(
  '/clinic/:clinicName',
  clinicNameValidation.concat(paginationValidation).concat(dateRangeValidation).concat(appointmentFiltersValidation),
  AppointmentController.getAppointmentsByClinic
);

/**
 * @route   GET /api/v1/appointments/:id
 * @desc    Get appointment by ID
 * @access  Public
 */
router.get(
  '/:id',
  appointmentIdValidation,
  AppointmentController.getAppointmentById
);

/**
 * @route   POST /api/v1/appointments
 * @desc    Create new appointment
 * @access  Public
 */
router.post(
  '/',
  createAppointmentValidation,
  AppointmentController.createAppointment
);

/**
 * @route   PUT /api/v1/appointments/:id
 * @desc    Update appointment
 * @access  Public
 */
router.put(
  '/:id',
  appointmentIdValidation.concat(updateAppointmentValidation),
  AppointmentController.updateAppointment
);

/**
 * @route   DELETE /api/v1/appointments/:id/cancel
 * @desc    Cancel appointment
 * @access  Public
 */
router.delete(
  '/:id/cancel',
  appointmentIdValidation.concat(cancelAppointmentValidation),
  AppointmentController.cancelAppointment
);

/**
 * @route   PUT /api/v1/appointments/:id/complete
 * @desc    Complete appointment and mark ready for billing
 * @access  Public
 */
router.put(
  '/:id/complete',
  appointmentIdValidation.concat(completeAppointmentValidation),
  AppointmentController.completeAppointment
);

/**
 * @route   GET /api/v1/appointments/billing/ready
 * @desc    Get appointments ready for billing
 * @access  Public
 */
router.get(
  '/billing/ready',
  [
    query('clinicName')
      .optional()
      .trim()
  ],
  AppointmentController.getAppointmentsReadyToBill
);

/**
 * @route   GET /api/v1/appointments/resource/:resourceId/schedule
 * @desc    Get resource schedule for a specific date
 * @access  Public
 */
router.get(
  '/resource/:resourceId/schedule',
  resourceIdValidation.concat(dateValidation),
  AppointmentController.getResourceSchedule
);

/**
 * @route   GET /api/v1/appointments/client/:clientId/history
 * @desc    Get client appointment history
 * @access  Public
 */
router.get(
  '/client/:clientId/history',
  clientIdValidation,
  AppointmentController.getClientAppointmentHistory
);

/**
 * @route   GET /api/v1/appointments/clinic/:clinicName/stats
 * @desc    Get clinic appointment statistics
 * @access  Public
 */
router.get(
  '/clinic/:clinicName/stats',
  clinicNameValidation.concat(dateRangeValidation),
  AppointmentController.getClinicAppointmentStats
);

export default router;
