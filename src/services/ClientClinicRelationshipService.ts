import { ClientClinicRelationshipModel, IClientClinicRelationship } from '@/models/ClientClinicRelationship';
import { ClientModel } from '@/models/Client';
import { logger } from '@/utils/logger';
import { NotFoundError, ValidationError, DatabaseError, ConflictError } from '@/utils/errors';

export interface RelationshipQuery {
  page?: number;
  limit?: number;
  clientId?: string;
  clinicName?: string;
  relationshipType?: string;
  isActive?: boolean;
  isPrimary?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface RelationshipStats {
  totalRelationships: number;
  activeRelationships: number;
  primaryRelationships: number;
  relationshipsByType: Record<string, number>;
  relationshipsByClinic: Record<string, number>;
  averageRelationshipsPerClient: number;
  multiClinicClients: number;
  recentlyCreated: number;
  expiringCount: number;
}

export class ClientClinicRelationshipService {
  /**
   * Get client-clinic relationships with filtering and pagination
   * Uses efficient aggregation instead of forEach
   */
  static async getRelationships(query: RelationshipQuery) {
    try {
      const {
        page = 1,
        limit = 50,
        clientId,
        clinicName,
        relationshipType,
        isActive,
        isPrimary,
        startDate,
        endDate
      } = query;

      // Build filter efficiently
      const filter: any = {};

      if (clientId) {filter.clientId = clientId;}
      if (clinicName) {filter.clinicName = clinicName;}
      if (relationshipType) {filter.relationshipType = relationshipType;}
      if (isActive !== undefined) {filter.isActive = isActive;}
      if (isPrimary !== undefined) {filter.isPrimary = isPrimary;}

      // Date range filter
      if (startDate || endDate) {
        filter.startDate = {};
        if (startDate) {filter.startDate.$gte = startDate;}
        if (endDate) {filter.startDate.$lte = endDate;}
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute queries in parallel for performance
      const [relationships, total] = await Promise.all([
        ClientClinicRelationshipModel.find(filter)
          .sort({ startDate: -1, isPrimary: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ClientClinicRelationshipModel.countDocuments(filter)
      ]);

      logger.info(`🏥 Retrieved ${relationships.length} client-clinic relationships`);

      return {
        relationships,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error retrieving client-clinic relationships:', error);
      throw new DatabaseError('Failed to retrieve client-clinic relationships');
    }
  }

  /**
   * Get relationship by ID
   */
  static async getRelationshipById(id: number) {
    try {
      const relationship = await ClientClinicRelationshipModel.findOne({ id, isActive: true }).lean();

      if (!relationship) {
        throw new NotFoundError(`Client-clinic relationship with ID ${id} not found`);
      }

      logger.info(`🏥 Retrieved relationship: ${id}`);
      return relationship;
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error retrieving relationship by ID:', error);
      throw new DatabaseError('Failed to retrieve relationship');
    }
  }

  /**
   * Create new client-clinic relationship
   */
  static async createRelationship(relationshipData: Partial<IClientClinicRelationship>) {
    try {
      // Validate required fields
      if (!relationshipData.clientId || !relationshipData.clinicName) {
        throw new ValidationError('Client ID and clinic name are required');
      }

      // Check if relationship already exists
      const existingRelationship = await ClientClinicRelationshipModel.findOne({
        clientId: relationshipData.clientId,
        clinicName: relationshipData.clinicName,
        isActive: true
      }).lean();

      if (existingRelationship) {
        throw new ConflictError(
          `Relationship between client ${relationshipData.clientId} and clinic ${relationshipData.clinicName} already exists`
        );
      }

      // Validate client exists
      const numericClientId = Number(relationshipData.clientId);
      const clientExists = await ClientModel.findOne({ 
        $or: [
          { clientId: numericClientId, isActive: true },
          { clientId: relationshipData.clientId, isActive: true },
          { clientKey: numericClientId, isActive: true }
        ]
      }).lean();

      if (!clientExists) {
        throw new ValidationError(`Client ${relationshipData.clientId} not found`);
      }

      // Get next ID efficiently
      const lastRelationship = await ClientClinicRelationshipModel.findOne({}, { id: 1 })
        .sort({ id: -1 })
        .lean();
      
      const nextId = (lastRelationship?.id || 0) + 1;

      // Handle primary relationship logic
      if (relationshipData.isPrimary) {
        // Make sure only one primary relationship exists per client
        await ClientClinicRelationshipModel.updateMany(
          { 
            clientId: relationshipData.clientId, 
            isActive: true 
          },
          { 
            isPrimary: false,
            modifiedAt: new Date()
          }
        );
      } else {
        // If no primary relationship exists and this is the first for client, make it primary
        const existingCount = await ClientClinicRelationshipModel.countDocuments({
          clientId: relationshipData.clientId,
          isActive: true
        });

        if (existingCount === 0) {
          relationshipData.isPrimary = true;
        }
      }

      const newRelationship = new ClientClinicRelationshipModel({
        ...relationshipData,
        id: nextId,
        isActive: true,
        startDate: relationshipData.startDate || new Date(),
        createdAt: new Date(),
        // Initialize stats
        stats: {
          totalAppointments: 0,
          completedAppointments: 0,
          cancelledAppointments: 0,
          noShowAppointments: 0,
          totalAmountBilled: 0,
          totalAmountPaid: 0,
          averageAppointmentDuration: 60
        }
      });

      const savedRelationship = await newRelationship.save();
      logger.info(`🏥 Created client-clinic relationship: ${savedRelationship.id}`);

      return savedRelationship;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {throw error;}
      logger.error('Error creating client-clinic relationship:', error);
      throw new DatabaseError('Failed to create client-clinic relationship');
    }
  }

  /**
   * Update relationship
   */
  static async updateRelationship(id: number, updateData: Partial<IClientClinicRelationship>) {
    try {
      const relationship = await ClientClinicRelationshipModel.findOne({ id, isActive: true });

      if (!relationship) {
        throw new NotFoundError(`Client-clinic relationship with ID ${id} not found`);
      }

      // Handle primary relationship logic
      if (updateData.isPrimary && !relationship.isPrimary) {
        // Make this relationship primary and others non-primary
        await relationship.makePrimary();
      }

      // Update fields efficiently using Object.assign
      Object.assign(relationship, updateData, { modifiedAt: new Date() });

      const updatedRelationship = await relationship.save();
      logger.info(`🏥 Updated relationship: ${id}`);

      return updatedRelationship;
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error updating relationship:', error);
      throw new DatabaseError('Failed to update relationship');
    }
  }

  /**
   * Deactivate relationship (soft delete)
   */
  static async deactivateRelationship(id: number, reason?: string) {
    try {
      const relationship = await ClientClinicRelationshipModel.findOne({ id, isActive: true });

      if (!relationship) {
        throw new NotFoundError(`Client-clinic relationship with ID ${id} not found`);
      }

      relationship.deactivate(reason);
      await relationship.save();

      // If this was a primary relationship, make another relationship primary
      if (relationship.isPrimary) {
        const nextPrimary = await ClientClinicRelationshipModel.findOne({
          clientId: relationship.clientId,
          isActive: true,
          _id: { $ne: relationship._id }
        }).sort({ startDate: -1 });

        if (nextPrimary) {
          await nextPrimary.makePrimary();
          await nextPrimary.save();
        }
      }

      logger.info(`🏥 Deactivated relationship: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error deactivating relationship:', error);
      throw new DatabaseError('Failed to deactivate relationship');
    }
  }

  /**
   * Get relationships by client with efficient querying
   */
  static async getRelationshipsByClient(clientId: string) {
    try {
      const relationships = await ClientClinicRelationshipModel.findByClient(clientId);
      
      logger.info(`🏥 Retrieved ${relationships.length} relationships for client: ${clientId}`);
      return relationships;
    } catch (error) {
      logger.error('Error retrieving client relationships:', error);
      throw new DatabaseError('Failed to retrieve client relationships');
    }
  }

  /**
   * Get relationships by clinic with efficient querying
   */
  static async getRelationshipsByClinic(clinicName: string, relationshipType?: string) {
    try {
      const relationships = await ClientClinicRelationshipModel.findByClinic(clinicName, relationshipType);
      
      logger.info(`🏥 Retrieved ${relationships.length} relationships for clinic: ${clinicName}`);
      return relationships;
    } catch (error) {
      logger.error('Error retrieving clinic relationships:', error);
      throw new DatabaseError('Failed to retrieve clinic relationships');
    }
  }

  /**
   * Get primary relationship for client
   */
  static async getPrimaryRelationship(clientId: string) {
    try {
      const primaryRelationship = await ClientClinicRelationshipModel.findPrimaryRelationship(clientId);
      
      if (!primaryRelationship) {
        throw new NotFoundError(`No primary relationship found for client: ${clientId}`);
      }

      logger.info(`🏥 Retrieved primary relationship for client: ${clientId}`);
      return primaryRelationship;
    } catch (error) {
      if (error instanceof NotFoundError) {throw error;}
      logger.error('Error retrieving primary relationship:', error);
      throw new DatabaseError('Failed to retrieve primary relationship');
    }
  }

  /**
   * Update appointment statistics for relationship
   */
  static async updateAppointmentStats(
    clientId: string, 
    clinicName: string, 
    appointmentData: {
      type: 'completed' | 'cancelled' | 'noshow';
      duration?: number;
      amount?: number;
      date: Date;
    }
  ) {
    try {
      const relationship = await ClientClinicRelationshipModel.findOne({
        clientId,
        clinicName,
        isActive: true
      });

      if (!relationship) {
        logger.warn(`No relationship found for client ${clientId} and clinic ${clinicName}`);
        return;
      }

      relationship.updateStats(appointmentData);
      await relationship.save();

      logger.info(`🏥 Updated stats for relationship: client ${clientId}, clinic ${clinicName}`);
    } catch (error) {
      logger.error('Error updating appointment stats:', error);
      throw new DatabaseError('Failed to update appointment stats');
    }
  }

  /**
   * Get relationship statistics with efficient aggregation
   */
  static async getRelationshipStats(clinicName?: string): Promise<RelationshipStats> {
    try {
      const matchStage: any = {};
      if (clinicName) {
        matchStage.clinicName = clinicName;
      }

      // Use efficient aggregation pipeline
      const [statsResult] = await ClientClinicRelationshipModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRelationships: { $sum: 1 },
            activeRelationships: {
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            primaryRelationships: {
              $sum: { $cond: ['$isPrimary', 1, 0] }
            },
            relationshipsByType: {
              $push: '$relationshipType'
            },
            relationshipsByClinic: {
              $push: '$clinicName'
            },
            clientIds: {
              $addToSet: '$clientId'
            },
            recentlyCreated: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            },
            expiringCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$endDate', null] },
                      { $lte: ['$endDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      // Process distribution counts efficiently
      const relationshipsByType = statsResult?.relationshipsByType.reduce((acc: Record<string, number>, type: string) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}) || {};

      const relationshipsByClinic = statsResult?.relationshipsByClinic.reduce((acc: Record<string, number>, clinic: string) => {
        acc[clinic] = (acc[clinic] || 0) + 1;
        return acc;
      }, {}) || {};

      // Calculate multi-clinic clients
      const clientCounts = await ClientClinicRelationshipModel.aggregate([
        { $match: { isActive: true, ...matchStage } },
        {
          $group: {
            _id: '$clientId',
            clinicCount: { $sum: 1 }
          }
        },
        {
          $match: { clinicCount: { $gt: 1 } }
        },
        {
          $count: 'multiClinicClients'
        }
      ]);

      const uniqueClients = statsResult?.clientIds?.length || 0;
      const multiClinicClients = clientCounts[0]?.multiClinicClients || 0;

      const stats: RelationshipStats = {
        totalRelationships: statsResult?.totalRelationships || 0,
        activeRelationships: statsResult?.activeRelationships || 0,
        primaryRelationships: statsResult?.primaryRelationships || 0,
        relationshipsByType,
        relationshipsByClinic,
        averageRelationshipsPerClient: uniqueClients > 0 ? 
          Math.round((statsResult?.totalRelationships || 0) / uniqueClients * 100) / 100 : 0,
        multiClinicClients,
        recentlyCreated: statsResult?.recentlyCreated || 0,
        expiringCount: statsResult?.expiringCount || 0
      };

      logger.info(`📊 Generated relationship stats: ${stats.totalRelationships} total relationships`);
      return stats;
    } catch (error) {
      logger.error('Error generating relationship stats:', error);
      throw new DatabaseError('Failed to generate relationship stats');
    }
  }

  /**
   * Get clinic statistics using efficient aggregation
   */
  static async getClinicStats(clinicName: string) {
    try {
      const stats = await ClientClinicRelationshipModel.getClinicStats(clinicName);
      
      logger.info(`🏥 Retrieved clinic stats for: ${clinicName}`);
      return stats;
    } catch (error) {
      logger.error('Error retrieving clinic stats:', error);
      throw new DatabaseError('Failed to retrieve clinic stats');
    }
  }

  /**
   * Get client distribution across clinics
   */
  static async getClientDistribution() {
    try {
      const distribution = await ClientClinicRelationshipModel.getClientDistribution();
      
      logger.info(`📊 Retrieved client distribution across ${distribution.length} clinics`);
      return distribution;
    } catch (error) {
      logger.error('Error retrieving client distribution:', error);
      throw new DatabaseError('Failed to retrieve client distribution');
    }
  }

  /**
   * Transfer client to different clinic
   */
  static async transferClient(
    clientId: string, 
    fromClinic: string, 
    toClinic: string, 
    transferDate?: Date,
    notes?: string
  ) {
    try {
      // Validate that source relationship exists
      const sourceRelationship = await ClientClinicRelationshipModel.findOne({
        clientId,
        clinicName: fromClinic,
        isActive: true
      });

      if (!sourceRelationship) {
        throw new NotFoundError(
          `No active relationship found between client ${clientId} and clinic ${fromClinic}`
        );
      }

      // Check if target relationship already exists
      const targetExists = await ClientClinicRelationshipModel.findOne({
        clientId,
        clinicName: toClinic,
        isActive: true
      });

      if (targetExists) {
        throw new ConflictError(
          `Client ${clientId} already has an active relationship with clinic ${toClinic}`
        );
      }

      const transferNotes = notes || `Transferred from ${fromClinic}`;
      const effectiveDate = transferDate || new Date();

      // Create new relationship
      const newRelationshipData = {
        clientId,
        clinicName: toClinic,
        relationshipType: sourceRelationship.relationshipType,
        startDate: effectiveDate,
        isPrimary: sourceRelationship.isPrimary,
        permissions: sourceRelationship.permissions,
        details: {
          ...sourceRelationship.details,
          notes: transferNotes,
          referredBy: fromClinic,
          referralDate: effectiveDate,
          referralReason: 'Client transfer'
        }
      };

      const newRelationship = await this.createRelationship(newRelationshipData);

      // Deactivate old relationship
      sourceRelationship.deactivate(`Transferred to ${toClinic}`);
      sourceRelationship.endDate = effectiveDate;
      await sourceRelationship.save();

      logger.info(`🔄 Transferred client ${clientId} from ${fromClinic} to ${toClinic}`);

      return {
        sourceRelationship,
        newRelationship,
        transferDate: effectiveDate
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {throw error;}
      logger.error('Error transferring client:', error);
      throw new DatabaseError('Failed to transfer client');
    }
  }

  /**
   * Bulk operations for relationships
   */
  static async bulkUpdateRelationships(
    relationshipIds: number[],
    updateData: Partial<IClientClinicRelationship>
  ) {
    try {
      // Use Promise.all for parallel processing instead of forEach
      const updatePromises = relationshipIds.map(id => 
        this.updateRelationship(id, updateData)
      );

      const results = await Promise.all(updatePromises);
      
      logger.info(`🏥 Bulk updated ${results.length} relationships`);
      return results;
    } catch (error) {
      logger.error('Error in bulk update relationships:', error);
      throw new DatabaseError('Failed to bulk update relationships');
    }
  }
}
