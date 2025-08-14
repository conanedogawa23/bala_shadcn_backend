import { Router } from 'express';
import { Request, Response } from 'express';
import clinicRoutes from './clinicRoutes';
import clientRoutes from './clientRoutes';
import { getDatabaseStatus } from '@/config/database';

const router = Router();

// API Information
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Bala Visio Backend API v1',
    version: '1.0.0',
    endpoints: {
      clinics: '/api/v1/clinics',
      clients: '/api/v1/clients',
      health: '/health',
      status: '/api/v1/status'
    },
    documentation: 'API documentation available at /api/v1/docs',
    timestamp: new Date().toISOString()
  });
});

// Health status endpoint
router.get('/status', (req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  
  res.json({
    success: true,
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus.status,
      host: dbStatus.host,
      name: dbStatus.name,
      collections: dbStatus.collections
    },
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    }
  });
});

// Mount route modules
router.use('/clinics', clinicRoutes);
router.use('/clients', clientRoutes);

// API documentation placeholder
router.get('/docs', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API Documentation',
    endpoints: {
      'GET /api/v1/clinics': 'Get all clinics with pagination',
      'GET /api/v1/clinics/active': 'Get active clinics only',
      'GET /api/v1/clinics/:id': 'Get clinic by ID',
      'GET /api/v1/clinics/name/:name': 'Get clinic by name',
      'GET /api/v1/clinics/:id/stats': 'Get clinic statistics',
      'GET /api/v1/clinics/frontend-compatible': '🔗 Get clinics in frontend-compatible format',
      'GET /api/v1/clinics/:id/frontend-compatible': '🔗 Get clinic by ID in frontend-compatible format',
      'POST /api/v1/clinics': 'Create new clinic',
      'PUT /api/v1/clinics/:id': 'Update clinic',
      'DELETE /api/v1/clinics/:id': 'Delete clinic (soft delete)',
      
      'GET /api/v1/clients/search': 'Search clients across all clinics',
      'GET /api/v1/clients/:id': 'Get client by ID',
      'GET /api/v1/clients/clinic/:clinicName': 'Get clients by clinic',
      'GET /api/v1/clients/clinic/:clinicName/insurance': 'Get clients with insurance',
      'GET /api/v1/clients/clinic/:clinicName/stats': 'Get client statistics',
      'GET /api/v1/clients/clinic/:clinicName/frontend-compatible': '🔗 Get clients by clinic in frontend-compatible format',
      'GET /api/v1/clients/:id/frontend-compatible': '🔗 Get client by ID in frontend-compatible format',
      'POST /api/v1/clients': 'Create new client',
      'PUT /api/v1/clients/:id': 'Update client',
      'DELETE /api/v1/clients/:id': 'Delete client (soft delete)'
    },
    compatibility: {
      description: 'Frontend-compatible endpoints (🔗) return data in the exact format expected by @bala_shadn_registry/ mock data structure',
      usage: 'Use these endpoints for seamless migration from mock data to real API',
      differences: {
        'Standard endpoints': 'Return rich, nested data structures with full backend features',
        'Frontend-compatible endpoints': 'Return flattened data structures matching frontend mock expectations'
      }
    },
    parameters: {
      pagination: 'page (int), limit (int, max 100)',
      search: 'q (search term), clinic (clinic name), limit (int)',
      filtering: 'status (active|inactive|historical|no-data), city, province'
    },
    examples: {
      'Get clinics (compatible)': 'GET /api/v1/clinics/frontend-compatible?page=1&limit=20&status=active',
      'Get clients (compatible)': 'GET /api/v1/clients/clinic/BodyBliss/frontend-compatible?page=1&search=smith',
      'Standard vs Compatible': {
        'Standard': 'GET /api/v1/clients/12345 → {personalInfo: {firstName: "John"}}',
        'Compatible': 'GET /api/v1/clients/12345/frontend-compatible → {firstName: "John"}'
      }
    }
  });
});

export default router;
