import { AdvancedBillingModel, IAdvancedBilling, BillingStatus } from '../models/AdvancedBilling';
import { ClientModel } from '../models/Client';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class AdvancedBillingService {
  /**
   * Get all advanced billings with filtering and pagination
   */
  static async getAllBillings(filters: {
    clientId?: string;
    clinicName?: string;
    status?: BillingStatus;
    isActive?: boolean;
    isOverdue?: boolean;
    productKey?: number;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    billings: IAdvancedBilling[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, limit = 50, startDate, endDate, ...filterParams } = filters;
      const skip = (page - 1) * limit;
      
      // Build query using reduce for optimal performance
      const query = Object.entries(filterParams).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'clinicName') {
            acc.clinicName = new RegExp(value as string, 'i');
          } else {
            acc[key] = value;
          }
        }
        return acc;
      }, {} as any);
      
      // Add date range filtering
      if (startDate && endDate) {
        query.$or = [
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } },
          { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
        ];
      } else if (startDate) {
        query.startDate = { $gte: startDate };
      } else if (endDate) {
        query.endDate = { $lte: endDate };
      }
      
      const [billings, total] = await Promise.all([
        AdvancedBillingModel.find(query)
          .sort({ billDate: 1, startDate: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AdvancedBillingModel.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      logger.info(`Retrieved ${billings.length} advanced billings (page ${page}/${totalPages})`);
      
      return {
        billings,
        total,
        page,
        totalPages
      };
    } catch (error) {
      logger.error('Error getting advanced billings:', error);
      throw new AppError('Failed to retrieve advanced billings', 500);
    }
  }

  /**
   * Get billing by ID
   */
  static async getBillingById(id: string): Promise<IAdvancedBilling | null> {
    try {
      const billing = await AdvancedBillingModel.findById(id).lean();
      
      if (!billing) {
        logger.warn(`Advanced billing not found: ${id}`);
        return null;
      }
      
      logger.info(`Retrieved advanced billing: ${billing.billingId}`);
      return billing;
    } catch (error) {
      logger.error(`Error getting advanced billing ${id}:`, error);
      throw new AppError('Failed to retrieve advanced billing', 500);
    }
  }

  /**
   * Get billing by billing ID (MSSQL key)
   */
  static async getBillingByBillingId(billingId: number): Promise<IAdvancedBilling | null> {
    try {
      const billing = await AdvancedBillingModel.findOne({ billingId }).lean();
      
      if (!billing) {
        logger.warn(`Advanced billing not found for billingId: ${billingId}`);
        return null;
      }
      
      logger.info(`Retrieved advanced billing by billingId: ${billing.billingId}`);
      return billing;
    } catch (error) {
      logger.error(`Error getting advanced billing by billingId ${billingId}:`, error);
      throw new AppError('Failed to retrieve advanced billing', 500);
    }
  }

  /**
   * Get active billings
   */
  static async getActiveBillings(): Promise<IAdvancedBilling[]> {
    try {
      const billings = await AdvancedBillingModel.getActiveBillings().lean();
      
      logger.info(`Retrieved ${billings.length} active billings`);
      return billings;
    } catch (error) {
      logger.error('Error getting active billings:', error);
      throw new AppError('Failed to retrieve active billings', 500);
    }
  }

  /**
   * Get billings by client
   */
  static async getBillingsByClient(clientId: string): Promise<IAdvancedBilling[]> {
    try {
      // Get client to obtain clientKey (advancedbillings uses clientKey, not clientId string)
      const client = await ClientModel.findOne({ clientId });
      if (!client) {
        logger.warn(`Client ${clientId} not found when retrieving billings`);
        return [];
      }

      // Use clientKey for querying advancedbillings (which stores it as clientId number)
      const clientKey = client.clientKey || Number(clientId);
      const billings = await AdvancedBillingModel.getBillingsByClient(clientKey).lean();
      
      logger.info(`Retrieved ${billings.length} billings for client: ${clientId} (clientKey: ${clientKey})`);
      return billings;
    } catch (error) {
      logger.error(`Error getting billings for client ${clientId}:`, error);
      throw new AppError('Failed to retrieve client billings', 500);
    }
  }

  /**
   * Get billings by clinic
   */
  static async getBillingsByClinic(clinicName: string): Promise<IAdvancedBilling[]> {
    try {
      const billings = await AdvancedBillingModel.getBillingsByClinic(clinicName).lean();
      
      logger.info(`Retrieved ${billings.length} billings for clinic: ${clinicName}`);
      return billings;
    } catch (error) {
      logger.error(`Error getting billings for clinic ${clinicName}:`, error);
      throw new AppError('Failed to retrieve clinic billings', 500);
    }
  }

  /**
   * Get overdue billings
   */
  static async getOverdueBillings(): Promise<IAdvancedBilling[]> {
    try {
      const billings = await AdvancedBillingModel.getOverdueBillings().lean();
      
      logger.info(`Retrieved ${billings.length} overdue billings`);
      return billings;
    } catch (error) {
      logger.error('Error getting overdue billings:', error);
      throw new AppError('Failed to retrieve overdue billings', 500);
    }
  }

  /**
   * Get upcoming billings
   */
  static async getUpcomingBillings(days = 30): Promise<IAdvancedBilling[]> {
    try {
      const billings = await AdvancedBillingModel.getUpcomingBillings(days).lean();
      
      logger.info(`Retrieved ${billings.length} upcoming billings (next ${days} days)`);
      return billings;
    } catch (error) {
      logger.error(`Error getting upcoming billings for ${days} days:`, error);
      throw new AppError('Failed to retrieve upcoming billings', 500);
    }
  }

  /**
   * Get billings expiring soon
   */
  static async getBillingsExpiringSoon(days = 7): Promise<IAdvancedBilling[]> {
    try {
      const billings = await AdvancedBillingModel.getBillingsExpiringSoon(days).lean();
      
      logger.info(`Retrieved ${billings.length} billings expiring in ${days} days`);
      return billings;
    } catch (error) {
      logger.error(`Error getting billings expiring in ${days} days:`, error);
      throw new AppError('Failed to retrieve expiring billings', 500);
    }
  }

  /**
   * Create new billing
   */
  static async createBilling(billingData: Partial<IAdvancedBilling>): Promise<IAdvancedBilling> {
    try {
      // Check if billing ID already exists
      if (billingData.billingId) {
        const existing = await AdvancedBillingModel.findOne({ 
          billingId: billingData.billingId 
        });
        
        if (existing) {
          throw new AppError(`Advanced billing with ID ${billingData.billingId} already exists`, 409);
        }
      }
      
      const billing = new AdvancedBillingModel(billingData);
      await billing.save();
      
      logger.info(`Created advanced billing: ${billing.billingId} for client ${billing.clientId}`);
      return billing.toObject();
    } catch (error) {
      if (error instanceof AppError) {throw error;}
      
      logger.error('Error creating advanced billing:', error);
      throw new AppError('Failed to create advanced billing', 500);
    }
  }

  /**
   * Update billing
   */
  static async updateBilling(id: string, updateData: Partial<IAdvancedBilling>): Promise<IAdvancedBilling | null> {
    try {
      // Don't allow updating the unique billingId
      delete updateData.billingId;
      
      const billing = await AdvancedBillingModel.findByIdAndUpdate(
        id,
        { ...updateData, dateModified: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!billing) {
        logger.warn(`Advanced billing not found for update: ${id}`);
        return null;
      }
      
      logger.info(`Updated advanced billing: ${billing.billingId}`);
      return billing.toObject();
    } catch (error) {
      logger.error(`Error updating advanced billing ${id}:`, error);
      throw new AppError('Failed to update advanced billing', 500);
    }
  }

  /**
   * Update billing status
   */
  static async updateBillingStatus(id: string, status: BillingStatus): Promise<IAdvancedBilling | null> {
    try {
      const billing = await AdvancedBillingModel.findById(id);
      
      if (!billing) {
        logger.warn(`Advanced billing not found for status update: ${id}`);
        return null;
      }
      
      // Use appropriate method based on status
      switch (status) {
      case BillingStatus.ACTIVE:
        await billing.activate();
        break;
      case BillingStatus.INACTIVE:
        await billing.deactivate();
        break;
      case BillingStatus.CANCELLED:
        await billing.cancel();
        break;
      case BillingStatus.COMPLETED:
        await billing.complete();
        break;
      case BillingStatus.SUSPENDED:
        await billing.suspend();
        break;
      default:
        billing.status = status;
        await billing.save();
      }
      
      logger.info(`Updated billing status: ${billing.billingId} -> ${status}`);
      return billing.toObject();
    } catch (error) {
      logger.error(`Error updating billing status ${id}:`, error);
      throw new AppError('Failed to update billing status', 500);
    }
  }

  /**
   * Delete billing
   */
  static async deleteBilling(id: string): Promise<boolean> {
    try {
      const result = await AdvancedBillingModel.findByIdAndDelete(id);
      
      if (!result) {
        logger.warn(`Advanced billing not found for deletion: ${id}`);
        return false;
      }
      
      logger.info(`Deleted advanced billing: ${result.billingId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting advanced billing ${id}:`, error);
      throw new AppError('Failed to delete advanced billing', 500);
    }
  }

  /**
   * Get billing statistics
   */
  static async getBillingStats(): Promise<{
    totalBillings: number;
    activeBillings: number;
    overdueBillings: number;
    upcomingBillings: number;
    totalRevenue: number;
    topClients: Array<{ clientId: string; billingCount: number; totalCycles: number }>;
    topClinics: Array<{ clinic: string; billingCount: number }>;
    statusDistribution: Array<{ status: string; count: number }>;
  }> {
    try {
      const [
        totalBillings,
        activeBillings,
        overdueBillings,
        upcomingBillings,
        clientStats,
        clinicStats,
        statusStats
      ] = await Promise.all([
        AdvancedBillingModel.countDocuments(),
        AdvancedBillingModel.countDocuments({ isActive: true, status: BillingStatus.ACTIVE }),
        AdvancedBillingModel.countDocuments({ isOverdue: true }),
        AdvancedBillingModel.countDocuments({ 
          isActive: true,
          billDate: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        }),
        AdvancedBillingModel.aggregate([
          { $group: { 
            _id: '$clientId', 
            billingCount: { $sum: 1 },
            totalCycles: { $sum: '$billingCycleDays' }
          } },
          { $sort: { billingCount: -1 } },
          { $limit: 10 }
        ]),
        AdvancedBillingModel.aggregate([
          { $group: { _id: '$clinicName', billingCount: { $sum: 1 } } },
          { $sort: { billingCount: -1 } },
          { $limit: 10 }
        ]),
        AdvancedBillingModel.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      ]);
      
      const topClients = clientStats.map(stat => ({
        clientId: stat._id,
        billingCount: stat.billingCount,
        totalCycles: stat.totalCycles || 0
      }));
      
      const topClinics = clinicStats.map(stat => ({
        clinic: stat._id,
        billingCount: stat.billingCount
      }));
      
      const statusDistribution = statusStats.map(stat => ({
        status: stat._id,
        count: stat.count
      }));
      
      const stats = {
        totalBillings,
        activeBillings,
        overdueBillings,
        upcomingBillings,
        totalRevenue: activeBillings * 100, // Placeholder calculation
        topClients,
        topClinics,
        statusDistribution
      };
      
      logger.info('Retrieved advanced billing statistics');
      return stats;
    } catch (error) {
      logger.error('Error getting advanced billing statistics:', error);
      throw new AppError('Failed to retrieve billing statistics', 500);
    }
  }

  /**
   * Bulk update bill dates
   */
  static async bulkUpdateBillDates(updates: Array<{ billingId: number; billDate: Date }>): Promise<void> {
    try {
      await AdvancedBillingModel.bulkUpdateBillDates(updates);
      
      logger.info(`Bulk updated ${updates.length} billing dates`);
    } catch (error) {
      logger.error('Error bulk updating bill dates:', error);
      throw new AppError('Failed to bulk update bill dates', 500);
    }
  }

  /**
   * Get billing summary for dashboard
   */
  static async getBillingSummary(): Promise<{
    overview: {
      total: number;
      active: number;
      overdue: number;
      upcoming: number;
    };
    recentActivity: IAdvancedBilling[];
    criticalAlerts: {
      overdueBillings: IAdvancedBilling[];
      expiringSoon: IAdvancedBilling[];
    };
  }> {
    try {
      const [
        totalCount,
        activeCount,
        overdueCount,
        upcomingCount,
        recentActivity,
        overdueBillings,
        expiringSoon
      ] = await Promise.all([
        AdvancedBillingModel.countDocuments(),
        AdvancedBillingModel.countDocuments({ isActive: true, status: BillingStatus.ACTIVE }),
        AdvancedBillingModel.countDocuments({ isOverdue: true }),
        AdvancedBillingModel.countDocuments({ 
          isActive: true,
          billDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
        }),
        AdvancedBillingModel.find()
          .sort({ dateModified: -1 })
          .limit(5)
          .lean(),
        AdvancedBillingModel.getOverdueBillings().limit(5).lean(),
        AdvancedBillingModel.getBillingsExpiringSoon(7).limit(5).lean()
      ]);
      
      return {
        overview: {
          total: totalCount,
          active: activeCount,
          overdue: overdueCount,
          upcoming: upcomingCount
        },
        recentActivity,
        criticalAlerts: {
          overdueBillings,
          expiringSoon
        }
      };
    } catch (error) {
      logger.error('Error getting billing summary:', error);
      throw new AppError('Failed to retrieve billing summary', 500);
    }
  }
}
