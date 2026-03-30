import mongoose, { PipelineStage } from 'mongoose';
import { AppointmentModel, IAppointment } from '@/models/Appointment';
import { ResourceModel } from '@/models/Resource';
import { ClientModel } from '@/models/Client';
import { ClinicModel } from '@/models/Clinic';
import ReferringDoctor from '@/models/ReferringDoctor';
import { NotFoundError, ValidationError, DatabaseError, ConflictError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class AppointmentService {
  private static readonly WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long' });

  private static escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static toMinutes(time: string): number {
    const [hoursPart, minutesPart] = time.split(':');
    if (hoursPart === undefined || minutesPart === undefined) {
      return NaN;
    }

    const hours = Number(hoursPart);
    const minutes = Number(minutesPart);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return NaN;
    }

    return hours * 60 + minutes;
  }

  private static toHHMM(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private static validateResourceOperationalTiming(resource: any, startDate: Date, endDate: Date): void {
    const dayOfWeek = AppointmentService.WEEKDAY_FORMATTER.format(startDate).toLowerCase();
    const availabilityInfo = resource.getAvailabilityForDay(dayOfWeek);

    if (!availabilityInfo || !availabilityInfo.available) {
      throw new ValidationError(
        `Resource "${resource.resourceName}" is not available on ${dayOfWeek}`
      );
    }

    const slotStartMinutes = this.toMinutes(this.toHHMM(startDate));
    const slotEndMinutes = this.toMinutes(this.toHHMM(endDate));
    const availableStartMinutes = this.toMinutes(availabilityInfo.start);
    const availableEndMinutes = this.toMinutes(availabilityInfo.end);

    if (
      Number.isNaN(slotStartMinutes) ||
      Number.isNaN(slotEndMinutes) ||
      Number.isNaN(availableStartMinutes) ||
      Number.isNaN(availableEndMinutes)
    ) {
      throw new ValidationError(`Resource "${resource.resourceName}" has invalid availability configuration`);
    }

    if (slotStartMinutes < availableStartMinutes || slotEndMinutes > availableEndMinutes) {
      throw new ValidationError(
        `Appointment time (${this.toHHMM(startDate)}-${this.toHHMM(endDate)}) falls outside resource "${resource.resourceName}" operating hours (${availabilityInfo.start}-${availabilityInfo.end})`
      );
    }
  }

  /**
   * Map clinic names between collections due to data inconsistency
   * clinics collection uses different naming than appointments collection
   */
  private static getAppointmentClinicName(clinicName: string): string {
    return clinicName;
  }

  private static normalizeOptionalResourceId(resourceId: unknown): number | null {
    if (resourceId === undefined || resourceId === null || resourceId === '') {
      return null;
    }

    const normalizedResourceId = Number(resourceId);
    if (!Number.isInteger(normalizedResourceId) || normalizedResourceId <= 0) {
      return null;
    }

    return normalizedResourceId;
  }

  private static hasValidResourceId(resourceId: unknown): resourceId is number {
    return this.normalizeOptionalResourceId(resourceId) !== null;
  }

  private static async resolveReferringDoctor(
    referringDoctorId: unknown,
    clinicName?: string
  ): Promise<{ referringDoctorId?: string; referringDoctorName?: string }> {
    if (referringDoctorId === undefined || referringDoctorId === null || referringDoctorId === '') {
      return {};
    }

    const normalizedDoctorId = String(referringDoctorId).trim();
    if (!mongoose.Types.ObjectId.isValid(normalizedDoctorId)) {
      throw new ValidationError('Referring doctor ID must be a valid identifier');
    }

    const filter: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(normalizedDoctorId),
      isActive: true
    };

    if (clinicName) {
      const escapedClinicName = this.escapeRegex(clinicName);
      filter.$or = [
        { clinicName: new RegExp(`^${escapedClinicName}$`, 'i') },
        { clinicName: { $exists: false } },
        { clinicName: '' }
      ];
    }

    const doctor = await ReferringDoctor.findOne(filter).lean();
    if (!doctor) {
      throw new NotFoundError('Referring doctor', normalizedDoctorId);
    }

    return {
      referringDoctorId: normalizedDoctorId,
      referringDoctorName: doctor.fullName || `${doctor.firstName} ${doctor.lastName}`.trim()
    };
  }

  private static buildAppointmentUpdateDocument(
    updateData: Record<string, unknown>,
    options: {
      clearReferringDoctor?: boolean;
      clearResource?: boolean;
      resolvedReferringDoctor?: { referringDoctorId?: string; referringDoctorName?: string };
    } = {}
  ) {
    const {
      clearReferringDoctor = false,
      clearResource = false,
      resolvedReferringDoctor = {}
    } = options;

    const setData: Record<string, unknown> = {
      ...updateData,
      ...resolvedReferringDoctor,
      dateModified: new Date()
    };

    if (clearResource) {
      delete setData.resourceId;
    }

    if (clearReferringDoctor) {
      delete setData.referringDoctorId;
      delete setData.referringDoctorName;
    }

    Object.keys(setData).forEach((key) => {
      if (setData[key] === undefined) {
        delete setData[key];
      }
    });

    const updateDocument: {
      $set: Record<string, unknown>;
      $unset?: Record<string, ''>;
    } = {
      $set: setData
    };

    const unsetData: Record<string, ''> = {};
    if (clearResource) {
      unsetData.resourceId = '';
    }
    if (clearReferringDoctor) {
      unsetData.referringDoctorId = '';
      unsetData.referringDoctorName = '';
    }

    if (Object.keys(unsetData).length > 0) {
      updateDocument.$unset = unsetData;
    }

    return updateDocument;
  }

  /**
   * Aggregation stages to join client data from the clients collection.
   * Handles the type mismatch: appointments.clientId (Number|String) vs clients.clientId (String).
   */
  private static getClientLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'clients',
          let: {
            appointmentClientId: '$clientId',
            appointmentClientKey: '$clientKey'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $ne: ['$$appointmentClientId', null] },
                        { $eq: ['$clientId', { $toString: '$$appointmentClientId' }] }
                      ]
                    },
                    {
                      $and: [
                        { $ne: ['$$appointmentClientId', null] },
                        { $ne: ['$clientKey', null] },
                        { $eq: [{ $toString: '$clientKey' }, { $toString: '$$appointmentClientId' }] }
                      ]
                    },
                    {
                      $and: [
                        { $ne: ['$$appointmentClientKey', null] },
                        { $ne: ['$clientKey', null] },
                        { $eq: ['$clientKey', '$$appointmentClientKey'] }
                      ]
                    }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: 'clientDetails'
        }
      },
      { $unwind: { path: '$clientDetails', preserveNullAndEmptyArrays: true } }
    ];
  }

  /**
   * Aggregation stages to join resource data from the resources collection.
   */
  private static getResourceLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'resources',
          localField: 'resourceId',
          foreignField: 'resourceId',
          as: 'resourceDetails'
        }
      },
      { $unwind: { path: '$resourceDetails', preserveNullAndEmptyArrays: true } }
    ];
  }

  private static getReferringDoctorLookupStages(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'referringdoctors',
          let: {
            appointmentReferringDoctorId: '$referringDoctorId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$appointmentReferringDoctorId', null] },
                    { $eq: [{ $toString: '$_id' }, '$$appointmentReferringDoctorId'] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: 'referringDoctorDetails'
        }
      },
      { $unwind: { path: '$referringDoctorDetails', preserveNullAndEmptyArrays: true } }
    ];
  }

  /**
   * Derive resourceName from a plain resource object (mirrors Resource.getFullName()).
   */
  private static deriveResourceName(resource: any): string {
    if (!resource) {
      return '';
    }

    if (resource.type === 'practitioner' && resource.practitioner) {
      const { firstName, lastName } = resource.practitioner;
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      }
      if (firstName || lastName) {
        return firstName || lastName;
      }
    }
    return resource.resourceName || 'Unknown Resource';
  }

  private static deriveReferringDoctorName(appointment: any): string | undefined {
    return appointment?.referringDoctorDetails?.fullName
      || appointment?.referringDoctorName
      || undefined;
  }
  /**
   * Get appointments by clinic with filtering, pagination, and client/resource lookups.
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

      const clinic = await ClinicModel.findOne({ 
        name: new RegExp(`^${clinicName}$`, 'i') 
      });
      if (!clinic) {
        throw new NotFoundError('Clinic', clinicName);
      }

      const appointmentClinicName = AppointmentService.getAppointmentClinicName(clinicName);

      const matchStage: any = {
        clinicName: { $regex: new RegExp(`^${appointmentClinicName}$`, 'i') },
        isActive: true
      };

      if (startDate && endDate) {
        matchStage.startDate = { $gte: startDate, $lte: endDate };
      } else if (startDate) {
        matchStage.startDate = { $gte: startDate };
      } else if (endDate) {
        matchStage.startDate = { $lte: endDate };
      }

      if (status !== undefined) {
        matchStage.status = status;
      }
      if (resourceId) {
        matchStage.resourceId = resourceId;
      }
      if (clientId) {
        const normalizedClientId = String(clientId).trim();
        const numericClientId = Number(normalizedClientId);
        const clientIdFilters: any[] = [{ clientId: normalizedClientId }];

        if (!Number.isNaN(numericClientId)) {
          clientIdFilters.push({ clientId: numericClientId });
          clientIdFilters.push({ clientKey: numericClientId });
        }

        matchStage.$or = clientIdFilters;
      }

      const skip = (page - 1) * limit;

      const [countResult, appointments] = await Promise.all([
        AppointmentModel.countDocuments(matchStage),
        AppointmentModel.aggregate([
          { $match: matchStage },
          { $sort: { startDate: 1 } },
          { $skip: skip },
          { $limit: limit },
          ...this.getClientLookupStages(),
          ...this.getResourceLookupStages(),
          ...this.getReferringDoctorLookupStages()
        ])
      ]);

      const total = countResult;

      const enriched = appointments.map((apt: any) => ({
        ...apt,
        resourceName: this.deriveResourceName(apt.resourceDetails),
        referringDoctorName: this.deriveReferringDoctorName(apt)
      }));

      return { appointments: enriched, page, limit, total };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getAppointmentsByClinic:', error);
      throw new DatabaseError('Failed to retrieve appointments', error as Error);
    }
  }

  /**
   * Get appointment by MongoDB ObjectId with client and resource details.
   */
  static async getAppointmentById(appointmentId: string): Promise<any> {
    try {
      const results = await AppointmentModel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(appointmentId) } },
        ...this.getClientLookupStages(),
        ...this.getResourceLookupStages(),
        ...this.getReferringDoctorLookupStages()
      ]);

      if (!results || results.length === 0) {
        throw new NotFoundError('Appointment', appointmentId);
      }

      const appointment = results[0];
      appointment.resourceName = this.deriveResourceName(appointment.resourceDetails);
      appointment.referringDoctorName = this.deriveReferringDoctorName(appointment);

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
   * Get appointment by business appointmentId with client and resource details.
   */
  static async getAppointmentByBusinessId(appointmentId: number): Promise<any> {
    try {
      const results = await AppointmentModel.aggregate([
        {
          $match: {
            $or: [
              { id: appointmentId },
              { appointmentId: appointmentId }
            ]
          }
        },
        ...this.getClientLookupStages(),
        ...this.getResourceLookupStages(),
        ...this.getReferringDoctorLookupStages()
      ]);

      if (!results || results.length === 0) {
        throw new NotFoundError('Appointment', appointmentId.toString());
      }

      const appointment = results[0];
      appointment.resourceName = this.deriveResourceName(appointment.resourceDetails);
      appointment.referringDoctorName = this.deriveReferringDoctorName(appointment);

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
      const hasIncomingResourceId = Object.prototype.hasOwnProperty.call(updateData, 'resourceId');
      const shouldClearResource = hasIncomingResourceId && (updateData.resourceId === null || updateData.resourceId === '');
      const hasIncomingReferringDoctorId = Object.prototype.hasOwnProperty.call(updateData, 'referringDoctorId');
      const shouldClearReferringDoctor = hasIncomingReferringDoctorId
        && (updateData.referringDoctorId === null || updateData.referringDoctorId === '');
      const resourceId = shouldClearResource
        ? null
        : this.normalizeOptionalResourceId(
          hasIncomingResourceId ? updateData.resourceId : existingAppointment.resourceId
        );

      // If time or resource is being changed, check for conflicts
      if (updateData.startDate || updateData.endDate || hasIncomingResourceId) {
        const startDate = updateData.startDate ? new Date(updateData.startDate) : new Date(existingAppointment.startDate);
        const endDate = updateData.endDate ? new Date(updateData.endDate) : new Date(existingAppointment.endDate);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
          throw new ValidationError('Invalid appointment start/end date');
        }
        if (endDate <= startDate) {
          throw new ValidationError('End date must be after start date');
        }
        if (!shouldClearResource && hasIncomingResourceId && resourceId === null) {
          throw new ValidationError('Resource ID must be a positive integer');
        }

        if (resourceId !== null) {
          const resource = await ResourceModel.findOne({ resourceId });
          if (!resource) {
            throw new NotFoundError('Resource', resourceId.toString());
          }

          const conflicts = await AppointmentModel.checkTimeSlotConflict(
            resourceId,
            startDate,
            endDate,
            String(existingAppointment._id)
          );

          if (conflicts.length > 0) {
            throw new ConflictError('Time slot conflict: Resource is already booked during this time');
          }

          this.validateResourceOperationalTiming(resource, startDate, endDate);
        }
      }

      const resolvedReferringDoctor = hasIncomingReferringDoctorId && !shouldClearReferringDoctor
        ? await this.resolveReferringDoctor(
          updateData.referringDoctorId,
          String(updateData.clinicName || existingAppointment.clinicName || '')
        )
        : {};

      const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
        existingAppointment._id,
        this.buildAppointmentUpdateDocument(updateData, {
          clearReferringDoctor: shouldClearReferringDoctor,
          clearResource: shouldClearResource,
          resolvedReferringDoctor
        }),
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

      const normalizedAppointmentClientId = typeof client.clientKey === 'number'
        ? client.clientKey
        : numericClientId;
      const normalizedAppointmentClientKey = typeof client.clientKey === 'number'
        ? client.clientKey
        : (!Number.isNaN(numericClientId) ? numericClientId : undefined);
      const normalizedResourceId = Number(appointmentData.resourceId);
      const appointmentStartDate = new Date(appointmentData.startDate);
      const appointmentEndDate = new Date(appointmentData.endDate);

      if (Number.isNaN(normalizedResourceId) || normalizedResourceId <= 0) {
        throw new ValidationError('Resource ID must be a positive integer');
      }
      if (Number.isNaN(appointmentStartDate.getTime()) || Number.isNaN(appointmentEndDate.getTime())) {
        throw new ValidationError('Invalid appointment start/end date');
      }
      if (appointmentEndDate <= appointmentStartDate) {
        throw new ValidationError('End date must be after start date');
      }

      // Verify resource exists
      const resource = await ResourceModel.findOne({ resourceId: normalizedResourceId });
      if (!resource) {
        throw new NotFoundError('Resource', normalizedResourceId.toString());
      }

      // Verify clinic exists - use case-insensitive search due to naming inconsistencies
      const clinic = await ClinicModel.findOne({ 
        name: new RegExp(`^${appointmentData.clinicName}$`, 'i') 
      });
      if (!clinic) {
        throw new NotFoundError('Clinic', appointmentData.clinicName);
      }

      const resolvedReferringDoctor = await this.resolveReferringDoctor(
        appointmentData.referringDoctorId,
        appointmentData.clinicName
      );

      // Check for time slot conflicts
      const conflicts = await AppointmentModel.checkTimeSlotConflict(
        normalizedResourceId,
        appointmentStartDate,
        appointmentEndDate
      );

      if (conflicts.length > 0) {
        throw new ConflictError('Time slot conflict: Resource is already booked during this time');
      }

      // Validate clinic operational timing against resource availability window
      this.validateResourceOperationalTiming(resource, appointmentStartDate, appointmentEndDate);

      // Create appointment
      const appointment = new AppointmentModel({
        ...appointmentData,
        resourceId: normalizedResourceId,
        ...resolvedReferringDoctor,
        clientId: normalizedAppointmentClientId,
        clientKey: normalizedAppointmentClientKey,
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
      await AppointmentService.updateResourceStats(normalizedResourceId);

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
      const hasIncomingResourceId = Object.prototype.hasOwnProperty.call(updateData, 'resourceId');
      const shouldClearResource = hasIncomingResourceId && (updateData.resourceId === null || updateData.resourceId === '');
      const hasIncomingReferringDoctorId = Object.prototype.hasOwnProperty.call(updateData, 'referringDoctorId');
      const shouldClearReferringDoctor = hasIncomingReferringDoctorId
        && (updateData.referringDoctorId === null || updateData.referringDoctorId === '');
      const resourceId = shouldClearResource
        ? null
        : this.normalizeOptionalResourceId(
          hasIncomingResourceId ? updateData.resourceId : existingAppointment.resourceId
        );

      // If time or resource is being changed, check for conflicts
      if (updateData.startDate || updateData.endDate || hasIncomingResourceId) {
        const startDate = updateData.startDate ? new Date(updateData.startDate) : new Date(existingAppointment.startDate);
        const endDate = updateData.endDate ? new Date(updateData.endDate) : new Date(existingAppointment.endDate);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
          throw new ValidationError('Invalid appointment start/end date');
        }
        if (endDate <= startDate) {
          throw new ValidationError('End date must be after start date');
        }
        if (!shouldClearResource && hasIncomingResourceId && resourceId === null) {
          throw new ValidationError('Resource ID must be a positive integer');
        }

        if (resourceId !== null) {
          const resource = await ResourceModel.findOne({ resourceId });
          if (!resource) {
            throw new NotFoundError('Resource', resourceId.toString());
          }

          const conflicts = await AppointmentModel.checkTimeSlotConflict(
            resourceId,
            startDate,
            endDate,
            appointmentId
          );

          if (conflicts.length > 0) {
            throw new ConflictError('Time slot conflict: Resource is already booked during this time');
          }

          this.validateResourceOperationalTiming(resource, startDate, endDate);
        }
      }

      const resolvedReferringDoctor = hasIncomingReferringDoctorId && !shouldClearReferringDoctor
        ? await this.resolveReferringDoctor(
          updateData.referringDoctorId,
          String(updateData.clinicName || existingAppointment.clinicName || '')
        )
        : {};

      const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
        appointmentId,
        this.buildAppointmentUpdateDocument(updateData, {
          clearReferringDoctor: shouldClearReferringDoctor,
          clearResource: shouldClearResource,
          resolvedReferringDoctor
        }),
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
   * Get appointments ready for billing with client details via aggregation.
   */
  static async getAppointmentsReadyToBill(clinicName?: string) {
    try {
      const matchStage: any = {
        readyToBill: true,
        invoiceDate: { $exists: false },
        isActive: true
      };

      if (clinicName) {
        const escapedClinicName = clinicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matchStage.clinicName = new RegExp(`^${escapedClinicName}$`, 'i');
      }

      const appointments = await AppointmentModel.aggregate([
        { $match: matchStage },
        { $sort: { billDate: 1 } },
        ...this.getClientLookupStages(),
        ...this.getResourceLookupStages(),
        ...this.getReferringDoctorLookupStages()
      ]);

      return appointments.map((apt: any) => ({
        ...apt,
        resourceName: this.deriveResourceName(apt.resourceDetails),
        referringDoctorName: this.deriveReferringDoctorName(apt)
      }));
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
   * Get client appointment history with resource details via aggregation.
   */
  static async getClientAppointmentHistory(clientId: string) {
    try {
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

      const clientMatchFilters: Array<Record<string, string | number>> = [];
      const clientIdStrings = new Set<string>();
      const clientIdNumbers = new Set<number>();

      clientIdStrings.add(client.clientId);

      const numericRequestedClientId = Number(clientId);
      if (!Number.isNaN(numericRequestedClientId)) {
        clientIdNumbers.add(numericRequestedClientId);
      }

      const numericClientIdFromClientRecord = Number(client.clientId);
      if (!Number.isNaN(numericClientIdFromClientRecord)) {
        clientIdNumbers.add(numericClientIdFromClientRecord);
      }

      if (typeof client.clientKey === 'number' && !Number.isNaN(client.clientKey)) {
        clientIdNumbers.add(client.clientKey);
        clientIdStrings.add(String(client.clientKey));
      }

      for (const idString of clientIdStrings) {
        clientMatchFilters.push({ clientId: idString });
      }

      for (const idNumber of clientIdNumbers) {
        clientMatchFilters.push({ clientId: idNumber });
        clientMatchFilters.push({ clientKey: idNumber });
      }

      const appointments = await AppointmentModel.aggregate([
        {
          $match: {
            $or: clientMatchFilters,
            isActive: true
          }
        },
        { $sort: { startDate: -1 } },
        ...this.getResourceLookupStages(),
        ...this.getReferringDoctorLookupStages()
      ]);

      const enriched = appointments.map((apt: any) => ({
        ...apt,
        resourceName: this.deriveResourceName(apt.resourceDetails),
        referringDoctorName: this.deriveReferringDoctorName(apt)
      }));

      return {
        client: {
          id: client.clientId,
          name: client.getFullName(),
          defaultClinic: client.defaultClinic
        },
        appointments: enriched
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
      const query: any = { clinicName: new RegExp(`^${appointmentClinicName}$`, 'i'), isActive: true };
      
      if (startDate && endDate) {
        query.startDate = { $gte: startDate, $lte: endDate };
      }

      // Get current date for upcoming/overdue calculations
      const now = new Date();

      const [
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        readyToBillCount,
        upcomingCount,
        overdueCount,
        averageDuration
      ] = await Promise.all([
        AppointmentModel.countDocuments(query),
        AppointmentModel.countDocuments({ ...query, status: 1 }),
        AppointmentModel.countDocuments({ ...query, status: 2 }),
        AppointmentModel.countDocuments({ ...query, readyToBill: true, invoiceDate: { $exists: false } }),
        // Upcoming: scheduled appointments (status 0) that are in the future
        AppointmentModel.countDocuments({ ...query, status: 0, startDate: { $gt: now } }),
        // Overdue: scheduled appointments (status 0) that are in the past
        AppointmentModel.countDocuments({ ...query, status: 0, startDate: { $lt: now } }),
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
          upcomingCount,
          overdueCount,
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
      if (!this.hasValidResourceId(resourceId)) {
        return;
      }

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
