import { ClientModel, IClient } from '@/models/Client';
import { NotFoundError, ValidationError, DatabaseError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { ClinicService } from './ClinicService';
import mongoose from 'mongoose';

// Add proper type definitions for client data
interface InsuranceData {
  type: '1st' | '2nd' | '3rd';
  dpa?: boolean;
  policyHolder: string;
  cob?: string;
  policyHolderName?: string;
  birthday?: {
    day: string;
    month: string;
    year: string;
  };
  company: string;
  companyAddress?: string;
  city?: string;
  province?: string;
  postalCode?: {
    first3: string;
    last3: string;
  };
  groupNumber?: string;
  certificateNumber: string;
  coverage: {
    numberOfOrthotics?: string;
    totalAmountPerOrthotic?: number;
    totalAmountPerYear?: number;
    frequency?: string;
    numOrthoticsPerYear?: string;
    orthopedicShoes?: number;
    compressionStockings?: number;
    physiotherapy?: number;
    massage?: number;
    other?: number;
  };
}

interface CreateClientData {
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth?: Date;
    birthday?: {
      day: string;
      month: string;
      year: string;
    };
    gender?: 'Male' | 'Female' | 'Other';
    fullName?: string;
  };
  contact: {
    address: {
      street?: string;
      apartment?: string;
      city: string;
      province: string;
      postalCode?: string | {
        first3: string;
        last3: string;
        full?: string;
      };
    };
    phones?: {
      home?: string | object;
      cell?: string | object;
      work?: string | object;
    };
    email?: string;
    company?: string;
    companyOther?: string;
  };
  medical?: {
    familyMD?: string;
    referringMD?: string;
    csrName?: string;
  };
  insurance?: InsuranceData[];
  defaultClinic: string;
  clientId?: string;
  // Legacy support for top-level birthday
  birthday?: {
    day: string;
    month: string;
    year: string;
  };
}

interface UpdateClientData extends Partial<CreateClientData> {
  isActive?: boolean;
}

// MongoDB query interface for better type safety
interface ClientQuery {
  $or?: Array<{
    defaultClinic?: string;
    clinicId?: string;
    clinics?: string;
  }>;
  $and?: Array<{
    $or: Array<{
      defaultClinic?: string;
      clinicId?: string;
      clinics?: string;
    }>;
  } | {
    $or: Array<{
      'personalInfo.firstName'?: RegExp;
      'personalInfo.lastName'?: RegExp;
      'personalInfo.fullName'?: RegExp;
      'contact.email'?: RegExp;
      clientId?: RegExp;
    }>;
  }>;
  isActive?: boolean;
  defaultClinic?: string;
  clinicId?: string;
  clinics?: string;
}

