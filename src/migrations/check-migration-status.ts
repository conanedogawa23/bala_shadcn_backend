import { getMigrationConnection, closeMigrationConnection, getMigrationDatabaseStatus } from './utils/mongodb-connection';

async function checkMigrationStatus(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION STATUS CHECK');
  console.log('='.repeat(70) + '\n');

  try {
    const mongoConn = await getMigrationConnection();
    const dbStatus = getMigrationDatabaseStatus();

    console.log('🔗 Database Connection:');
    console.log(`   Status: ${dbStatus.status}`);
    console.log(`   Database: ${dbStatus.name}`);
    console.log(`   Host: ${dbStatus.host}`);
    console.log(`   Collections: ${dbStatus.collections}`);
    console.log('');

    console.log('📊 Collection Statistics:\n');

    const collections = ['clients', 'payments', 'orders', 'appointments', 'clinics', 'products', 'resources'];
    
    for (const collectionName of collections) {
      try {
        const collection = mongoConn.collection(collectionName);
        const count = await collection.countDocuments();
        const size = await collection.estimatedDocumentCount();
        console.log(`   ${collectionName.padEnd(20)} ${count.toLocaleString().padStart(12)} documents`);
      } catch (error) {
        console.log(`   ${collectionName.padEnd(20)} ${'-'.padStart(12)} (not found)`);
      }
    }

    console.log('\n📈 Migration Progress:\n');

    const MigrationProgress = mongoConn.model('MigrationProgress');
    const progressRecords = await MigrationProgress.find().sort({ tableName: 1 });

    if (progressRecords.length === 0) {
      console.log('   ⚠️  No migration progress records found');
      console.log('   Migration has not been started yet.\n');
    } else {
      console.log('Table                  Status       Migrated      Failed    Progress    ETA');
      console.log('-'.repeat(85));

      for (const progress of progressRecords) {
        const statusIcon = progress.status === 'completed' ? '✅' :
                          progress.status === 'failed' ? '❌' :
                          progress.status === 'in_progress' ? '⏳' : '⏸️';
        
        const percentage = progress.totalRecords > 0
          ? ((progress.migratedRecords / progress.totalRecords) * 100).toFixed(1)
          : '0.0';

        let etaStr = '-';
        if (progress.status === 'in_progress' && progress.metadata?.estimatedCompletion) {
          const eta = new Date(progress.metadata.estimatedCompletion);
          etaStr = eta.toLocaleTimeString();
        }

        console.log(
          `${progress.tableName.padEnd(20)} ${statusIcon} ${progress.status.padEnd(10)} ` +
          `${progress.migratedRecords.toString().padStart(10)} ` +
          `${progress.failedRecords.toString().padStart(10)} ` +
          `${percentage.padStart(7)}% ` +
          `${etaStr.padStart(12)}`
        );
      }
      console.log('-'.repeat(85));

      const allCompleted = progressRecords.every(p => p.status === 'completed');
      const anyInProgress = progressRecords.some(p => p.status === 'in_progress');
      const anyFailed = progressRecords.some(p => p.status === 'failed');

      const totalMigrated = progressRecords.reduce((sum, p) => sum + p.migratedRecords, 0);
      const totalFailed = progressRecords.reduce((sum, p) => sum + p.failedRecords, 0);

      console.log(`\nTotal Migrated: ${totalMigrated.toLocaleString()}`);
      console.log(`Total Failed: ${totalFailed.toLocaleString()}`);

      if (allCompleted) {
        console.log('\n✅ Migration Status: COMPLETED');
        console.log('   All tables successfully migrated!');
      } else if (anyInProgress) {
        console.log('\n⏳ Migration Status: IN PROGRESS');
        console.log('   Migration is currently running...');
      } else if (anyFailed) {
        console.log('\n❌ Migration Status: FAILED');
        console.log('   Some phases failed - review errors and retry.');
      } else {
        console.log('\n⏸️  Migration Status: PENDING');
        console.log('   Migration has not started yet.');
      }
    }

    console.log('\n📋 Recent Errors:\n');
    const progressWithErrors = await MigrationProgress.find({ 'migrationErrors.0': { $exists: true } });
    
    if (progressWithErrors.length === 0) {
      console.log('   ✅ No errors recorded');
    } else {
      for (const progress of progressWithErrors) {
        console.log(`   ${progress.tableName}:`);
        for (const error of (progress.migrationErrors || []).slice(-5)) {
          console.log(`     - Offset ${error.offset}: ${error.error.substring(0, 80)}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Status check failed:', error);
    throw error;
  } finally {
    await closeMigrationConnection();
  }
}

if (require.main === module) {
  checkMigrationStatus()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    });
}

export { checkMigrationStatus };
