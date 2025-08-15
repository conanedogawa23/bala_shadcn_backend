import { Request, Response } from 'express';
import { AdvancedBillingService } from '../services/AdvancedBillingService';
import { AdvancedBillingView } from '../views/AdvancedBillingView';
import { BillingStatus } from '../models/AdvancedBilling';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { validateRequiredString, ensureString } from '../utils/mongooseHelpers';

export class AdvancedBillingController {
  /**
   * Get all advanced billings
   * GET /api/advanced-billing
   */
  static getAllBillings = asyncHandler(async (req: Request, res: Response) => {
    const {
      clientId,
      clinicName,
      status,
      isActive,
      isOverdue,
      productKey,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query as any;

    const filters = {
      clientId,
      clinicName,
      status: status as BillingStatus,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      isOverdue: isOverdue !== undefined ? isOverdue === 'true' : undefined,
      productKey: productKey ? parseInt(productKey) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await AdvancedBillingService.getAllBillings(filters);
    const response = AdvancedBillingView.formatBillingList({
      ...result,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      message: 'Advanced billings retrieved successfully',
      data: response
    });
  });

  /**
   * Get billing by ID
   * GET /api/advanced-billing/:id
   */
  static getBillingById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const billingId = validateRequiredString(id, 'Billing ID');

    const billing = await AdvancedBillingService.getBillingById(billingId);
    
    if (!billing) {
      throw new AppError('Advanced billing not found', 404);
    }

    const response = AdvancedBillingView.formatBilling(billing);

    res.json({
      success: true,
      message: 'Advanced billing retrieved successfully',
      data: response
    });
  });

  /**
   * Get billing by billing ID (MSSQL key)
   * GET /api/advanced-billing/billing-id/:billingId
   */
  static getBillingByBillingId = asyncHandler(async (req: Request, res: Response) => {
    const { billingId } = req.params;
    const validBillingId = validateRequiredString(billingId, 'Billing ID');

    const billing = await AdvancedBillingService.getBillingByBillingId(parseInt(validBillingId));
    
    if (!billing) {
      throw new AppError('Advanced billing not found', 404);
    }

    const response = AdvancedBillingView.formatBilling(billing);

    res.json({
      success: true,
      message: 'Advanced billing retrieved successfully',
      data: response
    });
  });

  /**
   * Get active billings
   * GET /api/advanced-billing/active
   */
  static getActiveBillings = asyncHandler(async (req: Request, res: Response) => {
    const billings = await AdvancedBillingService.getActiveBillings();
    const response = AdvancedBillingView.formatBillings(billings);

    res.json({
      success: true,
      message: 'Active billings retrieved successfully',
      data: {
        billings: response,
        count: response.length
      }
    });
  });

  /**
   * Get billings by client
   * GET /api/advanced-billing/client/:clientId
   */
  static getBillingsByClient = asyncHandler(async (req: Request, res: Response) => {
    const { clientId } = req.params;
    const validClientId = validateRequiredString(clientId, 'Client ID');

    const billings = await AdvancedBillingService.getBillingsByClient(validClientId);
    const response = AdvancedBillingView.formatClientBillings(validClientId, billings);

    res.json({
      success: true,
      message: 'Client billings retrieved successfully',
      data: response
    });
  });

  /**
   * Get billings by clinic
   * GET /api/advanced-billing/clinic/:clinicName
   */
  static getBillingsByClinic = asyncHandler(async (req: Request, res: Response) => {
    const { clinicName } = req.params;
    const validClinicName = validateRequiredString(clinicName, 'Clinic Name');

    const billings = await AdvancedBillingService.getBillingsByClinic(validClinicName);
    const response = AdvancedBillingView.formatClinicBillings(validClinicName, billings);

    res.json({
      success: true,
      message: 'Clinic billings retrieved successfully',
      data: response
    });
  });

  /**
   * Get overdue billings
   * GET /api/advanced-billing/overdue
   */
  static getOverdueBillings = asyncHandler(async (req: Request, res: Response) => {
    const billings = await AdvancedBillingService.getOverdueBillings();
    const response = AdvancedBillingView.formatBillings(billings);

    res.json({
      success: true,
      message: 'Overdue billings retrieved successfully',
      data: {
        billings: response,
        count: response.length
      }
    });
  });

  /**
   * Get upcoming billings
   * GET /api/advanced-billing/upcoming
   */
  static getUpcomingBillings = asyncHandler(async (req: Request, res: Response) => {
    const { days = 30 } = req.query as any;

    const billings = await AdvancedBillingService.getUpcomingBillings(parseInt(days));
    const response = AdvancedBillingView.formatBillings(billings);

    res.json({
      success: true,
      message: 'Upcoming billings retrieved successfully',
      data: {
        billings: response,
        count: response.length,
        daysAhead: parseInt(days)
      }
    });
  });

  /**
   * Get billings expiring soon
   * GET /api/advanced-billing/expiring
   */
  static getBillingsExpiringSoon = asyncHandler(async (req: Request, res: Response) => {
    const { days = 7 } = req.query as any;

    const billings = await AdvancedBillingService.getBillingsExpiringSoon(parseInt(days));
    const response = AdvancedBillingView.formatBillings(billings);

    res.json({
      success: true,
      message: 'Expiring billings retrieved successfully',
      data: {
        billings: response,
        count: response.length,
        daysAhead: parseInt(days)
      }
    });
  });

