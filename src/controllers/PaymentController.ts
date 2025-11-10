import { Request, Response } from 'express';
import { Types } from 'mongoose';
import PaymentModel, { IPayment, PaymentStatus, PaymentType, PaymentMethod } from '../models/Payment';
import { ClientModel } from '../models/Client';
import { ClinicModel } from '../models/Clinic';
import { ClinicService } from '../services/ClinicService';
import { PaymentService } from '../services/PaymentService';

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
   * Helper method to find payment by ID (supports both ObjectId and paymentNumber)
   */
    private static async findPaymentById(id: string): Promise<any> {
    console.log(`Helper findPaymentById called with: ${id}`);
    
    let payment;
    
    // Try to find by MongoDB _id first
    console.log(`Searching by ObjectId: ${id}`);
    try {
      payment = await PaymentModel.findById(id)
        .populate('orderId', 'orderNumber status clientId clientName totalAmount')
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email');
      console.log(`ObjectId search result: ${payment ? 'found' : 'not found'}`);
    } catch (objectIdError) {
      console.log('ObjectId search failed, trying other methods...');
    }
    
    // If not found by ObjectId, try paymentId
    if (!payment) {
      console.log(`Searching by paymentId: ${id}`);
      try {
        payment = await PaymentModel.findOne({ paymentId: id })
          .populate('orderId', 'orderNumber status clientId clientName totalAmount')
          .populate('createdBy', 'username email')
          .populate('updatedBy', 'username email');
        console.log(`PaymentId search result: ${payment ? 'found' : 'not found'}`);
      } catch (paymentIdError) {
        console.log('PaymentId search failed, trying paymentNumber...');
      }
    }
    
    // If still not found, try paymentNumber as final fallback
    if (!payment) {
      console.log(`Fallback: Searching by paymentNumber: ${id}`);
      try {
        payment = await PaymentModel.findOne({ paymentNumber: id })
          .populate('orderId', 'orderNumber status clientId clientName totalAmount')
          .populate('createdBy', 'username email')
          .populate('updatedBy', 'username email');
        console.log(`PaymentNumber fallback result: ${payment ? 'found' : 'not found'}`);
      } catch (paymentNumberError) {
        console.error('All search methods failed:', paymentNumberError);
      }
    }
    
    return payment;
  }

  /**
   * @route   GET /api/v1/payments
   * @desc    Get all payments with filtering and pagination
   * @access  Private
   * @params  page, limit, status, paymentMethod, paymentType, clinicName, clientId, orderNumber, orderId, startDate, endDate, outstanding
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
        orderNumber,
        orderId,
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
      if (orderNumber) filter.orderNumber = orderNumber as string;
      if (orderId) {
        // Handle ObjectId filtering for orderId
        try {
          filter.orderId = new Types.ObjectId(orderId as string);
        } catch (error) {
          // If invalid ObjectId, filter will not match anything
          filter.orderId = null;
        }
      }
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
   * @desc    Get payment by ID (accepts both MongoDB _id and paymentNumber)
   * @access  Private
   */
  static async getPaymentById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || id.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
        return;
      }

      console.log(`PaymentController.getPaymentById called with ID: ${id}`);

      const payment = await PaymentController.findPaymentById(id);

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      // Transform payment data for frontend compatibility
      const paymentData = payment.toObject();
      
      // Handle both data formats: direct fields vs nested amounts object
      if (paymentData.amounts && paymentData.amounts.totalPaymentAmount !== undefined) {
        // Legacy format with amounts object
        paymentData.total = paymentData.amounts.totalPaymentAmount;
        paymentData.amountPaid = paymentData.amounts.totalPaid;
        paymentData.amountDue = paymentData.amounts.totalOwed;
      } else {
        // New format with direct fields - ensure they exist or set defaults
        paymentData.total = paymentData.total || 0;
        paymentData.amountPaid = paymentData.amountPaid || 0;
        paymentData.amountDue = paymentData.amountDue || 0;
      }

      // Add alias fields (preserve original paymentId from database)
      if (!paymentData.paymentId) {
        paymentData.paymentId = paymentData._id; // Fallback to _id if no paymentId
      }
      paymentData.invoiceNumber = paymentData.invoiceNumber || paymentData.paymentNumber;

      // Fetch associated client data
      let clientData = null;
      try {
        const client = await ClientModel.findOne({ clientId: payment.clientId });
        if (client) {
          clientData = {
            name: client.personalInfo?.fullName || `${client.personalInfo?.firstName || ''} ${client.personalInfo?.lastName || ''}`.trim(),
            address: client.contact?.address?.street || '',
            city: client.contact?.address?.city || '',
            province: client.contact?.address?.province || '',
            postalCode: client.contact?.address?.postalCode?.full || '',
            phone: client.contact?.phones?.cell?.full || client.contact?.phones?.home?.full || client.contact?.phones?.work?.full || '',
            email: client.contact?.email || ''
          };
        }
      } catch (clientError) {
        console.error('Error fetching client data for invoice:', clientError);
        // Continue with null clientData - will use fallback
      }

      // Fetch associated clinic data
      let clinicData = null;
      try {
        // Use case-insensitive regex to handle clinic name variations (e.g., BodyBlissPhysio vs bodyblissphysio)
        // Explicitly select logo field to ensure it's included
        const clinic = await ClinicModel.findOne({ 
          name: { $regex: new RegExp(`^${payment.clinicName}$`, 'i') } 
        }).select('+logo');
        if (clinic) {
          // Set default phone/fax based on clinic (phone/fax not stored in clinic model)
          let defaultPhone = '(416) 555-0123';
          let defaultFax = '(416) 555-0124';
          
          // Clinic-specific defaults if needed
          if (clinic.name === 'bodyblissphysio') {
            defaultPhone = '(416) 555-0123';
            defaultFax = '(416) 555-0124';
          }
          
          // Log to verify logo exists
          console.log(`Clinic ${clinic.name} has logo:`, !!clinic.logo);
          if (clinic.logo) {
            console.log(`Logo details - contentType: ${clinic.logo.contentType}, filename: ${clinic.logo.filename}, data length: ${clinic.logo.data?.length || 0}`);
          }
          
          clinicData = {
            name: clinic.name || '',
            displayName: clinic.displayName || clinic.name || '',
            address: clinic.address?.street || '',
            city: clinic.address?.city || '',
            province: clinic.address?.province || '',
            postalCode: clinic.address?.postalCode || '',
            phone: defaultPhone,
            fax: defaultFax,
            logo: clinic.logo ? {
              data: clinic.logo.data,
              contentType: clinic.logo.contentType,
              filename: clinic.logo.filename
            } : undefined
          };
        }
      } catch (clinicError) {
        console.error('Error fetching clinic data for invoice:', clinicError);
        // Continue with null clinicData - will use fallback
      }

      // Add client and clinic data to response
      paymentData.clientData = clientData;
      paymentData.clinicData = clinicData;

      console.log(`Successfully found payment: ${paymentData.paymentNumber}`);

      res.json({
        success: true,
        data: paymentData
      });
    } catch (error) {
      console.error('Error fetching payment:', error);

      // Enhanced error handling
      if (error instanceof Error) {
        if (error.name === 'CastError') {
          res.status(400).json({
            success: false,
            message: 'Invalid payment ID format'
          });
          return;
        }
      }

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
   * @access  Private - Requires 'canCreatePayments' permission
   */
  static async createPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Verify user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required to create payment'
        });
        return;
      }

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

      console.log('Creating payment with data:', JSON.stringify({ clientId, clinicName, paymentMethod, paymentType, amounts }));

      // Validation
      if (!clientId || !clinicName || !paymentMethod || !paymentType || !amounts) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: clientId, clinicName, paymentMethod, paymentType, amounts'
        });
        return;
      }

      // Validate amounts structure
      if (typeof amounts !== 'object' || amounts.totalPaymentAmount === undefined) {
        res.status(400).json({
          success: false,
          message: 'Invalid amounts object. Must contain totalPaymentAmount'
        });
        return;
      }

      // Validate totalPaymentAmount is positive
      if (amounts.totalPaymentAmount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Payment amount must be greater than zero'
        });
        return;
      }

      // Validate all amount fields are not negative
      const amountFields = [
        'popAmount', 'popfpAmount', 'dpaAmount', 'dpafpAmount',
        'cob1Amount', 'cob2Amount', 'cob3Amount',
        'insurance1stAmount', 'insurance2ndAmount', 'insurance3rdAmount',
        'refundAmount', 'salesRefundAmount', 'writeoffAmount', 'noInsurFpAmount', 'badDebtAmount'
      ];
      
      for (const field of amountFields) {
        if (amounts[field] !== undefined && amounts[field] < 0) {
          res.status(400).json({
            success: false,
            message: `${field} cannot be negative`
          });
          return;
        }
      }

      // Validate clientId is a valid number
      const numericClientId = Number(clientId);
      if (isNaN(numericClientId) || numericClientId <= 0) {
        res.status(400).json({
          success: false,
          message: 'clientId must be a positive number'
        });
        return;
      }

      // Ensure amounts have default values
      const sanitizedAmounts = {
        totalPaymentAmount: amounts.totalPaymentAmount,
        totalPaid: amounts.totalPaid || 0,
        totalOwed: amounts.totalOwed || amounts.totalPaymentAmount,
        popAmount: amounts.popAmount || 0,
        popfpAmount: amounts.popfpAmount || 0,
        dpaAmount: amounts.dpaAmount || 0,
        dpafpAmount: amounts.dpafpAmount || 0,
        cob1Amount: amounts.cob1Amount || 0,
        cob2Amount: amounts.cob2Amount || 0,
        cob3Amount: amounts.cob3Amount || 0,
        insurance1stAmount: amounts.insurance1stAmount || 0,
        insurance2ndAmount: amounts.insurance2ndAmount || 0,
        insurance3rdAmount: amounts.insurance3rdAmount || 0,
        refundAmount: amounts.refundAmount || 0,
        salesRefundAmount: amounts.salesRefundAmount || 0,
        writeoffAmount: amounts.writeoffAmount || 0,
        noInsurFpAmount: amounts.noInsurFpAmount || 0,
        badDebtAmount: amounts.badDebtAmount || 0
      };

      // Create payment
      const payment = new PaymentModel({
        orderNumber,
        clientId: numericClientId,
        clientName,
        clinicName,
        paymentMethod,
        paymentType,
        amounts: sanitizedAmounts,
        orderId: orderId ? new Types.ObjectId(orderId) : undefined,
        notes,
        referringNo,
        createdBy: req.user._id,
        userLoginName: req.user.username,
        paymentDate: new Date()
      });

      const savedPayment = await payment.save();

      console.log('Payment created successfully:', savedPayment._id, savedPayment.paymentNumber);

      res.status(201).json({
        success: true,
        message: 'Payment created successfully',
        data: savedPayment
      });
    } catch (error) {
      console.error('Error creating payment:', error);

      // Handle validation errors
      if (error instanceof Error) {
        if (error.name === 'ValidationError') {
          res.status(400).json({
            success: false,
            message: 'Payment validation failed',
            error: error.message
          });
          return;
        }
        if (error.name === 'MongoServerError' && (error as any).code === 11000) {
          res.status(409).json({
            success: false,
            message: 'Payment with this identifier already exists'
          });
          return;
        }
      }

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

      console.log('Updating payment:', id, 'with data:', JSON.stringify(updateData));

      // Validate amounts if provided
      if (updateData.amounts) {
        // Validate totalPaymentAmount is positive
        if (updateData.amounts.totalPaymentAmount !== undefined && updateData.amounts.totalPaymentAmount <= 0) {
          res.status(400).json({
            success: false,
            message: 'Payment amount must be greater than zero'
          });
          return;
        }

        // Validate all amount fields are not negative
        const amountFields = [
          'totalPaid', 'totalOwed', 'popAmount', 'popfpAmount', 'dpaAmount', 'dpafpAmount',
          'cob1Amount', 'cob2Amount', 'cob3Amount',
          'insurance1stAmount', 'insurance2ndAmount', 'insurance3rdAmount',
          'refundAmount', 'salesRefundAmount', 'writeoffAmount', 'noInsurFpAmount', 'badDebtAmount'
        ];
        
        for (const field of amountFields) {
          if (updateData.amounts[field] !== undefined && updateData.amounts[field] < 0) {
            res.status(400).json({
              success: false,
              message: `${field} cannot be negative`
            });
            return;
          }
        }
      }

      // Add audit information
      updateData.updatedBy = req.user?._id;

      const payment = await PaymentModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('orderId', 'orderNumber status');

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
        return;
      }

      console.log('Payment updated successfully:', payment._id, 'Status:', payment.status);

      res.json({
        success: true,
        message: 'Payment updated successfully',
        data: payment
      });
    } catch (error) {
      console.error('Error updating payment:', error);
      
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

  /**
   * @route   GET /api/v1/payments/report/account-summary/:clinicName
   * @desc    Get account summary report for a clinic with client-level details
   * @access  Private
   */
  static async getAccountSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName } = req.params;
      const { page = 1, limit = 20, sortBy = 'clientName' } = req.query;

      if (!rawClinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      let actualClinicName: string = rawClinicName as string;
      try {
        actualClinicName = ClinicService.slugToClinicName(rawClinicName as string);
      } catch (conversionError) {
        actualClinicName = rawClinicName as string;
      }

      const result = await PaymentService.getAccountSummary(
        actualClinicName,
        Number(page),
        Number(limit),
        sortBy as string
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          currentPage: result.page,
          totalPages: Math.ceil(result.total / result.limit),
          totalItems: result.total,
          itemsPerPage: result.limit
        }
      });
    } catch (error) {
      console.error('Error fetching account summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch account summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/report/payment-summary/:clinicName
   * @desc    Get payment summary by date range and payment type
   * @access  Private
   */
  static async getPaymentSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName } = req.params;
      const { startDate, endDate } = req.query;

      if (!rawClinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      let actualClinicName: string = rawClinicName as string;
      try {
        actualClinicName = ClinicService.slugToClinicName(rawClinicName as string);
      } catch (conversionError) {
        actualClinicName = rawClinicName as string;
      }

      const result = await PaymentService.getPaymentSummary(
        actualClinicName,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: {
          paymentTypeSummary: result.paymentTypeSummary,
          dailySummary: result.dailySummary,
          dateRange: {
            startDate: startDate || 'All time',
            endDate: endDate || 'All time'
          }
        }
      });
    } catch (error) {
      console.error('Error fetching payment summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/report/client-history/:clientId
   * @desc    Get complete payment history for a client
   * @access  Private
   */
  static async getClientPaymentHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { page = 1, limit = 50, sortBy = 'paymentDate' } = req.query;

      if (!clientId) {
        res.status(400).json({
          success: false,
          message: 'Client ID is required'
        });
        return;
      }

      const result = await PaymentService.getClientPaymentHistory(
        Number(clientId),
        Number(page),
        Number(limit),
        sortBy as string
      );

      res.json({
        success: true,
        data: result.payments,
        statistics: result.stats,
        pagination: {
          currentPage: result.page,
          totalPages: Math.ceil(result.total / result.limit),
          totalItems: result.total,
          itemsPerPage: result.limit
        }
      });
    } catch (error) {
      console.error('Error fetching client payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client payment history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   GET /api/v1/payments/report/aging/:clinicName
   * @desc    Get aged accounts receivable report
   * @access  Private
   */
  static async getAgingReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { clinicName: rawClinicName } = req.params;

      if (!rawClinicName) {
        res.status(400).json({
          success: false,
          message: 'Clinic name is required'
        });
        return;
      }

      let actualClinicName: string = rawClinicName as string;
      try {
        actualClinicName = ClinicService.slugToClinicName(rawClinicName as string);
      } catch (conversionError) {
        actualClinicName = rawClinicName as string;
      }

      const result = await PaymentService.getAgingReport(actualClinicName);

      res.json({
        success: true,
        data: {
          agingByClient: result.agingByClient,
          summary: result.summary
        }
      });
    } catch (error) {
      console.error('Error fetching aging report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch aging report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * @route   POST /api/v1/payments/:id/dispute
   * @desc    Mark a payment as disputed
   * @access  Private
   */
  static async disputePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason, resolutionNotes } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required'
        });
        return;
      }

      const payment = await PaymentService.disputePayment(id, reason, resolutionNotes);

      res.json({
        success: true,
        message: 'Payment marked as disputed',
        data: payment
      });
    } catch (error) {
      console.error('Error disputing payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to dispute payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
