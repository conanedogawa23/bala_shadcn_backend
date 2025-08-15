import { IInsuranceFrequency, FrequencyType } from '../models/InsuranceFrequency';
import { IInsurancePolicyHolder, PolicyHolderType } from '../models/InsurancePolicyHolder';
import { IInsuranceCOB, COBStatus } from '../models/InsuranceCOB';

// Insurance Frequency Interfaces
export interface InsuranceFrequencyResponse {
  id: string;
  frequencyKey: number;
  frequencyName: string;
  frequencyType: FrequencyType;
  isSelectable: boolean;
  displayOrder: number;
  displayName: string;
  dateCreated: string;
  dateModified: string;
}

// Insurance Policy Holder Interfaces  
export interface InsurancePolicyHolderResponse {
  id: string;
  policyHolderKey: number;
  policyHolderName: string;
  policyHolderType: PolicyHolderType;
  isValidSelection: boolean;
  displayOrder: number;
  requiresAdditionalInfo: boolean;
  displayName: string;
  dateCreated: string;
  dateModified: string;
}

// Insurance COB Interfaces
export interface InsuranceCOBResponse {
  id: string;
  cobKey: number;
  cobName: string;
  cobStatus: COBStatus;
  cobValue: boolean;
  isDefault: boolean;
  displayOrder: number;
  displayName: string;
  dateCreated: string;
  dateModified: string;
}

// Combined Reference Data Interface
export interface InsuranceReferenceDataResponse {
  frequencies: InsuranceFrequencyResponse[];
  policyHolders: InsurancePolicyHolderResponse[];
  cobOptions: InsuranceCOBResponse[];
}

// Form Data Interface
export interface InsuranceFormDataResponse {
  frequencyOptions: Array<{ value: number; label: string; type: string }>;
  policyHolderOptions: Array<{ value: number; label: string; requiresInfo: boolean }>;
  cobOptions: Array<{ value: number; label: string; booleanValue: boolean; isDefault: boolean }>;
}

// Statistics Interface
export interface InsuranceReferenceStatsResponse {
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
}

export class InsuranceReferenceView {
  /**
   * INSURANCE FREQUENCY FORMATTING
   */

  /**
   * Format single insurance frequency
   */
  static formatFrequency(frequency: IInsuranceFrequency): InsuranceFrequencyResponse {
    return {
      id: frequency._id.toString(),
      frequencyKey: frequency.frequencyKey,
      frequencyName: frequency.frequencyName?.trim() || '',
      frequencyType: frequency.frequencyType,
      isSelectable: frequency.isSelectable,
      displayOrder: frequency.displayOrder,
      displayName: frequency.getDisplayName(),
      dateCreated: frequency.dateCreated.toISOString(),
      dateModified: frequency.dateModified.toISOString()
    };
  }

  /**
   * Format multiple frequencies - optimized with map
   */
  static formatFrequencies(frequencies: IInsuranceFrequency[]): InsuranceFrequencyResponse[] {
    return frequencies.map(frequency => this.formatFrequency(frequency));
  }

  /**
   * INSURANCE POLICY HOLDER FORMATTING
   */

  /**
   * Format single policy holder
   */
  static formatPolicyHolder(policyHolder: IInsurancePolicyHolder): InsurancePolicyHolderResponse {
    return {
      id: policyHolder._id.toString(),
      policyHolderKey: policyHolder.policyHolderKey,
      policyHolderName: policyHolder.policyHolderName?.trim() || '',
      policyHolderType: policyHolder.policyHolderType,
      isValidSelection: policyHolder.isValidSelection,
      displayOrder: policyHolder.displayOrder,
      requiresAdditionalInfo: policyHolder.requiresAdditionalInfo,
      displayName: policyHolder.getDisplayName(),
      dateCreated: policyHolder.dateCreated.toISOString(),
      dateModified: policyHolder.dateModified.toISOString()
    };
  }

  /**
   * Format multiple policy holders - optimized with map
   */
  static formatPolicyHolders(policyHolders: IInsurancePolicyHolder[]): InsurancePolicyHolderResponse[] {
    return policyHolders.map(policyHolder => this.formatPolicyHolder(policyHolder));
  }

  /**
   * INSURANCE COB FORMATTING
   */

  /**
   * Format single COB option
   */
  static formatCOB(cob: IInsuranceCOB): InsuranceCOBResponse {
    return {
      id: cob._id.toString(),
      cobKey: cob.cobKey,
      cobName: cob.cobName?.trim() || '',
      cobStatus: cob.cobStatus,
      cobValue: cob.cobValue,
      isDefault: cob.isDefault,
      displayOrder: cob.displayOrder,
      displayName: cob.getDisplayName(),
      dateCreated: cob.dateCreated.toISOString(),
      dateModified: cob.dateModified.toISOString()
    };
  }

