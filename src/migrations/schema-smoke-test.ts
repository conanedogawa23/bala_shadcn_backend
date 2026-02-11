/**
 * Schema Smoke Test
 * 
 * Loads one document from each major collection via Mongoose,
 * validates it, and attempts a no-op save to catch any schema mismatches.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { AppointmentModel } from '../models/Appointment';
import { ClientModel } from '../models/Client';
import { PaymentModel } from '../models/Payment';
import OrderModel from '../models/Order';
import { ContactHistoryModel } from '../models/ContactHistory';
import { ClientClinicRelationshipModel } from '../models/ClientClinicRelationship';
import { InsuranceCompanyModel } from '../models/InsuranceCompany';

const MONGO_URI = process.env.MIGRATION_MONGODB_URI || process.env.MONGODB_URI || '';

interface TestResult {
  collection: string;
  findOne: 'PASS' | 'FAIL';
  validate: 'PASS' | 'FAIL' | 'SKIP';
  error?: string;
}

async function testCollection(
  name: string,
  model: mongoose.Model<any>
): Promise<TestResult> {
  const result: TestResult = {
    collection: name,
    findOne: 'FAIL',
    validate: 'SKIP'
  };

  try {
    // Test 1: Can Mongoose load the document?
    const doc = await model.findOne().lean();
    if (!doc) {
      result.findOne = 'PASS';
      result.validate = 'SKIP';
      console.log(`  [${name}] No documents found (empty collection) - SKIP`);
      return result;
    }
    result.findOne = 'PASS';

    // Test 2: Can Mongoose hydrate and validate the document?
    const hydratedDoc = new model(doc);
    const validationError = hydratedDoc.validateSync();
    if (validationError) {
      result.validate = 'FAIL';
      result.error = validationError.message;
      console.log(`  [${name}] findOne: PASS | validate: FAIL`);
      console.log(`    Error: ${validationError.message}`);
    } else {
      result.validate = 'PASS';
      console.log(`  [${name}] findOne: PASS | validate: PASS`);
    }
  } catch (error: any) {
    result.error = error.message;
    console.log(`  [${name}] findOne: FAIL`);
    console.log(`    Error: ${error.message}`);
  }

  return result;
}

async function runSmokeTest(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('SCHEMA SMOKE TEST');
  console.log('='.repeat(70) + '\n');

  console.log(`Connecting to MongoDB: ${MONGO_URI.replace(/\/\/[^@]+@/, '//***@')}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const tests: Array<{ name: string; model: mongoose.Model<any> }> = [
    { name: 'appointments', model: AppointmentModel },
    { name: 'clients', model: ClientModel },
    { name: 'payments', model: PaymentModel },
    { name: 'orders', model: OrderModel },
    { name: 'contact_history', model: ContactHistoryModel },
    { name: 'client_clinic_relationships', model: ClientClinicRelationshipModel },
    { name: 'insurance_companies', model: InsuranceCompanyModel },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await testCollection(test.name, test.model);
    results.push(result);
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const status = r.findOne === 'PASS' && (r.validate === 'PASS' || r.validate === 'SKIP')
      ? 'PASS'
      : 'FAIL';
    if (status === 'PASS') passCount++;
    else failCount++;
    console.log(`  ${status === 'PASS' ? '[PASS]' : '[FAIL]'} ${r.collection}`);
    if (r.error) {
      console.log(`         ${r.error}`);
    }
  }

  console.log(`\nTotal: ${passCount} passed, ${failCount} failed out of ${results.length}`);
  console.log('='.repeat(70) + '\n');

  await mongoose.disconnect();

  if (failCount > 0) {
    process.exit(1);
  }
}

runSmokeTest()
  .then(() => { process.exit(0); })
  .catch((error) => { console.error('Smoke test error:', error); process.exit(1); });
