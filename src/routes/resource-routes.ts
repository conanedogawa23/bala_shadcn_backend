import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { ResourceController } from '@/controllers/ResourceController';

const router = Router();

// Validation middleware
const resourceIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Resource ID must be a positive integer')
];

const clinicNameValidation = [
  param('clinicName')
    .notEmpty()
    .withMessage('Clinic name is required')
    .trim()
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

const resourceFiltersValidation = [
  query('type')
    .optional()
    .isIn(['practitioner', 'service', 'equipment', 'room'])
    .withMessage('Type must be one of: practitioner, service, equipment, room'),
  query('clinicName')
    .optional()
    .trim(),
  query('specialty')
    .optional()
    .trim(),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('isBookable')
    .optional()
    .isBoolean()
    .withMessage('isBookable must be a boolean')
];

const dateRangeValidation = [
  query('startDate')
    .isISO8601()
    .withMessage('Start date is required and must be in ISO 8601 format'),
  query('endDate')
    .isISO8601()
    .withMessage('End date is required and must be in ISO 8601 format')
];

const optionalDateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format')
];

const createResourceValidation = [
  body('resourceId')
    .isInt({ min: 1 })
    .withMessage('Resource ID is required and must be a positive integer'),
  body('resourceName')
    .notEmpty()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Resource name is required and must be less than 100 characters'),
  body('type')
    .isIn(['practitioner', 'service', 'equipment', 'room'])
    .withMessage('Type must be one of: practitioner, service, equipment, room'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color code'),
  body('image')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Image URL must be less than 500 characters'),
  
  // Practitioner-specific validation
  body('practitioner.firstName')
    .if(body('type').equals('practitioner'))
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('practitioner.lastName')
    .if(body('type').equals('practitioner'))
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  body('practitioner.credentials')
    .if(body('type').equals('practitioner'))
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Credentials must be less than 100 characters'),
  body('practitioner.licenseNumber')
    .if(body('type').equals('practitioner'))
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('License number must be less than 50 characters'),
  body('practitioner.specialties')
    .if(body('type').equals('practitioner'))
    .optional()
    .isArray()
    .withMessage('Specialties must be an array'),
  body('practitioner.email')
    .if(body('type').equals('practitioner'))
    .optional()
    .isEmail()
    .withMessage('Email must be a valid email address'),
  body('practitioner.phone')
    .if(body('type').equals('practitioner'))
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone must be less than 20 characters'),
  
  // Service-specific validation
  body('service.category')
    .if(body('type').equals('service'))
    .notEmpty()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Service category is required and must be less than 100 characters'),
  body('service.duration')
    .if(body('type').equals('service'))
    .isInt({ min: 15, max: 480 })
    .withMessage('Service duration must be between 15 and 480 minutes'),
  body('service.price')
    .if(body('type').equals('service'))
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Service price must be a positive number'),
  body('service.description')
    .if(body('type').equals('service'))
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Service description must be less than 500 characters'),
  body('service.requiresEquipment')
    .if(body('type').equals('service'))
    .optional()
    .isArray()
    .withMessage('Required equipment must be an array'),
  
  // General validation
  body('clinics')
    .optional()
    .isArray()
    .withMessage('Clinics must be an array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isBookable')
    .optional()
    .isBoolean()
    .withMessage('isBookable must be a boolean'),
  body('requiresApproval')
    .optional()
    .isBoolean()
    .withMessage('requiresApproval must be a boolean')
];

const updateResourceValidation = [
  body('resourceName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Resource name must be less than 100 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color code'),
  body('image')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Image URL must be less than 500 characters'),
  
  // Practitioner updates
  body('practitioner.firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('practitioner.lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  body('practitioner.credentials')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Credentials must be less than 100 characters'),
  body('practitioner.email')
    .optional()
    .isEmail()
    .withMessage('Email must be a valid email address'),
  
  // Service updates
  body('service.duration')
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage('Service duration must be between 15 and 480 minutes'),
  body('service.price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Service price must be a positive number'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isBookable')
    .optional()
    .isBoolean()
    .withMessage('isBookable must be a boolean')
];

const availabilityValidation = [
  body('availability')
    .isObject()
    .withMessage('Availability must be an object'),
  body('availability.monday')
    .optional()
    .isObject()
    .withMessage('Monday availability must be an object'),
  body('availability.monday.available')
    .optional()
    .isBoolean()
    .withMessage('Monday available must be a boolean'),
  body('availability.monday.start')
    .if(body('availability.monday.available').equals('true'))
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Monday start time must be in HH:MM format'),
  body('availability.monday.end')
    .if(body('availability.monday.available').equals('true'))
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Monday end time must be in HH:MM format'),
  // Repeat for other days...
  body('availability.tuesday')
    .optional()
    .isObject()
    .withMessage('Tuesday availability must be an object'),
  body('availability.wednesday')
    .optional()
    .isObject()
    .withMessage('Wednesday availability must be an object'),
  body('availability.thursday')
    .optional()
    .isObject()
    .withMessage('Thursday availability must be an object'),
  body('availability.friday')
    .optional()
    .isObject()
    .withMessage('Friday availability must be an object'),
  body('availability.saturday')
    .optional()
    .isObject()
    .withMessage('Saturday availability must be an object'),
  body('availability.sunday')
    .optional()
    .isObject()
    .withMessage('Sunday availability must be an object')
];

// Routes

/**
 * @route   GET /api/v1/resources
 * @desc    Get all resources with filtering and pagination
 * @access  Public
 */
router.get(
  '/',
  paginationValidation.concat(resourceFiltersValidation),
  ResourceController.getAllResources
);

/**
 * @route   GET /api/v1/resources/practitioners
 * @desc    Get practitioners with optional filtering
 * @access  Public
 */
router.get(
  '/practitioners',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('clinicName').optional().trim(),
    query('specialty').optional().trim()
  ],
  ResourceController.getPractitioners
);

/**
 * @route   GET /api/v1/resources/services
 * @desc    Get services with optional category filtering
 * @access  Public
 */
router.get(
  '/services',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('category').optional().trim()
  ],
  ResourceController.getServices
);

/**
 * @route   GET /api/v1/resources/:id
 * @desc    Get resource by ID
 * @access  Public
 */
router.get(
  '/:id',
  resourceIdValidation,
  ResourceController.getResourceById
);

/**
 * @route   POST /api/v1/resources
 * @desc    Create new resource
 * @access  Public
 */
router.post(
  '/',
  createResourceValidation,
  ResourceController.createResource
);

/**
 * @route   PUT /api/v1/resources/:id
 * @desc    Update resource
 * @access  Public
 */
router.put(
  '/:id',
  resourceIdValidation.concat(updateResourceValidation),
  ResourceController.updateResource
);

/**
 * @route   DELETE /api/v1/resources/:id
 * @desc    Delete resource (soft delete)
 * @access  Public
 */
router.delete(
  '/:id',
  resourceIdValidation,
  ResourceController.deleteResource
);

/**
 * @route   GET /api/v1/resources/practitioners
 * @desc    Get practitioners with optional filtering
 * @access  Public
 */
router.get(
  '/practitioners/list',
  [
    query('clinicName')
      .optional()
      .trim(),
    query('specialty')
      .optional()
      .trim()
  ],
  ResourceController.getPractitioners
);

/**
 * @route   GET /api/v1/resources/services
 * @desc    Get services with optional category filtering
 * @access  Public
 */
router.get(
  '/services/list',
  [
    query('category')
      .optional()
      .trim()
  ],
  ResourceController.getServices
);

/**
 * @route   GET /api/v1/resources/clinic/:clinicName/bookable
 * @desc    Get bookable resources for a clinic
 * @access  Public
 */
router.get(
  '/clinic/:clinicName/bookable',
  clinicNameValidation,
  ResourceController.getBookableResources
);

/**
 * @route   PUT /api/v1/resources/:id/availability
 * @desc    Update resource availability
 * @access  Public
 */
router.put(
  '/:id/availability',
  resourceIdValidation.concat(availabilityValidation),
  ResourceController.updateResourceAvailability
);

/**
 * @route   GET /api/v1/resources/:id/availability
 * @desc    Get resource availability for a date range
 * @access  Public
 */
router.get(
  '/:id/availability',
  resourceIdValidation.concat(dateRangeValidation),
  ResourceController.getResourceAvailability
);

/**
 * @route   GET /api/v1/resources/:id/stats
 * @desc    Get resource statistics
 * @access  Public
 */
router.get(
  '/:id/stats',
  resourceIdValidation.concat(optionalDateRangeValidation),
  ResourceController.getResourceStats
);

export default router;
