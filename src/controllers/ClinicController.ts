import { Request, Response } from 'express';
import { ClinicService } from '../services/ClinicService';
import { ClinicModel } from '../models/Clinic';
import { asyncHandler } from '../utils/asyncHandler';

export class ClinicController {
  /**
   * Get all available clinics with full data
   * GET /api/v1/clinics/frontend-compatible
   */
  static getClinicsFrontendCompatible = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Get retained clinics from MongoDB with full data
      const retainedClinics = await ClinicModel.findRetainedClinics();
      
      // Create proper slug and backend name mapping
      const generateProperSlug = (clinicName: string, displayName: string): string => {
        // Special mappings for known clinics to match frontend expectations
        const specialMappings: Record<string, string> = {
          'bodyblissphysio': 'bodybliss-physio',
          'BodyBliss': 'bodybliss',
          'BodyBlissOneCare': 'bodybliss-onecare',
          'Ortholine Duncan Mills': 'ortholine-duncan-mills',
          'Physio Bliss': 'physio-bliss',
          'My Cloud': 'my-cloud',
          'Century Care': 'century-care'
        };

        // Check if we have a special mapping first
        if (specialMappings[clinicName]) {
          return specialMappings[clinicName];
        }
        if (specialMappings[displayName]) {
          return specialMappings[displayName];
        }

        // Default slug generation from displayName
        return displayName.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      };

      // Get proper backend clinic name for API calls (what's stored in client documents)
      const getBackendClinicName = (clinicName: string, displayName: string): string => {
        // Map to actual clinic names used in client documents
        const backendNameMappings: Record<string, string> = {
          'bodyblissphysio': 'BodyBlissPhysio',
          'BodyBliss': 'BodyBliss',
          'BodyBlissOneCare': 'BodyBlissOneCare',
          'Ortholine Duncan Mills': 'Ortholine Duncan Mills',
          'Physio Bliss': 'Physio Bliss',
          'My Cloud': 'My Cloud',
          'Century Care': 'Century Care'
        };

        return backendNameMappings[clinicName] || backendNameMappings[displayName] || displayName;
      };

      // Transform to frontend-compatible format
      const clinicsData = retainedClinics.map(clinic => {
        const primaryAddress = clinic.address?.[0];
        
        return {
          id: clinic.clinicId,
          name: generateProperSlug(clinic.name, clinic.displayName),
          displayName: clinic.displayName,
          backendName: getBackendClinicName(clinic.name, clinic.displayName), // For API calls to other services
          address: primaryAddress?.line?.join(', ') || '',
          city: primaryAddress?.city || '',
          province: primaryAddress?.state || '',
          postalCode: primaryAddress?.postalCode || '',
          status: clinic.isActive() ? 'active' : 'inactive',
          lastActivity: clinic.stats?.lastActivity?.toISOString()?.split('T')[0] || null,
          totalAppointments: clinic.stats?.totalOrders || 0,
          clientCount: clinic.stats?.totalClients || clinic.clientCount || 0,
          description: `${clinic.displayName} - Active retained clinic`
        };
      });

      res.json({
        success: true,
        message: 'Clinics retrieved successfully',
        data: {
          clinics: clinicsData,
          total: clinicsData.length,
          retainedOnly: true
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve clinics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get all available clinics
   * GET /api/v1/clinics/available
   */
  static getAvailableClinics = asyncHandler(async (req: Request, res: Response) => {
    const clinics = ClinicService.getAvailableClinics();
    const mapping = ClinicService.getClinicMapping();

    res.json({
      success: true,
      message: 'Available clinics retrieved successfully',
      data: {
        clinics,
        mapping,
        total: clinics.length
      }
    });
  });

  /**
   * Validate clinic by slug
   * GET /api/v1/clinics/validate/:slug
   */
  static validateClinicSlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Clinic slug is required',
        data: {
          availableSlugs: ClinicService.getAvailableClinics().map(c => c.slug)
        }
      });
    }
    
    const clinic = ClinicService.getClinicBySlug(slug);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: `Clinic with slug '${slug}' not found in retained clinics list`,
        data: {
          availableSlugs: ClinicService.getAvailableClinics().map(c => c.slug)
        }
      });
    }

    return res.json({
      success: true,
      message: 'Clinic validated successfully',
      data: {
        clinic,
        backendName: clinic.name
      }
    });
  });

  /**
   * Get clinic mapping
   * GET /api/v1/clinics/mapping
   */
  static getClinicMapping = asyncHandler(async (req: Request, res: Response) => {
    const mapping = ClinicService.getClinicMapping();

    res.json({
      success: true,
      message: 'Clinic mapping retrieved successfully',
      data: {
        mapping,
        slugs: Object.keys(mapping),
        clinicNames: Object.values(mapping)
      }
    });
  });

  /**
   * Convert slug to clinic name
   * GET /api/v1/clinics/slug-to-name/:slug
   */
  static slugToClinicName = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Clinic slug is required',
        data: {
          isValid: false,
          availableSlugs: ClinicService.getAvailableClinics().map(c => c.slug)
        }
      });
    }
    
    try {
      const clinicName = ClinicService.slugToClinicName(slug);
      
      return res.json({
        success: true,
        message: 'Slug converted successfully',
        data: {
          slug,
          clinicName,
          isValid: true
        }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
        data: {
          slug,
          isValid: false,
          availableSlugs: ClinicService.getAvailableClinics().map(c => c.slug)
        }
      });
    }
  });
}
