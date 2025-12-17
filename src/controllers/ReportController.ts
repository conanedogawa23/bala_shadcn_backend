import { Request, Response } from 'express';
import { AuthRequest } from './AuthController';
import User from '../models/User';
import Order from '../models/Order';
import Product from '../models/Product';
import { ClientModel } from '../models/Client';
import { AppointmentModel } from '../models/Appointment';
import { PaymentModel } from '../models/Payment';
import { logger } from '../utils/logger';

// Temporary Payment interface (until Payment model is created)
interface Payment {
  _id: string;
  clinicName: string;
  amount: number;
  status: string;
  paymentMethod: string;
  insurance?: {
    copay1?: number;
    copay2?: number;
  };
  createdAt: Date;
}

// Report interfaces
interface AccountSummaryData {
  clinicName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalClients: number;
    averageOrderValue: number;
    completedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
  };
  topServices: Array<{
    productKey: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  revenueBreakdown: Array<{
    date: string;
    revenue: number;
    orderCount: number;
  }>;
}

interface PaymentSummaryData {
  clinicName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalPayments: number;
    totalAmount: number;
    averagePayment: number;
    completedPayments: number;
    pendingPayments: number;
    refundedPayments: number;
  };
  paymentMethods: Array<{
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  dailyPayments: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
}

interface UserSessionData {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  lastLogin: string | null;
  lastActivity: string | null;
  totalSessions: number;
  activeSessions: number;
  sessions: Array<{
    deviceId: string;
    ipAddress: string;
    userAgent: string;
    lastActivity: string;
    isActive: boolean;
  }>;
}

interface TimesheetData {
  clinicName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  practitioners: Array<{
    resourceId: number;
    resourceName: string;
    totalHours: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    averageAppointmentDuration: number;
    revenue: number;
    utilization: number;
  }>;
  userActivity: Array<UserSessionData>;
  summary: {
    totalHours: number;
    totalRevenue: number;
    averageUtilization: number;
    totalActiveUsers: number;
    totalLoginSessions: number;
  };
}

interface OrderStatusData {
  clinicName: string;
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
    totalValue: number;
  }>;
  recentOrders: Array<{
    orderId: string;
    orderNumber: string;
    clientName: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  summary: {
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
  };
}

interface CoPaySummaryData {
  clinicName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalCoPayments: number;
    totalCoPayAmount: number;
    averageCoPayment: number;
    insurance1CoPayments: number;
    insurance2CoPayments: number;
  };
  coPayBreakdown: Array<{
    insuranceType: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
}

interface MarketingBudgetData {
  clinicName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalSpent: number;
    totalROI: number;
    conversionRate: number;
    costPerAcquisition: number;
  };
  campaigns: Array<{
    campaignName: string;
    spent: number;
    revenue: number;
    roi: number;
    conversions: number;
  }>;
  channels: Array<{
    channel: string;
    spent: number;
    clients: number;
    revenue: number;
    roi: number;
  }>;
}

