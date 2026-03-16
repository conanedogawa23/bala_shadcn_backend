import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import { trimString, toDate } from './utils/transform-helpers';
import { buildClientLookupMap, getClientKeyById } from './utils/client-lookup';
import { ClientClinicRelationshipModel } from '../models/ClientClinicRelationship';
import { MigrationProgressModel } from '../models/MigrationProgress';

const BATCH_SIZE = 5000;

async function migrateClientClinic(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('CLIENT-CLINIC RELATIONSHIP MIGRATION');
  console.log('='.repeat(70) + '\n');

  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const ClientClinic = mongoConn.model('ClientClinicRelationship', ClientClinicRelationshipModel.schema);
  const MigrationProgress = mongoConn.model('MigrationProgress', MigrationProgressModel.schema);

  try {
    // Idempotent cleanup: remove previous migration data for clean re-run
    console.log('Cleaning up previous migration data...');
    await ClientClinic.deleteMany({});
    await MigrationProgress.deleteOne({ tableName: 'sb_client_and_clinic' });
    console.log('  [OK] Previous data cleaned');

    console.log('Building client lookup map...');
    await buildClientLookupMap(mongoConn);

    const totalCountResult = await mssqlConn.request().query(`
      SELECT COUNT(*) as cnt FROM sb_client_and_clinic
      WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
    `);
    const totalRecords = totalCountResult.recordset[0].cnt;

    console.log(`Total client-clinic records to migrate: ${totalRecords.toLocaleString()}`);

    let progress = await MigrationProgress.findOne({ tableName: 'sb_client_and_clinic' });
    if (!progress) {
      progress = new MigrationProgress({
        tableName: 'sb_client_and_clinic',
        totalRecords,
        status: 'in_progress',
        metadata: { batchSize: BATCH_SIZE }
      });
      await progress.save();
    } else {
      progress.status = 'in_progress';
      progress.totalRecords = totalRecords;
      await progress.save();
    }

    let offset = progress.lastOffset;
    let migratedCount = progress.migratedRecords;
    let failedCount = progress.failedRecords;

    while (offset < totalRecords) {
      console.log(`\nProcessing batch: ${offset + 1} to ${Math.min(offset + BATCH_SIZE, totalRecords)} of ${totalRecords.toLocaleString()}`);

      const result = await mssqlConn.request()
        .input('offset', offset)
        .input('batchSize', BATCH_SIZE)
        .query(`
          SELECT 
            sb_client_and_clinic_key, sb_client_id, sb_clinic_name,
            sb_clinic_selectedIndex, sb_first_name, sb_last_name,
            sb_full_name_for_autocomplete, sb_date_of_birth,
            sb_home_phone, sb_cell_phone, sb_postal_code, sb_email_address
          FROM sb_client_and_clinic
          WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
          ORDER BY sb_client_and_clinic_key
          OFFSET @offset ROWS
          FETCH NEXT @batchSize ROWS ONLY
        `);

      const batch = [];
      for (const row of result.recordset) {
        try {
          const clientId = trimString(row.sb_client_id);
          const clinicName = trimString(row.sb_clinic_name);

          batch.push({
            id: row.sb_client_and_clinic_key,
            clientId,
            clinicName,
            relationshipType: 'primary',
            startDate: new Date(),
            isActive: true,
            isPrimary: row.sb_clinic_selectedIndex === 0 || row.sb_clinic_selectedIndex === 1,
            permissions: {
              canSchedule: true,
              canViewRecords: true,
              canReceiveBills: true,
              canAuthorizeInsurance: false
            },
            details: {
              referredBy: '',
              notes: '',
              preferredServices: []
            },
            billing: {
              insurancePrimary: true
            },
            stats: {
              totalAppointments: 0,
              completedAppointments: 0,
              cancelledAppointments: 0,
              noShowAppointments: 0,
              lastAppointmentDate: undefined,
              totalAmountBilled: 0,
              totalAmountPaid: 0,
              averageAppointmentDuration: 60
            }
          });
        } catch (error) {
          console.error(`  [WARN] Failed to transform client-clinic ${row.sb_client_and_clinic_key}:`, error);
          failedCount++;
        }
      }

      if (batch.length > 0) {
        try {
          await ClientClinic.insertMany(batch, { ordered: false });
          migratedCount += batch.length;
          console.log(`  [OK] Inserted ${batch.length} records (Total: ${migratedCount.toLocaleString()})`);
        } catch (error: any) {
          if (error.writeErrors) {
            const successCount = batch.length - error.writeErrors.length;
            migratedCount += successCount;
            failedCount += error.writeErrors.length;
            console.log(`  [WARN] Partial success: ${successCount}/${batch.length} inserted`);
          } else {
            console.error('  [ERROR] Batch insert failed:', error);
            failedCount += batch.length;
          }
        }
      }

      offset += BATCH_SIZE;
      progress.updateProgress(batch.length, offset);
      await progress.save();

      const percentage = ((offset / totalRecords) * 100).toFixed(2);
      console.log(`  Progress: ${percentage}% complete`);
    }

    progress.status = 'completed';
    progress.endTime = new Date();
    await progress.save();

    console.log('\n' + '='.repeat(70));
    console.log('[OK] CLIENT-CLINIC MIGRATION COMPLETE');
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`   Migrated: ${migratedCount.toLocaleString()}`);
    console.log(`   Failed: ${failedCount.toLocaleString()}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n[ERROR] Client-clinic migration failed:', error);
    const progress = await MigrationProgress.findOne({ tableName: 'sb_client_and_clinic' });
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

if (require.main === module) {
  migrateClientClinic()
    .then(() => { console.log('[OK] Migration completed successfully'); process.exit(0); })
    .catch((error) => { console.error('[ERROR] Migration failed:', error); process.exit(1); });
}

export { migrateClientClinic };
