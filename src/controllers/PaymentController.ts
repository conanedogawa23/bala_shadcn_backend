import { Request, Response } from 'express';
import { Types } from 'mongoose';
import PaymentModel, { IPayment, PaymentStatus, PaymentType, PaymentMethod } from '../models/Payment';
import { ClinicService } from '../services/ClinicService';

// Extend Request interface to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    _id: Types.ObjectId;
    username: string;
    email: string;
  };
}

export class PaymentController {
  /**
   * @route   GET /api/v1/payments
   * @desc    Get all payments with filtering and pagination
   * @access  Private
   * @params  page, limit, status, paymentMethod, paymentType, clinicName, clientId, startDate, endDate, outstanding
   */
  static async getAllPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        paymentMethod,
        paymentType,
        clinicName,
        clientId,
        startDate,
        endDate,
        outstanding
      } = req.query;

      const filter: any = {};

      // Apply filters
      if (status) filter.status = status;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (paymentType) filter.paymentType = paymentType;
      if (clinicName) {
        // Convert slug to proper clinic name if needed
        let actualClinicName: string = clinicName as string;
        try {
          actualClinicName = ClinicService.slugToClinicName(clinicName as string);
        } catch (conversionError) {
          // If conversion fails, assume it's already a proper clinic name
          actualClinicName = clinicName as string;
        }
        filter.clinicName = actualClinicName;
      }
      if (clientId) filter.clientId = Number(clientId);
      if (outstanding === 'true') filter['amounts.totalOwed'] = { $gt: 0 };

      // Date range filter
      if (startDate || endDate) {
        filter.paymentDate = {};
        if (startDate) filter.paymentDate.$gte = new Date(startDate as string);
        if (endDate) filter.paymentDate.$lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);
      
      const [payments, total] = await Promise.all([
        PaymentModel.find(filter)
          .populate('orderId', 'orderNumber status clientId')
          .sort({ paymentDate: -1 })
          .skip(skip)
          .limit(Number(limit)),
        PaymentModel.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / Number(limit));

      res.json({
        success: true,
        data: payments,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1
        }
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/:id
   * @desc    Get payment by ID
   * @access  Private
   */
  static async getPaymentById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
        return;
      }

      const payment = await PaymentModel.findById(id)
        .populate('orderId', 'orderNumber status clientId clientName totalAmount')
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      console.error('Error fetching payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/clinic/:clinicName
   * @desc    Get payments by clinic name
   * @access  Private
   */
  static async getPaymentsByClinic(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName } = req.params;
      const { page = 1, limit = 20, status, outstanding } = req.query;

      if (!rawClinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      // Convert slug to proper clinic name if needed
      let actualClinicName: string = rawClinicName;
      try {
        actualClinicName = ClinicService.slugToClinicName(rawClinicName);
      } catch (conversionError) {
        // If conversion fails, assume it's already a proper clinic name
        actualClinicName = rawClinicName;
      }

      const filter: any = { clinicName: actualClinicName };
      if (status) filter.status = status;
      if (outstanding === 'true') filter['amounts.totalOwed'] = { $gt: 0 };

      const skip = (Number(page) - 1) * Number(limit);

      const [payments, total] = await Promise.all([
        PaymentModel.find(filter)
          .populate('orderId', 'orderNumber status')
          .sort({ paymentDate: -1 })
          .skip(skip)
          .limit(Number(limit)),
        PaymentModel.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: payments,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total
        }
      });
    } catch (error) {
      console.error('Error fetching clinic payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinic payments',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/client/:clientId
   * @desc    Get payments by client ID
   * @access  Private
   */
  static async getPaymentsByClient(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      if (!clientId) {
        res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
        return;
      }

      const payments = await PaymentModel.findByClient(Number(clientId));

      res.json({
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Error fetching client payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client payments',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   POST /api/v1/payments
   * @desc    Create new payment
   * @access  Private
   */
  static async createPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        orderNumber,
        clientId,
        clientName,
        clinicName,
        paymentMethod,
        paymentType,
        amounts,
        orderId,
        notes,
        referringNo
      } = req.body;

      // Validation
      if (!clientId || !clinicName || !paymentMethod || !paymentType || !amounts) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: clientId, clinicName, paymentMethod, paymentType, amounts'
        });
        return;
      }

      // Create payment
      const payment = new PaymentModel({
        orderNumber,
        clientId: Number(clientId),
        clientName,
        clinicName,
        paymentMethod,
        paymentType,
        amounts,
        orderId: orderId ? new Types.ObjectId(orderId) : undefined,
        notes,
        referringNo,
        createdBy: req.user?._id,
        userLoginName: req.user?.username
      });

      const savedPayment = await payment.save();

      res.status(201).json({
        success: true,
        message: 'Payment created successfully',
        data: savedPayment
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   PUT /api/v1/payments/:id
   * @desc    Update payment
   * @access  Private
   */
  static async updatePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
        return;
      }

      // Add audit information
      updateData.updatedBy = req.user?._id;

      const payment = await PaymentModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate('orderId', 'orderNumber status');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payment updated successfully',
        data: payment
      });
    } catch (error) {
      console.error('Error updating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   DELETE /api/v1/payments/:id
   * @desc    Soft delete payment (mark as deleted)
   * @access  Private
   */
  static async deletePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
        return;
      }

      const payment = await PaymentModel.findByIdAndUpdate(
        id,
        {
          deletedStatus: 'deleted',
          updatedBy: req.user?._id
        },
        { new: true }
      );

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Payment deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   POST /api/v1/payments/:id/add-amount
   * @desc    Add payment amount to existing payment
   * @access  Private
   */
  static async addPaymentAmount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { paymentType, amount } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
        return;
      }

      if (!paymentType || amount === undefined) {
        res.status(400).json({
          success: false,
          message: 'Payment type and amount are required'
        });
        return;
      }

      const payment = await PaymentModel.findById(id);
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      payment.addPaymentAmount(paymentType, Number(amount));
      payment.updatedBy = req.user?._id as Types.ObjectId;
      await payment.save();

      res.json({
        success: true,
        message: 'Payment amount added successfully',
        data: payment
      });
    } catch (error) {
      console.error('Error adding payment amount:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add payment amount',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   POST /api/v1/payments/:id/refund
   * @desc    Process payment refund
   * @access  Private
   */
  static async processRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { amount, refundType = PaymentType.SALES_REFUND } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
        return;
      }

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid refund amount is required'
        });
        return;
      }

      const payment = await PaymentModel.findById(id);
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      const refundedPayment = await payment.processRefund(Number(amount), refundType);
      refundedPayment.updatedBy = req.user?._id as Types.ObjectId;
      await refundedPayment.save();

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: refundedPayment
      });
    } catch (error) {
      console.error('Error processing refund:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process refund',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/stats/:clinicName
   * @desc    Get payment statistics for clinic
   * @access  Private
   */
  static async getPaymentStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clinicName } = req.params;

      if (!clinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      const [statusStats, methodStats, totalRevenue, outstandingPayments] = await Promise.all([
        PaymentModel.getPaymentStats(clinicName),
        PaymentModel.getPaymentMethodStats(clinicName),
        PaymentModel.getTotalRevenue(clinicName),
        PaymentModel.countDocuments({ 
          clinicName, 
          'amounts.totalOwed': { $gt: 0 } 
        })
      ]);

      res.json({
        success: true,
        data: {
          statusStats,
          methodStats,
          totalRevenue,
          outstandingPayments
        }
      });
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/outstanding/:clinicName
   * @desc    Get outstanding payments for clinic
   * @access  Private
   */
  static async getOutstandingPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clinicName } = req.params;
      const { page = 1, limit = 20 } = req.query;

      if (!clinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [payments, total] = await Promise.all([
        PaymentModel.find({ 
          clinicName, 
          'amounts.totalOwed': { $gt: 0 } 
        })
        .sort({ paymentDate: 1 })
        .skip(skip)
        .limit(Number(limit)),
        PaymentModel.countDocuments({ 
          clinicName, 
          'amounts.totalOwed': { $gt: 0 } 
        })
      ]);

      res.json({
        success: true,
        data: payments,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total
        }
      });
    } catch (error) {
      console.error('Error fetching outstanding payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch outstanding payments',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/revenue/:clinicName
   * @desc    Get revenue data for clinic with date range
   * @access  Private
   */
  static async getRevenueData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clinicName } = req.params;
      const { startDate, endDate } = req.query;

      if (!clinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const totalRevenue = await PaymentModel.getTotalRevenue(clinicName, start, end);

      res.json({
        success: true,
        data: {
          totalRevenue,
          startDate: start,
          endDate: end,
          clinicName
        }
      });
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch revenue data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
