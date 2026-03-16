import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import { trimString, toDate } from './utils/transform-helpers';
import { buildClientLookupMap, getClientKeyById } from './utils/client-lookup';
import { ContactHistoryModel } from '../models/ContactHistory';
import { MigrationProgressModel } from '../models/MigrationProgress';

const BATCH_SIZE = 5000;

async function migrateContactHistory(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('CONTACT HISTORY MIGRATION');
  console.log('='.repeat(70) + '\n');

  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const ContactHistory = mongoConn.model('ContactHistory', ContactHistoryModel.schema);
  const MigrationProgress = mongoConn.model('MigrationProgress', MigrationProgressModel.schema);

  try {
    // Idempotent cleanup: remove previous migration data for clean re-run
    console.log('Cleaning up previous migration data...');
    await ContactHistory.deleteMany({});
    await MigrationProgress.deleteOne({ tableName: 'sb_contact_history' });
    console.log('  [OK] Previous data cleaned');

    console.log('Building client lookup map...');
    await buildClientLookupMap(mongoConn);

    const totalCountResult = await mssqlConn.request().query(`
      SELECT COUNT(*) as cnt FROM sb_contact_history
      WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
    `);
    const totalRecords = totalCountResult.recordset[0].cnt;

    console.log(`Total contact history records to migrate: ${totalRecords.toLocaleString()}`);

    let progress = await MigrationProgress.findOne({ tableName: 'sb_contact_history' });
    if (!progress) {
      progress = new MigrationProgress({
        tableName: 'sb_contact_history',
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
            sb_contact_history_key, sb_client_id, sb_contact_date,
            sb_contact_message, sb_deleted_status, sb_clinic_name
          FROM sb_contact_history
          WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
          ORDER BY sb_contact_history_key
          OFFSET @offset ROWS
          FETCH NEXT @batchSize ROWS ONLY
        `);

      const batch = [];
      for (const row of result.recordset) {
        try {
          const clientKey = getClientKeyById(row.sb_client_id);
          const contactDateStr = trimString(row.sb_contact_date);

          batch.push({
            id: row.sb_contact_history_key,
            clientId: clientKey || trimString(row.sb_client_id),
            clinicName: trimString(row.sb_clinic_name),
            contactType: 'note', // MSSQL only stores messages, default to 'note'
            direction: 'internal',
            description: trimString(row.sb_contact_message),
            contactDate: toDate(contactDateStr) || new Date(),
            priority: 'medium',
            isActive: trimString(row.sb_deleted_status).toLowerCase() !== 'deleted'
            // createdAt and updatedAt auto-managed by timestamps: true
          });
        } catch (error) {
          console.error(`  [WARN] Failed to transform contact history ${row.sb_contact_history_key}:`, error);
          failedCount++;
        }
      }

      if (batch.length > 0) {
        try {
          await ContactHistory.insertMany(batch, { ordered: false });
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
    console.log('[OK] CONTACT HISTORY MIGRATION COMPLETE');
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`   Migrated: ${migratedCount.toLocaleString()}`);
    console.log(`   Failed: ${failedCount.toLocaleString()}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n[ERROR] Contact history migration failed:', error);
    const progress = await MigrationProgress.findOne({ tableName: 'sb_contact_history' });
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
  migrateContactHistory()
    .then(() => { console.log('[OK] Migration completed successfully'); process.exit(0); })
    .catch((error) => { console.error('[ERROR] Migration failed:', error); process.exit(1); });
}

export { migrateContactHistory };
