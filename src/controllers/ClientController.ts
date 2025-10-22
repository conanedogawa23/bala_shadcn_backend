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
    const { q, query, clinic, limit } = req.query;
    const searchTerm = q || query; // Accept both q and query params

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

  /**
   * Get client account summary (legacy feature: aggregate of orders, payments, insurance)
   */
  static getClientAccountSummary = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer to get comprehensive account summary
    const summary = await ClientService.getClientAccountSummary(id);

    // Format response using view layer
    const response = ClientView.formatSuccess(
      summary,
      'Client account summary retrieved successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Advanced search with multiple criteria (legacy feature)
   */
  static advancedSearch = asyncHandler(async (req: Request, res: Response) => {
    const {
      firstName,
      lastName,
      dateOfBirth,
      phone,
      email,
      clinic,
      insuranceCompany,
      limit = 50
    } = req.query;

    // If no criteria provided, return empty results instead of error
    if (!firstName && !lastName && !phone && !email && !insuranceCompany && !dateOfBirth) {
      const response = ClientView.formatSuccess(
        [],
        'No search criteria provided. Please provide at least one search parameter.'
      );
      return res.status(200).json(response);
    }

    // Call service layer
    const clients = await ClientService.advancedSearch({
      firstName: firstName as string | undefined,
      lastName: lastName as string | undefined,
      dateOfBirth: dateOfBirth as string | undefined,
      phone: phone as string | undefined,
      email: email as string | undefined,
      clinic: clinic as string | undefined,
      insuranceCompany: insuranceCompany as string | undefined,
      limit: Math.min(Number(limit), 100)
    });

    // Format response
    const response = ClientView.formatSuccess(
      clients.map(client => ClientView.formatClientForFrontend(client)),
      `Found ${clients.length} client(s)`
    );

    return res.status(200).json(response);
  });

  /**
   * Get clients with specific insurance company
   */
  static getClientsByInsuranceCompany = asyncHandler(async (req: Request, res: Response) => {
    const { insuranceCompany, companyName, clinicName } = req.query;
    
    // Support both parameter names for backwards compatibility
    const company = insuranceCompany || companyName;

    if (!company) {
      const response = ClientView.formatError('Insurance company name is required (use insuranceCompany parameter)', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const clients = await ClientService.getClientsByInsuranceCompany(
      company as string,
      clinicName as string
    );

    // Format response
    const response = ClientView.formatSuccess(
      clients.map(client => ClientView.formatClientForFrontend(client)),
      `Found ${clients.length} client(s) with ${company}`
    );

    return res.status(200).json(response);
  });

  /**
   * Get client with all related data (appointments, orders, payments)
   */
  static getClientComprehensive = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const clientData = await ClientService.getClientComprehensive(id);

    // Format response
    const response = ClientView.formatSuccess(
      clientData,
      'Client comprehensive data retrieved successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Get client contact history
   */
  static getClientContactHistory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const history = await ClientService.getClientContactHistory(
      id,
      Number(limit)
    );

    // Format response
    const response = ClientView.formatSuccess(
      history,
      'Client contact history retrieved successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Update client insurance information (multiple insurance plans)
   */
  static updateClientInsurance = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { insurance } = req.body;

    if (!id) {
      const response = ClientView.formatError('Client ID is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    if (!insurance || !Array.isArray(insurance)) {
      const response = ClientView.formatError('Insurance array is required', 'INVALID_FORMAT');
      return res.status(400).json(response);
    }

    // Call service layer
    const client = await ClientService.updateClientInsurance(id, insurance);

    // Format response
    const response = ClientView.formatSuccess(
      ClientView.formatClientForFrontend(client),
      'Client insurance information updated successfully'
    );

    return res.status(200).json(response);
  });

  /**
   * Get clients with DPA (Direct Payment Authorization)
   */
  static getClientsWithDPA = asyncHandler(async (req: Request, res: Response) => {
    // Accept clinic from either params or query
    const clinicName = req.params.clinicName || (req.query.clinicName as string);
    const { page = 1, limit = 20 } = req.query;

    if (!clinicName) {
      const response = ClientView.formatError('Clinic name is required', 'MISSING_PARAMETER');
      return res.status(400).json(response);
    }

    // Call service layer
    const result = await ClientService.getClientsWithDPA(
      clinicName,
      Number(page),
      Number(limit)
    );

    // Format response
    return res.status(200).json({
      success: true,
      data: result.clients.map(client => ClientView.formatClientForFrontend(client)),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit)
      }
    });
  });

  /**
   * Bulk update clients (batch operation)
   */
  static bulkUpdateClients = asyncHandler(async (req: Request, res: Response) => {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      const response = ClientView.formatError('Updates array is required', 'INVALID_FORMAT');
      return res.status(400).json(response);
    }

    // Call service layer
    const result = await ClientService.bulkUpdateClients(updates);

    // Format response
    const response = ClientView.formatSuccess(
      result,
      `Successfully updated ${result.updatedCount} client(s)`
    );

    return res.status(200).json(response);
  });

  /**
   * Export clients data
   */
  static exportClients = asyncHandler(async (req: Request, res: Response) => {
    const { clinicName, format = 'json', limit = '1000' } = req.query;

    // Call service layer
    const data = await ClientService.exportClients(
      clinicName as string | undefined,
      format as string,
      parseInt(limit as string)
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      const filename = `clients${clinicName ? '-' + clinicName : ''}-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data);
    } else {
      const response = ClientView.formatSuccess(
        data,
        `Exported ${Array.isArray(data) ? data.length : 0} client(s)`
      );
      res.status(200).json(response);
    }
  });
}
