import { Request, Response } from 'express';
import { ClinicService } from '../services/ClinicService';
import { ClinicModel } from '../models/Clinic';
import { asyncHandler } from '../utils/asyncHandler';

export class ClinicController {

  // Utility function to generate proper slugs
  private static generateProperSlug = (clinicName: string, displayName: string): string => {
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

  // Utility function to get backend clinic names
  private static getBackendClinicName = (clinicName: string, displayName: string): string => {
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

  /**
   * Get all available clinics with full data
   * GET /api/v1/clinics/frontend-compatible
   */
  static getClinicsFrontendCompatible = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Get retained clinics from MongoDB with full data
      const retainedClinics = await ClinicModel.findRetainedClinics();

      // Import services for stats calculation
      const { ClientService } = await import('../services/ClientService');
      const { AppointmentService } = await import('../services/AppointmentService');
      const { ClientModel } = await import('../models/Client');
      const { AppointmentModel } = await import('../models/Appointment');

      // Transform to frontend-compatible format with real stats
      const clinicsData = await Promise.all(retainedClinics.map(async (clinic) => {
        // Handle Mongoose address structure: array of address documents
        const addressArray = clinic.address || [];
        const firstAddress = addressArray[0];
        
        // Access Mongoose document data via _doc or toObject() and cast to any
        const addressData = firstAddress ? ((firstAddress as any)._doc || (firstAddress as any).toObject?.() || firstAddress) as any : {};
        
        // Extract properties from address document
        const streetAddress = addressData.street || '';
        const cityName = addressData.city || '';
        const provinceName = addressData.province || '';
        const postalCode = addressData.postalCode || '';
        
        // Extract phone and fax from telecom array if available
        const phoneContact = clinic.telecom?.find(contact => contact.system === 'phone');
        const faxContact = clinic.telecom?.find(contact => contact.system === 'fax');

        // Calculate real stats from database
        let clientCount = 0;
        let totalAppointments = 0;
        let lastActivity: Date | null = null;

        try {
          // Get clinic names that might be used in client/appointment data
          const possibleClinicNames = [
            clinic.name,           // e.g., "bodyblissphysio"
            clinic.displayName,    // e.g., "BodyBliss Physiotherapy"
            // Handle common variations
            clinic.name.toLowerCase().includes('bodybliss') ? 'BodyBliss' : null,
            clinic.name.toLowerCase().includes('bodybliss') ? 'BodyBlissPhysio' : null
          ].filter(Boolean);

          // Count clients across all possible clinic name variations
          for (const clinicNameVariation of possibleClinicNames) {
            const count = await ClientModel.countDocuments({ 
              defaultClinic: clinicNameVariation, 
              isActive: true 
            });
            clientCount += count;
          }

          // Count appointments across all possible clinic name variations
          for (const clinicNameVariation of possibleClinicNames) {
            const count = await AppointmentModel.countDocuments({ 
              clinicName: clinicNameVariation, 
              isActive: true 
            });
            totalAppointments += count;

            // Get latest activity
            const latestAppointment = await AppointmentModel.findOne({ 
              clinicName: clinicNameVariation, 
              isActive: true 
            }).sort({ startDate: -1 }).limit(1);
            
            if (latestAppointment && latestAppointment.startDate) {
              if (!lastActivity || latestAppointment.startDate > lastActivity) {
                lastActivity = latestAppointment.startDate;
              }
            }
          }

        } catch (statsError) {
          console.error(`Error calculating stats for clinic ${clinic.name}:`, statsError);
          // Continue with zeros if stats calculation fails
        }
        
        return {
          id: clinic.clinicId,
          name: ClinicController.generateProperSlug(clinic.name, clinic.displayName),
          displayName: clinic.displayName,
          backendName: ClinicController.getBackendClinicName(clinic.name, clinic.displayName), // For API calls to other services
          address: streetAddress,
          city: cityName,
          province: provinceName,
          postalCode: postalCode,
          phone: phoneContact?.value || '',
          fax: faxContact?.value || '',
          status: clinic.isActive() ? 'active' : 'inactive',
          lastActivity: lastActivity?.toISOString()?.split('T')[0] || null,
          totalAppointments: totalAppointments,
          clientCount: clientCount,
          description: `${clinic.displayName} - Active retained clinic`
        };
      }));

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
   * Validate clinic by slug (MongoDB-based)
   * GET /api/v1/clinics/validate/:slug
   */
  static validateClinicSlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    
    if (!slug) {
      const retainedClinics = await ClinicModel.findRetainedClinics();
      const availableSlugs = retainedClinics.map(clinic => 
        ClinicController.generateProperSlug(clinic.name, clinic.displayName)
      );
      
      return res.status(400).json({
        success: false,
        message: 'Clinic slug is required',
        data: {
          availableSlugs
        }
      });
    }
    
    // Get retained clinics from MongoDB
    const retainedClinics = await ClinicModel.findRetainedClinics();
    
    // Find clinic by matching generated slug
    const clinic = retainedClinics.find(c => 
      ClinicController.generateProperSlug(c.name, c.displayName) === slug
    );
    
    if (!clinic) {
      const availableSlugs = retainedClinics.map(c => 
        ClinicController.generateProperSlug(c.name, c.displayName)
      );
      
      return res.status(404).json({
        success: false,
        message: `Clinic with slug '${slug}' not found in retained clinics list`,
        data: {
          availableSlugs
        }
      });
    }

    return res.json({
      success: true,
      message: 'Clinic validated successfully',
      data: {
        clinic: {
          id: clinic.clinicId,
          name: ClinicController.generateProperSlug(clinic.name, clinic.displayName),
          displayName: clinic.displayName,
          backendName: ClinicController.getBackendClinicName(clinic.name, clinic.displayName)
        },
        backendName: ClinicController.getBackendClinicName(clinic.name, clinic.displayName)
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
