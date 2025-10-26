import PaymentMethodModel from '../models/PaymentMethod';
import PaymentTypeModel from '../models/PaymentType';
import { logger } from './logger';

/**
 * Payment Method and Type Seeder
 * Populates lookup tables with standard values from MSSQL
 */

// Standard payment methods from MSSQL
const PAYMENT_METHODS = [
  { sb_paymentMethod_key: 1, sb_paymentMethod_name: 'Cash' },
  { sb_paymentMethod_key: 2, sb_paymentMethod_name: 'Credit Card' },
  { sb_paymentMethod_key: 3, sb_paymentMethod_name: 'Debit' },
  { sb_paymentMethod_key: 4, sb_paymentMethod_name: 'Cheque' },
  { sb_paymentMethod_key: 5, sb_paymentMethod_name: 'Insurance' },
  { sb_paymentMethod_key: 6, sb_paymentMethod_name: 'Bank Transfer' },
  { sb_paymentMethod_key: 7, sb_paymentMethod_name: 'Other' }
];

// Standard payment types from MSSQL
const PAYMENT_TYPES = [
  { sb_paymentType_key: 1, sb_paymentType_name: 'POP' },               // Patient Out of Pocket
  { sb_paymentType_key: 2, sb_paymentType_name: 'POPFP' },             // Patient Out of Pocket - Final Payment
  { sb_paymentType_key: 3, sb_paymentType_name: 'DPA' },               // Direct Payment Authorization
  { sb_paymentType_key: 4, sb_paymentType_name: 'DPAFP' },             // DPA Final Payment
  { sb_paymentType_key: 5, sb_paymentType_name: 'COB_1' },             // Coordination of Benefits - Primary
  { sb_paymentType_key: 6, sb_paymentType_name: 'COB_2' },             // Coordination of Benefits - Secondary
  { sb_paymentType_key: 7, sb_paymentType_name: 'COB_3' },             // Coordination of Benefits - Tertiary
  { sb_paymentType_key: 8, sb_paymentType_name: 'INSURANCE_1ST' },     // 1st Insurance Payment
  { sb_paymentType_key: 9, sb_paymentType_name: 'INSURANCE_2ND' },     // 2nd Insurance Payment
  { sb_paymentType_key: 10, sb_paymentType_name: 'INSURANCE_3RD' },    // 3rd Insurance Payment
  { sb_paymentType_key: 11, sb_paymentType_name: 'SALES_REFUND' },     // Sales Refund
  { sb_paymentType_key: 12, sb_paymentType_name: 'WRITEOFF' },         // Write-off Amount
  { sb_paymentType_key: 13, sb_paymentType_name: 'NO_INSUR_FP' }       // No Insurance Final Payment
];

/**
 * Seed payment methods lookup table
 */
export async function seedPaymentMethods() {
  try {
    const count = await PaymentMethodModel.countDocuments();
    if (count > 0) {
      logger.info('Payment methods already seeded, skipping...');
      return;
    }

    await PaymentMethodModel.insertMany(PAYMENT_METHODS);
    logger.info(`Successfully seeded ${PAYMENT_METHODS.length} payment methods`);
  } catch (error) {
    logger.error('Failed to seed payment methods:', error);
    throw error;
  }
}

/**
 * Seed payment types lookup table
 */
export async function seedPaymentTypes() {
  try {
    const count = await PaymentTypeModel.countDocuments();
    if (count > 0) {
      logger.info('Payment types already seeded, skipping...');
      return;
    }

    await PaymentTypeModel.insertMany(PAYMENT_TYPES);
    logger.info(`Successfully seeded ${PAYMENT_TYPES.length} payment types`);
  } catch (error) {
    logger.error('Failed to seed payment types:', error);
    throw error;
  }
}

/**
 * Seed all payment lookup tables
 */
export async function seedAllPaymentLookups() {
  try {
    await seedPaymentMethods();
    await seedPaymentTypes();
    logger.info('All payment lookup tables seeded successfully');
  } catch (error) {
    logger.error('Failed to seed payment lookup tables:', error);
    throw error;
  }
}
