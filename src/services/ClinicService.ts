import { ValidationError } from '../utils/errors';

export interface RetainedClinic {
  name: string;
  slug: string;
  isActive: boolean;
}

export interface ClinicMapping {
  [frontendSlug: string]: string; // Maps frontend slug to backend clinic name
}

export class ClinicService {
  /**
   * CSV Requirement: Only retained clinics allowed
   * Reuse from PaymentService to maintain consistency
   */
  private static readonly RETAINED_CLINICS = [
    'BodyBlissPhysio',
    'BodyBlissOneCare', 
    'Century Care',
    'Ortholine Duncan Mills',
    'My Cloud',
    'Physio Bliss'
  ];

  /**
   * Frontend slug to backend clinic name mapping
   * Data-driven approach for clinic name resolution
   */
  private static readonly CLINIC_SLUG_MAPPING: ClinicMapping = {
    'bodybliss-physio': 'BodyBlissPhysio',
    'bodyblissphysio': 'BodyBlissPhysio', // Support both variations
    'bodybliss-onecare': 'BodyBlissOneCare',
    'bodyblissonecare': 'BodyBlissOneCare', // Support both variations
    'century-care': 'Century Care',
    'ortholine-duncan-mills': 'Ortholine Duncan Mills',
    'my-cloud': 'My Cloud',
    'physio-bliss': 'Physio Bliss'
  };

  /**
   * Get all available (retained) clinics
   * CSV: Under Clinic Name - retain the following
   */
  static getAvailableClinics(): RetainedClinic[] {
    return this.RETAINED_CLINICS.map(clinicName => ({
      name: clinicName,
      slug: this.clinicNameToSlug(clinicName),
      isActive: true
    }));
  }

  /**
   * Get clinic slug to name mapping for frontend
   * Enables frontend to convert slugs to proper backend names
   */
  static getClinicMapping(): ClinicMapping {
    return { ...this.CLINIC_SLUG_MAPPING };
  }

  /**
   * Validate if clinic is in retained list
   * Throws ValidationError if not allowed
   */
  static validateClinicAccess(clinicName: string): void {
    if (!this.RETAINED_CLINICS.includes(clinicName)) {
      throw new ValidationError(`Clinic '${clinicName}' is not in the retained clinics list`);
    }
  }

  /**
   * Convert frontend slug to backend clinic name
   * Returns proper clinic name for API operations
   */
  static slugToClinicName(slug: string): string {
    const clinicName = this.CLINIC_SLUG_MAPPING[slug];
    if (!clinicName) {
      throw new ValidationError(`Invalid clinic slug: '${slug}'`);
    }
    return clinicName;
  }

  /**
   * Convert clinic name to frontend slug
   * For URL generation and routing
   */
  static clinicNameToSlug(clinicName: string): string {
    return clinicName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Check if clinic name exists in retained list
   * Non-throwing validation for conditional logic
   */
  static isValidClinic(clinicName: string): boolean {
    return this.RETAINED_CLINICS.includes(clinicName);
  }

  /**
   * Get clinic info by slug
   * Returns clinic details for frontend consumption
   */
  static getClinicBySlug(slug: string): RetainedClinic | null {
    try {
      const clinicName = this.slugToClinicName(slug);
      return {
        name: clinicName,
        slug,
        isActive: true
      };
    } catch {
      return null;
    }
  }

  // ========================
  // COMPATIBILITY METHODS FOR EXISTING CODE
  // ========================

  /**
   * Get clinic by name - Compatibility method
   * Returns a minimal clinic object for backward compatibility
   */
  static async getClinicByName(name: string): Promise<{ name: string; clinicId: number; displayName: string }> {
    // Check if it's in our retained clinics
    if (!this.RETAINED_CLINICS.includes(name)) {
      throw new ValidationError(`Clinic '${name}' is not in the retained clinics list`);
    }
    
    // Return minimal compatible object
    return {
      name,
      clinicId: this.RETAINED_CLINICS.indexOf(name) + 1, // Simple ID mapping
      displayName: name
    };
  }

  /**
   * Update clinic stats - Compatibility stub
   * No-op for retained clinics as they don't use dynamic stats
   */
  static async updateClinicStats(clinicId: number, stats: any): Promise<void> {
    // No-op: Retained clinics don't need dynamic stats updates
    console.log(`Clinic stats update skipped for retained clinic ID: ${clinicId}`);
  }
}
