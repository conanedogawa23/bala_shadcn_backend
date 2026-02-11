import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import {
  trimString,
  toDate,
  buildPhoneObject,
  buildPostalCode,
  buildInsuranceArray,
  buildClientFullName,
  parseBirthday
} from './utils/transform-helpers';
import { ClientModel } from '../models/Client';
import { MigrationProgressModel } from '../models/MigrationProgress';

const BATCH_SIZE = 1000;

async function migrateClients(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('CLIENTS MIGRATION');
  console.log('='.repeat(70) + '\n');

  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const Client = mongoConn.model('Client', ClientModel.schema);
  const MigrationProgress = mongoConn.model('MigrationProgress', MigrationProgressModel.schema);

  try {
    const totalCountResult = await mssqlConn.request().query(`
      SELECT COUNT(*) as cnt FROM sb_clients
      WHERE ${getRetainedClinicsFilter()}
    `);
    const totalRecords = totalCountResult.recordset[0].cnt;

    console.log(`📊 Total clients to migrate: ${totalRecords.toLocaleString()}`);

    // Clean existing data for idempotent re-runs
    const existingCount = await Client.countDocuments();
    if (existingCount > 0) {
      console.log(`🧹 Clearing ${existingCount.toLocaleString()} existing clients for clean re-run...`);
      await Client.deleteMany({});
    }

    // Reset migration progress for clean start
    await MigrationProgress.deleteOne({ tableName: 'sb_clients' });
    const progress = new MigrationProgress({
      tableName: 'sb_clients',
      totalRecords,
      status: 'in_progress',
      metadata: { batchSize: BATCH_SIZE }
    });
    await progress.save();

    let offset = 0;
    let migratedCount = 0;
    let failedCount = 0;

    while (offset < totalRecords) {
      console.log(`\n📦 Processing batch: ${offset + 1} to ${Math.min(offset + BATCH_SIZE, totalRecords)} of ${totalRecords.toLocaleString()}`);

      const result = await mssqlConn.request()
        .input('offset', offset)
        .input('batchSize', BATCH_SIZE)
        .query(`
          SELECT *
          FROM sb_clients
          WHERE ${getRetainedClinicsFilter()}
          ORDER BY sb_clients_key
          OFFSET @offset ROWS
          FETCH NEXT @batchSize ROWS ONLY
        `);

      const batch = [];
      for (const row of result.recordset) {
        try {
          const client = transformClientRow(row);
          batch.push(client);
        } catch (error) {
          console.error(`  ⚠️  Failed to transform client ${row.sb_clients_key}:`, error);
          progress.recordError(offset, `Transform error: ${error}`, { clientKey: row.sb_clients_key });
          failedCount++;
        }
      }

      if (batch.length > 0) {
        try {
          // Use raw MongoDB driver to bypass Mongoose validation issues
          const rawCollection = mongoConn.db!.collection('clients');
          const result = await rawCollection.insertMany(batch, { ordered: false });
          migratedCount += result.insertedCount;
          console.log(`  ✅ Inserted ${result.insertedCount} clients (Total: ${migratedCount.toLocaleString()})`);
        } catch (error: any) {
          if (error.writeErrors) {
            const successCount = batch.length - error.writeErrors.length;
            migratedCount += successCount;
            failedCount += error.writeErrors.length;
            console.log(`  ⚠️  Partial success: ${successCount}/${batch.length} inserted`);
            for (const writeError of error.writeErrors) {
              progress.recordError(offset + writeError.index, writeError.errmsg);
            }
          } else {
            console.error(`  ❌ Batch insert failed:`, error);
            failedCount += batch.length;
          }
        }
      }

      offset += BATCH_SIZE;
      
      progress.updateProgress(batch.length, offset);
      await progress.save();

      const percentage = ((offset / totalRecords) * 100).toFixed(2);
      console.log(`  📈 Progress: ${percentage}% complete`);
      
      if (progress.metadata?.estimatedCompletion) {
        const eta = new Date(progress.metadata.estimatedCompletion);
        console.log(`  ⏱️  ETA: ${eta.toLocaleTimeString()}`);
      }
    }

    progress.status = 'completed';
    progress.endTime = new Date();
    await progress.save();

    console.log('\n' + '='.repeat(70));
    console.log('✅ CLIENTS MIGRATION COMPLETE');
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`   Migrated: ${migratedCount.toLocaleString()}`);
    console.log(`   Failed: ${failedCount.toLocaleString()}`);
    console.log(`   Duration: ${Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000)}s`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Clients migration failed:', error);
    const progress = await MigrationProgress.findOne({ tableName: 'sb_clients' });
    if (progress) {
      progress.status = 'failed';
      await progress.save();
    }
    throw error;
  } finally {
    await closeMSSQLConnection();
    await closeMigrationConnection();
  }
}

