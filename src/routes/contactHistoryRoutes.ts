import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { ContactHistoryController } from '@/controllers/ContactHistoryController';

const router = Router();

// Validation schemas
const createContactHistoryValidation = [
  body('contactType')
    .isIn(['call', 'email', 'sms', 'visit', 'note', 'appointment', 'other'])
    .withMessage('Contact type must be one of: call, email, sms, visit, note, appointment, other'),
  body('direction')
    .isIn(['inbound', 'outbound', 'internal'])
    .withMessage('Direction must be one of: inbound, outbound, internal'),
  body('contactDate')
    .isISO8601()
    .withMessage('Contact date must be a valid ISO 8601 date'),
  body('clinicName')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Clinic name must be between 1 and 200 characters'),
  body('clientId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Client ID must be between 1 and 50 characters'),
  body('subject')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Subject must be no more than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Description must be no more than 5000 characters'),
  body('duration')
    .optional()
    .isInt({ min: 0, max: 600 })
    .withMessage('Duration must be between 0 and 600 minutes'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category must be no more than 100 characters'),
  body('followUpRequired')
    .optional()
    .isBoolean()
    .withMessage('Follow-up required must be a boolean'),
  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow-up date must be a valid ISO 8601 date'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('communication.method')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Communication method must be no more than 50 characters'),
  body('communication.phoneNumber')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Phone number must be no more than 50 characters'),
  body('communication.emailAddress')
    .optional()
    .isEmail()
    .withMessage('Email address must be valid'),
  body('appointmentId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Appointment ID must be between 1 and 50 characters')
];

const updateContactHistoryValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Contact history ID must be a positive integer'),
  ...createContactHistoryValidation.filter(rule => 
    !rule.builder.fields.includes('contactType') && 
    !rule.builder.fields.includes('contactDate')
  ) // Remove required fields for updates
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Contact history ID must be a positive integer')
];

const clientIdValidation = [
  param('clientId')
    .isLength({ min: 1, max: 50 })
    .withMessage('Client ID must be between 1 and 50 characters')
];

const clinicNameValidation = [
  param('clinicName')
    .isLength({ min: 1, max: 200 })
    .withMessage('Clinic name must be between 1 and 200 characters')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('contactType')
    .optional()
    .isIn(['call', 'email', 'sms', 'visit', 'note', 'appointment', 'other'])
    .withMessage('Contact type must be one of: call, email, sms, visit, note, appointment, other'),
  query('direction')
    .optional()
    .isIn(['inbound', 'outbound', 'internal'])
    .withMessage('Direction must be one of: inbound, outbound, internal'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  query('followUpRequired')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Follow-up required must be true or false'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search term must be between 1 and 200 characters'),
  query('clinicName')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Clinic name must be between 1 and 200 characters'),
  query('clientId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Client ID must be between 1 and 50 characters')
];

const statsValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  query('clinicName')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Clinic name must be between 1 and 200 characters')
];

const recentActivityValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Days must be between 1 and 30'),
  query('clinicName')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Clinic name must be between 1 and 200 characters')
];

const tagValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Contact history ID must be a positive integer'),
  body('tag')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Tag must be between 1 and 50 characters')
];

const followUpCompleteValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Contact history ID must be a positive integer'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be no more than 1000 characters')
];

const bulkOperationValidation = [
  body('operation')
    .isIn(['delete', 'update', 'addTag'])
    .withMessage('Operation must be one of: delete, update, addTag'),
  body('contactIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('Contact IDs must be an array with 1-100 items'),
  body('contactIds.*')
    .isInt({ min: 1 })
    .withMessage('Each contact ID must be a positive integer'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object when provided')
];

// Routes

/**
 * @route   GET /api/v1/contact-history
 * @desc    Get contact history with filtering and pagination
 * @access  Private
 */
router.get('/', queryValidation, ContactHistoryController.getContactHistory);

/**
 * @route   GET /api/v1/contact-history/stats
 * @desc    Get contact history statistics
 * @access  Private
 */
router.get('/stats', statsValidation, ContactHistoryController.getContactHistoryStats);

/**
 * @route   GET /api/v1/contact-history/recent
 * @desc    Get recent contact activity
 * @access  Private
 */
router.get('/recent', recentActivityValidation, ContactHistoryController.getRecentActivity);

/**
 * @route   GET /api/v1/contact-history/follow-ups
 * @desc    Get follow-ups required
 * @access  Private
 */
router.get('/follow-ups', [
  query('clinicName')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Clinic name must be between 1 and 200 characters')
], ContactHistoryController.getFollowUpsRequired);

/**
 * @route   GET /api/v1/contact-history/client/:clientId
 * @desc    Get contact history by client
 * @access  Private
 */
router.get('/client/:clientId', [
  ...clientIdValidation,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], ContactHistoryController.getContactHistoryByClient);

/**
 * @route   GET /api/v1/contact-history/clinic/:clinicName
 * @desc    Get contact history by clinic
 * @access  Private
 */
router.get('/clinic/:clinicName', [
  ...clinicNameValidation,
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200')
], ContactHistoryController.getContactHistoryByClinic);

/**
 * @route   GET /api/v1/contact-history/:id
 * @desc    Get contact history by ID
 * @access  Private
 */
router.get('/:id', idValidation, ContactHistoryController.getContactHistoryById);

/**
 * @route   POST /api/v1/contact-history
 * @desc    Create new contact history record
 * @access  Private
 */
router.post('/', createContactHistoryValidation, ContactHistoryController.createContactHistory);

/**
 * @route   POST /api/v1/contact-history/bulk
 * @desc    Bulk operations for contact history
 * @access  Private
 */
router.post('/bulk', bulkOperationValidation, ContactHistoryController.bulkOperations);

/**
 * @route   POST /api/v1/contact-history/:id/tags
 * @desc    Add tag to contact history
 * @access  Private
 */
router.post('/:id/tags', tagValidation, ContactHistoryController.addTag);

/**
 * @route   PUT /api/v1/contact-history/:id
 * @desc    Update contact history record
 * @access  Private
 */
router.put('/:id', updateContactHistoryValidation, ContactHistoryController.updateContactHistory);

/**
 * @route   PUT /api/v1/contact-history/:id/follow-up/complete
 * @desc    Mark follow-up as completed
 * @access  Private
 */
router.put('/:id/follow-up/complete', followUpCompleteValidation, ContactHistoryController.markFollowUpCompleted);

/**
 * @route   DELETE /api/v1/contact-history/:id
 * @desc    Delete contact history record (soft delete)
 * @access  Private
 */
router.delete('/:id', idValidation, ContactHistoryController.deleteContactHistory);

export default router;
