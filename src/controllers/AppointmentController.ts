import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AppointmentService } from '../services/AppointmentService';
import { AppointmentView } from '../views/AppointmentView';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequiredString } from '../utils/mongooseHelpers';

export class AppointmentController {
  /**
   * Get appointments by clinic with filtering
   */
  static getAppointmentsByClinic = asyncHandler(async (req: Request, res: Response) => {
    // Use simplified logic that works (based on test endpoint)
    const { clinicName } = req.params;
    const { page = '1', limit = '20' } = req.query;
    
    const { AppointmentModel } = require('@/models/Appointment');
    const { ClinicModel } = require('@/models/Clinic');
    
    // Check if clinic exists
    const clinic = await ClinicModel.findOne({ name: clinicName });
    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Clinic with id ${clinicName} not found`
        }
      });
    }
    
    // Map clinic name (same logic as working test)
    const appointmentClinicName = clinicName === 'bodyblissphysio' ? 'BodyBlissPhysio' : clinicName;
    
    // Get appointments with pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;
    
    const [appointments, total] = await Promise.all([
      AppointmentModel.find({ 
        clinicName: appointmentClinicName, 
        isActive: true 
      })
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
      AppointmentModel.countDocuments({ 
        clinicName: appointmentClinicName, 
        isActive: true 
      })
    ]);
    
    // Format response to match expected structure
    const response = {
      success: true,
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };

    return res.status(200).json(response);
  });

  /**
   * Get appointment by ID
   */
  static getAppointmentById = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const validId = validateRequiredString(id, 'Appointment ID');

    // Call service layer
    const appointment = await AppointmentService.getAppointmentById(validId);

    // Format response
    const response = AppointmentView.formatAppointment(appointment);
    return res.status(200).json(response);
  });

  /**
   * Get appointment by business appointmentId
   */
  static getAppointmentByBusinessId = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { appointmentId } = req.params;
    
    if (!appointmentId) {
      const response = AppointmentView.formatValidationError([{
        field: 'appointmentId',
        message: 'Appointment ID is required',
        value: appointmentId
      }]);
      return res.status(400).json(response);
    }
    
    const businessId = parseInt(appointmentId, 10);

    if (isNaN(businessId)) {
      const response = AppointmentView.formatValidationError([{
        field: 'appointmentId',
        message: 'Invalid business appointment ID format',
        value: appointmentId
      }]);
      return res.status(400).json(response);
    }

    // Call service layer
    const appointment = await AppointmentService.getAppointmentByBusinessId(businessId);

    // Format response
    const response = AppointmentView.formatAppointment(appointment);
    return res.status(200).json(response);
  });

  /**
   * Create new appointment
   */
  static createAppointment = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    // Call service layer
    const appointment = await AppointmentService.createAppointment(req.body);

    // Format response
    const response = AppointmentView.formatAppointment(appointment);
    return res.status(201).json(response);
  });

  /**
   * Update appointment
   */
  static updateAppointment = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const validId = validateRequiredString(id, 'Appointment ID');

    // Call service layer
    const appointment = await AppointmentService.updateAppointment(validId, req.body);

    // Format response
    const response = AppointmentView.formatAppointment(appointment);
    return res.status(200).json(response);
  });

  /**
   * Cancel appointment
   */
  static cancelAppointment = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const validId = validateRequiredString(id, 'Appointment ID');
    const { reason } = req.body;

    // Call service layer
    await AppointmentService.cancelAppointment(validId, reason);

    // Format response
    const response = AppointmentView.formatSuccess('Appointment cancelled successfully');
    return res.status(200).json(response);
  });

  /**
   * Complete appointment
   */
  static completeAppointment = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const validId = validateRequiredString(id, 'Appointment ID');
    const { notes } = req.body;

    // Call service layer
    const appointment = await AppointmentService.completeAppointment(validId, notes);

    // Format response
    const response = AppointmentView.formatAppointment(appointment);
    return res.status(200).json(response);
  });

  /**
   * Get appointments ready for billing
   */
  static getAppointmentsReadyToBill = asyncHandler(async (req: Request, res: Response) => {
    const { clinicName } = req.query;

    // Call service layer
    const appointments = await AppointmentService.getAppointmentsReadyToBill(clinicName as string);

    // Format response
    const response = AppointmentView.formatBillingAppointments(appointments);
    return res.status(200).json(response);
  });

  /**
   * Get resource schedule
   */
  static getResourceSchedule = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { resourceId } = req.params;
    const { date } = req.query;

    // Call service layer
    const schedule = await AppointmentService.getResourceSchedule(
      Number(resourceId),
      new Date(date as string)
    );

    // Format response
    const response = AppointmentView.formatSuccess('Resource schedule retrieved', schedule);
    return res.status(200).json(response);
  });

  /**
   * Get client appointment history
   */
  static getClientAppointmentHistory = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { clientId } = req.params;
    const validClientId = validateRequiredString(clientId, 'Client ID');

    // Call service layer
    const history = await AppointmentService.getClientAppointmentHistory(validClientId);

    // Format response
    const response = AppointmentView.formatClientHistory(history);
    return res.status(200).json(response);
  });

  /**
   * Get clinic appointment statistics
   */
  static getClinicAppointmentStats = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { clinicName } = req.params;
    const validClinicName = validateRequiredString(clinicName, 'Clinic Name');
    const { startDate, endDate } = req.query;

    // Call service layer
    const stats = await AppointmentService.getClinicAppointmentStats(
      validClinicName,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    // Format response
    const response = AppointmentView.formatStats(stats);
    return res.status(200).json(response);
  });
}
