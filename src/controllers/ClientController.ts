import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ClientService } from '../services/ClientService';
import { ClientView } from '../views/ClientView';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequiredString } from '../utils/mongooseHelpers';

export class ClientController {
  /**
   * Get clients by clinic with pagination and search
   */
  static getClientsByClinic = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClientView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    // Extract parameters
    const { clinicName } = req.params;
    const validClinicName = validateRequiredString(clinicName, 'Clinic Name');
    const { page, limit, search, status } = req.query;

    // Call service layer
    const result = await ClientService.getClientsByClinic({
      clinicName: validClinicName,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search as string,
      status: status as string
    });

    // Format response using view layer
    const response = ClientView.formatClientList(
      result.clients,
      result.page,
      result.limit,
      result.total
    );

    return res.status(200).json(response);
  });

  /**
   * Get client by ID
   */
  static getClientById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const client = await ClientService.getClientById(id);

    // Format response using view layer
    const response = ClientView.formatSuccess(
      ClientView.formatClient(client),
      'Client retrieved successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Create new client
   */
  static createClient = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClientView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    // Call service layer
    const client = await ClientService.createClient(req.body);

    // Format response using view layer
    const response = ClientView.formatSuccess(
      ClientView.formatClient(client),
      'Client created successfully'
    );

    return res.status(201).json(response);
  });

  /**
   * Update client
   */
  static updateClient = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClientView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    const { id } = req.params;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const client = await ClientService.updateClient(id, req.body);

    // Format response using view layer
    const response = ClientView.formatSuccess(
      ClientView.formatClient(client),
      'Client updated successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Delete client (soft delete)
   */
  static deleteClient = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    await ClientService.deleteClient(id);

    // Format response using view layer
    const response = ClientView.formatSuccess(
      null,
      'Client deleted successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Search clients
   */
  static searchClients = asyncHandler(async (req: Request, res: Response) => {
    const { q: searchTerm, clinic, limit } = req.query;

    if (!searchTerm) {
      const response = ClientView.formatError('Search term is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const clients = await ClientService.searchClients(
      searchTerm as string,
      clinic as string,
      limit ? Number(limit) : undefined
    );

    // Format response using view layer
    const response = ClientView.formatSearchResults(
      clients,
      searchTerm as string,
      clients.length
    );

    return res.status(200).json(response);
  });

  /**
   * Get clients with insurance for a clinic
   */
  static getClientsWithInsurance = asyncHandler(async (req: Request, res: Response) => {
    const { clinicName } = req.params;
    const validClinicName = validateRequiredString(clinicName, 'Clinic Name');

    // Call service layer
    const clients = await ClientService.getClientsWithInsurance(validClinicName);

    // Format response using view layer
    const response = ClientView.formatSuccess(
      clients.map(client => ClientView.formatClientSummary(client)),
      'Clients with insurance retrieved successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Get client statistics for a clinic
   */
  static getClientStats = asyncHandler(async (req: Request, res: Response) => {
    const { clinicName } = req.params;
    const validClinicName = validateRequiredString(clinicName, 'Clinic Name');

    // Call service layer
    const stats = await ClientService.getClientStats(validClinicName);

    // Format response using view layer
    const response = ClientView.formatSuccess(
      stats,
      'Client statistics retrieved successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Get clients by clinic in frontend-compatible format
   */
  static getClientsByClinicCompatible = asyncHandler(async (req: Request, res: Response) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response = ClientView.formatValidationError(errors.array());
      return res.status(400).json(response);
    }

    // Extract parameters
    const { clinicName } = req.params;
    const validClinicName = validateRequiredString(clinicName, 'Clinic Name');
    const { page, limit, search, status } = req.query;

    // Call service layer
    const result = await ClientService.getClientsByClinic({
      clinicName: validClinicName,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search as string,
      status: status as string
    });

    // Format response using frontend-compatible view
    const clientsData = result.clients.map(client => ClientView.formatClientForFrontend(client));

    return res.status(200).json({
      success: true,
      data: clientsData,
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
   * Get client by ID in frontend-compatible format
   */
  static getClientByIdCompatible = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const client = await ClientService.getClientById(id);

    // Format response using frontend-compatible view
    const clientData = ClientView.formatClientForFrontend(client);

    return res.status(200).json({
      success: true,
      data: clientData,
      message: 'Client retrieved successfully'
    });
  });
}
