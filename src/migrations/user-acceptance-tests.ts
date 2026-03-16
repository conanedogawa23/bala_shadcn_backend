import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';

interface UATTestResult {
  testName: string;
  category: string;
  passed: boolean;
  resultCount?: number;
  sampleData?: any[];
  error?: string;
}

async function runUserAcceptanceTests(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('USER ACCEPTANCE TESTING');
  console.log('='.repeat(70) + '\n');

  const mongoConn = await getMigrationConnection();

  try {
    const results: UATTestResult[] = [];

    console.log('📋 Running Client Data Tests...\n');
    results.push(...await testClientData(mongoConn));

    console.log('\n💰 Running Payment Data Tests...\n');
    results.push(...await testPaymentData(mongoConn));

    console.log('\n📦 Running Order Data Tests...\n');
    results.push(...await testOrderData(mongoConn));

    console.log('\n📅 Running Appointment Data Tests...\n');
    results.push(...await testAppointmentData(mongoConn));

    printUATReport(results);

  } catch (error) {
    console.error('\n❌ UAT testing failed:', error);
    throw error;
  } finally {
    await closeMigrationConnection();
  }
}

async function testClientData(connection: any): Promise<UATTestResult[]> {
  const results: UATTestResult[] = [];
  const ClientModel = connection.model('Client');

  try {
    const totalClients = await ClientModel.countDocuments();
    console.log(`   Total Clients: ${totalClients.toLocaleString()}`);
    results.push({
      testName: 'Total clients count',
      category: 'Clients',
      passed: totalClients > 0,
      resultCount: totalClients
    });
  } catch (error) {
    results.push({
      testName: 'Total clients count',
      category: 'Clients',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const clientsWithInsurance = await ClientModel.countDocuments({ 'insurance.0': { $exists: true } });
    console.log(`   Clients with Insurance: ${clientsWithInsurance.toLocaleString()}`);
    results.push({
      testName: 'Clients with insurance',
      category: 'Clients',
      passed: clientsWithInsurance > 0,
      resultCount: clientsWithInsurance
    });
  } catch (error) {
    results.push({
      testName: 'Clients with insurance',
      category: 'Clients',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const sampleClient = await ClientModel.findOne().lean();
    console.log('   Sample Client:');
    console.log(`     Name: ${sampleClient?.personalInfo?.fullName}`);
    console.log(`     Clinic: ${sampleClient?.defaultClinic}`);
    console.log(`     Insurance: ${sampleClient?.insurance?.length || 0} policies`);
    results.push({
      testName: 'Sample client data structure',
      category: 'Clients',
      passed: !!sampleClient?.personalInfo?.fullName,
      sampleData: [sampleClient]
    });
  } catch (error) {
    results.push({
      testName: 'Sample client data structure',
      category: 'Clients',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const clientsByClinic = await ClientModel.aggregate([
      { $group: { _id: '$defaultClinic', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('   Clients by Clinic:');
    for (const clinic of clientsByClinic) {
      console.log(`     ${clinic._id}: ${clinic.count.toLocaleString()}`);
    }
    results.push({
      testName: 'Clients by clinic distribution',
      category: 'Clients',
      passed: clientsByClinic.length === 6,
      resultCount: clientsByClinic.length
    });
  } catch (error) {
    results.push({
      testName: 'Clients by clinic distribution',
      category: 'Clients',
      passed: false,
      error: `${error}`
    });
  }

  return results;
}

async function testPaymentData(connection: any): Promise<UATTestResult[]> {
  const results: UATTestResult[] = [];
  const PaymentModel = connection.model('Payment');

  try {
    const totalPayments = await PaymentModel.countDocuments();
    console.log(`   Total Payments: ${totalPayments.toLocaleString()}`);
    results.push({
      testName: 'Total payments count',
      category: 'Payments',
      passed: totalPayments > 0,
      resultCount: totalPayments
    });
  } catch (error) {
    results.push({
      testName: 'Total payments count',
      category: 'Payments',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const revenueByClinic = await PaymentModel.aggregate([
      { $group: { _id: '$clinicName', total: { $sum: '$amounts.totalPaid' } } },
      { $sort: { total: -1 } }
    ]);
    console.log('   Revenue by Clinic:');
    for (const clinic of revenueByClinic.slice(0, 3)) {
      console.log(`     ${clinic._id}: $${clinic.total.toFixed(2)}`);
    }
    results.push({
      testName: 'Revenue by clinic calculation',
      category: 'Payments',
      passed: revenueByClinic.length > 0,
      resultCount: revenueByClinic.length
    });
  } catch (error) {
    results.push({
      testName: 'Revenue by clinic calculation',
      category: 'Payments',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const outstandingPayments = await PaymentModel.countDocuments({ 'amounts.totalOwed': { $gt: 0 } });
    console.log(`   Outstanding Payments: ${outstandingPayments.toLocaleString()}`);
    results.push({
      testName: 'Outstanding payments query',
      category: 'Payments',
      passed: true,
      resultCount: outstandingPayments
    });
  } catch (error) {
    results.push({
      testName: 'Outstanding payments query',
      category: 'Payments',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const paymentByMethod = await PaymentModel.aggregate([
      { $group: { _id: '$paymentMethod', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('   Payments by Method:');
    for (const method of paymentByMethod.slice(0, 3)) {
      console.log(`     ${method._id}: ${method.count.toLocaleString()}`);
    }
    results.push({
      testName: 'Payment method distribution',
      category: 'Payments',
      passed: paymentByMethod.length > 0,
      resultCount: paymentByMethod.length
    });
  } catch (error) {
    results.push({
      testName: 'Payment method distribution',
      category: 'Payments',
      passed: false,
      error: `${error}`
    });
  }

  return results;
}

async function testOrderData(connection: any): Promise<UATTestResult[]> {
  const results: UATTestResult[] = [];
  const OrderModel = connection.model('Order');

  try {
    const totalOrders = await OrderModel.countDocuments();
    console.log(`   Total Orders: ${totalOrders.toLocaleString()}`);
    results.push({
      testName: 'Total orders count',
      category: 'Orders',
      passed: totalOrders > 0,
      resultCount: totalOrders
    });
  } catch (error) {
    results.push({
      testName: 'Total orders count',
      category: 'Orders',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const sampleOrder = await OrderModel.findOne().lean();
    console.log('   Sample Order:');
    console.log(`     Order Number: ${sampleOrder?.orderNumber}`);
    console.log(`     Items: ${sampleOrder?.items?.length || 0}`);
    console.log(`     Total: $${sampleOrder?.totalAmount?.toFixed(2) || 0}`);
    results.push({
      testName: 'Sample order with line items',
      category: 'Orders',
      passed: sampleOrder?.items?.length > 0,
      sampleData: [sampleOrder]
    });
  } catch (error) {
    results.push({
      testName: 'Sample order with line items',
      category: 'Orders',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const ordersByStatus = await OrderModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('   Orders by Status:');
    for (const status of ordersByStatus) {
      console.log(`     ${status._id}: ${status.count.toLocaleString()}`);
    }
    results.push({
      testName: 'Orders by status distribution',
      category: 'Orders',
      passed: ordersByStatus.length > 0,
      resultCount: ordersByStatus.length
    });
  } catch (error) {
    results.push({
      testName: 'Orders by status distribution',
      category: 'Orders',
      passed: false,
      error: `${error}`
    });
  }

  return results;
}

async function testAppointmentData(connection: any): Promise<UATTestResult[]> {
  const results: UATTestResult[] = [];
  const AppointmentModel = connection.model('Appointment');

  try {
    const totalAppointments = await AppointmentModel.countDocuments();
    console.log(`   Total Appointments: ${totalAppointments.toLocaleString()}`);
    results.push({
      testName: 'Total appointments count',
      category: 'Appointments',
      passed: totalAppointments > 0,
      resultCount: totalAppointments
    });
  } catch (error) {
    results.push({
      testName: 'Total appointments count',
      category: 'Appointments',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const appointmentsByClinic = await AppointmentModel.aggregate([
      { $group: { _id: '$clinicName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('   Appointments by Clinic:');
    for (const clinic of appointmentsByClinic) {
      console.log(`     ${clinic._id}: ${clinic.count.toLocaleString()}`);
    }
    results.push({
      testName: 'Appointments by clinic',
      category: 'Appointments',
      passed: appointmentsByClinic.length > 0,
      resultCount: appointmentsByClinic.length
    });
  } catch (error) {
    results.push({
      testName: 'Appointments by clinic',
      category: 'Appointments',
      passed: false,
      error: `${error}`
    });
  }

  try {
    const upcomingAppointments = await AppointmentModel.countDocuments({
      startDate: { $gte: new Date('2024-01-01') }
    });
    console.log(`   Appointments in 2024+: ${upcomingAppointments.toLocaleString()}`);
    results.push({
      testName: 'Date range query',
      category: 'Appointments',
      passed: true,
      resultCount: upcomingAppointments
    });
  } catch (error) {
    results.push({
      testName: 'Date range query',
      category: 'Appointments',
      passed: false,
      error: `${error}`
    });
  }

  return results;
}

function printUATReport(results: UATTestResult[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('UAT TEST RESULTS');
  console.log('='.repeat(70) + '\n');

  const categories = ['Clients', 'Payments', 'Orders', 'Appointments'];

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.passed).length;
    const total = categoryResults.length;

    console.log(`\n${category}: ${passed}/${total} tests passed`);
    console.log('-'.repeat(70));

    for (const result of categoryResults) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.testName}`);
      if (!result.passed && result.error) {
        console.log(`     Error: ${result.error}`);
      }
    }
  }

  const totalPassed = results.filter(r => r.passed).length;
  const totalTests = results.length;

  console.log('\n' + '='.repeat(70));
  if (totalPassed === totalTests) {
    console.log(`✅ ALL UAT TESTS PASSED (${totalPassed}/${totalTests})`);
  } else {
    console.log(`⚠️  UAT TESTS: ${totalPassed}/${totalTests} passed`);
  }
  console.log('='.repeat(70) + '\n');
}

if (require.main === module) {
  runUserAcceptanceTests()
    .then(() => {
      console.log('✅ User acceptance testing complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ User acceptance testing failed:', error);
      process.exit(1);
    });
}

export { runUserAcceptanceTests };
