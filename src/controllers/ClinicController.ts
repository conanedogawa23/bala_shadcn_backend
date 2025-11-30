import { Request, Response } from 'express';
import { ClinicService } from '../services/ClinicService';
import { ClinicModel } from '../models/Clinic';
import { ClientModel } from '../models/Client';
import { AppointmentModel } from '../models/Appointment';
import Order from '../models/Order';
import { asyncHandler } from '../utils/asyncHandler';

export class ClinicController {

  /**
   * Get backend clinic name for data queries
   * Maps clinic.name to the actual names used in client/appointment/order documents
   */
  private static getBackendClinicName = (clinicName: string, displayName: string): string => {
    // Map to actual clinic names used in client/appointment documents
    const backendNameMappings: Record<string, string> = {
      'bodyblissphysio': 'BodyBlissPhysio',
      'BodyBlissOneCare': 'BodyBlissOneCare',
      'Ortholine Duncan Mills': 'Ortholine Duncan Mills',
      'Physio Bliss': 'Physio Bliss',
      'My Cloud': 'My Cloud',
      'Century Care': 'Century Care',
      'BodyBliss Physiotherapy': 'BodyBlissPhysio'
    };

    return backendNameMappings[clinicName] || backendNameMappings[displayName] || clinicName;
  };

  /**
   * Get all available clinics with full data from MongoDB
   * GET /api/v1/clinics/frontend-compatible
   * This is the primary endpoint for fetching clinic data
   */
  static getClinicsFrontendCompatible = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Get retained clinics from MongoDB
      const retainedClinics = await ClinicModel.findRetainedClinics();

      console.log(`📊 Processing ${retainedClinics.length} retained clinics`);

      // Transform to frontend-compatible format with real stats
      const clinicsData = await Promise.all(retainedClinics.map(async (clinic) => {
        const streetAddress = clinic.address?.street || '';
        const cityName = clinic.address?.city || '';
        const provinceName = clinic.address?.province || '';
        const postalCode = clinic.address?.postalCode || '';

        // Calculate real stats from database
        let clientCount = 0;
        let totalAppointments = 0;
        let totalOrders = 0;
        let lastActivity: Date | null = null;

        try {
          const backendName = ClinicController.getBackendClinicName(clinic.name, clinic.getDisplayName());
          
          // Count clients, appointments, orders
          clientCount = await ClientModel.countDocuments({ 
            defaultClinic: backendName, 
            isActive: true 
          });

          totalAppointments = await AppointmentModel.countDocuments({ 
            clinicName: backendName, 
            isActive: true 
          });

          totalOrders = await Order.countDocuments({ 
            clinicName: backendName
          });

          // Get latest activity
          const latestAppointment = await AppointmentModel.findOne({ 
            clinicName: backendName, 
            isActive: true 
          }).sort({ startDate: -1 }).limit(1);
          
          if (latestAppointment?.startDate) {
            lastActivity = latestAppointment.startDate;
          }
        } catch (statsError) {
          console.error(`Error calculating stats for clinic ${clinic.name}:`, statsError);
        }
        
        return {
          id: clinic.clinicId,
          name: clinic.name, // Use MongoDB name directly - this is the canonical name
          displayName: clinic.getDisplayName(),
          backendName: ClinicController.getBackendClinicName(clinic.name, clinic.getDisplayName()),
          address: streetAddress,
          city: cityName,
          province: provinceName,
          postalCode: postalCode,
          status: clinic.isActive() ? 'active' : 'inactive',
          lastActivity: lastActivity?.toISOString()?.split('T')[0] || null,
          totalAppointments,
          totalOrders,
          clientCount,
          description: `${clinic.getDisplayName()} - Active retained clinic`,
          logo: clinic.logo || null
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
   * Get all available clinics (simple list)
   * GET /api/v1/clinics/available
   */
  static getAvailableClinics = asyncHandler(async (req: Request, res: Response) => {
    const clinics = await ClinicService.getRetainedClinics();

    res.json({
      success: true,
      message: 'Available clinics retrieved successfully',
      data: {
        clinics,
        total: clinics.length
      }
    });
  });

  /**
   * Find clinic by name (case-insensitive)
   * GET /api/v1/clinics/find/:name
   */
  static findClinicByName = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    
    if (!name) {
      const clinicNames = await ClinicService.getRetainedClinicNames();
      return res.status(400).json({
        success: false,
        message: 'Clinic name is required',
        data: { availableClinics: clinicNames }
      });
    }
    
    const clinic = await ClinicService.findClinicByName(name);
    
    if (!clinic) {
      const clinicNames = await ClinicService.getRetainedClinicNames();
      return res.status(404).json({
        success: false,
        message: `Clinic '${name}' not found`,
        data: { availableClinics: clinicNames }
      });
    }

    return res.json({
      success: true,
      message: 'Clinic found',
      data: {
        clinic,
        backendName: ClinicController.getBackendClinicName(clinic.name, clinic.displayName)
      }
    });
  });

  /**
   * Get clinic names only
   * GET /api/v1/clinics/names
   */
  static getClinicNames = asyncHandler(async (req: Request, res: Response) => {
    const names = await ClinicService.getRetainedClinicNames();

    res.json({
      success: true,
      message: 'Clinic names retrieved successfully',
      data: { names, total: names.length }
    });
  });
}
