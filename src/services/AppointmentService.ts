import { AppointmentModel, IAppointment } from '@/models/Appointment';
import { ResourceModel } from '@/models/Resource';
import { ClientModel } from '@/models/Client';
import { ClinicModel } from '@/models/Clinic';
import { NotFoundError, ValidationError, DatabaseError, ConflictError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class AppointmentService {
  
  /**
   * Map clinic names between collections due to data inconsistency
   * clinics collection uses different naming than appointments collection
   */
  private static getAppointmentClinicName(clinicName: string): string {
    // Since appointments are stored with both "bodyblissphysio" and "BodyBlissPhysio"
    // we need to query for both formats using case-insensitive regex
    return clinicName; // Return as-is, we'll handle case-insensitive search in query
  }
  /**
   * Get appointments by clinic with filtering and pagination
   */
  static async getAppointmentsByClinic(params: {
    clinicName: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    status?: number;
    resourceId?: number;
    clientId?: string;
  }) {
    try {
      const {
        clinicName,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        status,
        resourceId,
        clientId
      } = params;

      // For debugging - log the input parameters
      logger.info('getAppointmentsByClinic called with:', {
        clinicName,
        startDate,
        endDate,
        page,
        limit,
        status,
        resourceId,
        clientId
      });

      // Verify clinic exists - use case-insensitive search due to naming inconsistencies
      const clinic = await ClinicModel.findOne({ 
        name: new RegExp(`^${clinicName}$`, 'i') 
      });
      if (!clinic) {
        throw new NotFoundError('Clinic', clinicName);
      }

      logger.info('Clinic found:', { name: clinic.clinicName, displayName: clinic.getDisplayName() });

      // Map to appointment collection clinic name due to data inconsistency
      const appointmentClinicName = AppointmentService.getAppointmentClinicName(clinicName);
      logger.info('Mapped clinic name:', { original: clinicName, mapped: appointmentClinicName });

      // Build query using case-insensitive regex to handle inconsistent naming
      const query: any = {
        clinicName: new RegExp(`^${appointmentClinicName}$`, 'i'), // Case-insensitive exact match
        isActive: true
      };

      // Date range filter
      if (startDate && endDate) {
        query.startDate = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        query.startDate = { $gte: startDate };
      } else if (endDate) {
        query.startDate = { $lte: endDate };
      }

      // Additional filters
      if (status !== undefined) {
        query.status = status;
      }

      if (resourceId) {
        query.resourceId = resourceId;
      }

      if (clientId) {
        query.clientId = clientId;
      }

      logger.info('MongoDB query:', query);

      // Execute query with pagination - ultra-simplified for debugging
      const skip = (page - 1) * limit;
      
      // Test count first
      const total = await AppointmentModel.countDocuments(query);
      logger.info('Count result:', total);
      
      // Test find - Remove .lean() to preserve Mongoose methods for view layer
      const appointments = await AppointmentModel.find(query)
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit);
        
      logger.info('Found appointments:', appointments.length);

      return { appointments, page, limit, total };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Error in getAppointmentsByClinic:', error);
      throw new DatabaseError('Failed to retrieve appointments', error as Error);
    }
  }

  /**
   * Get appointment by ID
   */
  static async getAppointmentById(appointmentId: string): Promise<IAppointment> {
    try {
      const appointment = await AppointmentModel.findById(appointmentId);
      
      if (!appointment) {
        throw new NotFoundError('Appointment', appointmentId);
      }

      // Populate resource information manually (populate was causing issues)
      const resource = await ResourceModel.findOne({ resourceId: appointment.resourceId });
      if (resource) {
        (appointment as any).resourceName = resource.getFullName() || resource.resourceName;
      }

      return appointment;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getAppointmentById:', error);
      throw new DatabaseError('Failed to retrieve appointment', error as Error);
    }
  }

  /**
   * Get appointment by business appointmentId
   */
  static async getAppointmentByBusinessId(appointmentId: number): Promise<IAppointment> {
    try {
      // Query by either id or appointmentId field
      const appointment = await AppointmentModel.findOne({ 
        $or: [
          { id: appointmentId },
          { appointmentId: appointmentId }
        ]
      });
      
      if (!appointment) {
        throw new NotFoundError('Appointment', appointmentId.toString());
      }

      // Try to get resource information (optional - won't fail if resource not found)
      try {
        const resource = await ResourceModel.findOne({ resourceId: appointment.resourceId });
        if (resource) {
          (appointment as any).resourceName = resource.getFullName() || resource.resourceName;
        }
      } catch (resourceError) {
        logger.warn('Could not populate resource information:', resourceError);
        // Continue without resource information
      }

      return appointment;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getAppointmentByBusinessId:', error);
      throw new DatabaseError('Failed to retrieve appointment by business ID', error as Error);
    }
  }

  /**
   * Update appointment by business appointmentId
   */
  static async updateAppointmentByBusinessId(appointmentId: number, updateData: any): Promise<IAppointment> {
    try {
      // Find appointment by business ID
      const existingAppointment = await this.getAppointmentByBusinessId(appointmentId);

      // If time or resource is being changed, check for conflicts
      if (updateData.startDate || updateData.endDate || updateData.resourceId) {
        const startDate = updateData.startDate ? new Date(updateData.startDate) : existingAppointment.startDate;
        const endDate = updateData.endDate ? new Date(updateData.endDate) : existingAppointment.endDate;
        const resourceId = updateData.resourceId || existingAppointment.resourceId;

        const conflicts = await AppointmentModel.checkTimeSlotConflict(
          resourceId,
          startDate,
          endDate,
          String(existingAppointment._id)
        );

        if (conflicts.length > 0) {
          throw new ConflictError('Time slot conflict: Resource is already booked during this time');
        }
      }

      const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
        existingAppointment._id,
        {
          ...updateData,
          dateModified: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!updatedAppointment) {
        throw new NotFoundError('Appointment', appointmentId.toString());
      }

      logger.info(`Appointment updated by business ID: ${appointmentId}`);
      return updatedAppointment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      logger.error('Error in updateAppointmentByBusinessId:', error);
      throw new DatabaseError('Failed to update appointment by business ID', error as Error);
    }
  }

  /**
   * Create new appointment with conflict checking
   */
  static async createAppointment(appointmentData: any): Promise<IAppointment> {
    try {
      // Validate required fields
      if (!appointmentData.startDate || !appointmentData.endDate) {
        throw new ValidationError('Start date and end date are required');
      }

      if (!appointmentData.clientId) {
        throw new ValidationError('Client ID is required');
      }

      if (!appointmentData.resourceId) {
        throw new ValidationError('Resource ID is required');
      }

      if (!appointmentData.clinicName) {
        throw new ValidationError('Clinic name is required');
      }

      // Verify client exists
      const numericClientId = Number(appointmentData.clientId);
      const client = await ClientModel.findOne({
        $or: [
          { clientId: numericClientId },
          { clientId: appointmentData.clientId },
          { clientKey: numericClientId }
        ]
      });
      if (!client) {
        throw new NotFoundError('Client', appointmentData.clientId);
      }

      // Verify resource exists
      const resource = await ResourceModel.findOne({ resourceId: appointmentData.resourceId });
      if (!resource) {
        throw new NotFoundError('Resource', appointmentData.resourceId.toString());
      }

      // Verify clinic exists - use case-insensitive search due to naming inconsistencies
      const clinic = await ClinicModel.findOne({ 
        name: new RegExp(`^${appointmentData.clinicName}$`, 'i') 
      });
      if (!clinic) {
        throw new NotFoundError('Clinic', appointmentData.clinicName);
      }

      // Check for time slot conflicts
      const conflicts = await AppointmentModel.checkTimeSlotConflict(
        appointmentData.resourceId,
        new Date(appointmentData.startDate),
        new Date(appointmentData.endDate)
      );

      if (conflicts.length > 0) {
        throw new ConflictError('Time slot conflict: Resource is already booked during this time');
      }

      // Check resource availability for the day
      const appointmentDate = new Date(appointmentData.startDate);
      const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      if (!resource.isAvailableOnDay(dayOfWeek)) {
        const availabilityInfo = resource.getAvailabilityForDay(dayOfWeek);
        const errorMessage = `Resource "${resource.resourceName}" is not available on ${dayOfWeek}${availabilityInfo ? ` (availability: ${availabilityInfo.available ? 'available' : 'not available'} ${availabilityInfo.start}-${availabilityInfo.end})` : ''}`;
        throw new ValidationError(errorMessage);
      }

      // Create appointment
      const appointment = new AppointmentModel({
        ...appointmentData,
        subject: appointmentData.subject || client.getFullName(),
        type: appointmentData.type || 0,
        status: appointmentData.status || 0,
        label: appointmentData.label || 0,
        readyToBill: appointmentData.readyToBill || false,
        advancedBilling: appointmentData.advancedBilling || false,
        isActive: true
      });

      const savedAppointment = await appointment.save();

      // Update resource statistics
      await AppointmentService.updateResourceStats(appointmentData.resourceId);

      logger.info(`Appointment created: ${savedAppointment._id} for client ${client.getFullName()}`);

      return savedAppointment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      logger.error('Error in createAppointment:', error);
      throw new DatabaseError('Failed to create appointment', error as Error);
    }
  }

  /**
   * Update appointment
   */
  static async updateAppointment(appointmentId: string, updateData: any): Promise<IAppointment> {
    try {
      // Check if appointment exists
      const existingAppointment = await this.getAppointmentById(appointmentId);

      // If time or resource is being changed, check for conflicts
      if (updateData.startDate || updateData.endDate || updateData.resourceId) {
        const startDate = updateData.startDate ? new Date(updateData.startDate) : existingAppointment.startDate;
        const endDate = updateData.endDate ? new Date(updateData.endDate) : existingAppointment.endDate;
        const resourceId = updateData.resourceId || existingAppointment.resourceId;

        const conflicts = await AppointmentModel.checkTimeSlotConflict(
          resourceId,
          startDate,
          endDate,
          appointmentId
        );

        if (conflicts.length > 0) {
          throw new ConflictError('Time slot conflict: Resource is already booked during this time');
        }
      }

      const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
        appointmentId,
        {
          ...updateData,
          dateModified: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!updatedAppointment) {
        throw new NotFoundError('Appointment', appointmentId);
      }

      logger.info(`Appointment updated: ${appointmentId}`);
      return updatedAppointment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      logger.error('Error in updateAppointment:', error);
      throw new DatabaseError('Failed to update appointment', error as Error);
    }
  }

  /**
   * Cancel appointment by MongoDB ObjectId (soft delete)
   */
  static async cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
    try {
      const appointment = await this.getAppointmentById(appointmentId);
      
      await AppointmentModel.findByIdAndUpdate(
        appointmentId,
        { 
          isActive: false,
          status: 2, // Cancelled status
          description: reason ? `Cancelled: ${reason}` : 'Cancelled',
          dateModified: new Date()
        }
      );

      // Update resource statistics
      await AppointmentService.updateResourceStats(appointment.resourceId);

      logger.info(`Appointment cancelled: ${appointmentId}${reason ? ` - ${reason}` : ''}`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in cancelAppointment:', error);
      throw new DatabaseError('Failed to cancel appointment', error as Error);
    }
  }

  /**
   * Cancel appointment by business appointmentId (soft delete)
   */
  static async cancelAppointmentByBusinessId(appointmentId: number, reason?: string): Promise<void> {
    try {
      const appointment = await this.getAppointmentByBusinessId(appointmentId);
      
      await AppointmentModel.findByIdAndUpdate(
        appointment._id,
        { 
          isActive: false,
          status: 2, // Cancelled status
          description: reason ? `Cancelled: ${reason}` : 'Cancelled',
          dateModified: new Date()
        }
      );

      // Update resource statistics
      await AppointmentService.updateResourceStats(appointment.resourceId);

      logger.info(`Appointment cancelled by business ID: ${appointmentId}${reason ? ` - ${reason}` : ''}`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in cancelAppointmentByBusinessId:', error);
      throw new DatabaseError('Failed to cancel appointment by business ID', error as Error);
    }
  }

  /**
   * Complete appointment by MongoDB ObjectId and mark ready for billing
   */
  static async completeAppointment(appointmentId: string, notes?: string): Promise<IAppointment> {
    try {
      const appointment = await this.getAppointmentById(appointmentId);
      
      if (appointment.status === 1) {
        throw new ValidationError('Appointment is already completed');
      }

      const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
        appointmentId,
        { 
          status: 1, // Completed
          readyToBill: true,
          billDate: new Date(),
          description: notes ? `${appointment.description || ''}\nNotes: ${notes}` : appointment.description,
          dateModified: new Date()
        },
        { new: true }
      );

      if (!updatedAppointment) {
        throw new NotFoundError('Appointment', appointmentId);
      }

      // Update resource statistics
      await AppointmentService.updateResourceStats(appointment.resourceId);

      logger.info(`Appointment completed: ${appointmentId}`);
      return updatedAppointment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in completeAppointment:', error);
      throw new DatabaseError('Failed to complete appointment', error as Error);
    }
  }

  /**
   * Complete appointment by business appointmentId and mark ready for billing
   */
  static async completeAppointmentByBusinessId(appointmentId: number, notes?: string): Promise<IAppointment> {
    try {
      const appointment = await this.getAppointmentByBusinessId(appointmentId);
      
      if (appointment.status === 1) {
        throw new ValidationError('Appointment is already completed');
      }

      const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
        appointment._id,
        { 
          status: 1, // Completed
          readyToBill: true,
          billDate: new Date(),
          description: notes ? `${appointment.description || ''}\nNotes: ${notes}` : appointment.description,
          dateModified: new Date()
        },
        { new: true }
      );

      if (!updatedAppointment) {
        throw new NotFoundError('Appointment', appointmentId.toString());
      }

      // Update resource statistics
      await AppointmentService.updateResourceStats(appointment.resourceId);

      logger.info(`Appointment completed by business ID: ${appointmentId}`);
      return updatedAppointment;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in completeAppointmentByBusinessId:', error);
      throw new DatabaseError('Failed to complete appointment by business ID', error as Error);
    }
  }

  /**
   * Get appointments ready for billing
   */
  static async getAppointmentsReadyToBill(clinicName?: string) {
    try {
      const appointments = await AppointmentModel.findReadyToBill(clinicName);
      
      // Populate client information for billing
      const populatedAppointments = await AppointmentModel.populate(appointments, {
        path: 'clientId',
        select: 'personalInfo contact insurance defaultClinic',
        model: ClientModel
      });

      return populatedAppointments;
    } catch (error) {
      logger.error('Error in getAppointmentsReadyToBill:', error);
      throw new DatabaseError('Failed to retrieve appointments ready for billing', error as Error);
    }
  }

  /**
   * Get resource schedule for a specific date
   */
  static async getResourceSchedule(resourceId: number, date: Date) {
    try {
      // Verify resource exists
      const resource = await ResourceModel.findOne({ resourceId });
      if (!resource) {
        throw new NotFoundError('Resource', resourceId.toString());
      }

      // Get appointments for the date
      const appointments = await AppointmentModel.findByResource(resourceId, date);

      // Get resource availability for the day
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const availability = resource.getAvailabilityForDay(dayOfWeek);

      return {
        resource: {
          id: resource.resourceId,
          name: resource.getFullName() || resource.resourceName,
          type: resource.type
        },
        date: date.toISOString().split('T')[0],
        availability,
        appointments: appointments.map((apt: any) => ({
          id: apt._id,
          startDate: apt.startDate,
          endDate: apt.endDate,
          duration: apt.getDurationMinutes(),
          subject: apt.subject,
          status: apt.status,
          clientId: apt.clientId
        }))
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getResourceSchedule:', error);
      throw new DatabaseError('Failed to retrieve resource schedule', error as Error);
    }
  }

  /**
   * Get client appointment history
   */
  static async getClientAppointmentHistory(clientId: string) {
    try {
      // Verify client exists
      const numericClientId = Number(clientId);
      const client = await ClientModel.findOne({
        $or: [
          { clientId: numericClientId },
          { clientId: clientId },
          { clientKey: numericClientId }
        ]
      });
      if (!client) {
        throw new NotFoundError('Client', clientId);
      }

      // MongoDB stores clientId as string, so don't convert to Number
      const appointments = await AppointmentModel.findByClient(clientId);

      // Populate resource information
      const populatedAppointments = await Promise.all(
        appointments.map(async (apt: any) => {
          const resource = await ResourceModel.findOne({ resourceId: apt.resourceId });
          return {
            ...apt.toObject(),
            resourceName: resource?.getFullName() || resource?.resourceName || 'Unknown Resource'
          };
        })
      );

      return {
        client: {
          id: client.clientId,
          name: client.getFullName(),
          defaultClinic: client.defaultClinic
        },
        appointments: populatedAppointments
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClientAppointmentHistory:', error);
      throw new DatabaseError('Failed to retrieve client appointment history', error as Error);
    }
  }

  /**
   * Get clinic appointment statistics
   */
  static async getClinicAppointmentStats(clinicName: string, startDate?: Date, endDate?: Date) {
    try {
      // Verify clinic exists - use case-insensitive search due to naming inconsistencies
      const clinic = await ClinicModel.findOne({ 
        name: new RegExp(`^${clinicName}$`, 'i') 
      });
      if (!clinic) {
        throw new NotFoundError('Clinic', clinicName);
      }

      // Map to appointment collection clinic name due to data inconsistency
      const appointmentClinicName = AppointmentService.getAppointmentClinicName(clinicName);
      const query: any = { clinicName: appointmentClinicName, isActive: true };
      
      if (startDate && endDate) {
        query.startDate = { $gte: startDate, $lte: endDate };
      }

      const [
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        readyToBillCount,
        averageDuration
      ] = await Promise.all([
        AppointmentModel.countDocuments(query),
        AppointmentModel.countDocuments({ ...query, status: 1 }),
        AppointmentModel.countDocuments({ ...query, status: 2 }),
        AppointmentModel.countDocuments({ ...query, readyToBill: true, invoiceDate: { $exists: false } }),
        AppointmentModel.aggregate([
          { $match: query },
          { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ])
      ]);

      return {
        clinic: {
          name: clinic.clinicName,
          displayName: clinic.getDisplayName()
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
          readyToBillCount,
          averageDuration: averageDuration[0]?.avgDuration || 0,
          completionRate: totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0,
          cancellationRate: totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0
        }
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClinicAppointmentStats:', error);
      throw new DatabaseError('Failed to retrieve clinic appointment statistics', error as Error);
    }
  }

  /**
   * Update resource statistics (private helper)
   */
  private static async updateResourceStats(resourceId: number): Promise<void> {
    try {
      const [totalAppointments, avgDurationResult] = await Promise.all([
        AppointmentModel.countDocuments({ resourceId, isActive: true }),
        AppointmentModel.aggregate([
          { $match: { resourceId, isActive: true } },
          { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ])
      ]);

      const averageDuration = avgDurationResult[0]?.avgDuration || 30;

      await ResourceModel.findOneAndUpdate(
        { resourceId },
        {
          'stats.totalAppointments': totalAppointments,
          'stats.averageDuration': Math.round(averageDuration),
          'stats.lastActivity': new Date()
        }
      );
    } catch (error) {
      logger.error('Error updating resource stats:', error);
      // Don't throw error for this operation as it's not critical
    }
  }
}
