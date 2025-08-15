import { InsuranceFrequencyModel, IInsuranceFrequency, FrequencyType } from '../models/InsuranceFrequency';
import { InsurancePolicyHolderModel, IInsurancePolicyHolder, PolicyHolderType } from '../models/InsurancePolicyHolder';
import { InsuranceCOBModel, IInsuranceCOB, COBStatus } from '../models/InsuranceCOB';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

export class InsuranceReferenceService {
  /**
   * INSURANCE FREQUENCY METHODS
   */

  /**
   * Get all insurance frequencies
   */
  static async getAllFrequencies(): Promise<IInsuranceFrequency[]> {
    try {
      const frequencies = await InsuranceFrequencyModel.getAllFrequencies().lean();
      
      logger.info(`Retrieved ${frequencies.length} insurance frequencies`);
      return frequencies;
    } catch (error) {
      logger.error('Error getting insurance frequencies:', error);
      throw new AppError('Failed to retrieve insurance frequencies', 500);
    }
  }

  /**
   * Get selectable insurance frequencies (excluding "Select" option)
   */
  static async getSelectableFrequencies(): Promise<IInsuranceFrequency[]> {
    try {
      const frequencies = await InsuranceFrequencyModel.getSelectableFrequencies().lean();
      
      logger.info(`Retrieved ${frequencies.length} selectable insurance frequencies`);
      return frequencies;
    } catch (error) {
      logger.error('Error getting selectable insurance frequencies:', error);
      throw new AppError('Failed to retrieve selectable insurance frequencies', 500);
    }
  }

  /**
   * Get frequency by key
   */
  static async getFrequencyByKey(frequencyKey: number): Promise<IInsuranceFrequency | null> {
    try {
      const frequency = await InsuranceFrequencyModel.getByKey(frequencyKey).lean();
      
      if (!frequency) {
        logger.warn(`Insurance frequency not found: ${frequencyKey}`);
        return null;
      }
      
      logger.info(`Retrieved insurance frequency: ${frequency.frequencyName}`);
      return frequency;
    } catch (error) {
      logger.error(`Error getting insurance frequency ${frequencyKey}:`, error);
      throw new AppError('Failed to retrieve insurance frequency', 500);
    }
  }

  /**
   * INSURANCE POLICY HOLDER METHODS
   */

  /**
   * Get all policy holders
   */
  static async getAllPolicyHolders(): Promise<IInsurancePolicyHolder[]> {
    try {
      const policyHolders = await InsurancePolicyHolderModel.getAllPolicyHolders().lean();
      
      logger.info(`Retrieved ${policyHolders.length} insurance policy holders`);
      return policyHolders;
    } catch (error) {
      logger.error('Error getting insurance policy holders:', error);
      throw new AppError('Failed to retrieve insurance policy holders', 500);
    }
  }

  /**
   * Get valid policy holder selections (excluding "NONE")
   */
  static async getValidPolicyHolders(): Promise<IInsurancePolicyHolder[]> {
    try {
      const policyHolders = await InsurancePolicyHolderModel.getValidSelections().lean();
      
      logger.info(`Retrieved ${policyHolders.length} valid policy holder selections`);
      return policyHolders;
    } catch (error) {
      logger.error('Error getting valid policy holders:', error);
      throw new AppError('Failed to retrieve valid policy holders', 500);
    }
  }

  /**
   * Get policy holder by key
   */
  static async getPolicyHolderByKey(policyHolderKey: number): Promise<IInsurancePolicyHolder | null> {
    try {
      const policyHolder = await InsurancePolicyHolderModel.getByKey(policyHolderKey).lean();
      
      if (!policyHolder) {
        logger.warn(`Insurance policy holder not found: ${policyHolderKey}`);
        return null;
      }
      
      logger.info(`Retrieved policy holder: ${policyHolder.policyHolderName}`);
      return policyHolder;
    } catch (error) {
      logger.error(`Error getting policy holder ${policyHolderKey}:`, error);
      throw new AppError('Failed to retrieve policy holder', 500);
    }
  }

  /**
   * Get policy holders requiring additional info
   */
  static async getPolicyHoldersRequiringInfo(): Promise<IInsurancePolicyHolder[]> {
    try {
      const policyHolders = await InsurancePolicyHolderModel.getRequiringAdditionalInfo().lean();
      
      logger.info(`Retrieved ${policyHolders.length} policy holders requiring additional info`);
      return policyHolders;
    } catch (error) {
      logger.error('Error getting policy holders requiring additional info:', error);
      throw new AppError('Failed to retrieve policy holders requiring additional info', 500);
    }
  }

  /**
   * INSURANCE COB (COORDINATION OF BENEFITS) METHODS
   */

