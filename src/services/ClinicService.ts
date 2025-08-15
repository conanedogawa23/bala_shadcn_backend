import { ClinicModel, IClinic } from '@/models/Clinic';
import { NotFoundError, ValidationError, DatabaseError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class ClinicService {
  /**
   * Get all clinics with pagination and filtering
   */
  static async getAllClinics(params: {
    page?: number;
    limit?: number;
    status?: string;
    city?: string;
    province?: string;
  }) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        city,
        province
      } = params;

      // Build query
      const query: any = {};
      
      if (status) {
        query.status = status;
      }
      
      if (city) {
        query['address.city'] = new RegExp(city, 'i');
      }
      
      if (province) {
        query['address.province'] = new RegExp(province, 'i');
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [clinics, total] = await Promise.all([
        ClinicModel.find(query)
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        ClinicModel.countDocuments(query)
      ]);

      return { clinics, page, limit, total };
    } catch (error) {
      logger.error('Error in getAllClinics:', error);
      throw new DatabaseError('Failed to retrieve clinics', error as Error);
    }
  }

  /**
   * Get clinic by ID
   */
  static async getClinicById(clinicId: number): Promise<IClinic> {
    try {
      const clinic = await ClinicModel.findOne({ clinicId });
      
      if (!clinic) {
        throw new NotFoundError('Clinic', clinicId.toString());
      }

      return clinic;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClinicById:', error);
      throw new DatabaseError('Failed to retrieve clinic', error as Error);
    }
  }

  /**
   * Get clinic by name
   */
  static async getClinicByName(name: string): Promise<IClinic> {
    try {
      const clinic = await ClinicModel.findOne({ 
        $or: [
          { name: name },
          { displayName: name }
        ]
      });
      
      if (!clinic) {
        throw new NotFoundError('Clinic', name);
      }

      return clinic;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClinicByName:', error);
      throw new DatabaseError('Failed to retrieve clinic by name', error as Error);
    }
  }

  /**
   * Create new clinic
   */
  static async createClinic(clinicData: any): Promise<IClinic> {
    try {
      // Validate required fields
      if (!clinicData.name) {
        throw new ValidationError('Clinic name is required');
      }

      if (!clinicData.clinicId) {
        throw new ValidationError('Clinic ID is required');
      }

      // Check for duplicates
      const existingById = await ClinicModel.findOne({ clinicId: clinicData.clinicId });
      if (existingById) {
        throw new ValidationError('Clinic with this ID already exists');
      }

      const existingByName = await ClinicModel.findOne({ name: clinicData.name });
      if (existingByName) {
        throw new ValidationError('Clinic with this name already exists');
      }

      // Set default values
      const clinic = new ClinicModel({
        ...clinicData,
        displayName: clinicData.displayName || clinicData.name,
        status: clinicData.status || 'active',
        clientCount: 0,
        stats: {
          totalOrders: 0,
          totalRevenue: 0
        }
      });

      const savedClinic = await clinic.save();
      logger.info(`Clinic created: ${savedClinic.name} (ID: ${savedClinic.clinicId})`);

      return savedClinic;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error in createClinic:', error);
      throw new DatabaseError('Failed to create clinic', error as Error);
    }
  }

  /**
   * Update clinic
   */
  static async updateClinic(clinicId: number, updateData: any): Promise<IClinic> {
    try {
      // Check if clinic exists
      const existingClinic = await this.getClinicById(clinicId);

      // If name is being updated, check for duplicates
      if (updateData.name && updateData.name !== existingClinic.name) {
        const duplicateClinic = await ClinicModel.findOne({ 
          name: updateData.name,
          clinicId: { $ne: clinicId } 
        });
        
        if (duplicateClinic) {
          throw new ValidationError('Clinic with this name already exists');
        }
      }

      const updatedClinic = await ClinicModel.findOneAndUpdate(
        { clinicId },
        { 
          ...updateData,
          dateModified: new Date()
        },
        { new: true, runValidators: true }
      );

      logger.info(`Clinic updated: ${updatedClinic!.name} (ID: ${clinicId})`);
      return updatedClinic!;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in updateClinic:', error);
      throw new DatabaseError('Failed to update clinic', error as Error);
    }
  }

  /**
   * Delete clinic (soft delete by setting status to inactive)
   */
  static async deleteClinic(clinicId: number): Promise<void> {
    try {
      const clinic = await this.getClinicById(clinicId);
      
      await ClinicModel.findOneAndUpdate(
        { clinicId },
        { 
          status: 'inactive',
          dateModified: new Date()
        }
      );

      logger.info(`Clinic soft deleted: ${clinic.name} (ID: ${clinicId})`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in deleteClinic:', error);
      throw new DatabaseError('Failed to delete clinic', error as Error);
    }
  }

  /**
   * Get active clinics only
   */
  static async getActiveClinics(): Promise<IClinic[]> {
    try {
      return await ClinicModel.findActiveClinic();
    } catch (error) {
      logger.error('Error in getActiveClinics:', error);
      throw new DatabaseError('Failed to retrieve active clinics', error as Error);
    }
  }

  /**
   * Get clinic statistics
   */
  static async getClinicStats(clinicId: number) {
    try {
      const clinic = await this.getClinicById(clinicId);
      
      // Here you would typically aggregate data from related collections
      // For now, we'll return the stored stats
      return {
        clinic: {
          id: clinic.clinicId,
          name: clinic.name,
          displayName: clinic.displayName
        },
        stats: clinic.stats,
        clientCount: clinic.clientCount,
        status: clinic.status,
        lastUpdated: clinic.dateModified
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClinicStats:', error);
      throw new DatabaseError('Failed to retrieve clinic statistics', error as Error);
    }
  }

  /**
   * Update clinic statistics
   */
  static async updateClinicStats(clinicId: number, stats: any): Promise<void> {
    try {
      await ClinicModel.findOneAndUpdate(
        { clinicId },
        { 
          $set: {
            'stats.totalOrders': stats.totalOrders || 0,
            'stats.totalRevenue': stats.totalRevenue || 0,
            'stats.lastActivity': stats.lastActivity || new Date(),
            clientCount: stats.clientCount || 0,
            dateModified: new Date()
          }
        }
      );

      logger.info(`Clinic stats updated for clinic ID: ${clinicId}`);
    } catch (error) {
      logger.error('Error in updateClinicStats:', error);
      throw new DatabaseError('Failed to update clinic statistics', error as Error);
    }
  }
}
