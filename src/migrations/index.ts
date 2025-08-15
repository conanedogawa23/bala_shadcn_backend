import { connectDatabase } from '@/config/database';
import mongoose from 'mongoose';
import { logger } from '@/utils/logger';
import { ClientMigration } from './ClientMigration';
import { ContactHistoryMigration } from './ContactHistoryMigration';
import { ClientClinicRelationshipMigration } from './ClientClinicRelationshipMigration';
import { AppointmentMigration } from './AppointmentMigration';
import { InsuranceCompanyAddressMigration } from './InsuranceCompanyAddressMigration';
import { EventMigration } from './EventMigration';
import { AdvancedBillingMigration } from './AdvancedBillingMigration';
import { InsuranceReferenceMigration } from './InsuranceReferenceMigration';
import { DataFilter } from './DataFilter';
import { BaseMigration, MigrationResult, MigrationOptions } from './BaseMigration';

interface MigrationPlan {
  name: string;
  migration: () => BaseMigration;
  priority: number;
  dependencies: string[];
}

/**
 * Migration Manager for seamless MSSQL to MongoDB data migration
 * Coordinates all migrations with dependency management and error handling
 */
export class MigrationManager {
  private readonly migrations: Map<string, MigrationPlan> = new Map();
  private readonly results: Map<string, MigrationResult> = new Map();
  
  constructor(private readonly options: Partial<MigrationOptions> = {}) {
    this.registerMigrations();
  }

  /**
   * Register all available migrations with dependencies
   */
  private registerMigrations(): void {
    // ✅ IMPLEMENTED MIGRATIONS

    // PHASE 2: Core Data (Basic)
    this.migrations.set('clients', {
      name: 'Client Migration (31,213 records)',
      migration: () => new ClientMigration(this.options),
      priority: 2,
      dependencies: []
    });

    // PHASE 3: Relationship Data (Depends on clients)
    this.migrations.set('client_clinic_relationships', {
      name: 'Client-Clinic Relationships Migration (34,918 records)',
      migration: () => new ClientClinicRelationshipMigration(this.options),
      priority: 3,
      dependencies: ['clients']
    });

    // PHASE 4: Massive Communication Data (Depends on clients)
    this.migrations.set('contact_history', {
      name: 'Contact History Migration (92,599 records)',
      migration: () => new ContactHistoryMigration(this.options),
      priority: 4,
      dependencies: ['clients', 'client_clinic_relationships']
    });

    // ✅ NEWLY IMPLEMENTED CRITICAL MIGRATIONS

    // PHASE 5: Massive Appointments Data (149,477 records - HIGHEST VOLUME)
    this.migrations.set('appointments', {
      name: 'Appointments Migration (149,477 records)',
      migration: () => new AppointmentMigration(),
      priority: 5,
      dependencies: ['clients']
    });

    // PHASE 6: Insurance Company Addresses (184 records)
    this.migrations.set('insurance_company_addresses', {
      name: 'Insurance Company Addresses Migration (184 records)',
      migration: () => new InsuranceCompanyAddressMigration(),
      priority: 1,
      dependencies: []
    });

    // PHASE 7: Events (110 records)
    this.migrations.set('events', {
      name: 'Events Migration (110 records)',
      migration: () => new EventMigration(),
      priority: 3,
      dependencies: ['clients']
    });

    // ✅ PHASE 1, 2, 5 IMPLEMENTATION - Advanced Billing & Insurance Reference
    
    // PHASE 2: Advanced Billing (7 records)
    this.migrations.set('advanced_billing', {
      name: 'Advanced Billing Migration (7 records)',
      migration: () => new AdvancedBillingMigration(this.options),
      priority: 3,
      dependencies: ['clients']
    });

    // PHASE 5: Insurance Reference Data (9 records total)
    this.migrations.set('insurance_reference', {
      name: 'Insurance Reference Data Migration (9 records)',
      migration: () => new InsuranceReferenceMigration(),
      priority: 1,
      dependencies: []
    });

    // 🚧 TODO: REMAINING MIGRATIONS TO BE IMPLEMENTED
    // Temporarily commented out until migration classes are created

    // this.migrations.set('insurance_companies', {
    //   name: 'Insurance Companies Migration (93 records)',
    //   migration: () => new InsuranceCompanyMigration(this.options),
    //   priority: 1,
    //   dependencies: []
    // });

    // this.migrations.set('cities', {
    //   name: 'Cities Reference Migration (198 records)',
    //   migration: () => new CityMigration(this.options),
    //   priority: 1,
    //   dependencies: []
    // });

    // this.migrations.set('client_companies', {
    //   name: 'Client Companies Migration (2,298 records)',
    //   migration: () => new ClientCompanyMigration(this.options),
    //   priority: 1,
    //   dependencies: []
    // });

    // this.migrations.set('insurance_groups', {
    //   name: 'Insurance Group Numbers Migration (5,033 records)',
    //   migration: () => new InsuranceGroupMigration(this.options),
    //   priority: 5,
    //   dependencies: ['insurance_companies']
    // });
  }

