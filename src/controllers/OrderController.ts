import { Request, Response } from 'express';
import Order, { IOrder, OrderStatus, PaymentStatus } from '../models/Order';
import Product from '../models/Product';
import { ClinicService } from '../services/ClinicService';

interface OrderQuery {
  page?: string;
  limit?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  clinicName?: string;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  readyToBill?: string;
}

interface OrderResponse {
  success: boolean;
  data?: IOrder | IOrder[] | any;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class OrderController {

  /**
   * Get all orders with filtering and pagination
   */
  static async getAllOrders(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        paymentStatus,
        clinicName,
        clientId,
        startDate,
        endDate,
        search,
        readyToBill
      } = req.query as OrderQuery;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
      const filter: any = {};

      if (status) {
        filter.status = status;
      }

      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      if (clinicName) {
        // Convert slug to proper clinic name if needed
        let actualClinicName: string = clinicName;
        try {
          actualClinicName = ClinicService.slugToClinicName(clinicName);
        } catch (conversionError) {
          // If conversion fails, assume it's already a proper clinic name
          actualClinicName = clinicName;
        }
        filter.clinicName = actualClinicName;
      }

      if (clientId) {
        filter.clientId = parseInt(clientId);
      }

      if (readyToBill === 'true') {
        filter.readyToBill = true;
      }

      // Date range filter
      if (startDate || endDate) {
        filter.serviceDate = {};
        if (startDate) {
          filter.serviceDate.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.serviceDate.$lte = new Date(endDate);
        }
      }

      // Search filter
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
          { clientName: searchRegex },
          { orderNumber: searchRegex },
          { description: searchRegex }
        ];
      }

      // Execute queries
      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort({ serviceDate: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Order.countDocuments(filter)
      ]);

      const response: OrderResponse = {
        success: true,
        data: orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get order by ID or Order Number
   */
  static async getOrderById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      // Check if ID is an order number or MongoDB ObjectId
      const isOrderNumber = id.startsWith('ORD-');
      const query = isOrderNumber ? { orderNumber: id } : { _id: id };

      const order = await Order.findOne(query);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      const response: OrderResponse = {
        success: true,
        data: order
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get orders by client
   */
  static async getOrdersByClient(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { limit = '50' } = req.query;

      if (!clientId) {
        res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
        return;
      }

      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

      const orders = await Order.find({ clientId: parseInt(clientId) })
        .sort({ serviceDate: -1 })
        .limit(limitNum);

      const response: OrderResponse = {
        success: true,
        data: orders
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching client orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get orders by clinic with date range
   */
  static async getOrdersByClinic(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName } = req.params;
      const { startDate, endDate, status } = req.query as OrderQuery;

      // Convert slug to proper clinic name if needed
      let actualClinicName: string = rawClinicName || '';
      try {
        actualClinicName = ClinicService.slugToClinicName(rawClinicName || '');
      } catch (conversionError) {
        // If conversion fails, assume it's already a proper clinic name
        actualClinicName = rawClinicName || '';
      }

      const filter: any = { clinicName: actualClinicName };

      if (status) {
        filter.status = status;
      }

      if (startDate || endDate) {
        filter.serviceDate = {};
        if (startDate) {
          filter.serviceDate.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.serviceDate.$lte = new Date(endDate);
        }
      }

      const orders = await Order.find(filter)
        .sort({ serviceDate: 1 });

      const response: OrderResponse = {
        success: true,
        data: orders
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching clinic orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinic orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create new order
   */
  static async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderData = req.body;

      // Validate required fields
      const requiredFields = ['clientId', 'clientName', 'clinicName', 'serviceDate', 'items'];
      const missingFields = requiredFields.filter(field => !orderData[field]);

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        });
        return;
      }

      // Validate and enrich items with product data
      const enrichedItems = [];
      for (const item of orderData.items) {
        const product = await Product.findOne({ productKey: item.productKey });
        if (!product) {
          res.status(400).json({
            success: false,
            message: `Product with key ${item.productKey} not found`
          });
          return;
        }

        enrichedItems.push({
          productKey: item.productKey,
          productName: product.name,
          quantity: item.quantity || 1,
          duration: item.duration || product.duration,
          unitPrice: item.unitPrice || product.price,
          subtotal: (item.quantity || 1) * (item.unitPrice || product.price)
        });
      }

      // Calculate total amount
      const totalAmount = enrichedItems.reduce((total, item) => total + item.subtotal, 0);

      // Create order
      const order = new Order({
        ...orderData,
        items: enrichedItems,
        totalAmount,
        orderDate: new Date(),
        endDate: orderData.endDate || new Date(new Date(orderData.serviceDate).getTime() + 60 * 60 * 1000) // Default 1 hour
      });

      await order.save();

      const response: OrderResponse = {
        success: true,
        data: order,
        message: 'Order created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update order
   */
  static async updateOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      // Remove fields that shouldn't be updated directly
      delete updateData.orderNumber;
      delete updateData.appointmentId;
      delete updateData.totalAmount;
      delete updateData.createdAt;

      const isOrderNumber = id.startsWith('ORD-');
      const query = isOrderNumber ? { orderNumber: id } : { _id: id };

      // If items are being updated, recalculate total
      if (updateData.items) {
        updateData.totalAmount = updateData.items.reduce((total: number, item: any) => total + item.subtotal, 0);
      }

      const order = await Order.findOneAndUpdate(
        query,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      const response: OrderResponse = {
        success: true,
        data: order,
        message: 'Order updated successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      if (!Object.values(OrderStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
        return;
      }

      const isOrderNumber = id.startsWith('ORD-');
      const query = isOrderNumber ? { orderNumber: id } : { _id: id };

      const order = await Order.findOne(query);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      await order.updateStatus(status);

      const response: OrderResponse = {
        success: true,
        data: order,
        message: `Order status updated to ${status}`
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update order status'
      });
    }
  }

  /**
   * Mark order ready for billing
   */
  static async markReadyForBilling(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      const isOrderNumber = id.startsWith('ORD-');
      const query = isOrderNumber ? { orderNumber: id } : { _id: id };

      const order = await Order.findOne(query);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      await order.markReadyForBilling();

      const response: OrderResponse = {
        success: true,
        data: order,
        message: 'Order marked ready for billing'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error marking order for billing:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark order for billing'
      });
    }
  }

  /**
   * Process order payment
   */
  static async processPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { amount, paymentDate } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid payment amount is required'
        });
        return;
      }

      const isOrderNumber = id.startsWith('ORD-');
      const query = isOrderNumber ? { orderNumber: id } : { _id: id };

      const order = await Order.findOne(query);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      await order.processPayment(amount, paymentDate ? new Date(paymentDate) : new Date());

      const response: OrderResponse = {
        success: true,
        data: order,
        message: 'Payment processed successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error processing payment:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process payment'
      });
    }
  }

  /**
   * Get orders ready for billing
   */
  static async getOrdersReadyForBilling(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName } = req.query;

      const orders = await Order.find({
        readyToBill: true,
        billDate: null,
        status: { $in: [OrderStatus.COMPLETED, OrderStatus.IN_PROGRESS] },
        ...(clinicName && { clinicName })
      }).sort({ serviceDate: 1 });

      const response: OrderResponse = {
        success: true,
        data: orders
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching orders ready for billing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders ready for billing',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get overdue orders
   */
  static async getOverdueOrders(req: Request, res: Response): Promise<void> {
    try {
      const { daysOverdue = '30' } = req.query;
      const days = parseInt(daysOverdue as string);

      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - days);

      const orders = await Order.find({
        serviceDate: { $lt: overdueDate },
        paymentStatus: { $in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
        status: { $ne: OrderStatus.CANCELLED }
      }).sort({ serviceDate: 1 });

      const response: OrderResponse = {
        success: true,
        data: orders
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching overdue orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch overdue orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get revenue analytics
   */
  static async getRevenueAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName, startDate, endDate } = req.query;

      if (!rawClinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      // Convert slug to proper clinic name if needed
      let actualClinicName: string = rawClinicName as string;
      try {
        actualClinicName = ClinicService.slugToClinicName(rawClinicName as string);
      } catch (conversionError) {
        // If conversion fails, assume it's already a proper clinic name
        actualClinicName = rawClinicName as string;
      }

      // Use broad default date range to capture all historical data
      const start = startDate ? new Date(startDate as string) : new Date('2018-01-01'); // Start from earliest possible data
      const end = endDate ? new Date(endDate as string) : new Date('2025-12-31'); // Go to end of 2025

      console.log('Revenue Analytics Debug:', {
        rawClinicName,
        actualClinicName,
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });

      // First, test without any date filter to get baseline data
      const testCountNoDateFilter = await Order.countDocuments({
        clinicName: actualClinicName,
        status: { $ne: 'cancelled' }
      });

      console.log('Test count without date filter:', testCountNoDateFilter);

      // Test basic aggregation without date filter first
      const testAnalytics = await Order.aggregate([
        {
          $match: {
            clinicName: actualClinicName,
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 }
          }
        }
      ]);

      console.log('Test analytics without date filter:', testAnalytics);

      // Use simplified date matching - remove time components for better matching
      const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

      console.log('Simplified date range:', {
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString()
      });

      // Check if there are any orders in the date range with simplified dates
      const matchingOrdersCount = await Order.countDocuments({
        clinicName: actualClinicName,
        serviceDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'cancelled' }
      });

      console.log('Matching orders count with simplified dates:', matchingOrdersCount);

      const analytics = await Order.aggregate([
        {
          $match: {
            clinicName: actualClinicName,
            // Exclude problematic monthly aggregate data for now
            monthlyAggregate: { $ne: true },
            status: { $ne: 'cancelled' }
          }
        },
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
        {
          $match: {
            serviceDateConverted: { $ne: null }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$serviceDateConverted' },
              month: { $month: '$serviceDateConverted' },
              monthName: {
                $arrayElemAt: [
                  ['', 'January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'],
                  { $month: '$serviceDateConverted' }
                ]
              }
            },
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            scheduledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
            },
            paidOrders: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
            },
            // Add min/max order values for insights
            maxOrderValue: { $max: '$totalAmount' },
            minOrderValue: { $min: '$totalAmount' }
          }
        },
        { 
          $sort: { '_id.year': 1, '_id.month': 1 } 
        },
        {
          $addFields: {
            period: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                { $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]}
              ]
            }
          }
        }
      ]);

      console.log('Analytics result:', analytics);

      // Also provide summary statistics
      const summaryStats = await Order.aggregate([
        {
          $match: {
            clinicName: actualClinicName,
            // Use same filter as main analytics: exclude monthly aggregates and cancelled orders
            monthlyAggregate: { $ne: true },
            status: { $ne: 'cancelled' }
          }
        },
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
        {
          $project: {
            uniqueClients: 0 // Remove the array, keep only the count
          }
        }
      ]);

      const response: OrderResponse = {
        success: true,
        data: {
          analytics,
          summary: summaryStats[0] || {
            totalRevenue: 0,
            totalOrders: 0,
            avgOrderValue: 0,
            maxOrderValue: 0,
            minOrderValue: 0,
            uniqueClientCount: 0
          },
          dateRange: {
            start: start.toISOString(),
            end: end.toISOString()
          },
          matchingOrdersCount,
          testCountNoDateFilter,
          testAnalytics
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch revenue analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get product performance analytics
   */
  static async getProductPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      // Use more reasonable default date range - past 2 years to capture actual data
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 730 * 24 * 60 * 60 * 1000); // 2 years ago
      const end = endDate ? new Date(endDate as string) : new Date();

      // Convert dates to ISO strings for MongoDB compatibility
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      console.log('Product Performance Debug:', {
        startDate: startISO,
        endDate: endISO
      });

      // Check matching orders count for debugging
      const matchingOrdersCount = await Order.countDocuments({
        serviceDate: { $gte: start, $lte: end },
        status: { $ne: OrderStatus.CANCELLED }
      });

      console.log('Product Performance - Matching orders count:', matchingOrdersCount);

      const performance = await Order.aggregate([
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
            maxPrice: { $max: '$items.unitPrice' },
            minPrice: { $min: '$items.unitPrice' },
            totalDuration: { $sum: '$items.duration' },
            avgDuration: { $avg: '$items.duration' },
            uniqueClients: { $addToSet: '$clientId' }
          }
        },
        {
          $addFields: {
            uniqueClientCount: { $size: '$uniqueClients' },
            avgRevenuePerOrder: { $divide: ['$totalRevenue', '$totalOrders'] }
          }
        },
        {
          $project: {
            uniqueClients: 0 // Remove the array, keep only the count
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);

      // Get overall product performance summary
      const productSummary = await Order.aggregate([
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
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: '$items.subtotal' }
          }
        },
        {
          $addFields: {
            uniqueProductCount: { $size: '$totalProducts' }
          }
        },
        {
          $project: {
            totalProducts: 0 // Remove the array, keep only the count
          }
        }
      ]);

      console.log('Product Performance result:', { 
        performanceItemsCount: performance.length,
        samplePerformance: performance.slice(0, 2)
      });

      const response: OrderResponse = {
        success: true,
        data: {
          performance,
          summary: productSummary[0] || {
            uniqueProductCount: 0,
            totalRevenue: 0,
            totalOrders: 0,
            avgOrderValue: 0
          },
          dateRange: {
            start: start.toISOString(),
            end: end.toISOString()
          },
          matchingOrdersCount
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching product performance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product performance',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cancel order
   */
  static async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      const isOrderNumber = id.startsWith('ORD-');
      const query = isOrderNumber ? { orderNumber: id } : { _id: id };

      const order = await Order.findOne(query);

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      await order.updateStatus(OrderStatus.CANCELLED);

      if (reason) {
        order.description = (order.description || '') + ` | Cancelled: ${reason}`;
        await order.save();
      }

      const response: OrderResponse = {
        success: true,
        data: order,
        message: 'Order cancelled successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error cancelling order:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel order'
      });
    }
  }
}
