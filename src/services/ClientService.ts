import { ClientModel, IClient } from '@/models/Client';
import { NotFoundError, ValidationError, DatabaseError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { ClinicService } from './ClinicService';
import mongoose from 'mongoose';

export class ClientService {
  /**
   * Get clients by clinic with pagination and filtering
   */
  static async getClientsByClinic(params: {
    clinicName: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    // Extract parameters outside try block for error logging access
    const {
      clinicName: rawClinicName,
      page = 1,
      limit = 20,
      search,
      status
    } = params;

    // Declare clinic name variable outside try block
    let actualClinicName: string = rawClinicName;

    try {
      // Convert slug to proper clinic name if needed
      try {
        // First try direct conversion from slug to clinic name
        actualClinicName = ClinicService.slugToClinicName(rawClinicName);
      } catch (conversionError) {
        // If that fails, assume it's already a proper clinic name
        actualClinicName = rawClinicName;
        logger.debug('Clinic name conversion failed, using raw name:', { rawClinicName, error: conversionError });
      }

      // Verify clinic exists using the converted name
      await ClinicService.getClinicByName(actualClinicName);

      // Verify database connection
      if (mongoose.connection.readyState !== 1) {
        throw new DatabaseError('Database connection not ready', new Error(`Connection state: ${mongoose.connection.readyState}`));
      }

      // Build query using the converted clinic name
      // Check multiple fields to handle different data formats:
      // - defaultClinic: newer format
      // - clinicId: older format  
      // - clinics: array format
      const clinicQuery = {
        $or: [
          { defaultClinic: actualClinicName },
          { clinicId: actualClinicName },
          { clinics: actualClinicName }
        ]
      };

      // Start with clinic filter
      const query: any = { ...clinicQuery };

      if (status === 'active' || status === 'inactive') {
        query.isActive = status === 'active';
      }

      // Add search functionality using $and to combine with clinic filter
      if (search) {
        const searchQuery = {
          $or: [
            { 'personalInfo.firstName': new RegExp(search, 'i') },
            { 'personalInfo.lastName': new RegExp(search, 'i') },
            { 'personalInfo.fullName': new RegExp(search, 'i') },
            { 'contact.email': new RegExp(search, 'i') },
            { clientId: new RegExp(search, 'i') }
          ]
        };
        
        // Combine clinic filter and search filter using $and
        query.$and = [clinicQuery, searchQuery];
        delete query.$or; // Remove the top-level $or since we're using $and now
      }

      logger.debug('ClientService query details:', { 
        rawClinicName, 
        actualClinicName, 
        query, 
        page, 
        limit,
        search,
        status 
      });

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [clients, total] = await Promise.all([
        ClientModel.find(query)
          .sort({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        ClientModel.countDocuments(query)
      ]);

      return { clients, page, limit, total };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClientsByClinic:', {
        rawClinicName,
        actualClinicName: actualClinicName || 'undefined',
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new DatabaseError('Failed to retrieve clients', error as Error);
    }
  }

  /**
   * Get client by ID
   */
  static async getClientById(clientId: string): Promise<IClient> {
    try {
      const client = await ClientModel.findOne({ clientId });
      
      if (!client) {
        throw new NotFoundError('Client', clientId);
      }

      return client;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClientById:', error);
      throw new DatabaseError('Failed to retrieve client', error as Error);
    }
  }

  /**
   * Create new client
   */
  static async createClient(clientData: any): Promise<IClient> {
    try {
      // Validate required fields
      if (!clientData.personalInfo?.firstName) {
        throw new ValidationError('First name is required');
      }

      if (!clientData.personalInfo?.lastName) {
        throw new ValidationError('Last name is required');
      }

      if (!clientData.defaultClinic) {
        throw new ValidationError('Default clinic is required');
      }

      if (!clientData.contact?.address?.city) {
        throw new ValidationError('City is required');
      }

      if (!clientData.contact?.address?.province) {
        throw new ValidationError('Province is required');
      }

      // Verify clinic exists
      await ClinicService.getClinicByName(clientData.defaultClinic);

      // Check for duplicate client ID if provided
      if (clientData.clientId) {
        const existingClient = await ClientModel.findOne({ clientId: clientData.clientId });
        if (existingClient) {
          throw new ValidationError('Client with this ID already exists');
        }
      }

      // Generate client ID if not provided
      if (!clientData.clientId) {
        clientData.clientId = await this.generateClientId(clientData.defaultClinic);
      }

      // Parse date of birth if provided as string parts
      if (clientData.birthday && clientData.birthday.day && clientData.birthday.month && clientData.birthday.year) {
        const { day, month, year } = clientData.birthday;
        const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(birthDate.getTime())) {
          clientData.personalInfo.dateOfBirth = birthDate;
        }
      }

      // Create client
      const client = new ClientModel({
        ...clientData,
        personalInfo: {
          ...clientData.personalInfo,
          fullName: `${clientData.personalInfo.lastName}, ${clientData.personalInfo.firstName}`
        },
        clinics: [clientData.defaultClinic],
        isActive: true
      });

      const savedClient = await client.save();
      
      // Update clinic client count
      await this.updateClinicClientCount(clientData.defaultClinic);

      logger.info(`Client created: ${savedClient.getFullName()} (ID: ${savedClient.clientId})`);

      return savedClient;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error in createClient:', error);
      throw new DatabaseError('Failed to create client', error as Error);
    }
  }

  /**
   * Update client
   */
  static async updateClient(clientId: string, updateData: any): Promise<IClient> {
    try {
      // Check if client exists
      const existingClient = await this.getClientById(clientId);

      // Update full name if first or last name changed
      if (updateData.personalInfo?.firstName || updateData.personalInfo?.lastName) {
        const firstName = updateData.personalInfo?.firstName || existingClient.personalInfo.firstName;
        const lastName = updateData.personalInfo?.lastName || existingClient.personalInfo.lastName;
        
        if (!updateData.personalInfo) {
          updateData.personalInfo = {};
        }
        updateData.personalInfo.fullName = `${lastName}, ${firstName}`;
      }

      // If default clinic changed, verify new clinic exists and update client counts
      if (updateData.defaultClinic && updateData.defaultClinic !== existingClient.defaultClinic) {
        await ClinicService.getClinicByName(updateData.defaultClinic);
        
        // Update clinic counts
        await this.updateClinicClientCount(existingClient.defaultClinic);
        await this.updateClinicClientCount(updateData.defaultClinic);
      }

      const updatedClient = await ClientModel.findOneAndUpdate(
        { clientId },
        {
          ...updateData,
          dateModified: new Date()
        },
        { new: true, runValidators: true }
      );

      logger.info(`Client updated: ${updatedClient!.getFullName()} (ID: ${clientId})`);
      return updatedClient!;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in updateClient:', error);
      throw new DatabaseError('Failed to update client', error as Error);
    }
  }

  /**
   * Delete client (soft delete)
   */
  static async deleteClient(clientId: string): Promise<void> {
    try {
      const client = await this.getClientById(clientId);
      
      await ClientModel.findOneAndUpdate(
        { clientId },
        { 
          isActive: false,
          dateModified: new Date()
        }
      );

      // Update clinic client count
      await this.updateClinicClientCount(client.defaultClinic);

      logger.info(`Client soft deleted: ${client.getFullName()} (ID: ${clientId})`);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in deleteClient:', error);
      throw new DatabaseError('Failed to delete client', error as Error);
    }
  }

  /**
   * Search clients across all clinics or specific clinic
   */
  static async searchClients(searchTerm: string, clinicName?: string, limit = 20): Promise<IClient[]> {
    try {
      if (clinicName) {
        // Verify clinic exists
        await ClinicService.getClinicByName(clinicName);
      }

      const clients = await ClientModel.searchClients(searchTerm, clinicName);
      return clients.slice(0, limit);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in searchClients:', error);
      throw new DatabaseError('Failed to search clients', error as Error);
    }
  }

  /**
   * Get clients with insurance information
   */
  static async getClientsWithInsurance(clinicName: string): Promise<IClient[]> {
    try {
      // Verify clinic exists
      await ClinicService.getClinicByName(clinicName);

      const clients = await ClientModel.find({
        defaultClinic: clinicName,
        isActive: true,
        'insurance.0': { $exists: true }
      }).sort({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 });

      return clients;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClientsWithInsurance:', error);
      throw new DatabaseError('Failed to retrieve clients with insurance', error as Error);
    }
  }

  /**
   * Generate unique client ID for a clinic
   */
  private static async generateClientId(clinicName: string): Promise<string> {
    try {
      // Get clinic to use clinic ID in client ID generation
      const clinic = await ClinicService.getClinicByName(clinicName);
      const clinicId = clinic.clinicId;

      // Find the highest existing client ID for this clinic
      const lastClient = await ClientModel.findOne({
        defaultClinic: clinicName,
        clientId: new RegExp(`^${clinicId}`)
      }).sort({ clientId: -1 });

      let nextNumber = 1000; // Starting number
      
      if (lastClient) {
        const lastNumber = parseInt(lastClient.clientId.substring(clinicId.toString().length));
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      return `${clinicId}${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      logger.error('Error generating client ID:', error);
      throw new DatabaseError('Failed to generate client ID', error as Error);
    }
  }

  /**
   * Update clinic client count
   */
  private static async updateClinicClientCount(clinicName: string): Promise<void> {
    try {
      const count = await ClientModel.countDocuments({
        defaultClinic: clinicName,
        isActive: true
      });

      const clinic = await ClinicService.getClinicByName(clinicName);
      await ClinicService.updateClinicStats(clinic.clinicId, { clientCount: count });
    } catch (error) {
      logger.error('Error updating clinic client count:', error);
      // Don't throw error for this operation as it's not critical
    }
  }

  /**
   * Get client statistics for a clinic
   */
  static async getClientStats(clinicName: string) {
    try {
      // Verify clinic exists
      await ClinicService.getClinicByName(clinicName);

      const [
        totalClients,
        activeClients,
        clientsWithInsurance,
        recentClients
      ] = await Promise.all([
        ClientModel.countDocuments({ defaultClinic: clinicName }),
        ClientModel.countDocuments({ defaultClinic: clinicName, isActive: true }),
        ClientModel.countDocuments({ 
          defaultClinic: clinicName, 
          isActive: true,
          'insurance.0': { $exists: true }
        }),
        ClientModel.countDocuments({
          defaultClinic: clinicName,
          isActive: true,
          dateCreated: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        })
      ]);

      return {
        totalClients,
        activeClients,
        inactiveClients: totalClients - activeClients,
        clientsWithInsurance,
        clientsWithoutInsurance: activeClients - clientsWithInsurance,
        recentClients,
        insurancePercentage: activeClients > 0 ? Math.round((clientsWithInsurance / activeClients) * 100) : 0
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in getClientStats:', error);
      throw new DatabaseError('Failed to retrieve client statistics', error as Error);
    }
  }
}
