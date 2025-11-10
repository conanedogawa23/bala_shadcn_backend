import { Router } from 'express';
import { query, body, param } from 'express-validator';
import { ClientController } from '@/controllers/ClientController';

const router = Router();

// Validation middleware
const clientValidation = [
  body('personalInfo.firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  
  body('personalInfo.lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  
  body('personalInfo.gender')
    .optional()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other'),
  
  body('contact.address.city')
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  
  body('contact.address.province')
    .notEmpty()
    .withMessage('Province is required')
    .isLength({ max: 100 })
    .withMessage('Province cannot exceed 100 characters'),
  
  body('contact.address.street')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),
  
  body('contact.address.postalCode')
    .optional()
    .matches(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/)
    .withMessage('Invalid Canadian postal code format'),
  
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 100 })
    .withMessage('Email cannot exceed 100 characters'),
  
  body('contact.phones.cell.full')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Cell phone cannot exceed 20 characters'),
  
  body('contact.phones.home.full')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Home phone cannot exceed 20 characters'),
  
  body('contact.phones.work.full')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Work phone cannot exceed 20 characters'),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  body('defaultClinic')
    .notEmpty()
    .withMessage('Default clinic is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Default clinic must be between 2 and 100 characters'),
  
  body('clientId')
    .optional()
    .isLength({ min: 4, max: 30 })
    .withMessage('Client ID must be between 4 and 30 characters')
];

const updateClientValidation = [
  body('personalInfo.firstName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  
  body('personalInfo.lastName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  
  body('personalInfo.gender')
    .optional()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Gender must be Male, Female, or Other'),
  
  body('contact.address.city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  
  body('contact.address.province')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Province cannot exceed 100 characters'),
  
  body('contact.address.street')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),
  
  body('contact.address.postalCode')
    .optional()
    .matches(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/)
    .withMessage('Invalid Canadian postal code format'),
  
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 100 })
    .withMessage('Email cannot exceed 100 characters'),
  
  body('contact.phones.cell.full')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Cell phone cannot exceed 20 characters'),
  
  body('contact.phones.home.full')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Home phone cannot exceed 20 characters'),
  
  body('contact.phones.work.full')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Work phone cannot exceed 20 characters'),
  
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  body('defaultClinic')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Default clinic must be between 2 and 100 characters')
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
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be active or inactive')
];

const clinicNameValidation = [
  param('clinicName')
    .notEmpty()
    .withMessage('Clinic name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Clinic name must be between 2 and 100 characters')
];

const clientIdValidation = [
  param('id')
    .notEmpty()
    .withMessage('Client ID is required')
    .isLength({ min: 4, max: 30 })
    .withMessage('Client ID must be between 4 and 30 characters')
];

