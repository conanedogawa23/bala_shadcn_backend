import { Router, Request, Response } from 'express';
import clinicRoutes from './clinicRoutes';
import clientRoutes from './clientRoutes';
import appointmentRoutes from './appointmentRoutes';
import resourceRoutes from './resourceRoutes';
import contactHistoryRoutes from './contactHistoryRoutes';
import insuranceCompanyAddressRoutes from './insuranceCompanyAddressRoutes';
import eventRoutes from './eventRoutes';
import advancedBillingRoutes from './advancedBillingRoutes';
import insuranceReferenceRoutes from './insuranceReferenceRoutes';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Bala Visio Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API root information
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Bala Visio Healthcare Management API',
    description: 'RESTful API for healthcare appointment and clinic management system',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/health',
      status: '/api/v1/status',
      clinics: '/api/v1/clinics',
      clients: '/api/v1/clients',
      appointments: '/api/v1/appointments',
      resources: '/api/v1/resources',
      practitioners: '/api/v1/resources/practitioners/list',
      services: '/api/v1/resources/services/list',
      insuranceAddresses: '/api/v1/insurance-addresses',
      events: '/api/v1/events',
      contactHistory: '/api/v1/contact-history',
      advancedBilling: '/api/v1/advanced-billing',
      insuranceReference: '/api/v1/insurance-reference'
    }
  });
});

// System status endpoint
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'System Status',
    status: 'operational',
    timestamp: new Date().toISOString(),
    services: {
      api: 'operational',
      database: 'operational', // TODO: Add actual database health check
      authentication: 'operational'
    },
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  });
});