  /**
   * Get billing calendar events
   * GET /api/advanced-billing/calendar
   */
  static getBillingCalendarEvents = asyncHandler(async (req: Request, res: Response) => {
    const {
      startDate,
      endDate,
      clinicName,
      status,
      isActive = 'true'
    } = req.query as any;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      clinicName,
      status: status as BillingStatus,
      isActive: isActive === 'true',
      limit: 1000 // High limit for calendar view
    };

    const result = await AdvancedBillingService.getAllBillings(filters);
    const response = AdvancedBillingView.formatBillingsForCalendar(result.billings);

    res.json({
      success: true,
      message: 'Calendar billing events retrieved successfully',
      data: response
    });
  });

  /**
   * Create new billing
   * POST /api/advanced-billing
   */
  static createBilling = asyncHandler(async (req: Request, res: Response) => {
    const billingData = req.body;

    const billing = await AdvancedBillingService.createBilling(billingData);
    const response = AdvancedBillingView.formatBilling(billing);

    res.status(201).json({
      success: true,
      message: 'Advanced billing created successfully',
      data: response
    });
  });

  /**
   * Update billing
   * PUT /api/advanced-billing/:id
   */
  static updateBilling = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validId = validateRequiredString(id, 'Billing ID');
    const updateData = req.body;

    const billing = await AdvancedBillingService.updateBilling(validId, updateData);
    
    if (!billing) {
      throw new AppError('Advanced billing not found', 404);
    }

    const response = AdvancedBillingView.formatBilling(billing);

    res.json({
      success: true,
      message: 'Advanced billing updated successfully',
      data: response
    });
  });

  /**
   * Update billing status
   * PUT /api/advanced-billing/:id/status
   */
  static updateBillingStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validId = validateRequiredString(id, 'Billing ID');
    const { status } = req.body;

    if (!Object.values(BillingStatus).includes(status)) {
      throw new AppError('Invalid billing status', 400);
    }

    const billing = await AdvancedBillingService.updateBillingStatus(validId, status);
    
    if (!billing) {
      throw new AppError('Advanced billing not found', 404);
    }

    const response = AdvancedBillingView.formatBilling(billing);

    res.json({
      success: true,
      message: 'Billing status updated successfully',
      data: response
    });
  });

  /**
   * Delete billing
   * DELETE /api/advanced-billing/:id
   */
  static deleteBilling = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validId = validateRequiredString(id, 'Billing ID');

    const deleted = await AdvancedBillingService.deleteBilling(validId);
    
    if (!deleted) {
      throw new AppError('Advanced billing not found', 404);
    }

    res.json({
      success: true,
      message: 'Advanced billing deleted successfully',
      data: { deleted: true }
    });
  });

  /**
   * Get billing statistics
   * GET /api/advanced-billing/stats/overview
   */
  static getBillingStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await AdvancedBillingService.getBillingStats();
    const response = AdvancedBillingView.formatBillingStats(stats);

    res.json({
      success: true,
      message: 'Billing statistics retrieved successfully',
      data: response
    });
  });

  /**
   * Get billing summary for dashboard
   * GET /api/advanced-billing/summary
   */
  static getBillingSummary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await AdvancedBillingService.getBillingSummary();
    const response = AdvancedBillingView.formatBillingSummary(summary);

    res.json({
      success: true,
      message: 'Billing summary retrieved successfully',
      data: response
    });
  });

  /**
   * Bulk update bill dates
   * PUT /api/advanced-billing/bulk/bill-dates
   */
  static bulkUpdateBillDates = asyncHandler(async (req: Request, res: Response) => {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError('Updates array is required and must not be empty', 400);
    }

    // Validate update structure
    const isValidUpdates = updates.every(update => 
      typeof update.billingId === 'number' && 
      update.billDate && 
      !isNaN(new Date(update.billDate).getTime())
    );

    if (!isValidUpdates) {
      throw new AppError('Invalid update format. Each update must have billingId and valid billDate', 400);
    }

    // Convert date strings to Date objects
    const processedUpdates = updates.map(update => ({
      billingId: update.billingId,
      billDate: new Date(update.billDate)
    }));

    await AdvancedBillingService.bulkUpdateBillDates(processedUpdates);

    res.json({
      success: true,
      message: 'Bill dates updated successfully',
      data: {
        updatedCount: processedUpdates.length
      }
    });
  });

  /**
   * Get revenue trends
   * GET /api/advanced-billing/trends/revenue
   */
  static getRevenueTrends = asyncHandler(async (req: Request, res: Response) => {
    const {
      startDate,
      endDate,
      clinicName
    } = req.query as any;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      clinicName,
      limit: 10000 // High limit for trend analysis
    };

    const result = await AdvancedBillingService.getAllBillings(filters);
    const response = AdvancedBillingView.formatRevenueTrends(result.billings);

    res.json({
      success: true,
      message: 'Revenue trends retrieved successfully',
      data: response
    });
  });

  /**
   * Get billings for frontend compatibility
   * GET /api/advanced-billing/frontend-compatible
   */
  static getBillingsForFrontend = asyncHandler(async (req: Request, res: Response) => {
    const {
      clientId,
      clinicName,
      isActive = 'true',
      limit = 100
    } = req.query as any;

    const filters = {
      clientId,
      clinicName,
      isActive: isActive === 'true',
      page: 1,
      limit: parseInt(limit)
    };

    const result = await AdvancedBillingService.getAllBillings(filters);
    const response = AdvancedBillingView.formatBillingsForFrontend(result.billings);

    res.json({
      success: true,
      message: 'Billings retrieved for frontend',
      data: response,
      meta: {
        total: result.total,
        returned: response.length
      }
    });
  });
}