export class ReportController {
  /**
   * Generate Account Summary Report
   */
  static async getAccountSummary(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Clinic name is required', code: 'MISSING_CLINIC_NAME' }
        });
      }

      // Type assertion for clinicName (validated above)
      const clinic = clinicName as string;

      // Validate date range
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Ensure dates are valid
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid date format', code: 'INVALID_DATE' }
        });
      }

      // Get orders for the clinic in date range
      const orders = await Order.find({
        clinicName: clinic,
        createdAt: { $gte: start, $lte: end }
      })
        .limit(5000) // Reasonable limit for reports
        .lean() // Use lean() for read-only performance
        .populate('items.productKey');

      // Calculate summary metrics
      const totalRevenue = orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
      const totalOrders = orders.length;
      const completedOrders = orders.filter((order: any) => order.status === 'completed').length;
      const pendingOrders = orders.filter((order: any) => order.status === 'pending').length;
      const cancelledOrders = orders.filter((order: any) => order.status === 'cancelled').length;

      // Get unique clients
      const clientIds = [...new Set(orders.map((order: any) => order.clientId))];
      const totalClients = clientIds.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate top services
      const serviceStats = new Map();
      orders.forEach((order: any) => {
        order.items.forEach((item: any) => {
          const key = item.productKey || item.productId?.toString() || 'Unknown';
          const name = item.productName || 'Unknown Service';
          if (!serviceStats.has(key)) {
            serviceStats.set(key, { productKey: key, productName: name, quantity: 0, revenue: 0 });
          }
          const stats = serviceStats.get(key);
          stats.quantity += item.quantity;
          stats.revenue += item.total;
        });
      });

      const topServices = Array.from(serviceStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate daily revenue breakdown
      const revenueByDate = new Map();
      orders.forEach((order: any) => {
        const date = order.createdAt.toISOString().split('T')[0];
        if (!revenueByDate.has(date)) {
          revenueByDate.set(date, { date, revenue: 0, orderCount: 0 });
        }
        const dayData = revenueByDate.get(date);
        dayData.revenue += order.totalAmount;
        dayData.orderCount += 1;
      });

      const revenueBreakdown = Array.from(revenueByDate.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      const reportData: AccountSummaryData = {
        clinicName: clinic,
        dateRange: {
          startDate: start.toISOString().split('T')[0] as string,
          endDate: end.toISOString().split('T')[0] as string
        },
        summary: {
          totalRevenue,
          totalOrders,
          totalClients,
          averageOrderValue,
          completedOrders,
          pendingOrders,
          cancelledOrders
        },
        topServices,
        revenueBreakdown
      };

      return res.status(200).json({
        success: true,
        data: reportData
      });

    } catch (error) {
      logger.error('Account summary report error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to generate account summary report',
          code: 'ACCOUNT_SUMMARY_ERROR'
        }
      });
    }
  }

  /**
   * Get client statistics using aggregation (no full client data transfer)
   */
  static async getClientStatistics(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;
      
      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Clinic name is required', code: 'MISSING_CLINIC_NAME' }
        });
      }

      // Type assertion for clinicName (validated above)
      const clinic = clinicName as string;
      
      // Use case-insensitive regex for clinic name matching
      // This handles variations like "BodyBlissPhysio", "bodyblissphysio", etc.
      const clinicRegex = new RegExp(`^${clinic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

      // Aggregation pipeline for efficient stats calculation
      const stats = await ClientModel.aggregate([
        {
          $match: { 
            defaultClinic: clinicRegex
          }
        },
        {
          $facet: {
            total: [{ $count: 'count' }],
            active: [
              {
                $match: {
                  isActive: true
                }
              },
              { $count: 'count' }
            ],
            thisMonth: [
              {
                $match: {
                  dateCreated: {
                    $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                  }
                }
              },
              { $count: 'count' }
            ],
            activeRecently: [
              {
                $match: {
                  dateModified: {
                    $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months
                  }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]);

      const result = {
        totalClients: stats[0]?.total[0]?.count || 0,
        newClientsThisMonth: stats[0]?.thisMonth[0]?.count || 0,
        activeClients: stats[0]?.active[0]?.count || stats[0]?.activeRecently[0]?.count || stats[0]?.total[0]?.count || 0
      };

      return res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Client statistics error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get client statistics',
          code: 'CLIENT_STATS_ERROR'
        }
      });
    }
  }

  /**
   * Generate Payment Summary by Day Range Report
   */
  static async getPaymentSummary(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Clinic name is required', code: 'MISSING_CLINIC_NAME' }
        });
      }

      // Type assertion for clinicName (validated above)
      const clinic = clinicName as string;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Fetch actual Payment data from database
      const payments = await PaymentModel.find({
        clinicName: clinic,
        paymentDate: { $gte: start, $lte: end }
      }).lean();

      // Calculate summary metrics using actual Payment model fields
      const totalPayments = payments.length;
      const totalAmount = payments.reduce((sum: number, payment: any) => sum + (payment.amounts?.totalPaymentAmount || 0), 0);
      const averagePayment = totalPayments > 0 ? totalAmount / totalPayments : 0;
      const completedPayments = payments.filter((p: any) => p.status === 'completed').length;
      const pendingPayments = payments.filter((p: any) => p.status === 'pending').length;
      const refundedPayments = payments.filter((p: any) => p.status === 'refunded').length;

      // Calculate payment methods breakdown
      const methodStats = new Map();
      payments.forEach((payment: any) => {
        const method = payment.paymentMethod || 'Unknown';
        if (!methodStats.has(method)) {
          methodStats.set(method, { method, count: 0, amount: 0 });
        }
        const stats = methodStats.get(method);
        stats.count += 1;
        stats.amount += (payment.amounts?.totalPaymentAmount || 0);
      });

      const paymentMethods = Array.from(methodStats.values()).map(method => ({
        ...method,
        percentage: totalAmount > 0 ? (method.amount / totalAmount) * 100 : 0
      }));

      // Calculate daily payments
      const paymentsByDate = new Map();
      payments.forEach((payment: any) => {
        const date = new Date(payment.paymentDate || payment.createdAt).toISOString().split('T')[0];
        if (!paymentsByDate.has(date)) {
          paymentsByDate.set(date, { date, amount: 0, count: 0 });
        }
        const dayData = paymentsByDate.get(date);
        dayData.amount += (payment.amounts?.totalPaymentAmount || 0);
        dayData.count += 1;
      });

      const dailyPayments = Array.from(paymentsByDate.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      const reportData: PaymentSummaryData = {
        clinicName: clinic,
        dateRange: {
          startDate: start.toISOString().split('T')[0] as string,
          endDate: end.toISOString().split('T')[0] as string
        },
        summary: {
          totalPayments,
          totalAmount,
          averagePayment,
          completedPayments,
          pendingPayments,
          refundedPayments
        },
        paymentMethods,
        dailyPayments
      };

      return res.status(200).json({
        success: true,
        data: reportData
      });

    } catch (error) {
      logger.error('Payment summary report error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to generate payment summary report',
          code: 'PAYMENT_SUMMARY_ERROR'
        }
      });
    }
  }

  /**
   * Generate Timesheet Report
   * Includes practitioner hours and user login/logout activity tracking
   */
  static async getTimesheetReport(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Clinic name is required', code: 'MISSING_CLINIC_NAME' }
        });
      }

      // Type assertion for clinicName (validated above)
      const clinic = clinicName as string;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Get appointments for the clinic in date range
      const appointments = await AppointmentModel.find({
        clinicName: clinic,
        startDate: { $gte: start, $lte: end }
      })
        .limit(10000)
        .lean();

      // Group by resource (practitioner)
      const resourceStats = new Map();
      for (const appointment of appointments) {
        const appt = appointment as any;
        const resourceId = appt.resourceId;
        const resourceName = appt.resourceName || `Resource ${resourceId}`;
        
        if (!resourceStats.has(resourceId)) {
          resourceStats.set(resourceId, {
            resourceId,
            resourceName,
            totalHours: 0,
            totalAppointments: 0,
            completedAppointments: 0,
            cancelledAppointments: 0,
            totalDuration: 0,
            revenue: 0
          });
        }

        const stats = resourceStats.get(resourceId);
        stats.totalAppointments += 1;
        stats.totalDuration += appt.duration || 60; // Default 60 minutes
        
        if (appt.status === 1) { // Completed
          stats.completedAppointments += 1;
        } else if (appt.status === 2) { // Cancelled
          stats.cancelledAppointments += 1;
        }
      }

      // Calculate revenue from related orders for each practitioner
      // Get orders for appointments in the date range
      const appointmentIds = appointments.map((appt: any) => appt._id);
      const relatedOrders = await Order.find({
        clinicName: clinic,
        appointmentId: { $in: appointmentIds },
        createdAt: { $gte: start, $lte: end }
      }).lean();

      // Map revenue to practitioners based on appointment
      for (const order of relatedOrders) {
        const appt = appointments.find((a: any) => a._id.toString() === order.appointmentId?.toString());
        if (appt && resourceStats.has(appt.resourceId)) {
          resourceStats.get(appt.resourceId).revenue += order.totalAmount || 0;
        }
      }

      // Convert to array and calculate derived metrics
      const practitioners = Array.from(resourceStats.values()).map(stats => ({
        ...stats,
        totalHours: Math.round((stats.totalDuration / 60) * 100) / 100,
        averageAppointmentDuration: stats.totalAppointments > 0 ? stats.totalDuration / stats.totalAppointments : 0,
        utilization: Math.min(100, (stats.totalHours / (8 * 5)) * 100) // Assuming 8 hours/day, 5 days/week
      }));

      // Fetch user login/logout activity for users with access to this clinic
      const users = await User.find({
        $or: [
          { 'permissions.canAccessAllClinics': true },
          { 'permissions.allowedClinics': { $regex: new RegExp(clinic, 'i') } }
        ],
        status: 'active'
      })
        .select('username profile role lastLogin lastActivity sessions permissions')
        .lean();

      // Process user activity data - filter sessions within date range
      const userActivity: UserSessionData[] = users.map((user: any) => {
        // Filter sessions within the date range
        const sessionsInRange = (user.sessions || []).filter((session: any) => {
          if (!session.lastActivity) {
            return false;
          }
          const sessionDate = new Date(session.lastActivity);
          return sessionDate >= start && sessionDate <= end;
        });

        // Calculate active sessions
        const activeSessions = sessionsInRange.filter((s: any) => s.isActive).length;

        return {
          userId: user._id.toString(),
          username: user.username,
          fullName: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.username,
          role: user.role,
          lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString() : null,
          lastActivity: user.lastActivity ? new Date(user.lastActivity).toISOString() : null,
          totalSessions: sessionsInRange.length,
          activeSessions,
          sessions: sessionsInRange.map((session: any) => ({
            deviceId: session.deviceId || 'unknown',
            ipAddress: session.ipAddress || 'unknown',
            userAgent: session.userAgent || 'unknown',
            lastActivity: session.lastActivity ? new Date(session.lastActivity).toISOString() : new Date().toISOString(),
            isActive: session.isActive || false
          }))
        };
      });

      // Sort by last activity (most recent first)
      userActivity.sort((a, b) => {
        const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return dateB - dateA;
      });

      // Calculate summary
      const totalHours = practitioners.reduce((sum, p) => sum + p.totalHours, 0);
      const totalRevenue = practitioners.reduce((sum, p) => sum + p.revenue, 0);
      const averageUtilization = practitioners.length > 0 
        ? practitioners.reduce((sum, p) => sum + p.utilization, 0) / practitioners.length 
        : 0;
      const totalActiveUsers = userActivity.filter(u => u.activeSessions > 0).length;
      const totalLoginSessions = userActivity.reduce((sum, u) => sum + u.totalSessions, 0);

      const reportData: TimesheetData = {
        clinicName: clinic,
        dateRange: {
          startDate: start.toISOString().split('T')[0] as string,
          endDate: end.toISOString().split('T')[0] as string
        },
        practitioners: practitioners.sort((a, b) => b.totalHours - a.totalHours),
        userActivity,
        summary: {
          totalHours,
          totalRevenue,
          averageUtilization,
          totalActiveUsers,
          totalLoginSessions
        }
      };

      return res.status(200).json({
        success: true,
        data: reportData
      });

    } catch (error) {
      logger.error('Timesheet report error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to generate timesheet report',
          code: 'TIMESHEET_ERROR'
        }
      });
    }
  }

  /**
   * Generate Order Status Report
   */
  static async getOrderStatusReport(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;
      
      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Clinic name is required', code: 'MISSING_CLINIC_NAME' }
        });
      }

      // Type assertion for clinicName (validated above)
      const clinic = clinicName as string;

      // Get all orders for the clinic
      const orders = await Order.find({ clinicName: clinic })
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean()
        .populate('clientId', 'profile.firstName profile.lastName');

      // Calculate status breakdown
      const statusStats = new Map();
      const statusOptions = ['pending', 'processing', 'completed', 'cancelled', 'ready_to_bill'];
      
      statusOptions.forEach(status => {
        statusStats.set(status, { status, count: 0, totalValue: 0 });
      });

      orders.forEach((order: any) => {
        const status = order.status || 'pending';
        if (!statusStats.has(status)) {
          statusStats.set(status, { status, count: 0, totalValue: 0 });
        }
        const stats = statusStats.get(status);
        stats.count += 1;
        stats.totalValue += order.totalAmount;
      });

      const totalOrders = orders.length;
      const totalValue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

      const statusBreakdown = Array.from(statusStats.values()).map(stats => ({
        ...stats,
        percentage: totalOrders > 0 ? (stats.count / totalOrders) * 100 : 0
      }));

      // Get recent orders
      const recentOrders = orders
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20)
        .map(order => ({
          orderId: order._id.toString(),
          orderNumber: order.orderNumber || '',
          clientName: (order.clientId && typeof order.clientId === 'object' && (order.clientId as any).profile) ? 
            `${(order.clientId as any).profile.firstName} ${(order.clientId as any).profile.lastName}` : 
            'Unknown Client',
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt.toISOString()
        }));

      const reportData: OrderStatusData = {
        clinicName: clinic,
        statusBreakdown,
        recentOrders,
        summary: {
          totalOrders,
          totalValue,
          averageOrderValue: totalOrders > 0 ? totalValue / totalOrders : 0
        }
      };

      return res.status(200).json({
        success: true,
        data: reportData
      });

    } catch (error) {
      logger.error('Order status report error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to generate order status report',
          code: 'ORDER_STATUS_ERROR'
        }
      });
    }
  }

  /**
   * Generate Co-Pay Summary Report (Renamed from Sales Refund Summary)
   */
  static async getCoPaySummary(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Clinic name is required', code: 'MISSING_CLINIC_NAME' }
        });
      }

      // Type assertion for clinicName (validated above)
      const clinic = clinicName as string;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Fetch actual Payment data from database
      const payments = await PaymentModel.find({
        clinicName: clinic,
        paymentDate: { $gte: start, $lte: end },
        $or: [
          { 'amounts.cob1Amount': { $gt: 0 } },
          { 'amounts.cob2Amount': { $gt: 0 } }
        ]
      }).lean();

      // Calculate co-pay summary
      let totalCoPayments = 0;
      let totalCoPayAmount = 0;
      let insurance1CoPayments = 0;
      let insurance2CoPayments = 0;

      const coPayStats = new Map();
      coPayStats.set('Insurance 1', { insuranceType: 'Insurance 1', count: 0, amount: 0 });
      coPayStats.set('Insurance 2', { insuranceType: 'Insurance 2', count: 0, amount: 0 });

      payments.forEach((payment: any) => {
        if (payment.amounts?.cob1Amount && payment.amounts.cob1Amount > 0) {
          totalCoPayments += 1;
          totalCoPayAmount += payment.amounts.cob1Amount;
          insurance1CoPayments += 1;
          const stats = coPayStats.get('Insurance 1');
          stats.count += 1;
          stats.amount += payment.amounts.cob1Amount;
        }
        if (payment.amounts?.cob2Amount && payment.amounts.cob2Amount > 0) {
          totalCoPayments += 1;
          totalCoPayAmount += payment.amounts.cob2Amount;
          insurance2CoPayments += 1;
          const stats = coPayStats.get('Insurance 2');
          stats.count += 1;
          stats.amount += payment.amounts.cob2Amount;
        }
      });

      const averageCoPayment = totalCoPayments > 0 ? totalCoPayAmount / totalCoPayments : 0;

      const coPayBreakdown = Array.from(coPayStats.values()).map(stats => ({
        ...stats,
        percentage: totalCoPayAmount > 0 ? (stats.amount / totalCoPayAmount) * 100 : 0
      }));

      // Calculate monthly trends
      const monthlyStats = new Map();
      payments.forEach((payment: any) => {
        const month = new Date(payment.paymentDate || payment.createdAt).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyStats.has(month)) {
          monthlyStats.set(month, { month, amount: 0, count: 0 });
        }
        const stats = monthlyStats.get(month);
        if (payment.amounts?.cob1Amount) {
          stats.amount += payment.amounts.cob1Amount;
          stats.count += 1;
        }
        if (payment.amounts?.cob2Amount) {
          stats.amount += payment.amounts.cob2Amount;
          stats.count += 1;
        }
      });

      const monthlyTrends = Array.from(monthlyStats.values())
        .sort((a, b) => a.month.localeCompare(b.month));

      const reportData: CoPaySummaryData = {
        clinicName: clinic,
        dateRange: {
          startDate: start.toISOString().split('T')[0] as string,
          endDate: end.toISOString().split('T')[0] as string
        },
        summary: {
          totalCoPayments,
          totalCoPayAmount,
          averageCoPayment,
          insurance1CoPayments,
          insurance2CoPayments
        },
        coPayBreakdown,
        monthlyTrends
      };

      return res.status(200).json({
        success: true,
        data: reportData
      });

    } catch (error) {
      logger.error('Co-pay summary report error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to generate co-pay summary report',
          code: 'COPAY_SUMMARY_ERROR'
        }
      });
    }
  }

  /**
   * Generate Marketing Budget Summary Report (Renamed from Shoe Allowance Summary)
   */
  static async getMarketingBudgetSummary(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!clinicName) {
        return res.status(400).json({
          success: false,
          error: { message: 'Clinic name is required', code: 'MISSING_CLINIC_NAME' }
        });
      }

      // Type assertion for clinicName (validated above)
      const clinic = clinicName as string;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Get clients acquired in the date range with their referral sources
      const clients = await ClientModel.find({
        defaultClinic: clinic,
        dateCreated: { $gte: start, $lte: end }
      }).lean();

      const totalClients = clients.length;

      // Get revenue from acquired clients
      const clientIds = clients.map((c: any) => c.clientId || c.clientKey);
      const clientOrders = await Order.find({
        clientId: { $in: clientIds },
        clinicName: clinic,
        createdAt: { $gte: start, $lte: end }
      }).lean();

      const totalRevenue = clientOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);

      // Group clients by referral source from client data
      const referralStats = new Map();
      clients.forEach((client: any) => {
        // Check for referral source in client data
        const source = client.referralSource || client.source || 'Unknown';
        if (!referralStats.has(source)) {
          referralStats.set(source, { source, count: 0, clientIds: [] });
        }
        const stats = referralStats.get(source);
        stats.count += 1;
        stats.clientIds.push(client.clientId || client.clientKey);
      });

      // Calculate revenue per referral source
      const channels = Array.from(referralStats.values()).map(stats => {
        const sourceOrders = clientOrders.filter((order: any) => 
          stats.clientIds.includes(order.clientId)
        );
        const sourceRevenue = sourceOrders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
        
        // NOTE: Marketing spend data would need to come from external marketing platform
        // integrations (Google Ads API, Facebook Ads API, etc.)
        // For now, we calculate estimated spend based on industry averages
        const estimatedCPA = 50; // Estimated cost per acquisition
        const estimatedSpent = stats.count * estimatedCPA;
        const roi = estimatedSpent > 0 ? ((sourceRevenue - estimatedSpent) / estimatedSpent) * 100 : 0;

        return {
          channel: stats.source,
          spent: estimatedSpent,
          clients: stats.count,
          revenue: sourceRevenue,
          roi: Math.round(roi)
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // Calculate overall metrics
      const totalSpent = channels.reduce((sum, ch) => sum + ch.spent, 0);
      const totalROI = totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent) * 100 : 0;
      const conversionRate = totalClients > 0 ? (clientOrders.length / totalClients) : 0;
      const costPerAcquisition = totalClients > 0 ? totalSpent / totalClients : 0;

      // Generate campaign data from top channels
      // NOTE: Real campaign data would come from marketing platform APIs
      const campaigns = channels.slice(0, 5).map((channel, index) => ({
        campaignName: `${channel.channel} Campaign`,
        spent: channel.spent,
        revenue: channel.revenue,
        roi: channel.roi,
        conversions: channel.clients
      }));

      const reportData: MarketingBudgetData = {
        clinicName: clinic,
        dateRange: {
          startDate: start.toISOString().split('T')[0] as string,
          endDate: end.toISOString().split('T')[0] as string
        },
        summary: {
          totalSpent,
          totalROI,
          conversionRate,
          costPerAcquisition
        },
        campaigns,
        channels
      };

      return res.status(200).json({
        success: true,
        data: reportData
      });

    } catch (error) {
      logger.error('Marketing budget report error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to generate marketing budget report',
          code: 'MARKETING_BUDGET_ERROR'
        }
      });
    }
  }

  /**
   * Get all available reports for a clinic
   */
  static async getAvailableReports(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { clinicName } = req.params;

      const reports = [
        {
          id: 'account-summary',
          name: 'Account Summary Report',
          description: 'Comprehensive overview of clinic performance and revenue',
          category: 'Financial',
          endpoint: `/reports/${clinicName}/account-summary`
        },
        {
          id: 'account-summary-2',
          name: 'Account Summary Report 2',
          description: 'Alternative view of account summary with additional metrics',
          category: 'Financial',
          endpoint: `/reports/${clinicName}/account-summary?variant=2`
        },
        {
          id: 'payment-summary',
          name: 'Payment Summary by Day Range',
          description: 'Detailed payment analysis for specified date range',
          category: 'Financial',
          endpoint: `/reports/${clinicName}/payment-summary`
        },
        {
          id: 'timesheet',
          name: 'Time Sheet',
          description: 'Practitioner hours and utilization report',
          category: 'Operations',
          endpoint: `/reports/${clinicName}/timesheet`
        },
        {
          id: 'order-status',
          name: 'Order Status',
          description: 'Current status of all orders in the system',
          category: 'Operations',
          endpoint: `/reports/${clinicName}/order-status`
        },
        {
          id: 'copay-summary',
          name: 'Co Pay Summary',
          description: 'Insurance co-payment analysis and trends',
          category: 'Financial',
          endpoint: `/reports/${clinicName}/copay-summary`
        },
        {
          id: 'marketing-budget',
          name: 'Marketing Budget Summary',
          description: 'Marketing spend and ROI analysis',
          category: 'Marketing',
          endpoint: `/reports/${clinicName}/marketing-budget`
        }
      ];

      return res.status(200).json({
        success: true,
        data: {
          clinicName,
          reports,
          categories: ['Financial', 'Operations', 'Marketing']
        }
      });

    } catch (error) {
      logger.error('Available reports error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get available reports',
          code: 'AVAILABLE_REPORTS_ERROR'
        }
      });
    }
  }
}
