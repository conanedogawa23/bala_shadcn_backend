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
   * Updated to match MSSQL verified clinics (6 retained)
   * MSSQL VERIFIED: Total 13 clinics, Retained 6
   */
  private static readonly RETAINED_CLINICS = [
    'bodyblissphysio',           // MSSQL: "bodyblissphysio"
    'BodyBlissOneCare',          // MSSQL: "BodyBlissOneCare " (trimmed)
    'Century Care',              // MSSQL: "Century Care"
    'Ortholine Duncan Mills',    // MSSQL: "Ortholine Duncan Mills"
    'My Cloud',                  // MSSQL: "My Cloud"
    'Physio Bliss'               // MSSQL: "Physio Bliss"
  ];

  /**
   * Clinic name variations mapping - handles different name formats
   * Maps various name formats to the canonical MongoDB clinic name
   */
  private static readonly CLINIC_NAME_VARIATIONS: Record<string, string> = {
    // BodyBliss variations
    'BodyBliss': 'BodyBliss',
    'bodybliss': 'BodyBliss',
    
    // BodyBlissOneCare variations  
    'BodyBlissOneCare': 'BodyBlissOneCare',
    'bodyblissonecare': 'BodyBlissOneCare',
    'BodyBliss OneCare': 'BodyBlissOneCare',
    
    // BodyBliss Physiotherapy variations
    'bodyblissphysio': 'bodyblissphysio',
    'BodyBlissPhysio': 'bodyblissphysio',
    'BodyBliss Physio': 'bodyblissphysio',
    'BodyBliss Physiotherapy': 'bodyblissphysio',
    
    // Other clinics
    'Century Care': 'Century Care',
    'centurycare': 'Century Care',
    'Ortholine Duncan Mills': 'Ortholine Duncan Mills',
    'ortholine-duncan-mills': 'Ortholine Duncan Mills',
    'My Cloud': 'My Cloud',
    'mycloud': 'My Cloud',
    'Physio Bliss': 'Physio Bliss',
    'physiobliss': 'Physio Bliss'
  };

  /**
   * Normalize clinic name to canonical format
   */
  private static normalizeClinicName(name: string): string {
    // First try direct lookup
    if (this.CLINIC_NAME_VARIATIONS[name]) {
      return this.CLINIC_NAME_VARIATIONS[name];
    }

    // Try case-insensitive lookup
    const lowerName = name.toLowerCase();
    for (const [variation, canonical] of Object.entries(this.CLINIC_NAME_VARIATIONS)) {
      if (variation.toLowerCase() === lowerName) {
        return canonical;
      }
    }

    // Return original name if no match found
    return name;
  }

  /**
   * Frontend slug to backend clinic name mapping
   * Updated to match actual MongoDB clinic names
   */
  private static readonly CLINIC_SLUG_MAPPING: ClinicMapping = {
    'bodybliss': 'BodyBliss',                    // MongoDB: name="BodyBliss"
    'bodybliss-physio': 'bodyblissphysio',       // MongoDB: name="bodyblissphysio"  
    'bodyblissphysio': 'bodyblissphysio',        // Support both variations
    'bodybliss-onecare': 'BodyBlissOneCare',     // MongoDB: name="BodyBlissOneCare"
    'bodyblissonecare': 'BodyBlissOneCare',      // Support both variations
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
   * Get clinic by name - Compatibility method with name variation handling
   * Returns a minimal clinic object for backward compatibility
   */
  static async getClinicByName(name: string): Promise<{ name: string; clinicId: number; displayName: string }> {
    // Normalize the clinic name to handle variations
    const normalizedName = this.normalizeClinicName(name);
    
    // Check if the normalized name is in our retained clinics
    if (!this.RETAINED_CLINICS.includes(normalizedName)) {
      throw new ValidationError(`Clinic '${name}' (normalized: '${normalizedName}') is not in the retained clinics list. Available clinics: ${this.RETAINED_CLINICS.join(', ')}`);
    }
    
    // Return minimal compatible object with normalized name
    return {
      name: normalizedName,
      clinicId: this.RETAINED_CLINICS.indexOf(normalizedName) + 1, // Simple ID mapping
      displayName: normalizedName
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
