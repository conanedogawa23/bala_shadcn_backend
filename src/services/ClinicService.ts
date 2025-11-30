import { ClinicModel } from '../models/Clinic';

export interface RetainedClinic {
  name: string;
  displayName: string;
  isActive: boolean;
}

/**
 * Simplified ClinicService - uses MongoDB as single source of truth
 * All clinic data comes from the clinics collection where isRetainedClinic: true
 */
export class ClinicService {
  
  /**
   * Get all retained clinics from MongoDB
   */
  static async getRetainedClinics(): Promise<RetainedClinic[]> {
    const clinics = await ClinicModel.findRetainedClinics();
    return clinics.map(clinic => ({
      name: clinic.name,
      displayName: clinic.getDisplayName(),
      isActive: true
    }));
  }

  /**
   * Get retained clinic names as simple array
   */
  static async getRetainedClinicNames(): Promise<string[]> {
    const clinics = await ClinicModel.findRetainedClinics();
    return clinics.map(clinic => clinic.name);
  }

  /**
   * Find clinic by name (case-insensitive)
   * Returns the clinic if found in retained clinics, null otherwise
   */
  static async findClinicByName(name: string): Promise<RetainedClinic | null> {
    const clinics = await ClinicModel.findRetainedClinics();
    
    // Try exact match first
    let clinic = clinics.find(c => c.name === name);
    
    // Try case-insensitive match
    if (!clinic) {
      const nameLower = name.toLowerCase();
      clinic = clinics.find(c => 
        c.name.toLowerCase() === nameLower ||
        c.getDisplayName().toLowerCase() === nameLower
      );
    }
    
    // Try normalized match (remove spaces, hyphens)
    if (!clinic) {
      const nameNormalized = name.toLowerCase().replace(/[\s-]/g, '');
      clinic = clinics.find(c => 
        c.name.toLowerCase().replace(/[\s-]/g, '') === nameNormalized ||
        c.getDisplayName().toLowerCase().replace(/[\s-]/g, '') === nameNormalized
      );
    }
    
    if (!clinic) {
      return null;
    }
    
    return {
      name: clinic.name,
      displayName: clinic.getDisplayName(),
      isActive: true
    };
  }

  /**
   * Check if clinic name exists in retained clinics
   * Non-throwing validation for conditional logic
   */
  static async isValidClinic(clinicName: string): Promise<boolean> {
    const clinic = await this.findClinicByName(clinicName);
    return clinic !== null;
  }

  /**
   * Get the canonical clinic name from MongoDB
   * Used for API calls where exact clinic name is needed
   */
  static async getCanonicalClinicName(name: string): Promise<string | null> {
    const clinic = await this.findClinicByName(name);
    return clinic?.name || null;
  }
}
