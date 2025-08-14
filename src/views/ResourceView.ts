import { IResource } from '@/models/Resource';

export class ResourceView {
  /**
   * Format single resource for API response
   */
  static formatResource(resource: IResource) {
    return {
      success: true,
      data: {
        id: resource.resourceId,
        name: resource.resourceName,
        fullName: resource.getFullName(),
        type: resource.type,
        color: resource.color,
        image: resource.image,
        
        // Type-specific data
        ...(resource.type === 'practitioner' && resource.practitioner && {
          practitioner: {
            firstName: resource.practitioner.firstName,
            lastName: resource.practitioner.lastName,
            credentials: resource.practitioner.credentials,
            licenseNumber: resource.practitioner.licenseNumber,
            specialties: resource.practitioner.specialties,
            email: resource.practitioner.email,
            phone: resource.practitioner.phone
          }
        }),
        
        ...(resource.type === 'service' && resource.service && {
          service: {
            category: resource.service.category,
            duration: resource.service.duration,
            formattedDuration: this.formatDuration(resource.service.duration),
            price: resource.service.price,
            formattedPrice: resource.service.price ? `$${resource.service.price.toFixed(2)}` : null,
            description: resource.service.description,
            requiresEquipment: resource.service.requiresEquipment
          }
        }),
        
        // Availability
        availability: resource.availability,
        workingDays: this.getWorkingDays(resource.availability),
        
        // Clinic associations
        clinics: resource.clinics,
        defaultClinic: resource.defaultClinic,
        
        // Status and settings
        isActive: resource.isActive,
        isBookable: resource.isBookable,
        requiresApproval: resource.requiresApproval,
        
        // Statistics
        stats: {
          totalAppointments: resource.stats.totalAppointments,
          averageDuration: resource.stats.averageDuration,
          formattedAverageDuration: this.formatDuration(resource.stats.averageDuration),
          rating: resource.stats.rating,
          lastActivity: resource.stats.lastActivity
        },
        
        // Metadata
        dateCreated: resource.dateCreated,
        dateModified: resource.dateModified
      }
    };
  }

  /**
   * Format resource list with pagination
   */
  static formatResourceList(resources: IResource[], page: number, limit: number, total: number) {
    return {
      success: true,
      data: resources.map(resource => ({
        id: resource.resourceId,
        name: resource.resourceName,
        fullName: resource.getFullName(),
        type: resource.type,
        color: resource.color,
        
        // Basic type-specific info
        ...(resource.type === 'practitioner' && resource.practitioner && {
          practitioner: {
            firstName: resource.practitioner.firstName,
            lastName: resource.practitioner.lastName,
            credentials: resource.practitioner.credentials,
            specialties: resource.practitioner.specialties
          }
        }),
        
        ...(resource.type === 'service' && resource.service && {
          service: {
            category: resource.service.category,
            duration: resource.service.duration,
            formattedDuration: this.formatDuration(resource.service.duration),
            price: resource.service.price
          }
        }),
        
        // Summary info
        clinics: resource.clinics,
        defaultClinic: resource.defaultClinic,
        isActive: resource.isActive,
        isBookable: resource.isBookable,
        workingDays: this.getWorkingDays(resource.availability),
        totalAppointments: resource.stats.totalAppointments,
        lastActivity: resource.stats.lastActivity
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Format practitioners list
   */
  static formatPractitioners(practitioners: any[]) {
    return {
      success: true,
      data: practitioners.map(practitioner => ({
        id: practitioner.resourceId,
        name: practitioner.resourceName,
        fullName: practitioner.getFullName ? practitioner.getFullName() : practitioner.resourceName,
        type: practitioner.type,
        color: practitioner.color,
        image: practitioner.image,
        
        practitioner: {
          firstName: practitioner.practitioner?.firstName,
          lastName: practitioner.practitioner?.lastName,
          credentials: practitioner.practitioner?.credentials,
          licenseNumber: practitioner.practitioner?.licenseNumber,
          specialties: practitioner.practitioner?.specialties || [],
          email: practitioner.practitioner?.email,
          phone: practitioner.practitioner?.phone
        },
        
        clinics: practitioner.clinics,
        defaultClinic: practitioner.defaultClinic,
        isActive: practitioner.isActive,
        isBookable: practitioner.isBookable,
        requiresApproval: practitioner.requiresApproval,
        
        availability: practitioner.availability,
        workingDays: this.getWorkingDays(practitioner.availability),
        
        stats: practitioner.stats,
        appointmentStats: practitioner.appointmentStats
      })),
      summary: {
        total: practitioners.length,
        bySpecialty: this.groupPractitionersBySpecialty(practitioners),
        byClinic: this.groupByClinic(practitioners)
      }
    };
  }

  /**
   * Format services list
   */
  static formatServices(servicesData: any) {
    return {
      success: true,
      data: {
        services: servicesData.services.map((service: any) => ({
          id: service.resourceId,
          name: service.resourceName,
          type: service.type,
          color: service.color,
          
          service: {
            category: service.service?.category,
            duration: service.service?.duration,
            formattedDuration: this.formatDuration(service.service?.duration),
            price: service.service?.price,
            formattedPrice: service.service?.price ? `$${service.service.price.toFixed(2)}` : null,
            description: service.service?.description,
            requiresEquipment: service.service?.requiresEquipment || []
          },
          
          isActive: service.isActive,
          isBookable: service.isBookable,
          stats: service.stats
        })),
        
        servicesByCategory: Object.entries(servicesData.servicesByCategory).map(([category, services]: [string, any]) => ({
          category,
          services: services.map((service: any) => ({
            id: service.resourceId,
            name: service.resourceName,
            duration: service.service?.duration,
            price: service.service?.price,
            description: service.service?.description
          }))
        }))
      }
    };
  }

  /**
   * Format bookable resources for a clinic
   */
  static formatBookableResources(resourcesData: any) {
    return {
      success: true,
      data: {
        clinic: resourcesData.clinic,
        resources: resourcesData.resources.map((resource: any) => ({
          id: resource.resourceId,
          name: resource.resourceName,
          fullName: resource.getFullName ? resource.getFullName() : resource.resourceName,
          type: resource.type,
          color: resource.color,
          
          // Type-specific summary
          ...(resource.type === 'practitioner' && resource.practitioner && {
            specialties: resource.practitioner.specialties,
            credentials: resource.practitioner.credentials
          }),
          
          ...(resource.type === 'service' && resource.service && {
            category: resource.service.category,
            duration: resource.service.duration,
            price: resource.service.price
          }),
          
          isBookable: resource.isBookable,
          requiresApproval: resource.requiresApproval,
          workingDays: this.getWorkingDays(resource.availability),
          availability: resource.availability
        })),
        
        resourcesByType: Object.entries(resourcesData.resourcesByType).map(([type, resources]: [string, any]) => ({
          type,
          count: resources.length,
          resources: resources.map((resource: any) => ({
            id: resource.resourceId,
            name: resource.resourceName,
            fullName: resource.getFullName ? resource.getFullName() : resource.resourceName
          }))
        }))
      }
    };
  }

  /**
   * Format resource statistics
   */
  static formatResourceStats(stats: any) {
    return {
      success: true,
      data: {
        resource: stats.resource,
        dateRange: stats.dateRange,
        statistics: {
          ...stats.statistics,
          completionRate: Math.round(stats.statistics.completionRate * 100) / 100,
          cancellationRate: Math.round(stats.statistics.cancellationRate * 100) / 100,
          averageDuration: Math.round(stats.statistics.averageDuration),
          formattedAverageDuration: this.formatDuration(stats.statistics.averageDuration),
          appointmentsByDay: stats.statistics.appointmentsByDay
        }
      }
    };
  }

  /**
   * Format success response
   */
  static formatSuccess(message: string, data?: any) {
    return {
      success: true,
      message,
      ...(data && { data })
    };
  }

  /**
   * Format error response
   */
  static formatError(message: string, code?: string, details?: any) {
    return {
      success: false,
      error: {
        message,
        code: code || 'RESOURCE_ERROR',
        ...(details && { details })
      }
    };
  }

  /**
   * Format validation error response
   */
  static formatValidationError(errors: any[]) {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.map(error => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value
        }))
      }
    };
  }

  /**
   * Format duration in minutes to human-readable format (private helper)
   */
  private static formatDuration(minutes: number): string {
    if (!minutes) return '0m';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  /**
   * Get working days from availability (private helper)
   */
  private static getWorkingDays(availability: any): string[] {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days.filter(day => availability[day]?.available);
  }

  /**
   * Group practitioners by specialty (private helper)
   */
  private static groupPractitionersBySpecialty(practitioners: any[]): any {
    const specialtyGroups: { [key: string]: number } = {};
    
    practitioners.forEach(practitioner => {
      const specialties = practitioner.practitioner?.specialties || [];
      specialties.forEach((specialty: string) => {
        specialtyGroups[specialty] = (specialtyGroups[specialty] || 0) + 1;
      });
    });
    
    return Object.entries(specialtyGroups).map(([specialty, count]) => ({
      specialty,
      count
    }));
  }

  /**
   * Group resources by clinic (private helper)
   */
  private static groupByClinic(resources: any[]): any {
    const clinicGroups: { [key: string]: number } = {};
    
    resources.forEach(resource => {
      const clinics = resource.clinics || [];
      clinics.forEach((clinic: string) => {
        clinicGroups[clinic] = (clinicGroups[clinic] || 0) + 1;
      });
    });
    
    return Object.entries(clinicGroups).map(([clinic, count]) => ({
      clinic,
      count
    }));
  }
}
