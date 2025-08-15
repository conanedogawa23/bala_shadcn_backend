import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ResourceService } from '@/services/ResourceService';
import { ResourceView } from '@/views/ResourceView';
import { asyncHandler } from '@/utils/asyncHandler';

export class ResourceController {
  /**
   * Get all resources with filtering
   */
  static getAllResources = asyncHandler(async (req: Request, res: Response) => {
    // Extract parameters
    const { 
      page, 
      limit, 
      type, 
      clinicName, 
      specialty, 
      isActive, 
      isBookable 
    } = req.query;

    // Call service layer
    const result = await ResourceService.getAllResources({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type: type as string,
      clinicName: clinicName as string,
      specialty: specialty as string,
      isActive: isActive ? Boolean(isActive) : undefined,
      isBookable: isBookable ? Boolean(isBookable) : undefined
    });

    // Format response
    const response = ResourceView.formatResourceList(
      result.resources,
      result.page,
      result.limit,
      result.total
    );

    res.status(200).json(response);
  });

  /**
   * Get resource by ID
   */
  static getResourceById = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;

    // Call service layer
    const resource = await ResourceService.getResourceById(Number(id));

    // Format response
    const response = ResourceView.formatResource(resource);
    return res.status(200).json(response);
  });

  /**
   * Create new resource
   */
  static createResource = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    // Call service layer
    const resource = await ResourceService.createResource(req.body);

    // Format response
    const response = ResourceView.formatResource(resource);
    return res.status(201).json(response);
  });

  /**
   * Update resource
   */
  static updateResource = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;

    // Call service layer
    const resource = await ResourceService.updateResource(Number(id), req.body);

    // Format response
    const response = ResourceView.formatResource(resource);
    return res.status(200).json(response);
  });

  /**
   * Delete resource
   */
  static deleteResource = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;

    // Call service layer
    await ResourceService.deleteResource(Number(id));

    // Format response
    const response = ResourceView.formatSuccess('Resource deleted successfully');
    return res.status(200).json(response);
  });

  /**
   * Get practitioners
   */
  static getPractitioners = asyncHandler(async (req: Request, res: Response) => {
    const { clinicName, specialty } = req.query;

    // Call service layer
    const practitioners = await ResourceService.getPractitioners(
      clinicName as string,
      specialty as string
    );

    // Format response
    const response = ResourceView.formatPractitioners(practitioners);
    res.status(200).json(response);
  });

  /**
   * Get services
   */
  static getServices = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;

    // Call service layer
    const services = await ResourceService.getServices(category as string);

    // Format response
    const response = ResourceView.formatServices(services);
    res.status(200).json(response);
  });

  /**
   * Get bookable resources for a clinic
   */
  static getBookableResources = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { clinicName } = req.params;
    if (!clinicName) {
      return res.status(400).json({ error: 'Clinic name is required' });
    }

    // Call service layer
    const resources = await ResourceService.getBookableResources(clinicName);

    // Format response
    const response = ResourceView.formatBookableResources(resources);
    return res.status(200).json(response);
  });

  /**
   * Update resource availability
   */
  static updateResourceAvailability = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const { availability } = req.body;

    // Call service layer
    const resource = await ResourceService.updateResourceAvailability(Number(id), availability);

    // Format response
    const response = ResourceView.formatResource(resource);
    return res.status(200).json(response);
  });

  /**
   * Get resource availability for date range
   */
  static getResourceAvailability = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Call service layer
    const availability = await ResourceService.getResourceAvailability(
      Number(id),
      new Date(startDate as string),
      new Date(endDate as string)
    );

    // Format response
    const response = ResourceView.formatSuccess('Resource availability retrieved', availability);
    return res.status(200).json(response);
  });

  /**
   * Get resource statistics
   */
  static getResourceStats = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ResourceView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Call service layer
    const stats = await ResourceService.getResourceStats(
      Number(id),
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    // Format response
    const response = ResourceView.formatResourceStats(stats);
    return res.status(200).json(response);
  });
}