  /**
   * Format multiple COB options - optimized with map
   */
  static formatCOBOptions(cobOptions: IInsuranceCOB[]): InsuranceCOBResponse[] {
    return cobOptions.map(cob => this.formatCOB(cob));
  }

  /**
   * COMBINED REFERENCE DATA FORMATTING
   */

  /**
   * Format all insurance reference data
   */
  static formatInsuranceReferenceData(data: {
    frequencies: IInsuranceFrequency[];
    policyHolders: IInsurancePolicyHolder[];
    cobOptions: IInsuranceCOB[];
  }): InsuranceReferenceDataResponse {
    return {
      frequencies: this.formatFrequencies(data.frequencies),
      policyHolders: this.formatPolicyHolders(data.policyHolders),
      cobOptions: this.formatCOBOptions(data.cobOptions)
    };
  }

  /**
   * Format insurance form data for frontend
   */
  static formatInsuranceFormData(data: {
    frequencyOptions: Array<{ value: number; label: string; type: string }>;
    policyHolderOptions: Array<{ value: number; label: string; requiresInfo: boolean }>;
    cobOptions: Array<{ value: number; label: string; booleanValue: boolean; isDefault: boolean }>;
  }): InsuranceFormDataResponse {
    return {
      frequencyOptions: data.frequencyOptions.map(option => ({
        value: option.value,
        label: option.label?.trim() || '',
        type: option.type
      })),
      policyHolderOptions: data.policyHolderOptions.map(option => ({
        value: option.value,
        label: option.label?.trim() || '',
        requiresInfo: option.requiresInfo
      })),
      cobOptions: data.cobOptions.map(option => ({
        value: option.value,
        label: option.label?.trim() || '',
        booleanValue: option.booleanValue,
        isDefault: option.isDefault
      }))
    };
  }

  /**
   * Format insurance reference statistics
   */
  static formatInsuranceReferenceStats(stats: {
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
  }): InsuranceReferenceStatsResponse {
    return {
      frequencies: {
        total: stats.frequencies.total,
        selectable: stats.frequencies.selectable,
        byType: stats.frequencies.byType
      },
      policyHolders: {
        total: stats.policyHolders.total,
        valid: stats.policyHolders.valid,
        requiresInfo: stats.policyHolders.requiresInfo,
        byType: stats.policyHolders.byType
      },
      cob: {
        total: stats.cob.total,
        hasDefault: stats.cob.hasDefault,
        yesCount: stats.cob.yesCount,
        noCount: stats.cob.noCount
      }
    };
  }

  /**
   * FRONTEND COMPATIBILITY FORMATTING
   */

  /**
   * Format frequencies for frontend compatibility
   */
  static formatFrequenciesForFrontend(frequencies: IInsuranceFrequency[]): any[] {
    return frequencies.map(frequency => ({
      id: frequency._id.toString(),
      key: frequency.frequencyKey,
      name: frequency.frequencyName?.trim() || '',
      type: frequency.frequencyType,
      selectable: frequency.isSelectable,
      order: frequency.displayOrder,
      label: frequency.getDisplayName()
    }));
  }

  /**
   * Format policy holders for frontend compatibility
   */
  static formatPolicyHoldersForFrontend(policyHolders: IInsurancePolicyHolder[]): any[] {
    return policyHolders.map(holder => ({
      id: holder._id.toString(),
      key: holder.policyHolderKey,
      name: holder.policyHolderName?.trim() || '',
      type: holder.policyHolderType,
      valid: holder.isValidSelection,
      order: holder.displayOrder,
      requiresInfo: holder.requiresAdditionalInfo,
      label: holder.getDisplayName()
    }));
  }

  /**
   * Format COB options for frontend compatibility
   */
  static formatCOBOptionsForFrontend(cobOptions: IInsuranceCOB[]): any[] {
    return cobOptions.map(cob => ({
      id: cob._id.toString(),
      key: cob.cobKey,
      name: cob.cobName?.trim() || '',
      status: cob.cobStatus,
      value: cob.cobValue,
      default: cob.isDefault,
      order: cob.displayOrder,
      label: cob.getDisplayName()
    }));
  }

  /**
   * VALIDATION RESULTS FORMATTING
   */