const searchValidation = [
  query('q')
    .notEmpty()
    .withMessage('Search term is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('clinic')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Clinic name must be between 2 and 100 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Routes

/**
 * @route   GET /api/v1/clients/search
 * @desc    Search clients across all clinics
 * @access  Public
 */
router.get('/search', searchValidation, ClientController.searchClients);

/**
 * @route   GET /api/v1/clients/advanced-search
 * @desc    Advanced search with multiple criteria (legacy feature)
 * @access  Public
 * @params  firstName, lastName, dateOfBirth, phone, email, clinic, insuranceCompany, limit
 */
router.get('/advanced-search', ClientController.advancedSearch);

/**
 * @route   GET /api/v1/clients/export
 * @desc    Export clients data (JSON or CSV)
 * @access  Public
 * @params  clinicName, format (json|csv), limit
 */
router.get('/export', ClientController.exportClients);

/**
 * @route   GET /api/v1/clients/dpa
 * @desc    Get clients with DPA (Direct Payment Authorization) - query param version
 * @access  Public
 * @params  clinicName (query), page, limit
 */
router.get('/dpa', ClientController.getClientsWithDPA);

/**
 * @route   GET /api/v1/clients/insurance/company
 * @desc    Get clients by insurance company
 * @access  Public
 * @params  companyName or insuranceCompany (required), clinicName
 */
router.get('/insurance/company', ClientController.getClientsByInsuranceCompany);

/**
 * @route   GET /api/v1/clients/:id
 * @desc    Get client by ID
 * @access  Public
 */
router.get('/:id', clientIdValidation, ClientController.getClientById);

/**
 * @route   POST /api/v1/clients
 * @desc    Create new client
 * @access  Public
 */
router.post('/', clientValidation, ClientController.createClient);

/**
 * @route   PUT /api/v1/clients/:id
 * @desc    Update client
 * @access  Public
 */
router.put('/:id', clientIdValidation.concat(updateClientValidation), ClientController.updateClient);

/**
 * @route   DELETE /api/v1/clients/:id
 * @desc    Delete client (soft delete)
 * @access  Public
 */
router.delete('/:id', clientIdValidation, ClientController.deleteClient);

/**
 * @route   GET /api/v1/clients/clinic/:clinicName
 * @desc    Get clients by clinic with pagination and search
 * @access  Public
 */
router.get('/clinic/:clinicName', clinicNameValidation.concat(paginationValidation), ClientController.getClientsByClinic);

/**
 * @route   GET /api/v1/clients/clinic/:clinicName/insurance
 * @desc    Get clients with insurance for a clinic
 * @access  Public
 */
router.get('/clinic/:clinicName/insurance', clinicNameValidation, ClientController.getClientsWithInsurance);

/**
 * @route   GET /api/v1/clients/clinic/:clinicName/stats
 * @desc    Get client statistics for a clinic
 * @access  Public
 */
router.get('/clinic/:clinicName/stats', clinicNameValidation, ClientController.getClientStats);

/**
 * @route   GET /api/v1/clients/clinic/:clinicName/frontend-compatible
 * @desc    Get clients by clinic in frontend-compatible format
 * @access  Public
 */
router.get('/clinic/:clinicName/frontend-compatible', clinicNameValidation.concat(paginationValidation), ClientController.getClientsByClinicCompatible);

/**
 * @route   GET /api/v1/clients/:id/frontend-compatible
 * @desc    Get client by ID in frontend-compatible format
 * @access  Public
 */
router.get('/:id/frontend-compatible', clientIdValidation, ClientController.getClientByIdCompatible);

/**
 * @route   GET /api/v1/clients/:id/account-summary
 * @desc    Get client account summary (orders, payments, insurance)
 * @access  Public
 */
router.get('/:id/account-summary', clientIdValidation, ClientController.getClientAccountSummary);

/**
 * @route   GET /api/v1/clients/:id/comprehensive
 * @desc    Get client with all related data (appointments, orders, payments)
 * @access  Public
 */
router.get('/:id/comprehensive', clientIdValidation, ClientController.getClientComprehensive);

/**
 * @route   GET /api/v1/clients/:id/contact-history
 * @desc    Get client contact history
 * @access  Public
 * @params  limit
 */
router.get('/:id/contact-history', clientIdValidation, ClientController.getClientContactHistory);

/**
 * @route   PUT /api/v1/clients/:id/insurance
 * @desc    Update client insurance information
 * @access  Public
 */
router.put('/:id/insurance', clientIdValidation, ClientController.updateClientInsurance);

/**
 * @route   GET /api/v1/clients/clinic/:clinicName/dpa
 * @desc    Get clients with DPA (Direct Payment Authorization) - path param version
 * @access  Public
 * @params  page, limit
 */
router.get('/clinic/:clinicName/dpa', clinicNameValidation, ClientController.getClientsWithDPA);

/**
 * @route   POST /api/v1/clients/bulk-update
 * @desc    Bulk update clients (batch operation)
 * @access  Public
 */
router.post('/bulk-update', ClientController.bulkUpdateClients);

export default router;