  /**
   * Get all COB options
   */
  static async getAllCOBOptions(): Promise<IInsuranceCOB[]> {
    try {
      const cobOptions = await InsuranceCOBModel.getAllCOBOptions().lean();
      
      logger.info(`Retrieved ${cobOptions.length} COB options`);
      return cobOptions;
    } catch (error) {
      logger.error('Error getting COB options:', error);
      throw new AppError('Failed to retrieve COB options', 500);
    }
  }

  /**
   * Get COB option by key
   */
  static async getCOBByKey(cobKey: number): Promise<IInsuranceCOB | null> {
    try {
      const cob = await InsuranceCOBModel.getByKey(cobKey).lean();
      
      if (!cob) {
        logger.warn(`COB option not found: ${cobKey}`);
        return null;
      }
      
      logger.info(`Retrieved COB option: ${cob.cobName}`);
      return cob;
    } catch (error) {
      logger.error(`Error getting COB option ${cobKey}:`, error);
      throw new AppError('Failed to retrieve COB option', 500);
    }
  }

  /**
   * Get COB by boolean value
   */
  static async getCOBByValue(cobValue: boolean): Promise<IInsuranceCOB | null> {
    try {
      const cob = await InsuranceCOBModel.getByValue(cobValue).lean();
      
      if (!cob) {
        logger.warn(`COB option not found for value: ${cobValue}`);
        return null;
      }
      
      logger.info(`Retrieved COB option by value: ${cob.cobName}`);
      return cob;
    } catch (error) {
      logger.error(`Error getting COB option by value ${cobValue}:`, error);
      throw new AppError('Failed to retrieve COB option', 500);
    }
  }

  /**
   * Get default COB option
   */
  static async getDefaultCOB(): Promise<IInsuranceCOB | null> {
    try {
      const cob = await InsuranceCOBModel.getDefault().lean();
      
      if (!cob) {
        logger.warn('No default COB option found');
        return null;
      }
      
      logger.info(`Retrieved default COB option: ${cob.cobName}`);
      return cob;
    } catch (error) {
      logger.error('Error getting default COB option:', error);
      throw new AppError('Failed to retrieve default COB option', 500);
    }
  }

  /**
   * COMBINED REFERENCE DATA METHODS
   */

  /**
   * Get all insurance reference data in one call
   */
  static async getAllInsuranceReferenceData(): Promise<{
    frequencies: IInsuranceFrequency[];
    policyHolders: IInsurancePolicyHolder[];
    cobOptions: IInsuranceCOB[];
  }> {
    try {
      const [frequencies, policyHolders, cobOptions] = await Promise.all([
        InsuranceFrequencyModel.getSelectableFrequencies().lean(),
        InsurancePolicyHolderModel.getValidSelections().lean(),
        InsuranceCOBModel.getAllCOBOptions().lean()
      ]);
      
      logger.info('Retrieved all insurance reference data');
      return {
        frequencies,
        policyHolders,
        cobOptions
      };
    } catch (error) {
      logger.error('Error getting all insurance reference data:', error);
      throw new AppError('Failed to retrieve insurance reference data', 500);
    }
  }

  /**
   * Get insurance form data (for frontend forms)
   */
  static async getInsuranceFormData(): Promise<{
    frequencyOptions: Array<{ value: number; label: string; type: string }>;
    policyHolderOptions: Array<{ value: number; label: string; requiresInfo: boolean }>;
    cobOptions: Array<{ value: number; label: string; booleanValue: boolean; isDefault: boolean }>;
  }> {
    try {
      const [frequencies, policyHolders, cobOptions] = await Promise.all([
        this.getSelectableFrequencies(),
        this.getValidPolicyHolders(),
        this.getAllCOBOptions()
      ]);
      
      const frequencyOptions = frequencies.map(freq => ({
        value: freq.frequencyKey,
        label: freq.getDisplayName(),
        type: freq.frequencyType
      }));
      
      const policyHolderOptions = policyHolders.map(holder => ({
        value: holder.policyHolderKey,
        label: holder.getDisplayName(),
        requiresInfo: holder.requiresAdditionalInfo
      }));
      
      const cobOptionsFormatted = cobOptions.map(cob => ({
        value: cob.cobKey,
        label: cob.getDisplayName(),
        booleanValue: cob.cobValue,
        isDefault: cob.isDefault
      }));
      
      logger.info('Retrieved insurance form data');
      return {
        frequencyOptions,
        policyHolderOptions,
        cobOptions: cobOptionsFormatted
      };
    } catch (error) {
      logger.error('Error getting insurance form data:', error);
      throw new AppError('Failed to retrieve insurance form data', 500);
    }
  }

