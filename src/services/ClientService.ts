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
   * Get all possible clinic name variations for a given clinic
   * This handles the mapping between slugs and actual database clinic names
   */
  private static getClinicNameVariations(rawClinicName: string, actualClinicName?: string): string[] {
    const variations = new Set<string>();
    
    // Add the raw name and actual name
    variations.add(rawClinicName);
    if (actualClinicName) {
      variations.add(actualClinicName);
    }

    // Handle specific clinic variations more precisely
    const lowerRaw = rawClinicName.toLowerCase();
    
    // BodyBlissPhysio specific variations (separate from BodyBliss)
    if (rawClinicName === 'BodyBlissPhysio' || lowerRaw === 'bodyblissphysio' || 
        (actualClinicName && actualClinicName.toLowerCase() === 'bodyblissphysio')) {
      variations.add('BodyBlissPhysio');
      variations.add('bodyblissphysio');
      variations.add('BodyBliss Physio');
      variations.add('BodyBliss Physiotherapy');
    }
    // BodyBliss specific variations (separate clinic)
    else if (rawClinicName === 'BodyBliss' || lowerRaw === 'bodybliss') {
      variations.add('BodyBliss');
      variations.add('bodybliss');
    }
    // BodyBlissOneCare specific variations  
    else if (rawClinicName === 'BodyBlissOneCare' || lowerRaw.includes('onecare')) {
      variations.add('BodyBlissOneCare');
      variations.add('BodyBliss OneCare');
    }
    // Handle other clinic variations
    else if (lowerRaw.includes('ortholine')) {
      variations.add('Ortholine Duncan Mills');
      variations.add('ortholine-duncan-mills');
    }
    else if (lowerRaw.includes('century')) {
      variations.add('Century Care');
      variations.add('centurycare');
    }
    else if (lowerRaw.includes('cloud')) {
      variations.add('My Cloud');
      variations.add('mycloud');
    }
    else if (lowerRaw.includes('physio') && !lowerRaw.includes('bodybliss')) {
      variations.add('Physio Bliss');
      variations.add('physiobliss');
    }

    return Array.from(variations);
  }

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

      // Get all possible clinic name variations for this slug/name
      const possibleClinicNames = this.getClinicNameVariations(rawClinicName, actualClinicName);
      
      // Build query using all possible clinic name variations
      const clinicQueries = possibleClinicNames.flatMap(clinicName => [
        { defaultClinic: clinicName },
        { clinicId: clinicName },
        { clinics: clinicName }
      ]);

      const clinicQuery = {
        $or: clinicQueries
      };

      // Start with clinic filter - properly typed
      const query: ClientQuery = { ...clinicQuery };

      if (status === 'active' || status === 'inactive') {
        query.isActive = status === 'active';
      }

      // Add search functionality using $and to combine with clinic filter
      if (search) {
        // Trim whitespace and normalize search term
        const trimmedSearch = search.trim();
        
        if (trimmedSearch) {
          // Create flexible search patterns for different scenarios
          const searchPatterns = [];
          
          // 1. Direct field matches (case-insensitive, trimmed)
          searchPatterns.push(
            { 'personalInfo.firstName': new RegExp(trimmedSearch, 'i') },
            { 'personalInfo.lastName': new RegExp(trimmedSearch, 'i') },
            { 'personalInfo.fullName': new RegExp(trimmedSearch, 'i') },
            { 'contact.email': new RegExp(trimmedSearch, 'i') },
            { clientId: new RegExp(trimmedSearch, 'i') }
          );
          
          // 2. Handle multi-word searches for full names
          if (trimmedSearch.includes(' ')) {
            const words = trimmedSearch.split(/\s+/).filter(word => word.length > 0);
            if (words.length >= 2) {
              // Try different combinations for first name + last name
              const firstWord = words[0];
              const lastWord = words.slice(1).join(' ');
              
              // Only add patterns if both words exist
              if (firstWord && lastWord) {
                // firstName + lastName pattern
                searchPatterns.push({
                  $and: [
                    { 'personalInfo.firstName': new RegExp(firstWord, 'i') },
                    { 'personalInfo.lastName': new RegExp(lastWord, 'i') }
                  ]
                });
                
                // lastName + firstName pattern (reverse order)
                searchPatterns.push({
                  $and: [
                    { 'personalInfo.firstName': new RegExp(lastWord, 'i') },
                    { 'personalInfo.lastName': new RegExp(firstWord, 'i') }
                  ]
                });
              }
            }
          }
          
          // 3. Escape special regex characters for exact matches
          const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          // 4. Add patterns that look for words anywhere in the combined name fields
          searchPatterns.push(
            { 'personalInfo.fullName': new RegExp(escapedSearch, 'i') }
          );
          
          const searchQuery = { $or: searchPatterns };
          
          // Combine clinic filter and search filter using $and
          query.$and = [clinicQuery, searchQuery];
          delete query.$or; // Remove the top-level $or since we're using $and now
        }
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
        const clientIdStr = lastClient.clientId.toString();
        const lastNumber = parseInt(clientIdStr.substring(clinicId.toString().length));
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

      // Get all possible clinic name variations for querying
      const possibleClinicNames = this.getClinicNameVariations(clinicName);

      // Build query to match any of the clinic name variations
      const clinicQuery = {
        $or: [
          { defaultClinic: { $in: possibleClinicNames } },
          { clinicId: { $in: possibleClinicNames } },
          { clinics: { $in: possibleClinicNames } }
        ]
      };

      // Calculate "New This Month" properly
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      const [
        totalClients,
        activeClients,
        clientsWithInsurance,
        recentClients,
        newThisMonth
      ] = await Promise.all([
        ClientModel.countDocuments(clinicQuery),
        ClientModel.countDocuments({ ...clinicQuery, isActive: true }),
        ClientModel.countDocuments({ 
          ...clinicQuery, 
          isActive: true,
          'insurance.0': { $exists: true }
        }),
        ClientModel.countDocuments({
          ...clinicQuery,
          isActive: true,
          dateCreated: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }),
        // New clients this month (the key fix!)
        ClientModel.countDocuments({
          ...clinicQuery,
          isActive: true,
          dateCreated: { $gte: startOfMonth }
        })
      ]);

      return {
        totalClients,
        activeClients,
        inactiveClients: totalClients - activeClients,
        clientsWithInsurance,
        clientsWithoutInsurance: activeClients - clientsWithInsurance,
        recentClients,
        newThisMonth, // Add the new clients this month count
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

  /**
   * Advanced search with multiple criteria (legacy feature)
   */
  static async advancedSearch(criteria: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phone?: string;
    email?: string;
    clinic?: string;
    insuranceCompany?: string;
    limit?: number;
  }): Promise<IClient[]> {
    try {
      const query: any = { isActive: true };

      if (criteria.firstName) {
        query['personalInfo.firstName'] = new RegExp(criteria.firstName, 'i');
      }

      if (criteria.lastName) {
        query['personalInfo.lastName'] = new RegExp(criteria.lastName, 'i');
      }

      if (criteria.phone) {
        query.$or = [
          { 'contact.phones.home.full': new RegExp(criteria.phone, 'i') },
          { 'contact.phones.cell.full': new RegExp(criteria.phone, 'i') },
          { 'contact.phones.work.full': new RegExp(criteria.phone, 'i') }
        ];
      }

      if (criteria.email) {
        query['contact.email'] = new RegExp(criteria.email, 'i');
      }

      if (criteria.clinic) {
        query.defaultClinic = criteria.clinic;
      }

      if (criteria.insuranceCompany) {
        query['insurance.company'] = new RegExp(criteria.insuranceCompany, 'i');
      }

      const clients = await ClientModel.find(query)
        .limit(criteria.limit || 50)
        .sort({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 });

      logger.info(`Advanced search completed with ${clients.length} results`, { criteria });
      return clients;
    } catch (error) {
      logger.error('Error in advancedSearch:', error);
      throw new DatabaseError('Failed to perform advanced search', error as Error);
    }
  }

  /**
   * Get client account summary (orders, payments, insurance)
   */
  static async getClientAccountSummary(clientId: string): Promise<any> {
    try {
      const client = await this.getClientById(clientId);

      // Get related data from other services
      const [orders, payments] = await Promise.all([
        this.getClientOrders(clientId),
        this.getClientPayments(clientId)
      ]);

      // Calculate summary
      const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0);
      const totalPaid = payments.reduce((sum: number, payment: any) => sum + (payment.amounts?.totalPaid || 0), 0);
      const totalOwed = orders.reduce((sum: number, order: any) => {
        if (order.paymentStatus === 'pending' || order.paymentStatus === 'partial') {
          return sum + (order.totalAmount || 0);
        }
        return sum;
      }, 0);

      return {
        client: {
          id: client._id,
          name: client.getFullName(),
          email: client.contact?.email,
          phone: client.contact?.phones?.cell?.full
        },
        insurance: client.insurance || [],
        orders: {
          total: orders.length,
          totalRevenue,
          pending: orders.filter((o: any) => o.status === 'scheduled').length,
          completed: orders.filter((o: any) => o.status === 'completed').length
        },
        payments: {
          total: payments.length,
          totalPaid,
          totalOwed,
          lastPaymentDate: payments.length > 0 ? payments[0].paymentDate : null
        },
        financial: {
          totalInvoiced: totalRevenue,
          totalPaid,
          amountDue: totalOwed,
          balance: totalRevenue - totalPaid
        }
      };
    } catch (error) {
      logger.error('Error in getClientAccountSummary:', error);
      throw new DatabaseError('Failed to get client account summary', error as Error);
    }
  }

  /**
   * Get clients by insurance company
   */
  static async getClientsByInsuranceCompany(companyName: string, clinicName?: string): Promise<IClient[]> {
    try {
      const query: any = {
        'insurance.company': new RegExp(companyName, 'i'),
        isActive: true
      };

      if (clinicName) {
        await ClinicService.getClinicByName(clinicName);
        query.defaultClinic = clinicName;
      }

      const clients = await ClientModel.find(query)
        .sort({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 });

      logger.info(`Found ${clients.length} clients with insurance company: ${companyName}`);
      return clients;
    } catch (error) {
      logger.error('Error in getClientsByInsuranceCompany:', error);
      throw new DatabaseError('Failed to get clients by insurance company', error as Error);
    }
  }

  /**
   * Get client with comprehensive data (appointments, orders, payments)
   */
  static async getClientComprehensive(clientId: string): Promise<any> {
    try {
      const client = await this.getClientById(clientId);

      const [orders, payments, appointments] = await Promise.all([
        this.getClientOrders(clientId),
        this.getClientPayments(clientId),
        this.getClientAppointments(clientId)
      ]);

      return {
        client,
        orders,
        payments,
        appointments,
        summary: {
          totalOrders: orders.length,
          totalPayments: payments.length,
          totalAppointments: appointments.length,
          totalSpent: payments.reduce((sum: number, p: any) => sum + (p.amounts?.totalPaid || 0), 0)
        }
      };
    } catch (error) {
      logger.error('Error in getClientComprehensive:', error);
      throw new DatabaseError('Failed to get comprehensive client data', error as Error);
    }
  }

  /**
   * Get client contact history
   */
  static async getClientContactHistory(clientId: string, limit = 50): Promise<any[]> {
    try {
      const client = await this.getClientById(clientId);

      // Query contact history from ContactHistory model if it exists
      const ContactHistoryModel = mongoose.model('ContactHistory');
      const history = await ContactHistoryModel
        .find({ clientId: client._id })
        .sort({ createdAt: -1 })
        .limit(limit);

      return history;
    } catch (error) {
      logger.error('Error in getClientContactHistory:', error);
      throw new DatabaseError('Failed to get client contact history', error as Error);
    }
  }

  /**
   * Update client insurance information
   */
  static async updateClientInsurance(clientId: string, insurance: any[]): Promise<IClient> {
    try {
      if (!Array.isArray(insurance) || insurance.length === 0) {
        throw new ValidationError('Insurance must be a non-empty array');
      }

      // Validate insurance data
      for (const ins of insurance) {
        if (!ins.type || !['1st', '2nd', '3rd'].includes(ins.type)) {
          throw new ValidationError('Invalid insurance type. Must be 1st, 2nd, or 3rd');
        }
        if (!ins.company) {
          throw new ValidationError('Insurance company is required');
        }
      }

      const client = await ClientModel.findOneAndUpdate(
        { clientId },
        { 
          insurance,
          dateModified: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!client) {
        throw new NotFoundError(`Client with ID ${clientId} not found`);
      }

      logger.info(`Insurance updated for client: ${client.getFullName()}`);
      return client;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in updateClientInsurance:', error);
      throw new DatabaseError('Failed to update client insurance', error as Error);
    }
  }

  /**
   * Get clients with DPA (Direct Payment Authorization)
   */
  static async getClientsWithDPA(clinicName: string, page = 1, limit = 20): Promise<{ clients: IClient[]; page: number; limit: number; total: number }> {
    try {
      await ClinicService.getClinicByName(clinicName);

      const skip = (page - 1) * limit;

      const [clients, total] = await Promise.all([
        ClientModel.find({
          defaultClinic: clinicName,
          'insurance.dpa': true,
          isActive: true
        })
          .skip(skip)
          .limit(limit)
          .sort({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 }),
        ClientModel.countDocuments({
          defaultClinic: clinicName,
          'insurance.dpa': true,
          isActive: true
        })
      ]);

      return { clients, page, limit, total };
    } catch (error) {
      logger.error('Error in getClientsWithDPA:', error);
      throw new DatabaseError('Failed to get clients with DPA', error as Error);
    }
  }

  /**
   * Bulk update clients
   */
  static async bulkUpdateClients(updates: Array<{ id: string; data: any }>): Promise<{ updatedCount: number; errors: any[] }> {
    try {
      const results: { updatedCount: number; errors: Array<{ clientId: string; error: string }> } = { updatedCount: 0, errors: [] };

      for (const update of updates) {
        try {
          await this.updateClient(update.id, update.data);
          results.updatedCount++;
        } catch (error) {
          results.errors.push({
            clientId: update.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info(`Bulk update completed: ${results.updatedCount} successful, ${results.errors.length} failed`);
      return results;
    } catch (error) {
      logger.error('Error in bulkUpdateClients:', error);
      throw new DatabaseError('Failed to bulk update clients', error as Error);
    }
  }

  /**
   * Export clients data
   */
  static async exportClients(clinicName?: string, format = 'json', limit = 1000): Promise<any> {
    try {
      const query: any = { isActive: true };

      if (clinicName) {
        await ClinicService.getClinicByName(clinicName);
        query.defaultClinic = clinicName;
      }

      const clients = await ClientModel.find(query)
        .sort({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 })
        .limit(limit)
        .lean();

      if (format === 'csv') {
        return this.convertToCsv(clients);
      }

      return clients;
    } catch (error) {
      logger.error('Error in exportClients:', error);
      throw new DatabaseError('Failed to export clients', error as Error);
    }
  }

  /**
   * Helper: Convert clients to CSV format
   */
  private static convertToCsv(clients: IClient[]): string {
    const headers = [
      'Client ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'City',
      'Province',
      'Clinic',
      'Gender'
    ];

    const rows = clients.map(client => [
      client.clientId,
      client.personalInfo?.firstName || '',
      client.personalInfo?.lastName || '',
      client.contact?.email || '',
      // ✓ FIXED: Safely handle nested phone structure with proper null checks
      client.contact?.phones?.cell?.full || 
      client.contact?.phones?.home?.full || 
      client.contact?.phones?.work?.full || 
      '',
      client.contact?.address?.city || '',
      client.contact?.address?.province || '',
      client.defaultClinic || '',
      client.personalInfo?.gender || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell)}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Helper: Get client orders
   */
  private static async getClientOrders(clientId: string): Promise<any[]> {
    try {
      const Order = mongoose.model('Order');
      const client = await this.getClientById(clientId);
      // ✓ FIXED: Convert numeric clientId (client.clientKey or client.clientId) for Order model
      const numericClientId = client.clientKey || Number(client.clientId);
      return await Order.find({ clientId: numericClientId }).sort({ createdAt: -1 });
    } catch (error) {
      logger.warn('Could not retrieve client orders:', error);
      return [];
    }
  }

  /**
   * Helper: Get client payments
   */
  private static async getClientPayments(clientId: string): Promise<any[]> {
    try {
      const Payment = mongoose.model('Payment');
      const client = await this.getClientById(clientId);
      // ✓ FIXED: Convert numeric clientId (client.clientKey or client.clientId) for Payment model
      const numericClientId = client.clientKey || Number(client.clientId);
      return await Payment.find({ clientId: numericClientId }).sort({ paymentDate: -1 });
    } catch (error) {
      logger.warn('Could not retrieve client payments:', error);
      return [];
    }
  }

  /**
   * Helper: Get client appointments
   */
  private static async getClientAppointments(clientId: string): Promise<any[]> {
    try {
      const Appointment = mongoose.model('Appointment');
      const client = await this.getClientById(clientId);
      // ✓ FIXED: Convert numeric clientId (client.clientKey or client.clientId) for Appointment model
      const numericClientId = client.clientKey || Number(client.clientId);
      return await Appointment.find({ clientId: numericClientId }).sort({ startDate: -1 });
    } catch (error) {
      logger.warn('Could not retrieve client appointments:', error);
      return [];
    }
  }
}