  /**
   * Log VISIO business rules filter summary
   */
  private logVISIOFilterSummary(): void {
    const filterSummary = DataFilter.getMigrationFilterSummary();
    
    logger.info('📋 VISIO Business Rules Filter Summary:');
    logger.info(`   ✅ Clinics to Retain: ${filterSummary.retainedClinics}`);
    logger.info(`   ❌ Clinics to Exclude: ${filterSummary.excludedClinics}`);
    logger.info(`   🚫 Products to Exclude: ${filterSummary.excludedProducts}`);
    logger.info(`   📦 Modules to Skip: ${filterSummary.excludedModules.join(', ')}`);
    
    logger.info('✅ Retained Clinics:');
    // Using for...of to avoid forEach (per coding standards)
    for (const clinic of DataFilter.getRetainedClinics()) {
      logger.info(`   - ${clinic}`);
    }
    
    logger.info(`❌ Excluding ${filterSummary.excludedProducts} product codes from orders`);
    logger.info('🎯 Data-driven migration will filter records based on these rules');
  }

  /**
   * Execute all migrations in proper order
   */
  async executeAll(): Promise<{ success: boolean; results: MigrationResult[] }> {
    logger.info('🚀 Starting MSSQL to MongoDB migration process');
    
    // Display VISIO business rules summary
    this.logVISIOFilterSummary();
    
    try {
      // Connect to MongoDB
      await connectDatabase();
      logger.info('✅ Connected to MongoDB');

      // Get migration execution order
      const executionOrder = this.getExecutionOrder();
      const results: MigrationResult[] = [];
      let hasErrors = false;

      // Execute migrations in sequence (dependencies require sequential execution)
      for (const migrationName of executionOrder) {
        const plan = this.migrations.get(migrationName);
        if (!plan) {
          logger.error(`❌ Migration plan not found: ${migrationName}`);
          hasErrors = true;
          continue;
        }

        logger.info(`📊 Executing ${plan.name}...`);
        
        try {
          const migration = plan.migration();
          const result = await migration.execute();
          
          this.results.set(migrationName, result);
          results.push(result);
          
          if (result.success) {
            logger.info(`✅ ${plan.name} completed successfully: ${result.migratedRecords}/${result.totalRecords} records`);
          } else {
            logger.error(`❌ ${plan.name} failed:`, result.errors);
            hasErrors = true;
            
            // Stop on critical failures unless force mode is enabled
            if (!this.options.dryRun && result.errors.length > 0) {
              logger.warn('⚠️  Stopping migration due to errors. Use --force to continue on errors.');
              break;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`💥 Fatal error in ${plan.name}:`, errorMessage);
          hasErrors = true;
          
          results.push({
            success: false,
            totalRecords: 0,
            migratedRecords: 0,
            skippedRecords: 0,
            errors: [errorMessage],
            duration: 0,
            tableName: migrationName
          });
          break;
        }
      }

      // Generate summary report
      this.generateSummaryReport(results);
      
      return {
        success: !hasErrors,
        results
      };
      
    } catch (error) {
      logger.error('💥 Migration process failed:', error);
      return {
        success: false,
        results: []
      };
    } finally {
      await mongoose.connection.close();
      logger.info('🔌 Disconnected from MongoDB');
    }
  }

  /**
   * Execute specific migration by name
   */
  async executeMigration(name: string): Promise<MigrationResult> {
    const plan = this.migrations.get(name);
    if (!plan) {
      throw new Error(`Migration not found: ${name}`);
    }

    logger.info(`🎯 Executing single migration: ${plan.name}`);
    
    try {
      await connectDatabase();
      
      const migration = plan.migration();
      const result = await migration.execute();
      
      this.results.set(name, result);
      return result;
      
    } finally {
      await mongoose.connection.close();
    }
  }

  /**
   * Get execution order based on dependencies and priorities
   */
  private getExecutionOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) {return;}
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      visiting.add(name);
      
