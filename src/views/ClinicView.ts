import { IClinic } from '@/models/Clinic';

export class ClinicView {
  /**
   * Format single clinic for API response
   */
  static formatClinic(clinic: IClinic) {
    return {
      id: clinic.clinicId,
      name: clinic.clinicName,
      displayName: clinic.getDisplayName(),
      address: {
        street: clinic.clinicAddress || '',
        city: clinic.city || '',
        province: clinic.province || '',
        postalCode: clinic.postalCode || '',
        fullAddress: clinic.getFullAddress()
      },
      isActive: clinic.isActive(),
      isRetainedClinic: clinic.isRetainedClinic,
      createdAt: clinic.dateCreated,
      updatedAt: clinic.dateModified
    };
  }

  /**
   * Format clinic for frontend compatibility (matches mock data structure)
   */
  static formatClinicForFrontend(clinic: IClinic) {
    return {
      id: clinic.clinicId,
      name: clinic.clinicName,
      displayName: clinic.getDisplayName(),
      address: clinic.clinicAddress || '',
      city: clinic.city || '',
      province: clinic.province || '',
      postalCode: clinic.postalCode || '',
      isActive: clinic.isActive(),
      isRetainedClinic: clinic.isRetainedClinic,
      description: clinic.getDisplayName()
    };
  }

  /**
   * Format clinic list with pagination
   */
  static formatClinicList(clinics: IClinic[], page: number, limit: number, total: number) {
    return {
      success: true,
      data: clinics.map(this.formatClinic),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Format clinic summary (minimal data for dropdowns, etc.)
   */
  static formatClinicSummary(clinic: IClinic) {
    return {
      id: clinic.clinicId,
      name: clinic.clinicName,
      displayName: clinic.getDisplayName(),
      status: clinic.isActive(),
      isActive: clinic.isActive(),
      city: clinic.city || '',
      province: clinic.province || ''
    };
  }

  /**
   * Format clinic statistics
   */
  static formatClinicStats(clinic: IClinic) {
    return {
      clinic: {
        id: clinic.clinicId,
        name: clinic.clinicName,
        displayName: clinic.getDisplayName()
      },
      statistics: {
        clientCount: 0,
        totalOrders: 0,
        totalRevenue: 0,
        lastActivity: null,
        averageRevenuePerClient: 0
      },
      status: clinic.isActive(),
      isActive: clinic.isActive()
    };
  }

  /**
   * Format error response
   */
  static formatError(message: string, code?: string) {
    return {
      success: false,
      error: {
        code: code || 'CLINIC_ERROR',
        message
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format success response with custom message
   */
  static formatSuccess(data: any, message?: string) {
    return {
      success: true,
      data,
      message: message || 'Operation completed successfully',
      timestamp: new Date().toISOString()
    };
  }
}
