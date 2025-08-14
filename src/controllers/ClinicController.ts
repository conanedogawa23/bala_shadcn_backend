import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ClinicService } from '@/services/ClinicService';
import { ClinicView } from '@/views/ClinicView';
import { asyncHandler } from '@/utils/asyncHandler';
import { ValidationError } from '@/utils/errors';

export class ClinicController {
  /**
   * Get all clinics with pagination and filtering
   */
  static getAllClinics = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClinicView.formatError('Validation failed', 'VALIDATION_ERROR');
      return res.status(400).json(response);
    }

    // Extract parameters
    const { page, limit, status, city, province } = req.query;

    // Call service layer
    const result = await ClinicService.getAllClinics({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status as string,
      city: city as string,
      province: province as string
    });

    // Format response using view layer
    const response = ClinicView.formatClinicList(
      result.clinics,
      result.page,
      result.limit,
      result.total
    );

    res.status(200).json(response);
  });

  /**
   * Get clinic by ID
   */
  static getClinicById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const clinicId = parseInt(id);

    if (isNaN(clinicId)) {
      const response = ClinicView.formatError('Invalid clinic ID format', 'INVALID_ID');
      return res.status(400).json(response);
    }

    // Call service layer
    const clinic = await ClinicService.getClinicById(clinicId);

    // Format response using view layer
    const response = ClinicView.formatSuccess(
      ClinicView.formatClinic(clinic),
      'Clinic retrieved successfully'
    );

    res.status(200).json(response);
  });

  /**
   * Get clinic by name
   */
  static getClinicByName = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;

    if (!name) {
      const response = ClinicView.formatError('Clinic name is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const clinic = await ClinicService.getClinicByName(name);

    // Format response using view layer
    const response = ClinicView.formatSuccess(
      ClinicView.formatClinic(clinic),
      'Clinic retrieved successfully'
    );

    res.status(200).json(response);
  });

  /**
   * Create new clinic
   */
  static createClinic = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClinicView.formatError('Validation failed', 'VALIDATION_ERROR');
      return res.status(400).json(response);
    }

    // Call service layer
    const clinic = await ClinicService.createClinic(req.body);

    // Format response using view layer
    const response = ClinicView.formatSuccess(
      ClinicView.formatClinic(clinic),
      'Clinic created successfully'
    );

    res.status(201).json(response);
  });

  /**
   * Update clinic
   */
  static updateClinic = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClinicView.formatError('Validation failed', 'VALIDATION_ERROR');
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const clinicId = parseInt(id);

    if (isNaN(clinicId)) {
      const response = ClinicView.formatError('Invalid clinic ID format', 'INVALID_ID');
      return res.status(400).json(response);
    }

    // Call service layer
    const clinic = await ClinicService.updateClinic(clinicId, req.body);

    // Format response using view layer
    const response = ClinicView.formatSuccess(
      ClinicView.formatClinic(clinic),
      'Clinic updated successfully'
    );

    res.status(200).json(response);
  });

  /**
   * Delete clinic (soft delete)
   */
  static deleteClinic = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const clinicId = parseInt(id);

    if (isNaN(clinicId)) {
      const response = ClinicView.formatError('Invalid clinic ID format', 'INVALID_ID');
      return res.status(400).json(response);
    }

    // Call service layer
    await ClinicService.deleteClinic(clinicId);

    // Format response using view layer
    const response = ClinicView.formatSuccess(
      null,
      'Clinic deleted successfully'
    );

    res.status(200).json(response);
  });

  /**
   * Get active clinics only
   */
  static getActiveClinics = asyncHandler(async (req: Request, res: Response) => {
    // Call service layer
    const clinics = await ClinicService.getActiveClinics();

    // Format response using view layer
    const response = ClinicView.formatSuccess(
      clinics.map(clinic => ClinicView.formatClinicSummary(clinic)),
      'Active clinics retrieved successfully'
    );

    res.status(200).json(response);
  });

  /**
   * Get clinic statistics
   */
  static getClinicStats = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const clinicId = parseInt(id);

    if (isNaN(clinicId)) {
      const response = ClinicView.formatError('Invalid clinic ID format', 'INVALID_ID');
      return res.status(400).json(response);
    }

    // Call service layer
    const stats = await ClinicService.getClinicStats(clinicId);

    // Format response using view layer
    const response = ClinicView.formatSuccess(
      stats,
      'Clinic statistics retrieved successfully'
    );

    res.status(200).json(response);
  });

  /**
   * Get all clinics in frontend-compatible format
   */
  static getAllClinicsCompatible = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClinicView.formatError('Validation failed', 'VALIDATION_ERROR');
      return res.status(400).json(response);
    }

    // Extract parameters
    const { page, limit, status, city, province } = req.query;

    // Call service layer
    const result = await ClinicService.getAllClinics({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status as string,
      city: city as string,
      province: province as string
    });

    // Format response using frontend-compatible view
    const clinicsData = result.clinics.map(clinic => ClinicView.formatClinicForFrontend(clinic));

    res.status(200).json({
      success: true,
      data: clinicsData,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
        hasNext: result.page < Math.ceil(result.total / result.limit),
        hasPrev: result.page > 1
      }
    });
  });

  /**
   * Get clinic by ID in frontend-compatible format
   */
  static getClinicByIdCompatible = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const clinicId = parseInt(id);

    if (isNaN(clinicId)) {
      const response = ClinicView.formatError('Invalid clinic ID format', 'INVALID_ID');
      return res.status(400).json(response);
    }

    // Call service layer
    const clinic = await ClinicService.getClinicById(clinicId);

    // Format response using frontend-compatible view
    const clinicData = ClinicView.formatClinicForFrontend(clinic);

    res.status(200).json({
      success: true,
      data: clinicData,
      message: 'Clinic retrieved successfully'
    });
  });
}
