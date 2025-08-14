import { Router } from 'express';
import { query, body, param } from 'express-validator';
import { ClinicController } from '@/controllers/ClinicController';

const router = Router();

// Validation middleware
const clinicValidation = [
  body('name')
    .notEmpty()
    .withMessage('Clinic name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Clinic name must be between 2 and 100 characters'),
  
  body('clinicId')
    .isInt({ min: 1 })
    .withMessage('Clinic ID must be a positive integer'),
  
  body('displayName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters'),
  
  body('address.street')
    .notEmpty()
    .withMessage('Street address is required')
    .isLength({ max: 500 })
    .withMessage('Street address cannot exceed 500 characters'),
  
  body('address.city')
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  
  body('address.province')
    .notEmpty()
    .withMessage('Province is required')
    .isLength({ max: 100 })
    .withMessage('Province cannot exceed 100 characters'),
  
  body('address.postalCode')
    .notEmpty()
    .withMessage('Postal code is required')
    .matches(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/)
    .withMessage('Invalid Canadian postal code format'),
  
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'historical', 'no-data'])
    .withMessage('Status must be active, inactive, historical, or no-data')
];

const updateClinicValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Clinic name must be between 2 and 100 characters'),
  
  body('displayName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters'),
  
  body('address.street')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Street address cannot exceed 500 characters'),
  
  body('address.city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  
  body('address.province')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Province cannot exceed 100 characters'),
  
  body('address.postalCode')
    .optional()
    .matches(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/)
    .withMessage('Invalid Canadian postal code format'),
  
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'historical', 'no-data'])
    .withMessage('Status must be active, inactive, historical, or no-data')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'historical', 'no-data'])
    .withMessage('Status must be active, inactive, historical, or no-data')
];

const clinicIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Clinic ID must be a positive integer')
];

const clinicNameValidation = [
  param('name')
    .notEmpty()
    .withMessage('Clinic name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Clinic name must be between 2 and 100 characters')
];

// Routes
/**
 * @route   GET /api/v1/clinics
 * @desc    Get all clinics with pagination and filtering
 * @access  Public
 */
router.get('/', paginationValidation, ClinicController.getAllClinics);

/**
 * @route   GET /api/v1/clinics/active
 * @desc    Get active clinics only
 * @access  Public
 */
router.get('/active', ClinicController.getActiveClinics);

/**
 * @route   GET /api/v1/clinics/:id
 * @desc    Get clinic by ID
 * @access  Public
 */
router.get('/:id', clinicIdValidation, ClinicController.getClinicById);

/**
 * @route   GET /api/v1/clinics/name/:name
 * @desc    Get clinic by name
 * @access  Public
 */
router.get('/name/:name', clinicNameValidation, ClinicController.getClinicByName);

/**
 * @route   GET /api/v1/clinics/:id/stats
 * @desc    Get clinic statistics
 * @access  Public
 */
router.get('/:id/stats', clinicIdValidation, ClinicController.getClinicStats);

/**
 * @route   POST /api/v1/clinics
 * @desc    Create new clinic
 * @access  Public
 */
router.post('/', clinicValidation, ClinicController.createClinic);

/**
 * @route   PUT /api/v1/clinics/:id
 * @desc    Update clinic
 * @access  Public
 */
router.put('/:id', clinicIdValidation.concat(updateClinicValidation), ClinicController.updateClinic);

/**
 * @route   DELETE /api/v1/clinics/:id
 * @desc    Delete clinic (soft delete)
 * @access  Public
 */
router.delete('/:id', clinicIdValidation, ClinicController.deleteClinic);

/**
 * @route   GET /api/v1/clinics/frontend-compatible
 * @desc    Get all clinics in frontend-compatible format
 * @access  Public
 */
router.get('/frontend-compatible', paginationValidation, ClinicController.getAllClinicsCompatible);

/**
 * @route   GET /api/v1/clinics/:id/frontend-compatible
 * @desc    Get clinic by ID in frontend-compatible format
 * @access  Public
 */
router.get('/:id/frontend-compatible', clinicIdValidation, ClinicController.getClinicByIdCompatible);

export default router;
