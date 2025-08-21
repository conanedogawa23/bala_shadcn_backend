import { IClinic } from '@/models/Clinic';

export class ClinicView {
  /**
   * Format single clinic for API response
   */
  static formatClinic(clinic: IClinic) {
    return {
      id: clinic.clinicId,
      name: clinic.name,
      displayName: clinic.displayName,
      completeName: clinic.completeName,
      address: {
        street: clinic.address?.[0]?.line?.join(', ') || '',
        city: clinic.address?.[0]?.city || '',
        province: clinic.address?.[0]?.state || '',
        postalCode: clinic.address?.[0]?.postalCode || '',
        fullAddress: clinic.getFullAddress()
      },
      contact: clinic.contact,
      services: clinic.services,
      status: clinic.status,
      isActive: clinic.isActive(),
      clientCount: clinic.clientCount,
      stats: clinic.stats,
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
      name: clinic.name,
      displayName: clinic.displayName,
      address: clinic.address?.[0]?.line?.join(', ') || '',
      city: clinic.address?.[0]?.city || '',
      province: clinic.address?.[0]?.state || '',
      postalCode: clinic.address?.[0]?.postalCode || '',
      status: clinic.status,
      lastActivity: clinic.stats.lastActivity?.toISOString().split('T')[0],
      totalAppointments: clinic.stats.totalOrders, // Map orders to appointments
      clientCount: clinic.clientCount,
      description: clinic.completeName
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
      name: clinic.name,
      displayName: clinic.displayName,
      status: clinic.status,
      isActive: clinic.isActive(),
      clientCount: clinic.clientCount,
      city: clinic.address?.[0]?.city || '',
      province: clinic.address?.[0]?.state || ''
    };
  }

  /**
   * Format clinic statistics
   */
  static formatClinicStats(clinic: IClinic) {
    return {
      clinic: {
        id: clinic.clinicId,
        name: clinic.name,
        displayName: clinic.displayName
      },
      statistics: {
        clientCount: clinic.clientCount,
        totalOrders: clinic.stats.totalOrders,
        totalRevenue: clinic.stats.totalRevenue,
        lastActivity: clinic.stats.lastActivity,
        averageRevenuePerClient: clinic.clientCount > 0 
          ? Math.round((clinic.stats.totalRevenue / clinic.clientCount) * 100) / 100 
          : 0
      },
      status: clinic.status,
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
