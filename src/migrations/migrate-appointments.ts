import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import { trimString, toBoolean, toDate } from './utils/transform-helpers';
import { AppointmentModel } from '../models/Appointment';
import { MigrationProgressModel } from '../models/MigrationProgress';

const BATCH_SIZE = 5000;

async function migrateAppointments(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('APPOINTMENTS MIGRATION');
  console.log('='.repeat(70) + '\n');

  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  // Clone schema and disable autoIndex to prevent index operations from interfering with inserts
  const apptSchema = AppointmentModel.schema.clone();
  apptSchema.set('autoIndex', false);
  apptSchema.set('autoCreate', false);
  const Appointment = mongoConn.model('Appointment', apptSchema);
  const MigrationProgress = mongoConn.model('MigrationProgress', MigrationProgressModel.schema);

  try {
    const totalCountResult = await mssqlConn.request().query(`
      SELECT COUNT(*) as cnt FROM Appointments
      WHERE ${getRetainedClinicsFilter('ClinicName')}
    `);
    const totalRecords = totalCountResult.recordset[0].cnt;

    console.log(`📊 Total appointments to migrate: ${totalRecords.toLocaleString()}`);

    // Clean existing data for idempotent re-runs
    const existingCount = await Appointment.countDocuments();
    if (existingCount > 0) {
      console.log(`🧹 Clearing ${existingCount.toLocaleString()} existing appointments for clean re-run...`);
      await Appointment.deleteMany({});
    }

    // Reset migration progress for clean start
    await MigrationProgress.deleteOne({ tableName: 'Appointments' });
    const progress = new MigrationProgress({
      tableName: 'Appointments',
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
          SELECT 
            ID, Type, StartDate, EndDate, AllDay, Subject, Location, Description,
            Status, Label, ResourceID, ReminderInfo, RecurrenceInfo, Duration,
            ClientID, ProductKey, BillDate, ReadyToBill, IsActive, ClinicName,
            InvoiceDate, AdvancedBilling, shadowID, AdvancedBillingId, GroupID
          FROM Appointments
          WHERE ${getRetainedClinicsFilter('ClinicName')}
          ORDER BY ID
          OFFSET @offset ROWS
          FETCH NEXT @batchSize ROWS ONLY
        `);

      const batch = [];
      for (const row of result.recordset) {
        try {
          const appointment = transformAppointmentRow(row);
          batch.push(appointment);
        } catch (error) {
          console.error(`  ⚠️  Failed to transform appointment ${row.ID}:`, error);
          progress.recordError(offset, `Transform error: ${error}`, { appointmentId: row.ID });
          failedCount++;
        }
      }

      if (batch.length > 0) {
        try {
          // Use raw MongoDB driver to bypass Mongoose validation issues
          const rawCollection = mongoConn.db!.collection('appointments');
          const result = await rawCollection.insertMany(batch, { ordered: false });
          migratedCount += result.insertedCount;
          console.log(`  ✅ Inserted ${result.insertedCount} appointments (Total: ${migratedCount.toLocaleString()})`);
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
    }

    progress.status = 'completed';
    progress.endTime = new Date();
    await progress.save();

    console.log('\n' + '='.repeat(70));
    console.log('✅ APPOINTMENTS MIGRATION COMPLETE');
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`   Migrated: ${migratedCount.toLocaleString()}`);
    console.log(`   Failed: ${failedCount.toLocaleString()}`);
    console.log(`   Duration: ${Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000)}s`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Appointments migration failed:', error);
    const progress = await MigrationProgress.findOne({ tableName: 'Appointments' });
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

function transformAppointmentRow(row: any): any {
  return {
    appointmentId: row.ID,
    type: row.Type || 0,
    startDate: toDate(row.StartDate) || new Date(),
    endDate: toDate(row.EndDate) || new Date(),
    allDay: toBoolean(row.AllDay),
    subject: trimString(row.Subject),
    location: trimString(row.Location),
    description: trimString(row.Description),
    status: row.Status || 0,
    label: row.Label || 0,
    resourceId: row.ResourceID,
    reminderInfo: trimString(row.ReminderInfo),
    recurrenceInfo: trimString(row.RecurrenceInfo),
    duration: row.Duration || 0,
    clientId: row.ClientID,
    productKey: row.ProductKey,
    billDate: toDate(row.BillDate),
    readyToBill: toBoolean(row.ReadyToBill),
    isActive: toBoolean(row.IsActive),
    clinicName: trimString(row.ClinicName),
    invoiceDate: toDate(row.InvoiceDate),
    advancedBilling: toBoolean(row.AdvancedBilling),
    shadowId: row.shadowID,
    advancedBillingId: row.AdvancedBillingId,
    groupId: row.GroupID,
    dateCreated: toDate(row.StartDate) || new Date(),
    dateModified: new Date()
  };
}

if (require.main === module) {
  migrateAppointments()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrateAppointments };
