import { ResourceModel, IResource } from '@/models/Resource';
import { AppointmentModel } from '@/models/Appointment';
import { ClinicModel } from '@/models/Clinic';
import { NotFoundError, ValidationError, DatabaseError, ConflictError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class ResourceService {
  /**
   * Get all resources with filtering and pagination
   */
  static async getAllResources(params: {
    page?: number;
    limit?: number;
    type?: string;
    clinicName?: string;
    specialty?: string;
    isActive?: boolean;
    isBookable?: boolean;
  }) {
    try {
      const {
        page = 1,
        limit = 50,
        type,
        clinicName,
        specialty,
        isActive = true,
        isBookable
      } = params;

      // Build query
      const query: any = { isActive };

      if (type) {
        query.type = type;
      }

      if (clinicName) {
        query.clinics = clinicName;
      }

      if (specialty && type === 'practitioner') {
        query['practitioner.specialties'] = { $regex: specialty, $options: 'i' };
      }

      if (isBookable !== undefined) {
        query.isBookable = isBookable;
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [resources, total] = await Promise.all([
        ResourceModel.find(query)
          .sort({ type: 1, resourceName: 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        ResourceModel.countDocuments(query)
      ]);

      return { resources, page, limit, total };
    } catch (error) {
      logger.error('Error in getAllResources:', error);
      throw new DatabaseError('Failed to retrieve resources', error as Error);
    }
  }

  /**
   * Get resource by ID
   */
  static async getResourceById(resourceId: number): Promise<IResource> {
    try {
      const resource = await ResourceModel.findOne({ resourceId });
      
      if (!resource) {
        throw new NotFoundError('Resource', resourceId.toString());
      }

      return resource;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getResourceById:', error);
      throw new DatabaseError('Failed to retrieve resource', error as Error);
    }
  }

  /**
   * Create new resource
   */
  static async createResource(resourceData: any): Promise<IResource> {
    try {
      // Validate required fields
      if (!resourceData.resourceId) {
        throw new ValidationError('Resource ID is required');
      }

      if (!resourceData.resourceName) {
        throw new ValidationError('Resource name is required');
      }

      if (!resourceData.type) {
        throw new ValidationError('Resource type is required');
      }

      // Check if resource ID already exists
      const existingResource = await ResourceModel.findOne({ resourceId: resourceData.resourceId });
      if (existingResource) {
        throw new ConflictError(`Resource with ID ${resourceData.resourceId} already exists`);
      }

      // Validate clinic associations
      if (resourceData.clinics && resourceData.clinics.length > 0) {
        for (const clinicName of resourceData.clinics) {
          const clinic = await ClinicModel.findOne({ 
            name: new RegExp(`^${clinicName}$`, 'i') 
          });
          if (!clinic) {
            throw new NotFoundError('Clinic', clinicName);
          }
        }
      }

      // Validate type-specific data
      if (resourceData.type === 'practitioner') {
        if (!resourceData.practitioner) {
          throw new ValidationError('Practitioner details are required for practitioner type');
        }
        
        // Ensure specialties array exists
        if (!resourceData.practitioner.specialties) {
          resourceData.practitioner.specialties = [];
        }
      }

      if (resourceData.type === 'service') {
        if (!resourceData.service) {
          throw new ValidationError('Service details are required for service type');
        }
        
        if (!resourceData.service.category) {
          throw new ValidationError('Service category is required');
        }
        
        if (!resourceData.service.duration || resourceData.service.duration < 15) {
          throw new ValidationError('Service duration must be at least 15 minutes');
        }
      }

      // Create resource
      const resource = new ResourceModel({
        ...resourceData,
        isActive: resourceData.isActive !== undefined ? resourceData.isActive : true,
        isBookable: resourceData.isBookable !== undefined ? resourceData.isBookable : true,
        requiresApproval: resourceData.requiresApproval || false,
        stats: {
          totalAppointments: 0,
          averageDuration: resourceData.service?.duration || 30,
          lastActivity: new Date()
        }
      });

      const savedResource = await resource.save();

      logger.info(`Resource created: ${savedResource.resourceId} - ${savedResource.resourceName}`);
      return savedResource;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      logger.error('Error in createResource:', error);
      throw new DatabaseError('Failed to create resource', error as Error);
    }
  }

  /**
   * Update resource
   */
  static async updateResource(resourceId: number, updateData: any): Promise<IResource> {
    try {
      // Check if resource exists
      const existingResource = await this.getResourceById(resourceId);

      // Validate clinic associations if being updated
      if (updateData.clinics && updateData.clinics.length > 0) {
        for (const clinicName of updateData.clinics) {
          const clinic = await ClinicModel.findOne({ 
            name: new RegExp(`^${clinicName}$`, 'i') 
          });
          if (!clinic) {
            throw new NotFoundError('Clinic', clinicName);
          }
        }
      }

      // Type-specific validation
      if (updateData.type === 'practitioner' && updateData.practitioner) {
        if (!updateData.practitioner.specialties) {
          updateData.practitioner.specialties = [];
        }
      }

      if (updateData.type === 'service' && updateData.service) {
        if (updateData.service.duration && updateData.service.duration < 15) {
          throw new ValidationError('Service duration must be at least 15 minutes');
        }
      }

      const updatedResource = await ResourceModel.findOneAndUpdate(
        { resourceId },
        {
          ...updateData,
          dateModified: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!updatedResource) {
        throw new NotFoundError('Resource', resourceId.toString());
      }

      logger.info(`Resource updated: ${resourceId}`);
      return updatedResource;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in updateResource:', error);
      throw new DatabaseError('Failed to update resource', error as Error);
    }
  }

  /**
   * Delete resource (soft delete)
   */
  static async deleteResource(resourceId: number): Promise<void> {
    try {
      const resource = await this.getResourceById(resourceId);

      // Check if resource has future appointments
      const futureAppointments = await AppointmentModel.countDocuments({
        resourceId: resourceId,
        startDate: { $gte: new Date() },
        isActive: true
      });

      if (futureAppointments > 0) {
        throw new ConflictError(`Cannot delete resource: ${futureAppointments} future appointments exist`);
      }

      await ResourceModel.findOneAndUpdate(
        { resourceId },
        { 
          isActive: false,
          isBookable: false,
          dateModified: new Date()
        }
      );

      logger.info(`Resource deleted: ${resourceId}`);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      logger.error('Error in deleteResource:', error);
      throw new DatabaseError('Failed to delete resource', error as Error);
    }
  }

  /**
   * Get practitioners by clinic and specialty
   */
  static async getPractitioners(clinicName?: string, specialty?: string) {
    try {
      const practitioners = await ResourceModel.findPractitioners(clinicName, specialty);
      
      // Add appointment stats for each practitioner
      const practitionersWithStats = await Promise.all(
        practitioners.map(async (practitioner: any) => {
          const appointmentCount = await AppointmentModel.countDocuments({
            resourceId: practitioner.resourceId,
            isActive: true
          });

          const recentAppointments = await AppointmentModel.countDocuments({
            resourceId: practitioner.resourceId,
            startDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
            isActive: true
          });

          return {
            ...practitioner.toObject(),
            appointmentStats: {
              total: appointmentCount,
              lastMonth: recentAppointments
            }
          };
        })
      );

      return practitionersWithStats;
    } catch (error) {
      logger.error('Error in getPractitioners:', error);
      throw new DatabaseError('Failed to retrieve practitioners', error as Error);
    }
  }

  /**
   * Get services by category
   */
  static async getServices(category?: string) {
    try {
      const services = await ResourceModel.findServices(category);
      
      // Group services by category
      const servicesByCategory = services.reduce((acc: any, service: any) => {
        const cat = service.service?.category || 'Other';
        if (!acc[cat]) {
          acc[cat] = [];
        }
        acc[cat].push(service);
        return acc;
      }, {});

      return {
        services,
        servicesByCategory
      };
    } catch (error) {
      logger.error('Error in getServices:', error);
      throw new DatabaseError('Failed to retrieve services', error as Error);
    }
  }

  /**
   * Get bookable resources for a clinic
   */
  static async getBookableResources(clinicName: string) {
    try {
      // Verify clinic exists - use case-insensitive search due to naming inconsistencies
      const clinic = await ClinicModel.findOne({ 
        name: new RegExp(`^${clinicName}$`, 'i') 
      });
      if (!clinic) {
        throw new NotFoundError('Clinic', clinicName);
      }

      const resources = await ResourceModel.findBookableResources(clinicName);

      // Group by type
      const resourcesByType = resources.reduce((acc: any, resource: any) => {
        if (!acc[resource.type]) {
          acc[resource.type] = [];
        }
        acc[resource.type].push(resource);
        return acc;
      }, {});

      return {
        clinic: {
          name: clinic.name,
          displayName: clinic.displayName
        },
        resources,
        resourcesByType
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getBookableResources:', error);
      throw new DatabaseError('Failed to retrieve bookable resources', error as Error);
    }
  }

  /**
   * Update resource availability
   */
  static async updateResourceAvailability(resourceId: number, availability: any): Promise<IResource> {
    try {
      const resource = await this.getResourceById(resourceId);

      // Validate availability format
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

      for (const day of validDays) {
        if (availability[day]) {
          const dayAvailability = availability[day];
          
          if (typeof dayAvailability.available !== 'boolean') {
            throw new ValidationError(`Invalid availability flag for ${day}`);
          }
          
          if (dayAvailability.available) {
            if (!timeRegex.test(dayAvailability.start)) {
              throw new ValidationError(`Invalid start time format for ${day}`);
            }
            
            if (!timeRegex.test(dayAvailability.end)) {
              throw new ValidationError(`Invalid end time format for ${day}`);
            }
            
            // Check if start time is before end time
            const [startHour, startMin] = dayAvailability.start.split(':').map(Number);
            const [endHour, endMin] = dayAvailability.end.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            if (startMinutes >= endMinutes) {
              throw new ValidationError(`Start time must be before end time for ${day}`);
            }
          }
        }
      }

      const updatedResource = await ResourceModel.findOneAndUpdate(
        { resourceId },
        {
          availability: availability,
          dateModified: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!updatedResource) {
        throw new NotFoundError('Resource', resourceId.toString());
      }

      logger.info(`Resource availability updated: ${resourceId}`);
      return updatedResource;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in updateResourceAvailability:', error);
      throw new DatabaseError('Failed to update resource availability', error as Error);
    }
  }

  /**
   * Get resource availability for a specific date range
   */
  static async getResourceAvailability(resourceId: number, startDate: Date, endDate: Date) {
    try {
      const resource = await this.getResourceById(resourceId);

      // Get existing appointments in the date range
      const appointments = await AppointmentModel.find({
        resourceId: resourceId,
        startDate: { $gte: startDate, $lte: endDate },
        isActive: true
      }).sort({ startDate: 1 });

      // Generate availability slots for each day
      const availabilitySlots = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dayAvailability = resource.getAvailabilityForDay(dayOfWeek);

        if (dayAvailability && dayAvailability.available) {
          // Get appointments for this specific day
          const dayStart = new Date(currentDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(currentDate);
          dayEnd.setHours(23, 59, 59, 999);

          const dayAppointments = appointments.filter(apt => 
            apt.startDate >= dayStart && apt.startDate <= dayEnd
          );

          availabilitySlots.push({
            date: currentDate.toISOString().split('T')[0],
            dayOfWeek: dayOfWeek,
            availability: dayAvailability,
            appointments: dayAppointments.map(apt => ({
              id: apt._id,
              startDate: apt.startDate,
              endDate: apt.endDate,
              duration: apt.getDurationMinutes(),
              subject: apt.subject
            })),
            availableSlots: this.calculateAvailableSlots(dayAvailability, dayAppointments)
          });
        } else {
          availabilitySlots.push({
            date: currentDate.toISOString().split('T')[0],
            dayOfWeek: dayOfWeek,
            availability: null,
            appointments: [],
            availableSlots: []
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        resource: {
          id: resource.resourceId,
          name: resource.getFullName() || resource.resourceName,
          type: resource.type
        },
        dateRange: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        availabilitySlots
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getResourceAvailability:', error);
      throw new DatabaseError('Failed to retrieve resource availability', error as Error);
    }
  }

  /**
   * Get resource statistics
   */
  static async getResourceStats(resourceId: number, startDate?: Date, endDate?: Date) {
    try {
      const resource = await this.getResourceById(resourceId);

      const query: any = { resourceId, isActive: true };
      
      if (startDate && endDate) {
        query.startDate = { $gte: startDate, $lte: endDate };
      }

      const [
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        averageDuration,
        appointmentsByDay
      ] = await Promise.all([
        AppointmentModel.countDocuments(query),
        AppointmentModel.countDocuments({ ...query, status: 1 }),
        AppointmentModel.countDocuments({ ...query, status: 2 }),
        AppointmentModel.aggregate([
          { $match: query },
          { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ]),
        AppointmentModel.aggregate([
          { $match: query },
          { 
            $group: { 
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$startDate' } },
              count: { $sum: 1 }
            } 
          },
          { $sort: { _id: 1 } }
        ])
      ]);

      return {
        resource: {
          id: resource.resourceId,
          name: resource.getFullName() || resource.resourceName,
          type: resource.type
        },
        dateRange: {
          startDate: startDate?.toISOString().split('T')[0],
          endDate: endDate?.toISOString().split('T')[0]
        },
        statistics: {
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          pendingAppointments: totalAppointments - completedAppointments - cancelledAppointments,
          averageDuration: averageDuration[0]?.avgDuration || 0,
          completionRate: totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0,
          cancellationRate: totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0,
          appointmentsByDay: appointmentsByDay.map(item => ({
            date: item._id,
            count: item.count
          }))
        }
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getResourceStats:', error);
      throw new DatabaseError('Failed to retrieve resource statistics', error as Error);
    }
  }

  /**
   * Calculate available time slots (private helper)
   */
  private static calculateAvailableSlots(dayAvailability: any, appointments: any[]): any[] {
    const slots = [];
    const slotDuration = 30; // 30-minute slots
    
    const [startHour, startMin] = dayAvailability.start.split(':').map(Number);
    const [endHour, endMin] = dayAvailability.end.split(':').map(Number);
    
    let currentTime = startHour * 60 + startMin; // Convert to minutes
    const endTime = endHour * 60 + endMin;
    
    while (currentTime + slotDuration <= endTime) {
      const slotStart = currentTime;
      const slotEnd = currentTime + slotDuration;
      
      // Check if this slot conflicts with any appointment
      const hasConflict = appointments.some(apt => {
        const aptStart = apt.startDate.getHours() * 60 + apt.startDate.getMinutes();
        const aptEnd = apt.endDate.getHours() * 60 + apt.endDate.getMinutes();
        
        return (slotStart < aptEnd && slotEnd > aptStart);
      });
      
      if (!hasConflict) {
        const startHours = Math.floor(slotStart / 60);
        const startMinutes = slotStart % 60;
        const endHours = Math.floor(slotEnd / 60);
        const endMinutes = slotEnd % 60;
        
        slots.push({
          startTime: `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`,
          endTime: `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`,
          duration: slotDuration,
          available: true
        });
      }
      
      currentTime += slotDuration;
    }
    
    return slots;
  }
}
