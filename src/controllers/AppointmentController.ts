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
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = AppointmentView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    // Extract parameters
    const { clinicName } = req.params;
    const validClinicName = validateRequiredString(clinicName, 'Clinic Name');
    const { 
      startDate, 
      endDate, 
      page, 
      limit, 
      status, 
      resourceId, 
      clientId 
    } = req.query;

    // Call service layer
    const result = await AppointmentService.getAppointmentsByClinic({
      clinicName: validClinicName,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status ? Number(status) : undefined,
      resourceId: resourceId ? Number(resourceId) : undefined,
      clientId: clientId as string
    });

    // Format response
    const response = AppointmentView.formatAppointmentList(
      result.appointments,
      result.page,
      result.limit,
      result.total
    );

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
