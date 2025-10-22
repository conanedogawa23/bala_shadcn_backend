import { Types } from 'mongoose';
import PaymentModel, { IPayment } from '../models/Payment';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ClinicService } from './ClinicService';

export class PaymentService {
  /**
   * Get account summary report by clinic
   */
  static async getAccountSummary(
    clinicName: string,
    page = 1,
    limit = 20,
    sortBy = 'clientName'
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    try {
      await ClinicService.getClinicByName(clinicName);

      const skip = (page - 1) * limit;
      const sortField: Record<string, 1 | -1> = sortBy === 'amountDue' ? { amountDue: -1 } : { clientName: 1 };

      const [summary, total] = await Promise.all([
        PaymentModel.aggregate([
          { $match: { clinicName } },
          {
            $group: {
              _id: '$clientId',
              clientName: { $first: '$clientName' },
              totalInvoiced: { $sum: '$amounts.totalPaymentAmount' },
              totalPaid: { $sum: '$amounts.totalPaid' },
              amountDue: { $sum: '$amounts.totalOwed' },
              paymentCount: { $sum: 1 },
              lastPaymentDate: { $max: '$paymentDate' },
              paymentStatus: { $first: '$status' }
            }
          },
          { $sort: sortField },
          { $skip: skip },
          { $limit: limit }
        ]),
        PaymentModel.aggregate([
          { $match: { clinicName } },
          { $group: { _id: '$clientId' } },
          { $count: 'count' }
        ])
      ]);

      logger.info(`Account summary retrieved for clinic: ${clinicName}`);
      return { data: summary, total: total[0]?.count || 0, page, limit };
    } catch (error) {
      logger.error('Error in getAccountSummary:', error);
      throw new DatabaseError('Failed to get account summary', error as Error);
    }
  }

