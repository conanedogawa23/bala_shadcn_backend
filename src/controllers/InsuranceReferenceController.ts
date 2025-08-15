import { Request, Response } from 'express';
import { InsuranceReferenceService } from '../services/InsuranceReferenceService';
import { InsuranceReferenceView } from '../views/InsuranceReferenceView';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';

export class InsuranceReferenceController {
  /**
   * INSURANCE FREQUENCY ENDPOINTS
   */

  /**
   * Get all insurance frequencies
   * GET /api/insurance-reference/frequencies
   */
  static getAllFrequencies = asyncHandler(async (req: Request, res: Response) => {
    const frequencies = await InsuranceReferenceService.getAllFrequencies();
    const response = InsuranceReferenceView.formatFrequencies(frequencies);

    res.json({
      success: true,
      message: 'Insurance frequencies retrieved successfully',
      data: {
        frequencies: response,
        count: response.length
      }
    });
  });

  /**
   * Get selectable insurance frequencies
   * GET /api/insurance-reference/frequencies/selectable
   */
  static getSelectableFrequencies = asyncHandler(async (req: Request, res: Response) => {
    const frequencies = await InsuranceReferenceService.getSelectableFrequencies();
    const response = InsuranceReferenceView.formatFrequencies(frequencies);

    res.json({
      success: true,
      message: 'Selectable insurance frequencies retrieved successfully',
      data: {
        frequencies: response,
        count: response.length
      }
    });
  });

  /**
   * Get frequency by key
   * GET /api/insurance-reference/frequencies/:frequencyKey
   */
  static getFrequencyByKey = asyncHandler(async (req: Request, res: Response) => {
    const { frequencyKey } = req.params;

    const frequency = await InsuranceReferenceService.getFrequencyByKey(parseInt(frequencyKey));
    
    if (!frequency) {
      throw new AppError('Insurance frequency not found', 404);
    }

    const response = InsuranceReferenceView.formatFrequency(frequency);

    res.json({
      success: true,
      message: 'Insurance frequency retrieved successfully',
      data: response
    });
  });

  /**
   * INSURANCE POLICY HOLDER ENDPOINTS
   */

  /**
   * Get all policy holders
   * GET /api/insurance-reference/policy-holders
   */
  static getAllPolicyHolders = asyncHandler(async (req: Request, res: Response) => {
    const policyHolders = await InsuranceReferenceService.getAllPolicyHolders();
    const response = InsuranceReferenceView.formatPolicyHolders(policyHolders);

    res.json({
      success: true,
      message: 'Insurance policy holders retrieved successfully',
      data: {
        policyHolders: response,
        count: response.length
      }
    });
  });

  /**
   * Get valid policy holders
   * GET /api/insurance-reference/policy-holders/valid
   */
  static getValidPolicyHolders = asyncHandler(async (req: Request, res: Response) => {
    const policyHolders = await InsuranceReferenceService.getValidPolicyHolders();
    const response = InsuranceReferenceView.formatPolicyHolders(policyHolders);

    res.json({
      success: true,
      message: 'Valid policy holders retrieved successfully',
      data: {
        policyHolders: response,
        count: response.length
      }
    });
  });

  /**
   * Get policy holder by key
   * GET /api/insurance-reference/policy-holders/:policyHolderKey
   */
  static getPolicyHolderByKey = asyncHandler(async (req: Request, res: Response) => {
    const { policyHolderKey } = req.params;

    const policyHolder = await InsuranceReferenceService.getPolicyHolderByKey(parseInt(policyHolderKey));
    
    if (!policyHolder) {
      throw new AppError('Policy holder not found', 404);
    }

    const response = InsuranceReferenceView.formatPolicyHolder(policyHolder);

    res.json({
      success: true,
      message: 'Policy holder retrieved successfully',
      data: response
    });
  });

  /**
   * Get policy holders requiring additional info
   * GET /api/insurance-reference/policy-holders/requiring-info
   */
  static getPolicyHoldersRequiringInfo = asyncHandler(async (req: Request, res: Response) => {
    const policyHolders = await InsuranceReferenceService.getPolicyHoldersRequiringInfo();
    const response = InsuranceReferenceView.formatPolicyHolders(policyHolders);

    res.json({
      success: true,
      message: 'Policy holders requiring additional info retrieved successfully',
      data: {
        policyHolders: response,
        count: response.length
      }
    });
  });

  /**
   * INSURANCE COB ENDPOINTS
   */