// Utility function for safe JSON stringification
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Truncate large objects for logging
        const keys = Object.keys(value);
        if (keys.length > 10) {
          const truncated: Record<string, unknown> = {};
          for (const k of keys.slice(0, 10)) {
            truncated[k] = (value as Record<string, unknown>)[k];
          }
          truncated['...'] = `${keys.length - 10} more properties`;
          return truncated;
        }
      }
      return value;
    }, 2);
  } catch (error) {
    return `[Unstringifiable object: ${typeof obj}]`;
  }
}

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

      // Build query using the converted clinic name with proper typing
      const clinicQuery = {
        $or: [
          { defaultClinic: actualClinicName },
          { clinicId: actualClinicName },
          { clinics: actualClinicName }
        ]
      };

      // Start with clinic filter - properly typed
      const query: ClientQuery = { ...clinicQuery };

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
  static async createClient(clientData: CreateClientData): Promise<IClient> {
    try {
      logger.debug('Creating client with data:', { 
        clientData: safeStringify(clientData)
      });

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

      // Parse date of birth from multiple sources
      let dateOfBirth: Date | undefined;
      
      // Priority 1: personalInfo.dateOfBirth
      if (clientData.personalInfo?.dateOfBirth) {
        try {
          dateOfBirth = new Date(clientData.personalInfo.dateOfBirth);
          if (isNaN(dateOfBirth.getTime())) {
            dateOfBirth = undefined;
          }
        } catch (e) {
          logger.warn('Invalid dateOfBirth format:', clientData.personalInfo.dateOfBirth);
        }
      }
      
      // Priority 2: personalInfo.birthday object
      if (!dateOfBirth && clientData.personalInfo?.birthday?.day && clientData.personalInfo?.birthday?.month && clientData.personalInfo?.birthday?.year) {
        const { day, month, year } = clientData.personalInfo.birthday;
        try {
          dateOfBirth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (isNaN(dateOfBirth.getTime())) {
            dateOfBirth = undefined;
          }
        } catch (e) {
          logger.warn('Invalid birthday format:', clientData.personalInfo.birthday);
        }
      }
      
      // Priority 3: top-level birthday object (legacy) - properly typed
      if (!dateOfBirth && clientData.birthday?.day && clientData.birthday?.month && clientData.birthday?.year) {
        const { day, month, year } = clientData.birthday;
        try {
          dateOfBirth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (isNaN(dateOfBirth.getTime())) {
            dateOfBirth = undefined;
          }
        } catch (e) {
          logger.warn('Invalid top-level birthday format:', clientData.birthday);
        }
      }

      // Set dateOfBirth if we have a valid date
      if (dateOfBirth) {
        if (!clientData.personalInfo.birthday) {
          clientData.personalInfo.birthday = {
            day: dateOfBirth.getDate().toString().padStart(2, '0'),
            month: (dateOfBirth.getMonth() + 1).toString().padStart(2, '0'),
            year: dateOfBirth.getFullYear().toString()
          };
        }
        clientData.personalInfo.dateOfBirth = dateOfBirth;
      }

      // Ensure postal code is in correct format
      if (clientData.contact?.address?.postalCode && typeof clientData.contact.address.postalCode === 'string') {
        const pc = clientData.contact.address.postalCode.replace(/\s+/g, '');
        if (pc.length >= 6) {
          clientData.contact.address.postalCode = {
            first3: pc.substring(0, 3).toUpperCase(),
            last3: pc.substring(3, 6).toUpperCase(),
            full: `${pc.substring(0, 3).toUpperCase()} ${pc.substring(3, 6).toUpperCase()}`
          };
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

      logger.info(`Client created successfully: ${savedClient.getFullName()} (ID: ${savedClient.clientId})`);

      return savedClient;
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error('Validation error in createClient:', { 
          error: error.message,
          clientData: clientData ? {
            firstName: clientData.personalInfo?.firstName,
            lastName: clientData.personalInfo?.lastName,
            defaultClinic: clientData.defaultClinic
          } : 'undefined'
        });
        throw error;
      }
      logger.error('Error in createClient:', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        clientData: clientData ? {
          firstName: clientData.personalInfo?.firstName,
          lastName: clientData.personalInfo?.lastName,
          defaultClinic: clientData.defaultClinic
        } : 'undefined'
      });
      throw new DatabaseError('Failed to create client', error as Error);
    }
  }

  /**
   * Update client
   */
  static async updateClient(clientId: string, updateData: UpdateClientData): Promise<IClient> {
    try {
      logger.debug('Updating client with data:', { 
        clientId,
        updateData: safeStringify(updateData)
      });

      // Check if client exists
      const existingClient = await this.getClientById(clientId);

      // Parse date of birth from multiple sources if provided
      if (updateData.personalInfo) {
        let dateOfBirth: Date | undefined;
        
        // Priority 1: personalInfo.dateOfBirth
        if (updateData.personalInfo?.dateOfBirth) {
          try {
            dateOfBirth = new Date(updateData.personalInfo.dateOfBirth);
            if (isNaN(dateOfBirth.getTime())) {
              dateOfBirth = undefined;
            }
          } catch (e) {
            logger.warn('Invalid dateOfBirth format in update:', updateData.personalInfo.dateOfBirth);
          }
        }
        
        // Priority 2: personalInfo.birthday object
        if (!dateOfBirth && updateData.personalInfo?.birthday?.day && updateData.personalInfo?.birthday?.month && updateData.personalInfo?.birthday?.year) {
          const { day, month, year } = updateData.personalInfo.birthday;
          try {
            dateOfBirth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (isNaN(dateOfBirth.getTime())) {
              dateOfBirth = undefined;
            }
          } catch (e) {
            logger.warn('Invalid birthday format in update:', updateData.personalInfo.birthday);
          }
        }

        // Set dateOfBirth if we have a valid date
        if (dateOfBirth) {
          if (!updateData.personalInfo.birthday) {
            updateData.personalInfo.birthday = {
              day: dateOfBirth.getDate().toString().padStart(2, '0'),
              month: (dateOfBirth.getMonth() + 1).toString().padStart(2, '0'),
              year: dateOfBirth.getFullYear().toString()
            };
          }
          updateData.personalInfo.dateOfBirth = dateOfBirth;
        }

        // Update full name if first or last name changed
        if (updateData.personalInfo?.firstName || updateData.personalInfo?.lastName) {
          const firstName = updateData.personalInfo?.firstName || existingClient.personalInfo.firstName;
          const lastName = updateData.personalInfo?.lastName || existingClient.personalInfo.lastName;
          
          updateData.personalInfo.fullName = `${lastName}, ${firstName}`;
        }
      }

      // Ensure postal code is in correct format if provided
      if (updateData.contact?.address?.postalCode && typeof updateData.contact.address.postalCode === 'string') {
        const pc = updateData.contact.address.postalCode.replace(/\s+/g, '');
        if (pc.length >= 6) {
          updateData.contact.address.postalCode = {
            first3: pc.substring(0, 3).toUpperCase(),
            last3: pc.substring(3, 6).toUpperCase(),
            full: `${pc.substring(0, 3).toUpperCase()} ${pc.substring(3, 6).toUpperCase()}`
          };
        }
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

      logger.info(`Client updated successfully: ${updatedClient!.getFullName()} (ID: ${clientId})`);
      return updatedClient!;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        logger.error('Validation/NotFound error in updateClient:', { 
          error: error.message,
          clientId,
          updateData: updateData ? {
            firstName: updateData.personalInfo?.firstName,
            lastName: updateData.personalInfo?.lastName,
            defaultClinic: updateData.defaultClinic
          } : 'undefined'
        });
        throw error;
      }
      logger.error('Error in updateClient:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        clientId,
        updateData: updateData ? {
          firstName: updateData.personalInfo?.firstName,
          lastName: updateData.personalInfo?.lastName,
          defaultClinic: updateData.defaultClinic
        } : 'undefined'
      });
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