  /**
   * Get payment summary by payment type
   */
  static async getPaymentSummary(
    clinicName: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ paymentTypeSummary: any[]; dailySummary: any[] }> {
    try {
      await ClinicService.getClinicByName(clinicName);

      const matchCriteria: any = { clinicName };

      if (startDate || endDate) {
        matchCriteria.paymentDate = {};
        if (startDate) matchCriteria.paymentDate.$gte = startDate;
        if (endDate) matchCriteria.paymentDate.$lte = endDate;
      }

      const [paymentTypeSummary, dailySummary] = await Promise.all([
        PaymentModel.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: '$paymentType',
              totalAmount: { $sum: '$amounts.totalPaid' },
              paymentCount: { $sum: 1 },
              avgPayment: { $avg: '$amounts.totalPaid' }
            }
          },
          { $sort: { totalAmount: -1 } }
        ]),
        PaymentModel.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' }
              },
              totalAmount: { $sum: '$amounts.totalPaid' },
              paymentCount: { $sum: 1 }
            }
          },
          { $sort: { '_id': 1 } }
        ])
      ]);

      logger.info(`Payment summary retrieved for clinic: ${clinicName}`);
      return { paymentTypeSummary, dailySummary };
    } catch (error) {
      logger.error('Error in getPaymentSummary:', error);
      throw new DatabaseError('Failed to get payment summary', error as Error);
    }
  }

  /**
   * Get complete payment history for a client
   */
  static async getClientPaymentHistory(
    clientId: number,
    page = 1,
    limit = 50,
    sortBy = 'paymentDate'
  ): Promise<{ payments: IPayment[]; stats: any; page: number; limit: number; total: number }> {
    try {
      const skip = (page - 1) * limit;

      const [payments, total, stats] = await Promise.all([
        PaymentModel.find({ clientId })
          .sort({ [sortBy]: -1 })
          .skip(skip)
          .limit(limit)
          .populate('orderId', 'orderNumber status'),
        PaymentModel.countDocuments({ clientId }),
        PaymentModel.aggregate([
          { $match: { clientId } },
          {
            $group: {
              _id: null,
              totalPaid: { $sum: '$amounts.totalPaid' },
              totalOwed: { $sum: '$amounts.totalOwed' },
              paymentCount: { $sum: 1 }
            }
          }
        ])
      ]);

      logger.info(`Payment history retrieved for client: ${clientId}`);
      return {
        payments,
        stats: stats[0] || { totalPaid: 0, totalOwed: 0, paymentCount: 0 },
        page,
        limit,
        total
      };
    } catch (error) {
      logger.error('Error in getClientPaymentHistory:', error);
      throw new DatabaseError('Failed to get client payment history', error as Error);
    }
  }

  /**
   * Get aged accounts receivable report
   */
  static async getAgingReport(clinicName: string): Promise<{ agingByClient: any[]; summary: any }> {
    try {
      await ClinicService.getClinicByName(clinicName);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const [agingByClient, summaryData] = await Promise.all([
        PaymentModel.aggregate([
          {
            $match: {
              clinicName,
              'amounts.totalOwed': { $gt: 0 }
            }
          },
          {
            $group: {
              _id: '$clientId',
              clientName: { $first: '$clientName' },
              currentAmount: {
                $sum: {
                  $cond: [{ $gte: ['$paymentDate', thirtyDaysAgo] }, '$amounts.totalOwed', 0]
                }
              },
              thirtyPlusDays: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$paymentDate', sixtyDaysAgo] },
                        { $lt: ['$paymentDate', thirtyDaysAgo] }
                      ]
                    },
                    '$amounts.totalOwed',
                    0
                  ]
                }
              },
              sixtyPlusDays: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$paymentDate', ninetyDaysAgo] },
                        { $lt: ['$paymentDate', sixtyDaysAgo] }
                      ]
                    },
                    '$amounts.totalOwed',
                    0
                  ]
                }
              },
              overNinetyDays: {
                $sum: {
                  $cond: [{ $lt: ['$paymentDate', ninetyDaysAgo] }, '$amounts.totalOwed', 0]
                }
              },
              totalOwed: { $sum: '$amounts.totalOwed' }
            }
          },
          { $sort: { totalOwed: -1 } }
        ]),
        PaymentModel.aggregate([
          {
            $match: {
              clinicName,
              'amounts.totalOwed': { $gt: 0 }
            }
          },
          {
            $group: {
              _id: null,
              currentTotal: {
                $sum: {
                  $cond: [{ $gte: ['$paymentDate', thirtyDaysAgo] }, '$amounts.totalOwed', 0]
                }
              },
              thirtyPlusTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$paymentDate', sixtyDaysAgo] },
                        { $lt: ['$paymentDate', thirtyDaysAgo] }
                      ]
                    },
                    '$amounts.totalOwed',
                    0
                  ]
                }
              },
              sixtyPlusTotal: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$paymentDate', ninetyDaysAgo] },
                        { $lt: ['$paymentDate', sixtyDaysAgo] }
                      ]
                    },
                    '$amounts.totalOwed',
                    0
                  ]
                }
              },
              overNinetyDaysTotal: {
                $sum: {
                  $cond: [{ $lt: ['$paymentDate', ninetyDaysAgo] }, '$amounts.totalOwed', 0]
                }
              },
              totalOutstanding: { $sum: '$amounts.totalOwed' }
            }
          }
        ])
      ]);

      const summary = summaryData[0] || {
        currentTotal: 0,
        thirtyPlusTotal: 0,
        sixtyPlusTotal: 0,
        overNinetyDaysTotal: 0,
        totalOutstanding: 0
      };

      logger.info(`Aging report generated for clinic: ${clinicName}`);
      return { agingByClient, summary };
    } catch (error) {
      logger.error('Error in getAgingReport:', error);
      throw new DatabaseError('Failed to get aging report', error as Error);
    }
  }

  /**
   * Mark payment as disputed
   */
  static async disputePayment(
    paymentId: string,
    reason: string,
    resolutionNotes: string
  ): Promise<IPayment> {
    try {
      // First fetch the existing payment
      const existingPayment = await PaymentModel.findById(paymentId);
      if (!existingPayment) {
        throw new NotFoundError(`Payment with ID ${paymentId} not found`);
      }

      // Update with existing notes
      const payment = await PaymentModel.findByIdAndUpdate(
        paymentId,
        {
          status: 'failed',
          notes: `${existingPayment.notes || ''} | DISPUTED: ${reason} | Resolution: ${resolutionNotes}`
        },
        { new: true }
      );

      if (!payment) {
        throw new NotFoundError(`Payment update failed for ID ${paymentId}`);
      }

      logger.info(`Payment disputed: ${paymentId}`);
      return payment;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error in disputePayment:', error);
      throw new DatabaseError('Failed to dispute payment', error as Error);
    }
  }
}
