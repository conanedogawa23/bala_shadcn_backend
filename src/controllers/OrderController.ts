import { Request, Response } from 'express';
import Order, { IOrder, OrderStatus, PaymentStatus } from '../models/Order';
import Product from '../models/Product';
import { ClinicService } from '../services/ClinicService';
import { OrderService } from '../services/OrderService';

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
        // Use case-insensitive exact match for clinic name
        filter.clinicName = new RegExp(`^${clinicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
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

      // Use defensive $or query to handle both string and numeric clientId types in MongoDB
      const numericClientId = parseInt(clientId);
      const orders = await Order.find({
        $or: [
          { clientId: numericClientId },
          { clientId: clientId }
        ]
      })
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
   * Get orders by clinic with date range and pagination
   */
  static async getOrdersByClinic(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName } = req.params;
      const {
        page = '1',
        limit = '20',
        startDate,
        endDate,
        status,
        search
      } = req.query as OrderQuery;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Use clinic name directly
      const actualClinicName: string = rawClinicName || '';

      // Use case-insensitive regex for clinic name matching
      const clinicRegex = new RegExp(`^${actualClinicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const filter: any = { clinicName: clinicRegex };

      if (status) {
        filter.status = status;
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
          { description: searchRegex },
          { 'items.productName': searchRegex }
        ];
      }

      // Execute queries in parallel for better performance
      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort({ serviceDate: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Order.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limitNum);

      const response: OrderResponse = {
        success: true,
        data: orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages
        }
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

      // Validate items array
      if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Items array is required and must contain at least one item'
        });
        return;
      }

      // Validate clientId is a positive number
      const clientId = Number(orderData.clientId);
      if (isNaN(clientId) || clientId <= 0) {
        res.status(400).json({
          success: false,
          message: 'clientId must be a positive number'
        });
        return;
      }

      // Validate and enrich items with product data
      const enrichedItems = [];
      for (const item of orderData.items) {
        // Validate item has required fields
        if (!item.productKey) {
          res.status(400).json({
            success: false,
            message: 'Each item must have a productKey'
          });
          return;
        }

        const product = await Product.findOne({ productKey: item.productKey });
        if (!product) {
          res.status(400).json({
            success: false,
            message: `Product with key ${item.productKey} not found`
          });
          return;
        }

        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || product.price;
        
        // Validate quantity and price are positive
        if (quantity <= 0) {
          res.status(400).json({
            success: false,
            message: `Quantity for product ${item.productKey} must be positive`
          });
          return;
        }
        
        if (unitPrice < 0) {
          res.status(400).json({
            success: false,
            message: `Unit price for product ${item.productKey} cannot be negative`
          });
          return;
        }

        enrichedItems.push({
          productKey: item.productKey,
          productName: product.name,
          quantity: quantity,
          duration: item.duration || product.duration,
          unitPrice: unitPrice,
          subtotal: quantity * unitPrice
        });
      }

      // Calculate total amount
      const totalAmount = enrichedItems.reduce((total, item) => total + item.subtotal, 0);

      // Validate total amount is not negative
      if (totalAmount < 0) {
        res.status(400).json({
          success: false,
          message: 'Total order amount cannot be negative'
        });
        return;
      }

      // Create order with validated data
      const order = new Order({
        ...orderData,
        clientId: clientId, // Use validated numeric clientId
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
      
      // Handle validation errors specifically
      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: error.message
        });
        return;
      }
      
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

      // Log the update attempt for debugging
      console.log('Updating order:', id, 'with data:', JSON.stringify(updateData));

      // Remove fields that shouldn't be updated directly
      delete updateData.orderNumber;
      delete updateData.appointmentId;
      delete updateData.createdAt;

      const isOrderNumber = id.startsWith('ORD-');
      const query = isOrderNumber ? { orderNumber: id } : { _id: id };

      // If items are being updated, validate and recalculate total
      if (updateData.items) {
        // Validate items
        for (const item of updateData.items) {
          if (item.quantity <= 0) {
            res.status(400).json({
              success: false,
              message: 'Item quantity must be positive'
            });
            return;
          }
          if (item.unitPrice < 0) {
            res.status(400).json({
              success: false,
              message: 'Item unit price cannot be negative'
            });
            return;
          }
          if (item.subtotal < 0) {
            res.status(400).json({
              success: false,
              message: 'Item subtotal cannot be negative'
            });
            return;
          }
        }
        
        updateData.totalAmount = updateData.items.reduce((total: number, item: any) => total + item.subtotal, 0);
      }

      // Validate totalAmount if provided
      if (updateData.totalAmount !== undefined && updateData.totalAmount < 0) {
        res.status(400).json({
          success: false,
          message: 'Order total amount cannot be negative'
        });
        return;
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

      // Log successful update
      console.log('Order updated successfully:', order._id, 'New status:', order.status, 'Payment status:', order.paymentStatus);

      const response: OrderResponse = {
        success: true,
        data: order,
        message: 'Order updated successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error updating order:', error);
      
      // Handle validation errors
      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: error.message
        });
        return;
      }
      
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
   * Get overdue orders report
   */
  static async getOrdersOverdueReport(req: Request, res: Response): Promise<void> {
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

      // Use clinic name directly with case-insensitive regex matching
      const actualClinicName: string = rawClinicName as string;
      const clinicRegex = new RegExp(`^${actualClinicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

      // Calculate date range - default to last 12 months if not specified
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Get total orders count for this clinic
      const totalOrdersCount = await Order.countDocuments({
        clinicName: clinicRegex,
        status: { $ne: 'cancelled' }
      });

      // Monthly revenue analytics with proper date handling
      const analytics = await Order.aggregate([
        {
          $match: {
            clinicName: clinicRegex,
            status: { $ne: 'cancelled' }
          }
        },
        {
          $addFields: {
            // Handle both Date objects and ISO strings for orderDate/serviceDate
            effectiveDate: {
              $cond: {
                if: { $eq: [{ $type: '$orderDate' }, 'date'] },
                then: '$orderDate',
                else: {
                  $cond: {
                    if: { $eq: [{ $type: '$serviceDate' }, 'date'] },
                    then: '$serviceDate',
                    else: {
                      $dateFromString: {
                        dateString: { $ifNull: ['$orderDate', '$serviceDate'] },
                        onError: '$createdAt'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            effectiveDate: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$effectiveDate' },
              month: { $month: '$effectiveDate' }
            },
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            paidOrders: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            }
          }
        },
        { 
          $sort: { '_id.year': 1, '_id.month': 1 } 
        }
      ]);

      // Calculate summary statistics
      const summaryStats = await Order.aggregate([
        {
          $match: {
            clinicName: clinicRegex,
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
            uniqueClients: 0
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
          totalOrdersCount
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
      const { startDate, endDate, clinicName: rawClinicName } = req.query;

      // Use more reasonable default date range - past 12 months
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Build match filter
      const matchFilter: any = {
        status: { $ne: OrderStatus.CANCELLED }
      };

      // Add clinic filter if provided - use case-insensitive exact match
      if (rawClinicName) {
        matchFilter.clinicName = new RegExp(`^${(rawClinicName as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      }

      // Check matching orders count
      const matchingOrdersCount = await Order.countDocuments(matchFilter);

      const performance = await Order.aggregate([
        {
          $match: matchFilter
        },
        {
          $addFields: {
            effectiveDate: {
              $cond: {
                if: { $eq: [{ $type: '$orderDate' }, 'date'] },
                then: '$orderDate',
                else: {
                  $cond: {
                    if: { $eq: [{ $type: '$serviceDate' }, 'date'] },
                    then: '$serviceDate',
                    else: '$createdAt'
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            effectiveDate: { $gte: start, $lte: end }
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
            uniqueClients: 0
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 50 }
      ]);

      // Get overall product performance summary
      const productSummary = await Order.aggregate([
        {
          $match: matchFilter
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
            totalProducts: 0
          }
        }
      ]);

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

  /**
   * Get order status report
   */
  static async getOrderStatusReport(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName, startDate, endDate } = req.query;

      if (!rawClinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      // Use clinic name directly
      const actualClinicName: string = rawClinicName as string;

      const result = await OrderService.getOrderStatusReport(
        actualClinicName,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      const response: OrderResponse = {
        success: true,
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error generating order status report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate order status report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get orders by client with advanced details
   */
  static async getClientOrderDetails(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { page = '1', limit = '50', status, paymentStatus } = req.query;

      if (!clientId) {
        res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
        return;
      }

      const result = await OrderService.getClientOrderDetails(
        parseInt(clientId),
        parseInt(page as string),
        parseInt(limit as string),
        status as string,
        paymentStatus as string
      );

      const response: OrderResponse = {
        success: true,
        data: result.orders,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit)
        }
      };

      (response as any).statistics = result.statistics;

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching client order details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client order details',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mark multiple orders as ready for billing
   */
  static async bulkMarkReadyForBilling(req: Request, res: Response): Promise<void> {
    try {
      const { orderIds } = req.body;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Order IDs array is required'
        });
        return;
      }

      const result = await OrderService.bulkMarkReadyForBilling(orderIds);

      const response: OrderResponse = {
        success: true,
        data: result,
        message: `${result.modifiedCount} order(s) marked ready for billing`
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error marking orders for billing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark orders for billing',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get orders pending refund
   */
  static async getOrdersPendingRefund(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName, page = '1', limit = '20' } = req.query;

      // Clinic name is optional - if not provided, get all pending refunds
      const actualClinicName: string | undefined = rawClinicName as string | undefined;

      const result = await OrderService.getOrdersPendingRefund(
        actualClinicName,
        parseInt(page as string),
        parseInt(limit as string)
      );

      const response: OrderResponse = {
        success: true,
        data: result.orders,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit)
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching orders pending refund:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders pending refund',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get order service history for a product
   */
  static async getProductServiceHistory(req: Request, res: Response): Promise<void> {
    try {
      const { productKey } = req.params;
      const { clinicName, startDate, endDate } = req.query;

      if (!productKey) {
        res.status(400).json({
          success: false,
          message: 'Product key is required'
        });
        return;
      }

      const history = await OrderService.getProductServiceHistory(
        parseInt(productKey),
        clinicName as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      const response: OrderResponse = {
        success: true,
        data: history
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching product service history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product service history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export orders report
   */
  static async exportOrdersReport(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName, format = 'json', startDate, endDate, limit = '1000' } = req.query;

      // Clinic name is optional for export
      const actualClinicName: string | undefined = rawClinicName as string | undefined;

      const data = await OrderService.exportOrdersReport(
        actualClinicName,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        format as string,
        parseInt(limit as string)
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        const filename = `orders${actualClinicName ? '-' + actualClinicName : ''}-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);
      } else {
        const response: OrderResponse = {
          success: true,
          data,
          message: `Exported ${Array.isArray(data) ? data.length : 0} order(s)`
        };
        res.status(200).json(response);
      }
    } catch (error) {
      console.error('Error exporting orders report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export orders report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