// API documentation placeholder
router.get('/docs', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Bala Visio Healthcare Management API Documentation',
    version: '1.0.0',
    baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
    
    // Core Healthcare Management Endpoints
    endpoints: {
      // Clinic Management
      'GET /clinics': {
        description: 'Get all clinics with pagination and filtering',
        parameters: ['page', 'limit', 'status', 'city', 'province']
      },
      'GET /clinics/active': 'Get active clinics only',
      'GET /clinics/:id': 'Get clinic by ID',
      'GET /clinics/name/:name': 'Get clinic by name',
      'GET /clinics/:id/stats': 'Get clinic statistics',
      'POST /clinics': 'Create new clinic',
      'PUT /clinics/:id': 'Update clinic',
      'DELETE /clinics/:id': 'Delete clinic (soft delete)',
      
      // Client Management
      'GET /clients/search': {
        description: 'Search clients by name, email, or phone',
        parameters: ['q', 'clinic', 'page', 'limit']
      },
      'GET /clients/:id': 'Get client by ID',
      'POST /clients': 'Create new client',
      'PUT /clients/:id': 'Update client',
      'DELETE /clients/:id': 'Delete client (soft delete)',
      'GET /clients/clinic/:clinicName': {
        description: 'Get clients by clinic with pagination',
        parameters: ['page', 'limit', 'search', 'status']
      },
      'GET /clients/clinic/:clinicName/insurance': 'Get clients with insurance information',
      'GET /clients/clinic/:clinicName/stats': 'Get client statistics for clinic',
      
      // 🆕 Appointment Management
      'GET /appointments/clinic/:clinicName': {
        description: 'Get appointments by clinic with filtering',
        parameters: ['startDate', 'endDate', 'status', 'resourceId', 'clientId', 'page', 'limit']
      },
      'GET /appointments/:id': 'Get appointment by ID',
      'POST /appointments': 'Create new appointment',
      'PUT /appointments/:id': 'Update appointment',
      'DELETE /appointments/:id/cancel': 'Cancel appointment',
      'PUT /appointments/:id/complete': 'Complete appointment and mark ready for billing',
      'GET /appointments/billing/ready': 'Get appointments ready for billing',
      'GET /appointments/resource/:resourceId/schedule': 'Get resource schedule for a specific date',
      'GET /appointments/client/:clientId/history': 'Get client appointment history',
      'GET /appointments/clinic/:clinicName/stats': 'Get clinic appointment statistics',
      
      // 🆕 Resource Management (Practitioners & Services)
      'GET /resources': {
        description: 'Get all resources with filtering',
        parameters: ['type', 'clinicName', 'specialty', 'isActive', 'isBookable', 'page', 'limit']
      },
      'GET /resources/:id': 'Get resource by ID',
      'POST /resources': 'Create new resource (practitioner/service/equipment/room)',
      'PUT /resources/:id': 'Update resource',
      'DELETE /resources/:id': 'Delete resource (soft delete)',
      'GET /resources/practitioners/list': {
        description: 'Get practitioners with appointment statistics',
        parameters: ['clinicName', 'specialty']
      },
      'GET /resources/services/list': {
        description: 'Get services grouped by category',
        parameters: ['category']
      },
      'GET /resources/clinic/:clinicName/bookable': 'Get bookable resources for a clinic',
      'PUT /resources/:id/availability': 'Update resource availability schedule',
      'GET /resources/:id/availability': 'Get resource availability for date range',
      'GET /resources/:id/stats': 'Get resource statistics and performance metrics',
      
      // System Endpoints
      'GET /health': 'Health check endpoint',
      'GET /status': 'System status and metrics',
      'GET /docs': 'API documentation (this endpoint)'
    },
    
    // Response Format
    responseFormat: {
      success: {
        success: true,
        data: '{ ... response data ... }',
        pagination: '{ page, limit, total, pages, hasNext, hasPrev } // for paginated responses'
      },
      error: {
        success: false,
        error: {
          message: 'Error description',
          code: 'ERROR_CODE',
          details: '{ ... additional error details ... }'
        }
      }
    },
    
    // Healthcare-Specific Features
    healthcareFeatures: {
      appointmentManagement: {
        scheduling: 'Create, update, and manage appointments',
        conflictDetection: 'Automatic time slot conflict checking',
        billing: 'Ready-to-bill appointment tracking',
        completion: 'Mark appointments as completed with notes'
      },
      practitionerManagement: {
        specialties: 'Track practitioner specialties and credentials',
        availability: 'Manage practitioner working hours and days',
        scheduling: 'View practitioner schedules and appointment loads',
        statistics: 'Performance metrics and appointment analytics'
      },
      serviceManagement: {
        categories: 'Organize services by treatment categories',
        pricing: 'Service pricing and duration management',
        equipment: 'Track required equipment for services',
        booking: 'Service-specific booking requirements'
      },
      clientManagement: {
        insurance: 'Complex 3-tier insurance tracking with DPA',
        medical: 'Medical history and referring physician tracking',
        appointments: 'Complete appointment history per client',
        billing: 'Insurance billing integration ready'
      },
      clinicOperations: {
        multiClinic: 'Support for multiple clinic locations',
        statistics: 'Comprehensive clinic performance analytics',
        reporting: 'Appointment, revenue, and utilization reports',
        network: 'Cross-clinic resource and client management'
      }
    },
    
    // Data Models
    dataModels: {
      appointment: {
        core: 'startDate, endDate, clientId, resourceId, clinicName',
        status: '0=Scheduled, 1=Completed, 2=Cancelled, 3=No Show, 4=Rescheduled',
        billing: 'billDate, invoiceDate, readyToBill, advancedBilling'
      },
      resource: {
        types: 'practitioner, service, equipment, room',
        practitioner: 'name, credentials, specialties, licenseNumber',
        service: 'category, duration, price, description',
        availability: 'weekly schedule with start/end times per day'
      },
      client: {
        personal: 'name, dateOfBirth, gender, contact information',
        insurance: 'up to 3 insurance plans with DPA and coverage details',
        medical: 'familyMD, referringMD, location, CSR name'
      },
      clinic: {
        identification: 'name, displayName, completeName',
        location: 'full address with structured components',
        operations: 'services, contact info, client statistics'
      }
    }
  });
});

// Mount route modules
router.use('/clinics', clinicRoutes);
router.use('/clients', clientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/resources', resourceRoutes);
router.use('/contact-history', contactHistoryRoutes);
router.use('/insurance-addresses', insuranceCompanyAddressRoutes);
router.use('/events', eventRoutes);
router.use('/advanced-billing', advancedBillingRoutes);
router.use('/insurance-reference', insuranceReferenceRoutes);

export default router;