  /**
   * Format validation results
   */
  static formatValidationResults(validation: {
    isValid: boolean;
    issues: string[];
    stats: {
      frequenciesCount: number;
      policyHoldersCount: number;
      cobOptionsCount: number;
      hasDefaultCOB: boolean;
    };
  }): {
    isValid: boolean;
    issues: string[];
    summary: {
      status: 'PASSED' | 'FAILED';
      totalIssues: number;
      dataIntegrity: 'GOOD' | 'ISSUES' | 'CRITICAL';
    };
    stats: {
      frequenciesCount: number;
      policyHoldersCount: number;
      cobOptionsCount: number;
      hasDefaultCOB: boolean;
    };
  } {
    const totalIssues = validation.issues.length;
    let dataIntegrity: 'GOOD' | 'ISSUES' | 'CRITICAL';
    
    if (totalIssues === 0) {
      dataIntegrity = 'GOOD';
    } else if (totalIssues <= 2) {
      dataIntegrity = 'ISSUES';
    } else {
      dataIntegrity = 'CRITICAL';
    }
    
    return {
      isValid: validation.isValid,
      issues: validation.issues,
      summary: {
        status: validation.isValid ? 'PASSED' : 'FAILED',
        totalIssues,
        dataIntegrity
      },
      stats: validation.stats
    };
  }

  /**
   * DROPDOWN OPTIONS FORMATTING
   */

  /**
   * Format frequency options for dropdowns
   */
  static formatFrequencyDropdownOptions(frequencies: IInsuranceFrequency[]): Array<{
    value: number;
    label: string;
    disabled?: boolean;
    group?: string;
  }> {
    return frequencies.map(frequency => ({
      value: frequency.frequencyKey,
      label: frequency.getDisplayName(),
      disabled: !frequency.isSelectable,
      group: frequency.frequencyType.charAt(0).toUpperCase() + frequency.frequencyType.slice(1)
    }));
  }

  /**
   * Format policy holder options for dropdowns
   */
  static formatPolicyHolderDropdownOptions(policyHolders: IInsurancePolicyHolder[]): Array<{
    value: number;
    label: string;
    disabled?: boolean;
    requiresInfo?: boolean;
    description?: string;
  }> {
    return policyHolders.map(holder => ({
      value: holder.policyHolderKey,
      label: holder.getDisplayName(),
      disabled: !holder.isValidSelection,
      requiresInfo: holder.requiresAdditionalInfo,
      description: holder.requiresAdditionalInfo ? 'Additional information required' : undefined
    }));
  }

  /**
   * Format COB options for dropdowns
   */
  static formatCOBDropdownOptions(cobOptions: IInsuranceCOB[]): Array<{
    value: number;
    label: string;
    booleanValue: boolean;
    isDefault?: boolean;
    recommended?: boolean;
  }> {
    return cobOptions.map(cob => ({
      value: cob.cobKey,
      label: cob.getDisplayName(),
      booleanValue: cob.cobValue,
      isDefault: cob.isDefault,
      recommended: cob.isDefault
    }));
  }

  /**
   * SUMMARY FORMATTING
   */

  /**
   * Format insurance reference summary for dashboard
   */
  static formatInsuranceReferenceSummary(data: {
    frequencies: IInsuranceFrequency[];
    policyHolders: IInsurancePolicyHolder[];
    cobOptions: IInsuranceCOB[];
  }): {
    overview: {
      frequencyCount: number;
      policyHolderCount: number;
      cobCount: number;
      totalOptions: number;
    };
    availability: {
      selectableFrequencies: number;
      validPolicyHolders: number;
      hasDefaultCOB: boolean;
    };
    distribution: {
      frequencyTypes: Record<string, number>;
      policyHolderTypes: Record<string, number>;
      cobStatuses: Record<string, number>;
    };
  } {
    // Use reduce for optimized counting
    const frequencyTypes = data.frequencies.reduce((acc, freq) => {
      acc[freq.frequencyType] = (acc[freq.frequencyType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const policyHolderTypes = data.policyHolders.reduce((acc, holder) => {
      acc[holder.policyHolderType] = (acc[holder.policyHolderType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const cobStatuses = data.cobOptions.reduce((acc, cob) => {
      acc[cob.cobStatus] = (acc[cob.cobStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      overview: {
        frequencyCount: data.frequencies.length,
        policyHolderCount: data.policyHolders.length,
        cobCount: data.cobOptions.length,
        totalOptions: data.frequencies.length + data.policyHolders.length + data.cobOptions.length
      },
      availability: {
        selectableFrequencies: data.frequencies.filter(f => f.isSelectable).length,
        validPolicyHolders: data.policyHolders.filter(p => p.isValidSelection).length,
        hasDefaultCOB: data.cobOptions.some(c => c.isDefault)
      },
      distribution: {
        frequencyTypes,
        policyHolderTypes,
        cobStatuses
      }
    };
  }
}
