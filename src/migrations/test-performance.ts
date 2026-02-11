import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';

interface PerformanceTestResult {
  testName: string;
  collection: string;
  query: any;
  executionTimeMs: number;
  docsExamined: number;
  docsReturned: number;
  indexUsed: string | null;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

async function testQueryPerformance(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('PERFORMANCE TESTING');
  console.log('='.repeat(70) + '\n');

  const mongoConn = await getMigrationConnection();

  try {
    console.log('📊 Step 1: Verifying Indexes...\n');
    await verifyIndexes(mongoConn);

    console.log('\n🚀 Step 2: Testing Query Performance...\n');
    const results = await runPerformanceTests(mongoConn);

    printPerformanceReport(results);

  } catch (error) {
    console.error('\n❌ Performance testing failed:', error);
    throw error;
  } finally {
    await closeMigrationConnection();
  }
}

async function verifyIndexes(connection: any): Promise<void> {
  const collections = [
    { name: 'clients', expectedIndexes: ['clientId', 'clientKey', 'defaultClinic', 'isActive'] },
    { name: 'payments', expectedIndexes: ['clinicName', 'clientId', 'paymentDate', 'status'] },
    { name: 'orders', expectedIndexes: ['clientId', 'clinicName', 'orderDate', 'status'] },
    { name: 'appointments', expectedIndexes: ['clientId', 'clinicName', 'startDate', 'resourceId'] }
  ];

  for (const { name, expectedIndexes } of collections) {
    try {
      const collection = connection.collection(name);
      const indexes = await collection.indexes();
      const indexFields = indexes.map((idx: any) => Object.keys(idx.key).join('_'));

      console.log(`${name}:`);
      console.log(`   Indexes: ${indexFields.join(', ')}`);

      const missingIndexes = expectedIndexes.filter(
        expected => !indexFields.some((idx: string) => idx.includes(expected))
      );

      if (missingIndexes.length > 0) {
        console.log(`   ⚠️  Missing indexes: ${missingIndexes.join(', ')}`);
      } else {
        console.log(`   ✅ All expected indexes present`);
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ Failed to check indexes for ${name}:`, error);
    }
  }
}

async function runPerformanceTests(connection: any): Promise<PerformanceTestResult[]> {
  const results: PerformanceTestResult[] = [];

  const ClientModel = connection.model('Client');
  const PaymentModel = connection.model('Payment');
  const OrderModel = connection.model('Order');
  const AppointmentModel = connection.model('Appointment');

  results.push(await testQuery(
    'Find client by clientKey',
    'clients',
    () => ClientModel.find({ clientKey: 12345 }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find clients by clinic',
    'clients',
    () => ClientModel.find({ defaultClinic: 'bodyblissphysio' }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find active clients by clinic',
    'clients',
    () => ClientModel.find({ defaultClinic: 'bodyblissphysio', isActive: true }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find clients with text search',
    'clients',
    () => ClientModel.find({ $text: { $search: 'John' } }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find payments by clinic and date',
    'payments',
    () => PaymentModel.find({
      clinicName: 'bodyblissphysio',
      paymentDate: { $gte: new Date('2024-01-01') }
    }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find outstanding payments',
    'payments',
    () => PaymentModel.find({
      'amounts.totalOwed': { $gt: 0 }
    }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find payments by client',
    'payments',
    () => PaymentModel.find({ clientId: 12345 }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find orders by clinic',
    'orders',
    () => OrderModel.find({ clinicName: 'bodyblissphysio' }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find orders by client',
    'orders',
    () => OrderModel.find({ clientId: 12345 }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find pending orders',
    'orders',
    () => OrderModel.find({ status: 'scheduled', readyToBill: true }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find appointments by client',
    'appointments',
    () => AppointmentModel.find({ clientId: 12345 }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find appointments by date range',
    'appointments',
    () => AppointmentModel.find({
      startDate: { $gte: new Date('2024-01-01'), $lte: new Date('2024-12-31') }
    }).explain('executionStats')
  ));

  results.push(await testQuery(
    'Find appointments by resource and date',
    'appointments',
    () => AppointmentModel.find({
      resourceId: 1,
      startDate: { $gte: new Date('2024-01-01') }
    }).explain('executionStats')
  ));

  return results;
}

async function testQuery(
  testName: string,
  collection: string,
  queryFn: () => Promise<any>
): Promise<PerformanceTestResult> {
  try {
    const explainResult = await queryFn();
    const stats = explainResult.executionStats;

    const executionTimeMs = stats.executionTimeMs;
    const docsExamined = stats.totalDocsExamined;
    const docsReturned = stats.nReturned;

    let indexUsed: string | null = null;
    if (stats.executionStages?.inputStage?.indexName) {
      indexUsed = stats.executionStages.inputStage.indexName;
    } else if (stats.executionStages?.stage === 'COLLSCAN') {
      indexUsed = 'COLLSCAN';
    }

    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'Query performed well';

    if (indexUsed === 'COLLSCAN') {
      status = 'warn';
      message = 'Full collection scan - consider adding index';
    } else if (executionTimeMs > 100) {
      status = 'warn';
      message = 'Slow query - execution time > 100ms';
    } else if (docsExamined > docsReturned * 10) {
      status = 'warn';
      message = 'Low index selectivity - many docs examined';
    }

    return {
      testName,
      collection,
      query: {},
      executionTimeMs,
      docsExamined,
      docsReturned,
      indexUsed,
      status,
      message
    };
  } catch (error) {
    return {
      testName,
      collection,
      query: {},
      executionTimeMs: 0,
      docsExamined: 0,
      docsReturned: 0,
      indexUsed: null,
      status: 'fail',
      message: `Query failed: ${error}`
    };
  }
}

function printPerformanceReport(results: PerformanceTestResult[]): void {
  console.log('Test Name                              Time(ms)  Examined  Returned  Index Used            Status');
  console.log('-'.repeat(100));

  for (const result of results) {
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
    const indexName = result.indexUsed || 'None';

    console.log(
      `${result.testName.padEnd(35)} ${result.executionTimeMs.toString().padStart(8)} ` +
      `${result.docsExamined.toString().padStart(9)} ` +
      `${result.docsReturned.toString().padStart(9)} ` +
      `${indexName.padEnd(20)} ${statusIcon} ${result.status}`
    );
  }
  console.log('-'.repeat(100));

  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  console.log(`\nSummary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);

  if (warnCount > 0 || failCount > 0) {
    console.log('\n⚠️  Performance Issues Detected:\n');
    for (const result of results.filter(r => r.status !== 'pass')) {
      console.log(`   ${result.testName}: ${result.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  if (failCount === 0 && warnCount === 0) {
    console.log('✅ ALL PERFORMANCE TESTS PASSED');
  } else if (failCount === 0) {
    console.log('⚠️  PERFORMANCE TESTS PASSED WITH WARNINGS');
  } else {
    console.log('❌ SOME PERFORMANCE TESTS FAILED');
  }
  console.log('='.repeat(70) + '\n');
}

if (require.main === module) {
  testQueryPerformance()
    .then(() => {
      console.log('✅ Performance testing complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Performance testing failed:', error);
      process.exit(1);
    });
}

export { testQueryPerformance };
