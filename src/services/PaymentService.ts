import { Types } from 'mongoose';
import PaymentModel, { IPayment } from '../models/Payment';
import PaymentMethodModel from '../models/PaymentMethod';
import PaymentTypeModel from '../models/PaymentType';
import PaymentDeletedModel from '../models/PaymentDeleted';
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

  /**
   * Get all payment methods (lookup)
   */
  static async getAllPaymentMethods() {
    try {
      return await PaymentMethodModel.getAllMethods();
    } catch (error) {
      logger.error('Failed to retrieve payment methods:', error);
      throw new DatabaseError('Failed to retrieve payment methods');
    }
  }

  /**
   * Get all payment types (lookup)
   */
  static async getAllPaymentTypes() {
    try {
      return await PaymentTypeModel.getAllTypes();
    } catch (error) {
      logger.error('Failed to retrieve payment types:', error);
      throw new DatabaseError('Failed to retrieve payment types');
    }
  }

  /**
   * Find payment method by name
   */
  static async findPaymentMethodByName(name: string) {
    try {
      return await PaymentMethodModel.findByName(name);
    } catch (error) {
      logger.error(`Failed to find payment method: ${name}`, error);
      throw new DatabaseError(`Failed to find payment method: ${name}`);
    }
  }

  /**
   * Find payment type by name
   */
  static async findPaymentTypeByName(name: string) {
    try {
      return await PaymentTypeModel.findByName(name);
    } catch (error) {
      logger.error(`Failed to find payment type: ${name}`, error);
      throw new DatabaseError(`Failed to find payment type: ${name}`);
    }
  }

  /**
   * Archive deleted payment record
   */
  static async archivePayment(paymentId: Types.ObjectId, reason: string, userId: Types.ObjectId) {
    try {
      const payment = await PaymentModel.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      const archivedPayment = await PaymentDeletedModel.create({
        sb_payment_history_key: payment._id as any,
        sb_client_id: payment.clientId,
        sb_order_number: payment.orderNumber,
        sb_payment_number: payment.paymentNumber,
        sb_payment_date: payment.paymentDate,
        sb_payment_total_payment_amount: payment.amounts.totalPaymentAmount,
        sb_payment_total_paid: payment.amounts.totalPaid,
        sb_payment_total_owed: payment.amounts.totalOwed,
        sb_payment_POP_amount: payment.amounts.popAmount,
        sb_payment_POPFP_amount: payment.amounts.popfpAmount,
        sb_payment_DPA_amount: payment.amounts.dpaAmount,
        sb_payment_DPAFP_amount: payment.amounts.dpafpAmount,
        sb_payment_WRITEOFF_amount: payment.amounts.writeoffAmount,
        sb_payment_COB_1_amount: payment.amounts.cob1Amount,
        sb_payment_COB_2_amount: payment.amounts.cob2Amount,
        sb_payment_COB_3_amount: payment.amounts.cob3Amount,
        sb_payment_1st_insurance_cheque_amount: payment.amounts.insurance1stAmount,
        sb_payment_2nd_insurance_cheque_amount: payment.amounts.insurance2ndAmount,
        sb_payment_3rd_insurance_cheque_amount: payment.amounts.insurance3rdAmount,
        sb_payment_refund_amount: payment.amounts.refundAmount,
        sb_payment_SALESREFUND_amount: payment.amounts.salesRefundAmount,
        sb_payment_method: payment.paymentMethod,
        sb_payment_type: payment.paymentType,
        sb_payment_status: payment.status,
        sb_payment_referring_no: payment.referringNo,
        sb_payment_note: payment.notes,
        sb_clinic_name: payment.clinicName,
        sb_date_created: payment.createdAt,
        UserLoginName: payment.userLoginName,
        BadDebtAmount: payment.amounts.badDebtAmount,
        archivedReason: reason,
        archivedBy: userId,
        originalPaymentId: paymentId
      });

      logger.info(`Payment ${paymentId} archived: ${reason}`);
      return archivedPayment;
    } catch (error) {
      logger.error('Failed to archive payment:', error);
      throw new DatabaseError('Failed to archive payment');
    }
  }

  /**
   * Get archived payments by client
   */
  static async getArchivedPaymentsByClient(clientId: number) {
    try {
      return await PaymentDeletedModel.findByClient(clientId);
    } catch (error) {
      logger.error(`Failed to retrieve archived payments for client ${clientId}:`, error);
      throw new DatabaseError('Failed to retrieve archived payments');
    }
  }

  /**
   * Get archived payments by clinic
   */
  static async getArchivedPaymentsByClinic(clinicName: string) {
    try {
      return await PaymentDeletedModel.findByClinic(clinicName);
    } catch (error) {
      logger.error(`Failed to retrieve archived payments for clinic ${clinicName}:`, error);
      throw new DatabaseError('Failed to retrieve archived payments');
    }
  }

  /**
   * Restore archived payment
   */
  static async restoreArchivedPayment(archiveId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      const restored = await PaymentDeletedModel.restore(archiveId, userId);
      if (!restored) {
        throw new NotFoundError('Archived payment not found');
      }

      logger.info(`Archived payment ${archiveId} restored by user ${userId}`);
      return restored;
    } catch (error) {
      logger.error('Failed to restore archived payment:', error);
      throw new DatabaseError('Failed to restore archived payment');
    }
  }

  /**
   * Get payment summary statistics by payment type
   */
  static async getPaymentTypeStats(clinicName?: string, startDate?: Date, endDate?: Date) {
    try {
      const match: any = {};
      if (clinicName) {
        // Use case-insensitive exact match to prevent substring matches
        match.clinicName = new RegExp(`^${clinicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }
      if (startDate || endDate) {
        match.paymentDate = {};
        if (startDate) match.paymentDate.$gte = startDate;
        if (endDate) match.paymentDate.$lte = endDate;
      }

      return await PaymentModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentType',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amounts.totalPaid' },
            avgAmount: { $avg: '$amounts.totalPaid' },
            minAmount: { $min: '$amounts.totalPaid' },
            maxAmount: { $max: '$amounts.totalPaid' }
          }
        },
        { $sort: { totalAmount: -1 } }
      ]);
    } catch (error) {
      logger.error('Failed to retrieve payment type statistics:', error);
      throw new DatabaseError('Failed to retrieve payment type statistics');
    }
  }

  /**
   * Get outstanding/unpaid amounts by clinic
   */
  static async getOutstandingAmountsByClinic(clinicName: string) {
    try {
      const result = await PaymentModel.aggregate([
        { $match: { clinicName } },
        {
          $group: {
            _id: null,
            totalOutstanding: { $sum: '$amounts.totalOwed' },
            paymentCount: { $sum: 1 },
            avgOutstanding: { $avg: '$amounts.totalOwed' },
            clientsWithOutstanding: { $sum: { $cond: [{ $gt: ['$amounts.totalOwed', 0] }, 1, 0] } }
          }
        }
      ]);

      return result[0] || { totalOutstanding: 0, paymentCount: 0, avgOutstanding: 0, clientsWithOutstanding: 0 };
    } catch (error) {
      logger.error(`Failed to retrieve outstanding amounts for clinic ${clinicName}:`, error);
      throw new DatabaseError('Failed to retrieve outstanding amounts');
    }
  }

  /**
   * Get payment reconciliation report
   */
  static async getPaymentReconciliation(clinicName: string, startDate: Date, endDate: Date) {
    try {
      const result = await PaymentModel.aggregate([
        {
          $match: {
            clinicName,
            paymentDate: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              paymentMethod: '$paymentMethod',
              paymentType: '$paymentType',
              status: '$status'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amounts.totalPaymentAmount' },
            totalPaid: { $sum: '$amounts.totalPaid' },
            totalOwed: { $sum: '$amounts.totalOwed' }
          }
        },
        {
          $sort: { '_id.paymentMethod': 1, '_id.paymentType': 1 }
        }
      ]);

      return result;
    } catch (error) {
      logger.error('Failed to retrieve payment reconciliation report:', error);
      throw new DatabaseError('Failed to retrieve payment reconciliation report');
    }
  }
}