function transformClientRow(row: any): any {
  const firstName = trimString(row.sb_clients_first_name);
  const lastName = trimString(row.sb_clients_last_name);

  return {
    clientId: trimString(row.sb_clients_id),
    clientKey: row.sb_clients_key,
    personalInfo: {
      firstName,
      lastName,
      fullName: buildClientFullName(firstName, lastName),
      fullNameForAutocomplete: trimString(row.sb_clients_full_name_for_autocomplete) || buildClientFullName(firstName, lastName),
      dateOfBirth: parseBirthday(
        row.sb_clients_birthday_day,
        row.sb_clients_birthday_month,
        row.sb_clients_birthday_year
      ),
      birthday: {
        day: trimString(row.sb_clients_birthday_day),
        month: trimString(row.sb_clients_birthday_month),
        year: trimString(row.sb_clients_birthday_year)
      },
      gender: trimString(row.sb_clients_gender) || 'Other'
    },
    contact: {
      address: {
        street: trimString(row.sb_clients_street_address),
        apartment: trimString(row.sb_clients_apartment_no),
        city: trimString(row.sb_clients_city),
        province: trimString(row.sb_clients_province),
        postalCode: buildPostalCode(
          row.sb_clients_postal_code_first3Digits,
          row.sb_clients_postal_code_last3Digits
        )
      },
      phones: {
        home: buildPhoneObject(
          row.sb_clients_home_phone_countryCode,
          row.sb_clients_home_phone_areaCode,
          row.sb_clients_home_phone_number
        ),
        cell: buildPhoneObject(
          row.sb_clients_cell_phone_countryCode,
          row.sb_clients_cell_phone_areaCode,
          row.sb_clients_cell_phone_number
        )
        // Work phone intentionally NOT migrated per client requirements:
        // visio_req.md: "Remove Work no. and Extension"
      },
      email: trimString(row.sb_clients_email_address),
      company: trimString(row.sb_clients_company),
      companyOther: trimString(row.sb_clients_company_other)
    },
    medical: {
      // familyMD intentionally NOT migrated per requirements: "Remove Family MD"
      // csrName intentionally NOT migrated per requirements: "Remove CSR Name"
      referringMD: trimString(row.sb_clients_referring_md),
      location: trimString(row.sb_clients_location)
    },
    insurance: buildInsuranceArray(row),
    defaultClinic: trimString(row.sb_default_clinic),
    clinics: [trimString(row.sb_default_clinic)],
    clinicId: trimString(row.sb_default_clinic),
    isActive: true,
    dateCreated: toDate(row.sb_clients_date_created) || new Date(),
    dateModified: new Date(),
    referralTypeId: row.sb_referral_type_id,
    referralSubtypeId: row.sb_referral_subtype_id,
    firstInsuranceBirthdayDayTmp: trimString(row.sb_clients_1st_insurance_birthday_day_tmp)
  };
}

if (require.main === module) {
  migrateClients()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateClients };
