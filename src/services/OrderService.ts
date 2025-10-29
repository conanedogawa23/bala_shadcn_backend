import Order, { IOrder, OrderStatus, PaymentStatus } from '../models/Order';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ClinicService } from './ClinicService';

export class OrderService {
  /**
   * Get order status report
   */
  static async getOrderStatusReport(
    clinicName: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ statusDistribution: any[]; paymentDistribution: any[] }> {
    try {
      await ClinicService.getClinicByName(clinicName);

      const matchCriteria: any = { clinicName };

      if (startDate || endDate) {
        matchCriteria.serviceDate = {};
        if (startDate) matchCriteria.serviceDate.$gte = startDate;
        if (endDate) matchCriteria.serviceDate.$lte = endDate;
      }

      const [statusReport, paymentReport] = await Promise.all([
        Order.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              avgAmount: { $avg: '$totalAmount' }
            }
          }
        ]),
        Order.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: '$paymentStatus',
              count: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' }
            }
          }
        ])
      ]);

      logger.info(`Order status report generated for clinic: ${clinicName}`);
      return { statusDistribution: statusReport, paymentDistribution: paymentReport };
    } catch (error) {
      logger.error('Error in getOrderStatusReport:', error);
      throw new DatabaseError('Failed to get order status report', error as Error);
    }
  }

  /**
   * Get orders by client with advanced details
   */
  static async getClientOrderDetails(
    clientId: number,
    page = 1,
    limit = 50,
    status?: string,
    paymentStatus?: string
  ): Promise<{ orders: IOrder[]; statistics: any; page: number; limit: number; total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      // Use defensive $or query to handle both string and numeric clientId types in MongoDB
      const clientIdQuery = {
        $or: [
          { clientId: clientId },
          { clientId: String(clientId) }
        ]
      };
      
      const filter: any = { ...clientIdQuery };

      if (status) filter.status = status;
      if (paymentStatus) filter.paymentStatus = paymentStatus;

      const [orders, total, stats] = await Promise.all([
        Order.find(filter)
          .sort({ serviceDate: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(filter),
        Order.aggregate([
          { $match: clientIdQuery },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              avgOrderValue: { $avg: '$totalAmount' },
              completedOrders: {
                $sum: { $cond: [{ $eq: ['$status', OrderStatus.COMPLETED] }, 1, 0] }
              },
              pendingOrders: {
                $sum: { $cond: [{ $eq: ['$status', OrderStatus.SCHEDULED] }, 1, 0] }
              },
              paidOrders: {
                $sum: { $cond: [{ $eq: ['$paymentStatus', PaymentStatus.PAID] }, 1, 0] }
              },
              outstandingAmount: {
                $sum: {
                  $cond: [{ $ne: ['$paymentStatus', PaymentStatus.PAID] }, '$totalAmount', 0]
                }
              }
            }
          }
        ])
      ]);

      logger.info(`Client order details retrieved for client: ${clientId}`);
      return {
        orders,
        statistics: stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          completedOrders: 0,
          pendingOrders: 0,
          paidOrders: 0,
          outstandingAmount: 0
        },
        page,
        limit,
        total
      };
    } catch (error) {
      logger.error('Error in getClientOrderDetails:', error);
      throw new DatabaseError('Failed to get client order details', error as Error);
    }
  }

  /**
   * Bulk mark orders as ready for billing
   */
  static async bulkMarkReadyForBilling(orderIds: string[]): Promise<{ modifiedCount: number; matchedCount: number }> {
    try {
      const result = await Order.updateMany(
        { _id: { $in: orderIds } },
        { readyToBill: true, updatedAt: new Date() }
      );

      logger.info(`${result.modifiedCount} orders marked ready for billing`);
      return { modifiedCount: result.modifiedCount, matchedCount: result.matchedCount };
    } catch (error) {
      logger.error('Error in bulkMarkReadyForBilling:', error);
      throw new DatabaseError('Failed to bulk mark orders for billing', error as Error);
    }
  }

  /**
   * Get orders pending refund
   */
  static async getOrdersPendingRefund(
    clinicName?: string,
    page = 1,
    limit = 20
  ): Promise<{ orders: IOrder[]; page: number; limit: number; total: number }> {
    try {
      if (clinicName) {
        await ClinicService.getClinicByName(clinicName);
      }

      const skip = (page - 1) * limit;
      
      const filter: any = {
        paymentStatus: { $in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIAL] }
      };
      
      if (clinicName) {
        filter.clinicName = clinicName;
      }

      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort({ serviceDate: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(filter)
      ]);

      logger.info(`Orders pending refund retrieved${clinicName ? ` for clinic: ${clinicName}` : ''}`);
      return { orders, page, limit, total };
    } catch (error) {
      logger.error('Error in getOrdersPendingRefund:', error);
      throw new DatabaseError('Failed to get orders pending refund', error as Error);
    }
  }

  /**
   * Get product service history
   */
  static async getProductServiceHistory(
    productKey: number,
    clinicName?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const matchCriteria: any = { 'items.productKey': productKey };

      if (clinicName) {
        await ClinicService.getClinicByName(clinicName);
        matchCriteria.clinicName = clinicName;
      }

      if (startDate || endDate) {
        matchCriteria.serviceDate = {};
        if (startDate) matchCriteria.serviceDate.$gte = startDate;
        if (endDate) matchCriteria.serviceDate.$lte = endDate;
      }

      const history = await Order.aggregate([
        { $match: matchCriteria },
        { $unwind: '$items' },
        { $match: { 'items.productKey': productKey } },
        {
          $project: {
            _id: 1,
            orderNumber: 1,
            clientId: 1,
            clientName: 1,
            clinicName: 1,
            serviceDate: 1,
            itemDetails: '$items',
            totalAmount: 1,
            status: 1
          }
        },
        { $sort: { serviceDate: -1 } }
      ]);

      logger.info(`Product service history retrieved for product: ${productKey}`);
      return history;
    } catch (error) {
      logger.error('Error in getProductServiceHistory:', error);
      throw new DatabaseError('Failed to get product service history', error as Error);
    }
  }

  /**
   * Export orders report
   */
  static async exportOrdersReport(
    clinicName?: string,
    startDate?: Date,
    endDate?: Date,
    format = 'json',
    limit = 1000
  ): Promise<any> {
    try {
      if (clinicName) {
        await ClinicService.getClinicByName(clinicName);
      }

      const matchCriteria: any = {};
      
      if (clinicName) {
        matchCriteria.clinicName = clinicName;
      }

      if (startDate || endDate) {
        matchCriteria.serviceDate = {};
        if (startDate) matchCriteria.serviceDate.$gte = startDate;
        if (endDate) matchCriteria.serviceDate.$lte = endDate;
      }

      const orders = await Order.find(matchCriteria)
        .sort({ serviceDate: -1 })
        .limit(limit)
        .lean();

      if (format === 'csv') {
        return this.convertOrdersToCsv(orders);
      }

      logger.info(`Orders exported${clinicName ? ` for clinic: ${clinicName}` : ''}`);
      return orders;
    } catch (error) {
      logger.error('Error in exportOrdersReport:', error);
      throw new DatabaseError('Failed to export orders report', error as Error);
    }
  }

  /**
   * Helper: Convert orders to CSV
   */
  private static convertOrdersToCsv(orders: any[]): string {
    const headers = [
      'Order Number',
      'Client Name',
      'Service Date',
      'Status',
      'Payment Status',
      'Total Amount',
      'Items'
    ];

    const rows = orders.map(order => [
      order.orderNumber,
      order.clientName,
      new Date(order.serviceDate).toLocaleDateString(),
      order.status,
      order.paymentStatus,
      order.totalAmount,
      order.items.map((item: any) => `${item.productName} x${item.quantity}`).join('; ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Get revenue analytics
   */
  static async getRevenueAnalytics(
    clinicName: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ analytics: any[]; summary: any }> {
    try {
      await ClinicService.getClinicByName(clinicName);

      const start = startDate || new Date('2018-01-01');
      const end = endDate || new Date('2025-12-31');

      const matchCriteria: any = {
        clinicName,
        monthlyAggregate: { $ne: true },
        status: { $ne: OrderStatus.CANCELLED }
      };

      const [analytics, summary] = await Promise.all([
        Order.aggregate([
          { $match: matchCriteria },
          {
            $addFields: {
              serviceDateConverted: {
                $dateFromString: {
                  dateString: '$serviceDate',
                  onError: null
                }
              }
            }
          },
          { $match: { serviceDateConverted: { $ne: null } } },
          {
            $group: {
              _id: {
                year: { $year: '$serviceDateConverted' },
                month: { $month: '$serviceDateConverted' }
              },
              totalRevenue: { $sum: '$totalAmount' },
              orderCount: { $sum: 1 },
              avgOrderValue: { $avg: '$totalAmount' },
              completedOrders: {
                $sum: { $cond: [{ $eq: ['$status', OrderStatus.COMPLETED] }, 1, 0] }
              },
              paidOrders: {
                $sum: { $cond: [{ $eq: ['$paymentStatus', PaymentStatus.PAID] }, 1, 0] }
              }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]),
        Order.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalAmount' },
              totalOrders: { $sum: 1 },
              avgOrderValue: { $avg: '$totalAmount' },
              maxOrderValue: { $max: '$totalAmount' },
              minOrderValue: { $min: '$totalAmount' },
              uniqueClients: { $addToSet: '$clientId' }
            }
          },
          {
            $addFields: {
              uniqueClientCount: { $size: '$uniqueClients' }
            }
          },
          { $project: { uniqueClients: 0 } }
        ])
      ]);

      logger.info(`Revenue analytics generated for clinic: ${clinicName}`);
      return {
        analytics,
        summary: summary[0] || {
          totalRevenue: 0,
          totalOrders: 0,
          avgOrderValue: 0,
          maxOrderValue: 0,
          minOrderValue: 0,
          uniqueClientCount: 0
        }
      };
    } catch (error) {
      logger.error('Error in getRevenueAnalytics:', error);
      throw new DatabaseError('Failed to get revenue analytics', error as Error);
    }
  }

  /**
   * Get product performance analytics
   */
  static async getProductPerformance(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ performance: any[]; summary: any }> {
    try {
      const start = startDate || new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const [performance, productSummary] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              serviceDate: { $gte: start, $lte: end },
              status: { $ne: OrderStatus.CANCELLED }
            }
          },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.productKey',
              productName: { $first: '$items.productName' },
              totalOrders: { $sum: 1 },
              totalQuantity: { $sum: '$items.quantity' },
              totalRevenue: { $sum: '$items.subtotal' },
              avgPrice: { $avg: '$items.unitPrice' },
              uniqueClients: { $addToSet: '$clientId' }
            }
          },
          {
            $addFields: {
              uniqueClientCount: { $size: '$uniqueClients' }
            }
          },
          { $project: { uniqueClients: 0 } },
          { $sort: { totalRevenue: -1 } }
        ]),
        Order.aggregate([
          {
            $match: {
              serviceDate: { $gte: start, $lte: end },
              status: { $ne: OrderStatus.CANCELLED }
            }
          },
          { $unwind: '$items' },
          {
            $group: {
              _id: null,
              totalProducts: { $addToSet: '$items.productKey' },
              totalRevenue: { $sum: '$items.subtotal' },
              totalOrders: { $sum: 1 }
            }
          },
          {
            $addFields: {
              uniqueProductCount: { $size: '$totalProducts' }
            }
          },
          { $project: { totalProducts: 0 } }
        ])
      ]);

      logger.info('Product performance analytics generated');
      return {
        performance,
        summary: productSummary[0] || {
          uniqueProductCount: 0,
          totalRevenue: 0,
          totalOrders: 0
        }
      };
    } catch (error) {
      logger.error('Error in getProductPerformance:', error);
      throw new DatabaseError('Failed to get product performance', error as Error);
    }
  }
}
