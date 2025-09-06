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
import productRoutes from './productRoutes';
import orderRoutes from './orderRoutes';
import paymentRoutes from './paymentRoutes';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import reportRoutes from './reportRoutes';
import { authenticate, optionalAuthenticate, trackActivity } from '../middleware/authMiddleware';

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
      auth: '/api/v1/auth',
      users: '/api/v1/users',
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
      insuranceReference: '/api/v1/insurance-reference',
      products: '/api/v1/products',
      orders: '/api/v1/orders',
      payments: '/api/v1/payments',
      reports: '/api/v1/reports'
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
      // 🔐 Authentication & Security
      'POST /auth/register': {
        description: 'Register new user account',
        parameters: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'phone', 'role', 'clinics']
      },
      'POST /auth/login': {
        description: 'User login with email and password',
        parameters: ['email', 'password', 'deviceId', 'rememberMe']
      },
      'POST /auth/refresh': 'Refresh access token using refresh token',
      'POST /auth/logout': 'Logout from current session',
      'POST /auth/logout-all': 'Logout from all devices/sessions',
      'GET /auth/profile': 'Get current user profile',
      'PUT /auth/password': 'Change user password',
      'POST /auth/forgot-password': 'Request password reset email',
      'POST /auth/reset-password': 'Reset password with token',
      'GET /auth/verify-email/:token': 'Verify email address',
      
      // 👥 User Management (Admin)
      'GET /users': {
        description: 'Get all users with filtering and pagination',
        parameters: ['page', 'limit', 'search', 'role', 'status', 'clinicName', 'sortBy', 'sortOrder']
      },
      'GET /users/stats': 'Get user statistics and analytics',
      'GET /users/:id': 'Get user by ID',
      'POST /users': 'Create new user (Admin only)',
      'PUT /users/:id': 'Update user (Admin or self)',
      'DELETE /users/:id': 'Delete user (Admin only)',
      'PUT /users/:id/status': 'Update user status (Admin only)',
      'PUT /users/:id/unlock': 'Unlock user account (Admin only)',
      
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
      
      // 🆕 Product Management
      'GET /products': {
        description: 'Get all products with filtering and pagination',
        parameters: ['page', 'limit', 'category', 'status', 'clinicName', 'search', 'sortBy', 'sortOrder']
      },
      'GET /products/popular': 'Get popular products by usage statistics',
      'GET /products/search': 'Search products by name or description',
      'GET /products/analytics': 'Get product analytics by category',
      'GET /products/category/:category': 'Get products by category',
      'GET /products/clinic/:clinicName': 'Get products available for specific clinic',
      'GET /products/:id': 'Get product by ID or ProductKey',
      'POST /products': 'Create new product',
      'PUT /products/:id': 'Update product',
      'DELETE /products/:id': 'Deactivate product (soft delete)',
      
      // 🆕 Order Management & Billing
      'GET /orders': {
        description: 'Get all orders with comprehensive filtering',
        parameters: ['page', 'limit', 'status', 'paymentStatus', 'clinicName', 'clientId', 'startDate', 'endDate', 'search', 'readyToBill']
      },
      'GET /orders/billing/ready': 'Get orders ready for billing',
      'GET /orders/billing/overdue': 'Get overdue orders',
      'GET /orders/analytics/revenue': 'Get revenue analytics for clinic',
      'GET /orders/analytics/products': 'Get product performance analytics',
      'GET /orders/client/:clientId': 'Get orders by client ID',
      'GET /orders/clinic/:clinicName': 'Get orders by clinic with date range',
      'GET /orders/:id': 'Get order by ID or Order Number',
      'POST /orders': 'Create new order',
      'PUT /orders/:id': 'Update order',
      'PUT /orders/:id/status': 'Update order status with validation',
      'PUT /orders/:id/billing/ready': 'Mark order ready for billing',
      'POST /orders/:id/payment': 'Process payment for order',
      'PUT /orders/:id/cancel': 'Cancel order with reason',
      
      // 📊 Reports & Analytics (VISIO Compliance)
      'GET /reports/:clinicName/available': 'Get all available reports for clinic',
      'GET /reports/:clinicName/account-summary': {
        description: 'Account Summary Report - comprehensive clinic performance overview',
        parameters: ['startDate', 'endDate']
      },
      'GET /reports/:clinicName/payment-summary': {
        description: 'Payment Summary by Day Range - detailed payment analysis',
        parameters: ['startDate', 'endDate']
      },
      'GET /reports/:clinicName/timesheet': {
        description: 'Time Sheet Report - practitioner hours and utilization',
        parameters: ['startDate', 'endDate']
      },
      'GET /reports/:clinicName/order-status': 'Order Status Report - current status of all orders',
      'GET /reports/:clinicName/copay-summary': {
        description: 'Co Pay Summary Report - insurance co-payment analysis',
        parameters: ['startDate', 'endDate']
      },
      'GET /reports/:clinicName/marketing-budget': {
        description: 'Marketing Budget Summary Report - marketing spend and ROI analysis',
        parameters: ['startDate', 'endDate']
      },
      
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

// Public routes (no authentication required)
router.use('/auth', authRoutes);

// Admin routes (authentication + admin permissions required)
router.use('/users', userRoutes);

// Temporarily public routes until authentication is implemented
router.use('/clinics', clinicRoutes); // Public routes for clinic validation and discovery
router.use('/clients', clientRoutes); // Core business functionality
router.use('/appointments', appointmentRoutes); // Core business functionality
router.use('/products', productRoutes); // Core business functionality  
router.use('/orders', orderRoutes); // Core business functionality
router.use('/payments', paymentRoutes); // Core business functionality
router.use('/events', eventRoutes); // Core business functionality
router.use('/reports', reportRoutes); // Core business functionality

// Still protected routes (less commonly used) 
// Temporarily public routes until authentication is implemented
router.use('/resources', resourceRoutes); // Core business functionality - needed for appointment forms
router.use('/contact-history', authenticate, trackActivity, contactHistoryRoutes);
router.use('/insurance-addresses', authenticate, trackActivity, insuranceCompanyAddressRoutes);
router.use('/advanced-billing', authenticate, trackActivity, advancedBillingRoutes);
router.use('/insurance-reference', authenticate, trackActivity, insuranceReferenceRoutes);

export default router;
