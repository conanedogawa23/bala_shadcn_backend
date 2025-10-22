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
 * @route   GET /api/v1/appointments/test/:clinicName
 * @desc    Simple test for appointments by clinic - no validation
 * @access  Public
 */
router.get('/test/:clinicName', async (req, res): Promise<void> => {
  try {
    const { clinicName } = req.params;
    console.log('=== SIMPLE TEST ENDPOINT ===');
    console.log('clinicName:', clinicName);
    
    const { AppointmentModel } = require('@/models/Appointment');
    const { ClinicModel } = require('@/models/Clinic');
    const mongoose = require('mongoose');
    
    // Debug: Check database connection
    console.log('Connected to database:', mongoose.connection.name);
    console.log('Connection state:', mongoose.connection.readyState);
    
    // Debug: List all databases available
    const adminDb = mongoose.connection.db.admin();
    const dbList = await adminDb.listDatabases();
    
    // Debug: List all collections in current database  
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    // Test: Count all clinics first
    const allClinicsCount = await ClinicModel.countDocuments({});
    console.log('Total clinics in database:', allClinicsCount);
    
    // Test: Raw MongoDB collection access
    const rawCollection = mongoose.connection.collection('clinics');
    const rawCount = await rawCollection.countDocuments({});
    const rawClinics = await rawCollection.find({}, { projection: { name: 1 } }).limit(5).toArray();
    
    // Test: Find all clinic names
    const allClinicNames = await ClinicModel.find({}, { name: 1 }).limit(5);
    console.log('First 5 clinic names:', allClinicNames.map((c: any) => c.name));
    
    // Test 1: Check if clinic exists
    const clinic = await ClinicModel.findOne({ name: clinicName });
    console.log('Clinic found:', !!clinic, clinic?.name);
    
    // Test: Try case-insensitive search
    const clinicInsensitive = await ClinicModel.findOne({ name: { $regex: new RegExp(`^${clinicName}$`, 'i') } });
    console.log('Case-insensitive search:', !!clinicInsensitive, clinicInsensitive?.name);
    
    if (!clinic) {
      res.json({ 
        error: 'Clinic not found', 
        clinicName,
        debugInfo: {
          database: mongoose.connection.name,
          connectionState: mongoose.connection.readyState,
          availableDatabases: dbList.databases.map((db: any) => db.name),
          collectionsInCurrentDb: collections.map((col: any) => col.name),
          mongooseClinics: allClinicsCount,
          mongooseClinicNames: allClinicNames.map((c: any) => c.name),
          rawClinicsCount: rawCount,
          rawClinicNames: rawClinics.map((c: any) => c.name),
          caseInsensitiveFound: !!clinicInsensitive,
          caseInsensitiveName: clinicInsensitive?.name
        }
      });
      return;
    }
    
    // Test 2: Get appointment clinic name
    const appointmentClinicName = clinicName === 'bodyblissphysio' ? 'BodyBlissPhysio' : clinicName;
    console.log('Mapped clinic name:', appointmentClinicName);
    
    // Test 3: Simple count
    const count = await AppointmentModel.countDocuments({ 
      clinicName: appointmentClinicName, 
      isActive: true 
    });
    console.log('Appointment count:', count);
    
    // Test 4: Simple find (no lean, no populate)
    const appointments = await AppointmentModel.find({ 
      clinicName: appointmentClinicName, 
      isActive: true 
    }).limit(2);
    console.log('Appointments found:', appointments.length);
    
    res.json({
      success: true,
      clinicName,
      appointmentClinicName,
      count,
      appointments: appointments.length,
      firstAppointment: appointments[0] || null
    });
    
  } catch (error) {
    console.error('ERROR in test endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack available';
    res.status(500).json({ error: errorMessage, stack: errorStack });
  }
});

/**
 * @route   GET /api/v1/appointments/clinic/:clinicName
 * @desc    Get appointments by clinic with filtering and pagination
 * @access  Public
 */
router.get(
  '/clinic/:clinicName',
  // Temporarily disable validation to debug
  // clinicNameValidation.concat(paginationValidation).concat(dateRangeValidation).concat(appointmentFiltersValidation),
  AppointmentController.getAppointmentsByClinic
);

/**
 * @route   GET /api/v1/appointments/business/:appointmentId
 * @desc    Get appointment by business appointmentId
 * @access  Public
 */
router.get(
  '/business/:appointmentId',
  [
    param('appointmentId')
      .isInt({ min: 1 })
      .withMessage('Invalid business appointment ID format')
  ],
  AppointmentController.getAppointmentByBusinessId
);

/**
 * @route   GET /api/v1/appointments/:id
 * @desc    Get appointment by MongoDB ObjectId
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
 * @route   GET /api/v1/appointments/ready-for-billing
 * @desc    Get appointments ready for billing
 * @access  Public
 */
router.get(
  '/ready-for-billing',
  [
    query('clinicName')
      .optional()
      .trim()
  ],
  AppointmentController.getAppointmentsReadyToBill
);

/**
 * @route   GET /api/v1/appointments/stats/clinic/:clinicName
 * @desc    Get clinic appointment statistics
 * @access  Public
 */
router.get(
  '/stats/clinic/:clinicName',
  clinicNameValidation.concat(dateRangeValidation),
  AppointmentController.getClinicAppointmentStats
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

export default router;