  /**
   * Get all COB options
   * GET /api/insurance-reference/cob
   */
  static getAllCOBOptions = asyncHandler(async (req: Request, res: Response) => {
    const cobOptions = await InsuranceReferenceService.getAllCOBOptions();
    const response = InsuranceReferenceView.formatCOBOptions(cobOptions);

    res.json({
      success: true,
      message: 'COB options retrieved successfully',
      data: {
        cobOptions: response,
        count: response.length
      }
    });
  });

  /**
   * Get COB option by key
   * GET /api/insurance-reference/cob/:cobKey
   */
  static getCOBByKey = asyncHandler(async (req: Request, res: Response) => {
    const { cobKey } = req.params;

    const cob = await InsuranceReferenceService.getCOBByKey(parseInt(cobKey));
    
    if (!cob) {
      throw new AppError('COB option not found', 404);
    }

    const response = InsuranceReferenceView.formatCOB(cob);

    res.json({
      success: true,
      message: 'COB option retrieved successfully',
      data: response
    });
  });

  /**
   * Get COB by boolean value
   * GET /api/insurance-reference/cob/value/:cobValue
   */
  static getCOBByValue = asyncHandler(async (req: Request, res: Response) => {
    const { cobValue } = req.params;

    const boolValue = cobValue.toLowerCase() === 'true';
    const cob = await InsuranceReferenceService.getCOBByValue(boolValue);
    
    if (!cob) {
      throw new AppError('COB option not found for value', 404);
    }

    const response = InsuranceReferenceView.formatCOB(cob);

    res.json({
      success: true,
      message: 'COB option retrieved successfully',
      data: response
    });
  });

  /**
   * Get default COB option
   * GET /api/insurance-reference/cob/default
   */
  static getDefaultCOB = asyncHandler(async (req: Request, res: Response) => {
    const cob = await InsuranceReferenceService.getDefaultCOB();
    
    if (!cob) {
      throw new AppError('No default COB option found', 404);
    }

    const response = InsuranceReferenceView.formatCOB(cob);

    res.json({
      success: true,
      message: 'Default COB option retrieved successfully',
      data: response
    });
  });

  /**
   * COMBINED REFERENCE DATA ENDPOINTS
   */

  /**
   * Get all insurance reference data
   * GET /api/insurance-reference/all
   */
  static getAllInsuranceReferenceData = asyncHandler(async (req: Request, res: Response) => {
    const data = await InsuranceReferenceService.getAllInsuranceReferenceData();
    const response = InsuranceReferenceView.formatInsuranceReferenceData(data);

    res.json({
      success: true,
      message: 'All insurance reference data retrieved successfully',
      data: response
    });
  });

  /**
   * Get insurance form data
   * GET /api/insurance-reference/form-data
   */
  static getInsuranceFormData = asyncHandler(async (req: Request, res: Response) => {
    const formData = await InsuranceReferenceService.getInsuranceFormData();
    const response = InsuranceReferenceView.formatInsuranceFormData(formData);

    res.json({
      success: true,
      message: 'Insurance form data retrieved successfully',
      data: response
    });
  });

  /**
   * DROPDOWN OPTIONS ENDPOINTS
   */

  /**
   * Get frequency dropdown options
   * GET /api/insurance-reference/dropdowns/frequencies
   */
  static getFrequencyDropdownOptions = asyncHandler(async (req: Request, res: Response) => {
    const frequencies = await InsuranceReferenceService.getSelectableFrequencies();
    const response = InsuranceReferenceView.formatFrequencyDropdownOptions(frequencies);

    res.json({
      success: true,
      message: 'Frequency dropdown options retrieved successfully',
      data: {
        options: response,
        count: response.length
      }
    });
  });

  /**
   * Get policy holder dropdown options
   * GET /api/insurance-reference/dropdowns/policy-holders
   */
  static getPolicyHolderDropdownOptions = asyncHandler(async (req: Request, res: Response) => {
    const policyHolders = await InsuranceReferenceService.getValidPolicyHolders();
    const response = InsuranceReferenceView.formatPolicyHolderDropdownOptions(policyHolders);

    res.json({
      success: true,
      message: 'Policy holder dropdown options retrieved successfully',
      data: {
        options: response,
        count: response.length
      }
    });
  });

  /**
   * Get COB dropdown options
   * GET /api/insurance-reference/dropdowns/cob
   */
  static getCOBDropdownOptions = asyncHandler(async (req: Request, res: Response) => {
    const cobOptions = await InsuranceReferenceService.getAllCOBOptions();
    const response = InsuranceReferenceView.formatCOBDropdownOptions(cobOptions);

    res.json({
      success: true,
      message: 'COB dropdown options retrieved successfully',
      data: {
        options: response,
        count: response.length
      }
    });
  });

  /**
   * STATISTICS AND VALIDATION ENDPOINTS
   */

  /**
   * Get reference data statistics
   * GET /api/insurance-reference/stats
   */
  static getReferenceDataStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await InsuranceReferenceService.getReferenceDataStats();
    const response = InsuranceReferenceView.formatInsuranceReferenceStats(stats);

    res.json({
      success: true,
      message: 'Insurance reference data statistics retrieved successfully',
      data: response
    });
  });

  /**
   * Validate reference data
   * GET /api/insurance-reference/validate
   */
  static validateReferenceData = asyncHandler(async (req: Request, res: Response) => {
    const validation = await InsuranceReferenceService.validateReferenceData();
    const response = InsuranceReferenceView.formatValidationResults(validation);

    res.json({
      success: true,
      message: 'Reference data validation completed',
      data: response
    });
  });

  /**
   * Get insurance reference summary
   * GET /api/insurance-reference/summary
   */
  static getInsuranceReferenceSummary = asyncHandler(async (req: Request, res: Response) => {
    const data = await InsuranceReferenceService.getAllInsuranceReferenceData();
    const response = InsuranceReferenceView.formatInsuranceReferenceSummary(data);

    res.json({
      success: true,
      message: 'Insurance reference summary retrieved successfully',
      data: response
    });
  });

  /**
   * FRONTEND COMPATIBILITY ENDPOINTS
   */

  /**
   * Get frequencies for frontend compatibility
   * GET /api/insurance-reference/frontend-compatible/frequencies
   */
  static getFrequenciesForFrontend = asyncHandler(async (req: Request, res: Response) => {
    const frequencies = await InsuranceReferenceService.getSelectableFrequencies();
    const response = InsuranceReferenceView.formatFrequenciesForFrontend(frequencies);

    res.json({
      success: true,
      message: 'Frequencies retrieved for frontend',
      data: response,
      meta: {
        total: response.length
      }
    });
  });

  /**
   * Get policy holders for frontend compatibility
   * GET /api/insurance-reference/frontend-compatible/policy-holders
   */
  static getPolicyHoldersForFrontend = asyncHandler(async (req: Request, res: Response) => {
    const policyHolders = await InsuranceReferenceService.getValidPolicyHolders();
    const response = InsuranceReferenceView.formatPolicyHoldersForFrontend(policyHolders);

    res.json({
      success: true,
      message: 'Policy holders retrieved for frontend',
      data: response,
      meta: {
        total: response.length
      }
    });
  });

  /**
   * Get COB options for frontend compatibility
   * GET /api/insurance-reference/frontend-compatible/cob
   */
  static getCOBOptionsForFrontend = asyncHandler(async (req: Request, res: Response) => {
    const cobOptions = await InsuranceReferenceService.getAllCOBOptions();
    const response = InsuranceReferenceView.formatCOBOptionsForFrontend(cobOptions);

    res.json({
      success: true,
      message: 'COB options retrieved for frontend',
      data: response,
      meta: {
        total: response.length
      }
    });
  });

  /**
   * Get all reference data for frontend compatibility
   * GET /api/insurance-reference/frontend-compatible/all
   */
  static getAllReferenceDataForFrontend = asyncHandler(async (req: Request, res: Response) => {
    const [frequencies, policyHolders, cobOptions] = await Promise.all([
      InsuranceReferenceService.getSelectableFrequencies(),
      InsuranceReferenceService.getValidPolicyHolders(),
      InsuranceReferenceService.getAllCOBOptions()
    ]);

    const response = {
      frequencies: InsuranceReferenceView.formatFrequenciesForFrontend(frequencies),
      policyHolders: InsuranceReferenceView.formatPolicyHoldersForFrontend(policyHolders),
      cobOptions: InsuranceReferenceView.formatCOBOptionsForFrontend(cobOptions)
    };

    res.json({
      success: true,
      message: 'All insurance reference data retrieved for frontend',
      data: response,
      meta: {
        frequencies: response.frequencies.length,
        policyHolders: response.policyHolders.length,
        cobOptions: response.cobOptions.length,
        total: response.frequencies.length + response.policyHolders.length + response.cobOptions.length
      }
    });
  });
}