      const plan = this.migrations.get(name);
      if (plan) {
        // Visit dependencies first
        plan.dependencies.map(dep => visit(dep));
      }
      
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    // Visit all migrations
    const migrationNames = Array.from(this.migrations.keys());
    migrationNames.map(name => visit(name));

    // Sort by priority within dependency constraints
    return order.sort((a, b) => {
      const planA = this.migrations.get(a);
      const planB = this.migrations.get(b);
      return (planA?.priority || 0) - (planB?.priority || 0);
    });
  }

  /**
   * Generate comprehensive migration summary report
   */
  private generateSummaryReport(results: MigrationResult[]): void {
    const totalRecords = results.reduce((sum, r) => sum + r.totalRecords, 0);
    const migratedRecords = results.reduce((sum, r) => sum + r.migratedRecords, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const errorCount = results.reduce((sum, r) => sum + r.errors.length, 0);
    
    const successfulMigrations = results.filter(r => r.success).length;
    const failedMigrations = results.filter(r => !r.success).length;

    logger.info('\n' + '='.repeat(80));
    logger.info('📈 MIGRATION SUMMARY REPORT');
    logger.info('='.repeat(80));
    logger.info(`📊 Total Migrations: ${results.length}`);
    logger.info(`✅ Successful: ${successfulMigrations}`);
    logger.info(`❌ Failed: ${failedMigrations}`);
    logger.info(`📝 Total Records: ${totalRecords.toLocaleString()}`);
    logger.info(`💾 Migrated Records: ${migratedRecords.toLocaleString()}`);
    logger.info(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    logger.info(`🚨 Total Errors: ${errorCount}`);
    
    if (totalRecords > 0) {
      const successRate = ((migratedRecords / totalRecords) * 100).toFixed(2);
      logger.info(`📈 Success Rate: ${successRate}%`);
    }

    // Individual migration details
    logger.info('\n📋 Individual Migration Results:');
    results.map(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      logger.info(`${status} ${result.tableName}: ${result.migratedRecords}/${result.totalRecords} (${duration}s)`);
      
      if (result.errors.length > 0) {
        result.errors.slice(0, 3).map(error => {
          logger.error(`   ❌ ${error}`);
        });
        if (result.errors.length > 3) {
          logger.error(`   ... and ${result.errors.length - 3} more errors`);
        }
      }
    });
    
    logger.info('='.repeat(80) + '\n');
  }

  /**
   * List all available migrations
   */
  listMigrations(): void {
    logger.info('📋 Available Migrations:');
    const order = this.getExecutionOrder();
    
    order.map((name, index) => {
      const plan = this.migrations.get(name);
      if (plan) {
        logger.info(`${index + 1}. ${plan.name} (${name})`);
        if (plan.dependencies.length > 0) {
          logger.info(`   Dependencies: ${plan.dependencies.join(', ')}`);
        }
      }
    });
  }
}

/**
 * CLI interface for migration execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');
  const migrationName = args.find(arg => !arg.startsWith('--'));

  const options: Partial<MigrationOptions> = {
    dryRun: isDryRun,
    batchSize: 1000,
    skipExisting: true,
    validateData: true
  };

  const manager = new MigrationManager(options);

  try {
    if (args.includes('--list')) {
      manager.listMigrations();
      return;
    }

    if (migrationName) {
      // Execute specific migration
      const result = await manager.executeMigration(migrationName);
      process.exit(result.success ? 0 : 1);
    } else {
      // Execute all migrations
      const { success } = await manager.executeAll();
      process.exit(success ? 0 : 1);
    }
  } catch (error) {
    logger.error('💥 Migration execution failed:', error);
    process.exit(1);
  }
}

// Execute CLI if this file is run directly
if (require.main === module) {
  main().catch(error => {
    logger.error('💥 Migration process crashed:', error);
    process.exit(1);
  });
}
