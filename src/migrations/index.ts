export { runValidationChecks } from './pre-migration-validation';
export { migrateLookupTables } from './migrate-lookups';
export { migrateClients } from './migrate-clients';
export { migrateAppointments } from './migrate-appointments';
export { migrateOrders } from './migrate-orders';
export { migratePayments } from './migrate-payments';
export { migrateContactHistory } from './migrate-contact-history';
export { migrateClientClinic } from './migrate-client-clinic';
export { migrateAllReferenceTables } from './migrate-reference-tables';
export { runPostMigrationValidation } from './post-migration-validation';
export { testQueryPerformance } from './test-performance';
export { runUserAcceptanceTests } from './user-acceptance-tests';
export { runFullMigration } from './run-full-migration';
export { checkMigrationStatus } from './check-migration-status';

export { getMSSQLConnection, closeMSSQLConnection, executeMSSQLQuery } from './utils/mssql-connection';
export { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
export { buildClientLookupMap, getClientKeyById, getClientNameById } from './utils/client-lookup';
