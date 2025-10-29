import { Request, Response } from 'express';
import { ClinicService } from '../services/ClinicService';
import { ClinicModel } from '../models/Clinic';
import { ClientModel } from '../models/Client';
import { AppointmentModel } from '../models/Appointment';
import Order from '../models/Order';
import { asyncHandler } from '../utils/asyncHandler';

export class ClinicController {

  // Return clinic name as-is to match MongoDB exactly (no slug transformation)
  private static generateProperSlug = (clinicName: string, displayName?: string): string => {
    // Return the exact MongoDB clinic name without any transformation
    return clinicName;
  };

  // Utility function to get backend clinic names
  private static getBackendClinicName = (clinicName: string, displayName: string): string => {
    // Map to actual clinic names used in client/appointment documents
    // Based on MongoDB data analysis:
    // - Clients collection uses: BodyBlissPhysio, BodyBlissOneCare, etc.
    // - Appointments collection uses: BodyBlissPhysio, Physio Bliss, etc.
    const backendNameMappings: Record<string, string> = {
      // Primary mapping - clinic.name to actual data collection names
      'bodyblissphysio': 'BodyBlissPhysio',           // 3,664 clients, 59,058 appointments
      'BodyBlissOneCare': 'BodyBlissOneCare',         // 14,846 clients, 10,169 appointments
      'Ortholine Duncan Mills': 'Ortholine Duncan Mills', // 11,369 clients, 14,291 appointments
      'Physio Bliss': 'Physio Bliss',                 // 711 clients, 51,922 appointments
      'My Cloud': 'My Cloud',                         // 379 clients, 1,425 appointments
      'Century Care': 'Century Care',                 // 203 clients
      
      // Fallback mappings by displayName
      'BodyBliss Physiotherapy': 'BodyBlissPhysio'
    };

    return backendNameMappings[clinicName] || backendNameMappings[displayName] || clinicName;
  };

  /**
   * Get all available clinics with full data
   * GET /api/v1/clinics/frontend-compatible
   */
  static getClinicsFrontendCompatible = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Get retained clinics from MongoDB with full data
      const retainedClinics = await ClinicModel.findRetainedClinics();

      // Transform to frontend-compatible format with real stats
      const clinicsData = await Promise.all(retainedClinics.map(async (clinic) => {
        // Use MongoDB fields directly
        const streetAddress = clinic.address?.street || '';
        const cityName = clinic.address?.city || '';
        const provinceName = clinic.address?.province || '';
        const postalCode = clinic.address?.postalCode || '';
        
        // Phone/fax not in current model - set empty values
        const phoneContact = null;
        const faxContact = null;

        // Calculate real stats from database
        let clientCount = 0;
        let totalAppointments = 0;
        let totalOrders = 0;
        let lastActivity: Date | null = null;

        try {
          // Get the correct backend clinic name used in client/appointment collections
          const backendName = ClinicController.getBackendClinicName(clinic.name, clinic.getDisplayName());
          
          // Count clients using the mapped backend name
          clientCount = await ClientModel.countDocuments({ 
            defaultClinic: backendName, 
            isActive: true 
          });

          // Count appointments using the mapped backend name
          totalAppointments = await AppointmentModel.countDocuments({ 
            clinicName: backendName, 
            isActive: true 
          });

          // Count orders using the mapped backend name
          totalOrders = await Order.countDocuments({ 
            clinicName: backendName
          });

          // Get latest activity from appointments
          const latestAppointment = await AppointmentModel.findOne({ 
            clinicName: backendName, 
            isActive: true 
          }).sort({ startDate: -1 }).limit(1);
          
          if (latestAppointment && latestAppointment.startDate) {
            lastActivity = latestAppointment.startDate;
          }

        } catch (statsError) {
          console.error(`Error calculating stats for clinic ${clinic.name}:`, statsError);
          // Continue with zeros if stats calculation fails
        }
        
        return {
          id: clinic.clinicId,
          name: ClinicController.generateProperSlug(clinic.name, clinic.getDisplayName()),
          displayName: clinic.getDisplayName(),
          backendName: ClinicController.getBackendClinicName(clinic.name, clinic.getDisplayName()), // For API calls to other services
          address: streetAddress,
          city: cityName,
          province: provinceName,
          postalCode: postalCode,
          phone: '',
          fax: '',
          status: clinic.isActive() ? 'active' : 'inactive',
          lastActivity: lastActivity?.toISOString()?.split('T')[0] || null,
          totalAppointments: totalAppointments,
          totalOrders: totalOrders,
          clientCount: clientCount,
          description: `${clinic.getDisplayName()} - Active retained clinic`
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
        ClinicController.generateProperSlug(clinic.name, clinic.getDisplayName())
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
      ClinicController.generateProperSlug(c.name, c.getDisplayName()) === slug
    );
    
    if (!clinic) {
      const availableSlugs = retainedClinics.map(c => 
        ClinicController.generateProperSlug(c.name, c.getDisplayName())
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
          name: ClinicController.generateProperSlug(clinic.name, clinic.getDisplayName()),
          displayName: clinic.getDisplayName(),
          backendName: ClinicController.getBackendClinicName(clinic.name, clinic.getDisplayName())
        },
        backendName: ClinicController.getBackendClinicName(clinic.name, clinic.getDisplayName())
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
