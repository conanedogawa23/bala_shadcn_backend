import dotenv from 'dotenv';
dotenv.config();

import { runValidationChecks } from './pre-migration-validation';
import { migrateLookupTables } from './migrate-lookups';
import { migrateClients } from './migrate-clients';
import { migrateAppointments } from './migrate-appointments';
import { migrateOrders } from './migrate-orders';
import { migratePayments } from './migrate-payments';
import { migrateContactHistory } from './migrate-contact-history';
import { migrateClientClinic } from './migrate-client-clinic';
import { migrateAllReferenceTables } from './migrate-reference-tables';
import { runPostMigrationValidation } from './post-migration-validation';
import { testQueryPerformance } from './test-performance';
import { runUserAcceptanceTests } from './user-acceptance-tests';

interface MigrationPhase {
  name: string;
  description: string;
  fn: () => Promise<void>;
  critical: boolean;
}

async function runFullMigration(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('VISIO MSSQL TO MONGODB MIGRATION');
  console.log('Full Migration Pipeline');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();
  const phases: MigrationPhase[] = [
    {
      name: 'Phase 1: Pre-Migration Validation',
      description: 'Validate MSSQL data quality and identify issues',
      fn: runValidationChecks,
      critical: false
    },
    {
      name: 'Phase 2: Lookup Tables Migration',
      description: 'Migrate reference data (Clinics, Products, Resources, Categories)',
      fn: migrateLookupTables,
      critical: true
    },
    {
      name: 'Phase 3: Clients Migration',
      description: 'Migrate 31K+ clients with nested insurance arrays',
      fn: migrateClients,
      critical: true
    },
    {
      name: 'Phase 4: Appointments Migration',
      description: 'Migrate 150K+ appointments',
      fn: migrateAppointments,
      critical: true
    },
    {
      name: 'Phase 5: Orders Migration',
      description: 'Migrate 330K+ orders with line item grouping',
      fn: migrateOrders,
      critical: true
    },
    {
      name: 'Phase 6: Payments Migration',
      description: 'Migrate 415K+ payments with nested amounts',
      fn: migratePayments,
      critical: true
    },
    {
      name: 'Phase 7: Contact History Migration',
      description: 'Migrate 101K+ contact history records',
      fn: migrateContactHistory,
      critical: true
    },
    {
      name: 'Phase 8: Client-Clinic Relationships Migration',
      description: 'Migrate 35K+ client-clinic relationships',
      fn: migrateClientClinic,
      critical: true
    },
    {
      name: 'Phase 9: Reference Tables Migration',
      description: 'Migrate insurance lookups, events, payment methods/types, cities, companies, advanced billing',
      fn: migrateAllReferenceTables,
      critical: true
    },
    {
      name: 'Phase 10: Post-Migration Validation',
      description: 'Verify data integrity and completeness',
      fn: runPostMigrationValidation,
      critical: true
    },
    {
      name: 'Phase 11: Performance Testing',
      description: 'Test query performance and index usage',
      fn: testQueryPerformance,
      critical: false
    },
    {
      name: 'Phase 12: User Acceptance Testing',
      description: 'Run business queries and validate results',
      fn: runUserAcceptanceTests,
      critical: false
    }
  ];

  const results: Array<{ phase: string; success: boolean; duration: number; error?: string }> = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!;
    const phaseStartTime = Date.now();

    console.log('\n' + '='.repeat(80));
    console.log(`${phase.name} (${i + 1}/${phases.length})`);
    console.log(phase.description);
    console.log('='.repeat(80) + '\n');

    try {
      await phase.fn();
      const duration = Date.now() - phaseStartTime;
      results.push({ phase: phase.name, success: true, duration });
      console.log(`\n✅ ${phase.name} completed in ${(duration / 1000).toFixed(1)}s\n`);
    } catch (error) {
      const duration = Date.now() - phaseStartTime;
      results.push({ phase: phase.name, success: false, duration, error: `${error}` });
      console.error(`\n❌ ${phase.name} failed after ${(duration / 1000).toFixed(1)}s`);
      console.error(`Error: ${error}\n`);

      if (phase.critical) {
        console.error(`\n🚨 CRITICAL PHASE FAILED - Migration cannot continue\n`);
        printMigrationSummary(results, Date.now() - startTime);
        process.exit(1);
      } else {
        console.warn(`\n⚠️  Non-critical phase failed - continuing migration\n`);
      }
    }
  }

  printMigrationSummary(results, Date.now() - startTime);
}

function printMigrationSummary(
  results: Array<{ phase: string; success: boolean; duration: number; error?: string }>,
  totalDuration: number
): void {
  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log('Phase Results:');
  console.log('-'.repeat(80));
  for (const result of results) {
    const icon = result.success ? '✅' : '❌';
    const durationStr = `${(result.duration / 1000).toFixed(1)}s`;
    console.log(`${icon} ${result.phase.padEnd(50)} ${durationStr.padStart(10)}`);
    if (result.error) {
      console.log(`   Error: ${result.error.substring(0, 100)}...`);
    }
  }
  console.log('-'.repeat(80));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalDurationMin = (totalDuration / 60000).toFixed(1);

  console.log(`\nTotal Phases: ${results.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total Duration: ${totalDurationMin} minutes`);

  console.log('\n' + '='.repeat(80));
  if (failCount === 0) {
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('   All phases passed - data is ready for production use.');
    console.log('   Database: visio_new');
  } else {
    console.log('⚠️  MIGRATION COMPLETED WITH ERRORS');
    console.log(`   ${successCount}/${results.length} phases successful`);
    console.log('   Please review the errors above and re-run failed phases.');
  }
  console.log('='.repeat(80) + '\n');
}

if (require.main === module) {
  runFullMigration()
    .then(() => {
      console.log('✅ Migration pipeline complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration pipeline failed:', error);
      process.exit(1);
    });
}

export { runFullMigration };
