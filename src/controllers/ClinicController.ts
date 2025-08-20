import { Request, Response } from 'express';
import { ClinicService } from '../services/ClinicService';
import { asyncHandler } from '../utils/asyncHandler';

export class ClinicController {
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
