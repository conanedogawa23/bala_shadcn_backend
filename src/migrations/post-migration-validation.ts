import { getMSSQLConnection, closeMSSQLConnection } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import {
  validateRecordCounts,
  findOrphanedRecords,
  validateComputedFields,
  printValidationReport
} from './utils/validation-helpers';

async function runPostMigrationValidation(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('POST-MIGRATION VALIDATION');
  console.log('='.repeat(70) + '\n');

  try {
    const mongoConn = await getMigrationConnection();

    console.log('📊 Step 1: Validating Record Counts...\n');
    const recordCountResults = await validateRecordCounts(mongoConn);
    printValidationReport(recordCountResults);

    const allCountsMatch = recordCountResults.every(r => r.match);
    if (!allCountsMatch) {
      console.log('⚠️  Warning: Record count mismatches detected!');
      console.log('   Please review the differences before proceeding.\n');
    }

    console.log('\n📍 Step 2: Checking for Orphaned Records...\n');
    const orphanedRecords = await findOrphanedRecords(mongoConn);

    if (orphanedRecords.length === 0) {
      console.log('✅ No orphaned records found - all foreign keys are valid!\n');
    } else {
      console.log('❌ Found orphaned records:\n');
      for (const orphaned of orphanedRecords) {
        console.log(`   ${orphaned.collection}: ${orphaned.count} records without valid client references`);
        console.log('   Sample records:');
        for (const sample of orphaned.samples.slice(0, 3)) {
          console.log(`     - ${JSON.stringify(sample)}`);
        }
        console.log('');
      }
    }

    console.log('\n🔍 Step 3: Validating Computed Fields...\n');
    const computedFieldErrors = await validateComputedFields(mongoConn);

    console.log(`   Client Full Names: ${computedFieldErrors.clientFullNames} errors`);
    console.log(`   Phone Formatting: ${computedFieldErrors.phoneFormatting} errors`);
    console.log(`   Postal Codes: ${computedFieldErrors.postalCodes} errors`);
    console.log(`   Payment Totals: ${computedFieldErrors.paymentTotals} errors`);

    const totalComputedErrors = Object.values(computedFieldErrors).reduce((sum, val) => sum + val, 0);
    if (totalComputedErrors === 0) {
      console.log('\n✅ All computed fields validated successfully!\n');
    } else {
      console.log(`\n⚠️  Found ${totalComputedErrors} computed field errors\n`);
    }

    console.log('\n📈 Step 4: Migration Progress Summary...\n');
    const MigrationProgress = mongoConn.model('MigrationProgress');
    const progressRecords = await MigrationProgress.find().sort({ tableName: 1 });

    console.log('Table                  Status       Migrated      Failed    Progress');
    console.log('-'.repeat(70));
    for (const progress of progressRecords) {
      const statusIcon = progress.status === 'completed' ? '✅' : progress.status === 'failed' ? '❌' : '⏳';
      const percentage = progress.totalRecords > 0 
        ? ((progress.migratedRecords / progress.totalRecords) * 100).toFixed(1)
        : '0.0';
      
      console.log(
        `${progress.tableName.padEnd(20)} ${statusIcon} ${progress.status.padEnd(10)} ` +
        `${progress.migratedRecords.toString().padStart(10)} ` +
        `${progress.failedRecords.toString().padStart(10)} ` +
        `${percentage.padStart(7)}%`
      );
    }
    console.log('-'.repeat(70));

    const allCompleted = progressRecords.every(p => p.status === 'completed');
    const totalMigrated = progressRecords.reduce((sum, p) => sum + p.migratedRecords, 0);
    const totalFailed = progressRecords.reduce((sum, p) => sum + p.failedRecords, 0);

    console.log(`\nTotal Migrated: ${totalMigrated.toLocaleString()}`);
    console.log(`Total Failed: ${totalFailed.toLocaleString()}`);

    console.log('\n' + '='.repeat(70));
    if (allCompleted && allCountsMatch && orphanedRecords.length === 0 && totalComputedErrors === 0) {
      console.log('✅ MIGRATION VALIDATION PASSED');
      console.log('   All data successfully migrated with no issues!');
    } else {
      console.log('⚠️  MIGRATION VALIDATION COMPLETED WITH WARNINGS');
      console.log('   Please review the issues identified above.');
    }
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    throw error;
  } finally {
    await closeMSSQLConnection();
    await closeMigrationConnection();
  }
}

if (require.main === module) {
  runPostMigrationValidation()
    .then(() => {
      console.log('✅ Post-migration validation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Post-migration validation failed:', error);
      process.exit(1);
    });
}

export { runPostMigrationValidation };