  /**
   * Validate insurance reference data consistency
   */
  static async validateReferenceData(): Promise<{
    isValid: boolean;
    issues: string[];
    stats: {
      frequenciesCount: number;
      policyHoldersCount: number;
      cobOptionsCount: number;
      hasDefaultCOB: boolean;
    };
  }> {
    try {
      const [frequencies, policyHolders, cobOptions, defaultCOB] = await Promise.all([
        this.getAllFrequencies(),
        this.getAllPolicyHolders(),
        this.getAllCOBOptions(),
        this.getDefaultCOB()
      ]);
      
      const issues: string[] = [];
      
      // Validate frequencies
      if (frequencies.length === 0) {
        issues.push('No insurance frequencies found');
      }
      
      const selectableFreqs = frequencies.filter(f => f.isSelectable);
      if (selectableFreqs.length === 0) {
        issues.push('No selectable frequency options available');
      }
      
      // Validate policy holders
      if (policyHolders.length === 0) {
        issues.push('No policy holders found');
      }
      
      const validPolicyHolders = policyHolders.filter(p => p.isValidSelection);
      if (validPolicyHolders.length === 0) {
        issues.push('No valid policy holder options available');
      }
      
      // Validate COB options
      if (cobOptions.length === 0) {
        issues.push('No COB options found');
      }
      
      if (cobOptions.length > 0 && !defaultCOB) {
        issues.push('No default COB option set');
      }
      
      const hasYesOption = cobOptions.some(cob => cob.cobStatus === COBStatus.YES);
      const hasNoOption = cobOptions.some(cob => cob.cobStatus === COBStatus.NO);
      
      if (!hasYesOption) {
        issues.push('Missing YES COB option');
      }
      
      if (!hasNoOption) {
        issues.push('Missing NO COB option');
      }
      
      const stats = {
        frequenciesCount: frequencies.length,
        policyHoldersCount: policyHolders.length,
        cobOptionsCount: cobOptions.length,
        hasDefaultCOB: !!defaultCOB
      };
      
      const isValid = issues.length === 0;
      
      logger.info(`Insurance reference data validation: ${isValid ? 'PASSED' : 'FAILED'} (${issues.length} issues)`);
      
      return {
        isValid,
        issues,
        stats
      };
    } catch (error) {
      logger.error('Error validating insurance reference data:', error);
      throw new AppError('Failed to validate insurance reference data', 500);
    }
  }

  /**
   * Get reference data statistics
   */
  static async getReferenceDataStats(): Promise<{
    frequencies: {
      total: number;
      selectable: number;
      byType: Record<FrequencyType, number>;
    };
    policyHolders: {
      total: number;
      valid: number;
      requiresInfo: number;
      byType: Record<PolicyHolderType, number>;
    };
    cob: {
      total: number;
      hasDefault: boolean;
      yesCount: number;
      noCount: number;
    };
  }> {
    try {
      const [frequencies, policyHolders, cobOptions] = await Promise.all([
        this.getAllFrequencies(),
        this.getAllPolicyHolders(),
        this.getAllCOBOptions()
      ]);
      
      // Frequency stats
      const frequencyByType = frequencies.reduce((acc, freq) => {
        acc[freq.frequencyType] = (acc[freq.frequencyType] || 0) + 1;
        return acc;
      }, {} as Record<FrequencyType, number>);
      
      // Policy holder stats  
      const policyHoldersByType = policyHolders.reduce((acc, holder) => {
        acc[holder.policyHolderType] = (acc[holder.policyHolderType] || 0) + 1;
        return acc;
      }, {} as Record<PolicyHolderType, number>);
      
      // COB stats
      const yesCount = cobOptions.filter(cob => cob.cobStatus === COBStatus.YES).length;
      const noCount = cobOptions.filter(cob => cob.cobStatus === COBStatus.NO).length;
      const hasDefault = cobOptions.some(cob => cob.isDefault);
      
      const stats = {
        frequencies: {
          total: frequencies.length,
          selectable: frequencies.filter(f => f.isSelectable).length,
          byType: frequencyByType
        },
        policyHolders: {
          total: policyHolders.length,
          valid: policyHolders.filter(p => p.isValidSelection).length,
          requiresInfo: policyHolders.filter(p => p.requiresAdditionalInfo).length,
          byType: policyHoldersByType
        },
        cob: {
          total: cobOptions.length,
          hasDefault,
          yesCount,
          noCount
        }
      };
      
      logger.info('Retrieved insurance reference data statistics');
      return stats;
    } catch (error) {
      logger.error('Error getting reference data statistics:', error);
      throw new AppError('Failed to retrieve reference data statistics', 500);
    }
  }
}
