import { Request, Response } from 'express';
import { InsuranceCompanyAddressService } from '../services/InsuranceCompanyAddressService';
import { InsuranceCompanyAddressView } from '../views/InsuranceCompanyAddressView';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';

export class InsuranceCompanyAddressController {
  /**
   * Get all insurance company addresses
   * GET /api/insurance-addresses
   */
  static getAllAddresses = asyncHandler(async (req: Request, res: Response) => {
    const {
      company,
      city,
      province,
      postalCode,
      page = '1',
      limit = '50'
    } = req.query as any;

    const result = await InsuranceCompanyAddressService.getAllAddresses({
      company: company as string | undefined,
      city: city as string | undefined,
      province: province as string | undefined,
      postalCode: postalCode as string | undefined,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    });

    const response = InsuranceCompanyAddressView.formatAddressList({
      ...result,
      limit: parseInt(limit as string, 10)
    });

    res.json({
      success: true,
      message: 'Insurance addresses retrieved successfully',
      data: response
    });
  });

  /**
   * Get insurance address by ID
   * GET /api/insurance-addresses/:id
   */
  static getAddressById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Address ID is required' });
    }
    const address = await InsuranceCompanyAddressService.getAddressById(id);
    
    if (!address) {
      throw new AppError('Insurance address not found', 404);
    }

    const response = InsuranceCompanyAddressView.formatAddress(address);

    return res.json({
      success: true,
      message: 'Insurance address retrieved successfully',
      data: response
    });
  });

  /**
   * Get insurance address by address key
   * GET /api/insurance-addresses/key/:addressKey
   */
  static getAddressByKey = asyncHandler(async (req: Request, res: Response) => {
    const { addressKey } = req.params;
    if (!addressKey) {
      return res.status(400).json({ error: 'Address key is required' });
    }
    const address = await InsuranceCompanyAddressService.getAddressByKey(parseInt(addressKey));
    
    if (!address) {
      throw new AppError('Insurance address not found', 404);
    }

    const response = InsuranceCompanyAddressView.formatAddress(address);

    return res.json({
      success: true,
      message: 'Insurance address retrieved successfully',
      data: response
    });
  });

  /**
   * Get addresses by company
   * GET /api/insurance-addresses/company/:companyName
   */
  static getAddressesByCompany = asyncHandler(async (req: Request, res: Response) => {
    const { companyName } = req.params;
    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    const addresses = await InsuranceCompanyAddressService.getAddressesByCompany(companyName);
    const response = InsuranceCompanyAddressView.formatCompanyAddresses(companyName, addresses);

    return res.json({
      success: true,
      message: 'Company addresses retrieved successfully',
      data: response
    });
  });

  /**
   * Get addresses by province
   * GET /api/insurance-addresses/province/:province
   */
  static getAddressesByProvince = asyncHandler(async (req: Request, res: Response) => {
    const { province } = req.params;
    if (!province) {
      return res.status(400).json({ error: 'Province is required' });
    }
    const addresses = await InsuranceCompanyAddressService.getAddressesByProvince(province);
    const response = InsuranceCompanyAddressView.formatProvinceAddresses(province, addresses);

    return res.json({
      success: true,
      message: 'Province addresses retrieved successfully',
      data: response
    });
  });

  /**
   * Get addresses by city
   * GET /api/insurance-addresses/city/:city
   */
  static getAddressesByCity = asyncHandler(async (req: Request, res: Response) => {
    const { city } = req.params;
    if (!city) {
      return res.status(400).json({ error: 'City is required' });
    }
    const addresses = await InsuranceCompanyAddressService.getAddressesByCity(city);
    const response = InsuranceCompanyAddressView.formatAddresses(addresses);

    return res.json({
      success: true,
      message: 'City addresses retrieved successfully',
      data: {
        city: city,
        addresses: response,
        count: response.length
      }
    });
  });

  /**
   * Search addresses by postal code
   * GET /api/insurance-addresses/postal/:postalCode
   */
  static searchByPostalCode = asyncHandler(async (req: Request, res: Response) => {
    const { postalCode } = req.params;
    if (!postalCode) {
      return res.status(400).json({ error: 'Postal code is required' });
    }
    const addresses = await InsuranceCompanyAddressService.searchByPostalCode(postalCode);
    const response = InsuranceCompanyAddressView.formatSearchResults(addresses, postalCode);

    return res.json({
      success: true,
      message: 'Postal code search completed successfully',
      data: response
    });
  });

  /**
   * Create new insurance address
   * POST /api/insurance-addresses
   */
  static createAddress = asyncHandler(async (req: Request, res: Response) => {
    const addressData = req.body;

    const address = await InsuranceCompanyAddressService.createAddress(addressData);
    const response = InsuranceCompanyAddressView.formatAddress(address);

    res.status(201).json({
      success: true,
      message: 'Insurance address created successfully',
      data: response
    });
  });

  /**
   * Update insurance address
   * PUT /api/insurance-addresses/:id
   */
  static updateAddress = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Address ID is required' });
    }
    const updateData = req.body;
    
    const address = await InsuranceCompanyAddressService.updateAddress(id, updateData);
    
    if (!address) {
      throw new AppError('Insurance address not found', 404);
    }

    const response = InsuranceCompanyAddressView.formatAddress(address);

    return res.json({
      success: true,
      message: 'Insurance address updated successfully',
      data: response
    });
  });

  /**
   * Delete insurance address
   * DELETE /api/insurance-addresses/:id
   */
  static deleteAddress = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Address ID is required' });
    }
    const deleted = await InsuranceCompanyAddressService.deleteAddress(id);
    
    if (!deleted) {
      throw new AppError('Insurance address not found', 404);
    }

    return res.json({
      success: true,
      message: 'Insurance address deleted successfully',
      data: { deleted: true }
    });
  });

  /**
   * Get address statistics
   * GET /api/insurance-addresses/stats/overview
   */
  static getAddressStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await InsuranceCompanyAddressService.getAddressStats();
    const response = InsuranceCompanyAddressView.formatAddressStats(stats);

    res.json({
      success: true,
      message: 'Insurance address statistics retrieved successfully',
      data: response
    });
  });

  /**
   * Get addresses for frontend compatibility
   * GET /api/insurance-addresses/frontend-compatible
   */
  static getAddressesForFrontend = asyncHandler(async (req: Request, res: Response) => {
    const {
      company,
      city,
      province,
      limit = 100
    } = req.query as any;

    const result = await InsuranceCompanyAddressService.getAllAddresses({
      company,
      city,
      province,
      page: 1,
      limit: parseInt(limit)
    });

    const response = InsuranceCompanyAddressView.formatAddressesForFrontend(result.addresses);

    res.json({
      success: true,
      message: 'Insurance addresses retrieved for frontend',
      data: response,
      meta: {
        total: result.total,
        returned: response.length
      }
    });
  });
}
