import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import { trimString, toNumber, toDate, toBoolean } from './utils/transform-helpers';
import { InsuranceCompanyModel } from '../models/InsuranceCompany';
import { InsuranceGroupNumberModel } from '../models/InsuranceGroupNumber';
import { InsuranceCompanyAddressModel } from '../models/InsuranceCompanyAddress';
import { InsuranceFrequencyModel } from '../models/InsuranceFrequency';
import { InsurancePolicyHolderModel } from '../models/InsurancePolicyHolder';
import { InsuranceCOBModel } from '../models/InsuranceCOB';
import { EventModel } from '../models/Event';
import { PaymentDeletedModel } from '../models/PaymentDeleted';
import { PaymentMethodModel } from '../models/PaymentMethod';
import { PaymentTypeModel } from '../models/PaymentType';
import { ClientCompanyModel } from '../models/ClientCompany';
import { CityModel } from '../models/City';
import { AdvancedBillingModel } from '../models/AdvancedBilling';

// Helper to register a model on the migration connection
function getModel(mongoConn: any, name: string, schema: any) {
  try {
    return mongoConn.model(name);
  } catch {
    return mongoConn.model(name, schema);
  }
}

async function migrateInsuranceCompanies(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Insurance Companies...');
  const result = await mssqlConn.request().query(`
    SELECT sb_1st_insurance_company_key, sb_1st_insurance_company_name
    FROM sb_1st_insurance_company
    ORDER BY sb_1st_insurance_company_key
  `);

  const Model = getModel(mongoConn, 'InsuranceCompany', InsuranceCompanyModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      await Model.findOneAndUpdate(
        { id: row.sb_1st_insurance_company_key },
        {
          id: row.sb_1st_insurance_company_key,
          companyName: trimString(row.sb_1st_insurance_company_name),
          isActive: true
          // createdAt and updatedAt auto-managed by timestamps: true
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Insurance company ${row.sb_1st_insurance_company_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} insurance companies`);
  return count;
}

async function migrateInsuranceGroupNumbers(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Insurance Group Numbers...');
  const result = await mssqlConn.request().query(`
    SELECT sb_1st_insurance_group_number_key, sb_1st_insurance_group_number_name
    FROM sb_1st_insurance_group_number
    ORDER BY sb_1st_insurance_group_number_key
  `);

  const Model = getModel(mongoConn, 'InsuranceGroupNumber', InsuranceGroupNumberModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      await Model.findOneAndUpdate(
        { id: row.sb_1st_insurance_group_number_key },
        {
          id: row.sb_1st_insurance_group_number_key,
          groupNumber: trimString(row.sb_1st_insurance_group_number_name),
          isActive: true,
          planType: 'group',
          dateCreated: new Date(),
          dateModified: new Date()
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Insurance group number ${row.sb_1st_insurance_group_number_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} insurance group numbers`);
  return count;
}

async function migrateInsuranceCompanyAddresses(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Insurance Company Addresses...');
  const result = await mssqlConn.request().query(`
    SELECT 
      sb_1st_insurance_company_address_key, sb_1st_insurance_company_address_name,
      sb_1st_insurance_company_name, sb_1st_insurance_company_city,
      sb_1st_insurance_company_province,
      sb_1st_insurance_company_postalCode_first3Digits,
      sb_1st_insurance_company_postalCode_last3Digits
    FROM sb_1st_insurance_company_address
    ORDER BY sb_1st_insurance_company_address_key
  `);

  const Model = getModel(mongoConn, 'InsuranceCompanyAddress', InsuranceCompanyAddressModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      const first3 = trimString(row.sb_1st_insurance_company_postalCode_first3Digits).toUpperCase();
      const last3 = trimString(row.sb_1st_insurance_company_postalCode_last3Digits).toUpperCase();

      await Model.findOneAndUpdate(
        { addressKey: row.sb_1st_insurance_company_address_key },
        {
          addressKey: row.sb_1st_insurance_company_address_key,
          addressName: trimString(row.sb_1st_insurance_company_address_name),
          companyName: trimString(row.sb_1st_insurance_company_name),
          city: trimString(row.sb_1st_insurance_company_city),
          province: trimString(row.sb_1st_insurance_company_province),
          postalCodeFirst3: first3,
          postalCodeLast3: last3,
          fullPostalCode: first3 && last3 ? `${first3} ${last3}` : '',
          dateCreated: new Date(),
          dateModified: new Date()
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Insurance address ${row.sb_1st_insurance_company_address_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} insurance company addresses`);
  return count;
}

async function migrateInsuranceFrequencies(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Insurance Frequencies...');
  const result = await mssqlConn.request().query(`
    SELECT sb_1st_insurance_frequency_key, sb_1st_insurance_frequency_name
    FROM sb_1st_insurance_frequency
    ORDER BY sb_1st_insurance_frequency_key
  `);

  const Model = getModel(mongoConn, 'InsuranceFrequency', InsuranceFrequencyModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      const name = trimString(row.sb_1st_insurance_frequency_name);
      await Model.findOneAndUpdate(
        { frequencyKey: row.sb_1st_insurance_frequency_key },
        {
          frequencyKey: row.sb_1st_insurance_frequency_key,
          frequencyName: name,
          frequencyType: name.toLowerCase().includes('year') ? 'yearly' :
                         name.toLowerCase().includes('roll') ? 'rolling' :
                         name.toLowerCase() === 'select' ? 'select' : 'numeric',
          isSelectable: true,
          displayOrder: row.sb_1st_insurance_frequency_key,
          dateCreated: new Date(),
          dateModified: new Date()
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Insurance frequency ${row.sb_1st_insurance_frequency_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} insurance frequencies`);
  return count;
}

async function migrateInsurancePolicyHolders(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Insurance Policy Holders...');
  const result = await mssqlConn.request().query(`
    SELECT sb_1st_insurance_policy_holder_key, sb_1st_insurance_policy_holder_name
    FROM sb_1st_insurance_policy_holder
    ORDER BY sb_1st_insurance_policy_holder_key
  `);

  const Model = getModel(mongoConn, 'InsurancePolicyHolder', InsurancePolicyHolderModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      const name = trimString(row.sb_1st_insurance_policy_holder_name).toUpperCase();
      let policyHolderType = 'OTHER';
      if (name === 'SELF') policyHolderType = 'SELF';
      else if (name === 'SPOUSE') policyHolderType = 'SPOUSE';
      else if (name === 'PARENT') policyHolderType = 'PARENT';
      else if (name === 'CHILD') policyHolderType = 'CHILD';
      else if (name === 'NONE' || name === 'SELECT' || name === '') policyHolderType = 'NONE';

      await Model.findOneAndUpdate(
        { policyHolderKey: row.sb_1st_insurance_policy_holder_key },
        {
          policyHolderKey: row.sb_1st_insurance_policy_holder_key,
          policyHolderName: trimString(row.sb_1st_insurance_policy_holder_name),
          policyHolderType,
          isValidSelection: policyHolderType !== 'NONE',
          displayOrder: row.sb_1st_insurance_policy_holder_key,
          requiresAdditionalInfo: ['SPOUSE', 'PARENT', 'OTHER'].includes(policyHolderType),
          dateCreated: new Date(),
          dateModified: new Date()
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Insurance policy holder ${row.sb_1st_insurance_policy_holder_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} insurance policy holders`);
  return count;
}

async function migrateInsuranceCOB(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Insurance COB...');
  const result = await mssqlConn.request().query(`
    SELECT sb_1st_insurance_cob_key, sb_1st_insurance_cob_name
    FROM sb_1st_insurance_cob
    ORDER BY sb_1st_insurance_cob_key
  `);

  const Model = getModel(mongoConn, 'InsuranceCOB', InsuranceCOBModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      const name = trimString(row.sb_1st_insurance_cob_name).toUpperCase();
      await Model.findOneAndUpdate(
        { cobKey: row.sb_1st_insurance_cob_key },
        {
          cobKey: row.sb_1st_insurance_cob_key,
          cobName: name === 'YES' ? 'YES' : 'NO',
          cobStatus: name === 'YES' ? 'YES' : 'NO',
          cobValue: name === 'YES',
          isDefault: name === 'NO',
          displayOrder: row.sb_1st_insurance_cob_key,
          dateCreated: new Date(),
          dateModified: new Date()
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Insurance COB ${row.sb_1st_insurance_cob_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} insurance COB records`);
  return count;
}

async function migrateEvents(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Events...');
  const result = await mssqlConn.request().query(`
    SELECT 
      event_id, event_parent_id, user_id, category_id,
      event_title, event_desc, event_date, event_time, event_time_end,
      event_date_add, event_user_add, event_is_public, event_is_approved,
      event_location, event_cost, event_url,
      custom_TextBox1, custom_TextBox2, custom_TextBox3,
      custom_TextArea1, custom_TextArea2, custom_TextArea3,
      custom_CheckBox1, custom_CheckBox2, custom_CheckBox3,
      sb_client_id, sb_client_full_name, sb_client_clinic_name
    FROM events
    ORDER BY event_id
  `);

  const Model = getModel(mongoConn, 'Event', EventModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      await Model.findOneAndUpdate(
        { eventId: row.event_id },
        {
          eventId: row.event_id,
          parentEventId: row.event_parent_id,
          userId: row.user_id,
          categoryId: row.category_id,
          title: trimString(row.event_title) || 'Untitled Event',
          description: trimString(row.event_desc),
          eventDate: toDate(row.event_date) || new Date(),
          eventTime: toDate(row.event_time),
          eventTimeEnd: toDate(row.event_time_end),
          location: trimString(row.event_location),
          cost: trimString(row.event_cost),
          url: trimString(row.event_url),
          isPublic: toBoolean(row.event_is_public),
          isApproved: toBoolean(row.event_is_approved),
          customTextBox1: trimString(row.custom_TextBox1),
          customTextBox2: trimString(row.custom_TextBox2),
          customTextBox3: trimString(row.custom_TextBox3),
          customTextArea1: trimString(row.custom_TextArea1),
          customTextArea2: trimString(row.custom_TextArea2),
          customTextArea3: trimString(row.custom_TextArea3),
          customCheckBox1: toBoolean(row.custom_CheckBox1),
          customCheckBox2: toBoolean(row.custom_CheckBox2),
          customCheckBox3: toBoolean(row.custom_CheckBox3),
          clientId: trimString(row.sb_client_id),
          clientFullName: trimString(row.sb_client_full_name),
          clientClinicName: trimString(row.sb_client_clinic_name),
          dateAdded: toDate(row.event_date_add) || new Date(),
          userAdded: row.event_user_add
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Event ${row.event_id}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} events`);
  return count;
}

async function migratePaymentDeleted(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Deleted Payments...');
  const result = await mssqlConn.request().query(`
    SELECT *
    FROM sb_payment_history_deleted
    WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
    ORDER BY sb_payment_history_key
  `);

  const Model = getModel(mongoConn, 'PaymentDeleted', PaymentDeletedModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      await Model.findOneAndUpdate(
        { sb_payment_history_key: row.sb_payment_history_key },
        {
          sb_payment_history_key: row.sb_payment_history_key,
          sb_client_id: toNumber(row.sb_client_id),
          sb_order_number: trimString(row.sb_order_number),
          sb_payment_number: trimString(row.sb_payment_number),
          sb_payment_date: toDate(row.sb_payment_date),
          sb_payment_total_payment_amount: toNumber(row.sb_payment_total_payment_amount),
          sb_payment_total_paid: toNumber(row.sb_payment_total_paid),
          sb_payment_total_owed: toNumber(row.sb_payment_total_owed),
          sb_payment_POP_amount: toNumber(row.sb_payment_POP_amount),
          sb_payment_POPFP_amount: toNumber(row.sb_payment_POPFP_amount),
          sb_payment_DPA_amount: toNumber(row.sb_payment_DPA_amount),
          sb_payment_DPAFP_amount: toNumber(row.sb_payment_DPAFP_amount),
          sb_payment_WRITEOFF_amount: toNumber(row.sb_payment_WRITEOFF_amount),
          sb_payment_COB_1_amount: toNumber(row.sb_payment_COB_1_amount),
          sb_payment_COB_2_amount: toNumber(row.sb_payment_COB_2_amount),
          sb_payment_COB_3_amount: toNumber(row.sb_payment_COB_3_amount),
          sb_payment_1st_insurance_cheque_amount: toNumber(row.sb_payment_1st_insurance_cheque_amount),
          sb_payment_2nd_insurance_cheque_amount: toNumber(row.sb_payment_2nd_insurance_cheque_amount),
          sb_payment_3rd_insurance_cheque_amount: toNumber(row.sb_payment_3rd_insurance_cheque_amount),
          sb_payment_refund_amount: toNumber(row.sb_payment_refund_amount),
          sb_payment_SALESREFUND_amount: toNumber(row.sb_payment_SALESREFUND_amount),
          sb_payment_method: trimString(row.sb_payment_method),
          sb_payment_type: trimString(row.sb_payment_type),
          sb_payment_status: trimString(row.sb_payment_status),
          sb_payment_referring_no: trimString(row.sb_payment_referring_no),
          sb_payment_note: trimString(row.sb_payment_note),
          sb_deleted_status: trimString(row.sb_deleted_status),
          sb_clinic_name: trimString(row.sb_clinic_name),
          sb_date_created: toDate(row.sb_date_created),
          sb_debugging_column: trimString(row.sb_debugging_column),
          sb_no_insur_fp: toNumber(row.sb_no_insur_fp),
          UserLoginName: trimString(row.UserLoginName),
          BadDebtAmount: toNumber(row.BadDebtAmount),
          archivedAt: new Date(),
          archivedReason: 'Migrated from MSSQL sb_payment_history_deleted',
          isRestored: false
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Deleted payment ${row.sb_payment_history_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} deleted payments`);
  return count;
}

async function migratePaymentMethods(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Payment Methods (lookup)...');
  const result = await mssqlConn.request().query(`
    SELECT sb_paymentMethod_key, sb_paymentMethod_name
    FROM sb_paymentMethod
    ORDER BY sb_paymentMethod_key
  `);

  const Model = getModel(mongoConn, 'PaymentMethod', PaymentMethodModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      await Model.findOneAndUpdate(
        { sb_paymentMethod_key: row.sb_paymentMethod_key },
        {
          sb_paymentMethod_key: row.sb_paymentMethod_key,
          sb_paymentMethod_name: trimString(row.sb_paymentMethod_name)
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Payment method ${row.sb_paymentMethod_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} payment methods`);
  return count;
}

async function migratePaymentTypes(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Payment Types (lookup)...');
  const result = await mssqlConn.request().query(`
    SELECT sb_paymentType_key, sb_paymentType_name
    FROM sb_paymentType
    ORDER BY sb_paymentType_key
  `);

  const Model = getModel(mongoConn, 'PaymentType', PaymentTypeModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      await Model.findOneAndUpdate(
        { sb_paymentType_key: row.sb_paymentType_key },
        {
          sb_paymentType_key: row.sb_paymentType_key,
          sb_paymentType_name: trimString(row.sb_paymentType_name)
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Payment type ${row.sb_paymentType_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} payment types`);
  return count;
}

async function migrateClientCompanies(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Client Companies...');
  const result = await mssqlConn.request().query(`
    SELECT sb_client_company_key, sb_client_company_name, sb_deleted_status
    FROM sb_client_company
    ORDER BY sb_client_company_key
  `);

  const Model = getModel(mongoConn, 'ClientCompany', ClientCompanyModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      const isDeleted = trimString(row.sb_deleted_status).toLowerCase() === 'deleted';
      await Model.findOneAndUpdate(
        { id: row.sb_client_company_key },
        {
          id: row.sb_client_company_key,
          companyName: trimString(row.sb_client_company_name),
          isActive: !isDeleted,
          stats: {
            totalEmployees: 0,
            activeClients: 0,
            totalAppointments: 0,
            totalBilledAmount: 0,
            averageClaimAmount: 0
          }
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Client company ${row.sb_client_company_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} client companies`);
  return count;
}

async function migrateCities(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Cities...');
  const result = await mssqlConn.request().query(`
    SELECT sb_city_key, sb_city_name
    FROM sb_city
    ORDER BY sb_city_key
  `);

  const Model = getModel(mongoConn, 'City', CityModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      await Model.findOneAndUpdate(
        { id: row.sb_city_key },
        {
          id: row.sb_city_key,
          cityName: trimString(row.sb_city_name),
          country: 'Canada',
          isActive: true,
          stats: { clientCount: 0, clinicCount: 0 }
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] City ${row.sb_city_key}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} cities`);
  return count;
}

async function migrateAdvancedBilling(mssqlConn: any, mongoConn: any): Promise<number> {
  console.log('\n-- Migrating Advanced Billing...');
  const result = await mssqlConn.request().query(`
    SELECT Id, ClientId, StartDate, EndDate, ProductKey, BillDate, IsActive, Status, ClinicName
    FROM AdvancedBilling
    WHERE ${getRetainedClinicsFilter('ClinicName')}
    ORDER BY Id
  `);

  const Model = getModel(mongoConn, 'AdvancedBilling', AdvancedBillingModel.schema);
  let count = 0;

  for (const row of result.recordset) {
    try {
      const statusStr = trimString(row.Status);
      const isActive = toBoolean(row.IsActive);

      await Model.findOneAndUpdate(
        { billingId: row.Id },
        {
          billingId: row.Id,
          clientId: row.ClientId,
          clientKey: row.ClientId,
          startDate: toDate(row.StartDate) || new Date(),
          endDate: toDate(row.EndDate) || new Date(),
          productKey: row.ProductKey,
          billDate: toDate(row.BillDate) || new Date(),
          isActive,
          status: statusStr || (isActive ? 'Active' : 'Inactive'),
          clinicName: trimString(row.ClinicName)
        },
        { upsert: true, new: true }
      );
      count++;
    } catch (error) {
      console.error(`  [ERROR] Advanced billing ${row.Id}:`, error);
    }
  }
  console.log(`  [OK] Migrated ${count} advanced billing records`);
  return count;
}

async function migrateAllReferenceTables(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('REFERENCE TABLES MIGRATION');
  console.log('='.repeat(70));

  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const results: Record<string, number> = {};

  try {
    // Insurance lookups
    results['insuranceCompanies'] = await migrateInsuranceCompanies(mssqlConn, mongoConn);
    results['insuranceGroupNumbers'] = await migrateInsuranceGroupNumbers(mssqlConn, mongoConn);
    results['insuranceCompanyAddresses'] = await migrateInsuranceCompanyAddresses(mssqlConn, mongoConn);
    results['insuranceFrequencies'] = await migrateInsuranceFrequencies(mssqlConn, mongoConn);
    results['insurancePolicyHolders'] = await migrateInsurancePolicyHolders(mssqlConn, mongoConn);
    results['insuranceCOB'] = await migrateInsuranceCOB(mssqlConn, mongoConn);

    // Events and audit data
    results['events'] = await migrateEvents(mssqlConn, mongoConn);
    results['paymentDeleted'] = await migratePaymentDeleted(mssqlConn, mongoConn);

    // Payment lookups
    results['paymentMethods'] = await migratePaymentMethods(mssqlConn, mongoConn);
    results['paymentTypes'] = await migratePaymentTypes(mssqlConn, mongoConn);

    // Other reference tables
    results['clientCompanies'] = await migrateClientCompanies(mssqlConn, mongoConn);
    results['cities'] = await migrateCities(mssqlConn, mongoConn);
    results['advancedBilling'] = await migrateAdvancedBilling(mssqlConn, mongoConn);

    console.log('\n' + '='.repeat(70));
    console.log('[OK] REFERENCE TABLES MIGRATION COMPLETE');
    console.log('   Summary:');
    let totalMigrated = 0;
    for (const [table, count] of Object.entries(results)) {
      console.log(`     ${table}: ${count} records`);
      totalMigrated += count;
    }
    console.log(`   Total records migrated: ${totalMigrated}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n[ERROR] Reference tables migration failed:', error);
    throw error;
  } finally {
    await closeMSSQLConnection();
    await closeMigrationConnection();
  }
}

if (require.main === module) {
  migrateAllReferenceTables()
    .then(() => { console.log('[OK] Migration completed successfully'); process.exit(0); })
    .catch((error) => { console.error('[ERROR] Migration failed:', error); process.exit(1); });
}

export { migrateAllReferenceTables };
