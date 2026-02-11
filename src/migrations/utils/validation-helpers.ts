import { Connection } from 'mongoose';
import { getMSSQLRecordCount, getRetainedClinicsFilter } from './mssql-connection';

export interface ValidationResult {
  tableName: string;
  mssqlCount: number;
  mongoCount: number;
  match: boolean;
  difference: number;
  percentageMatch: number;
}

export interface OrphanedRecords {
  collection: string;
  count: number;
  samples: any[];
}

export async function validateRecordCounts(connection: Connection): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  const ClientModel = connection.model('Client');
  const PaymentModel = connection.model('Payment');
  const OrderModel = connection.model('Order');
  const AppointmentModel = connection.model('Appointment');

  const mssqlClients = await getMSSQLRecordCount(
    'sb_clients',
    `WHERE ${getRetainedClinicsFilter()}`
  );
  const mongoClients = await ClientModel.countDocuments();
  results.push({
    tableName: 'Clients',
    mssqlCount: mssqlClients,
    mongoCount: mongoClients,
    match: mssqlClients === mongoClients,
    difference: mssqlClients - mongoClients,
    percentageMatch: (mongoClients / mssqlClients) * 100
  });

  const mssqlPayments = await getMSSQLRecordCount(
    'sb_payment_history',
    `WHERE ${getRetainedClinicsFilter('sb_clinic_name')}`
  );
  const mongoPayments = await PaymentModel.countDocuments();
  results.push({
    tableName: 'Payments',
    mssqlCount: mssqlPayments,
    mongoCount: mongoPayments,
    match: mssqlPayments === mongoPayments,
    difference: mssqlPayments - mongoPayments,
    percentageMatch: (mongoPayments / mssqlPayments) * 100
  });

  const mssqlOrders = await getMSSQLRecordCount(
    'sb_orders',
    `WHERE ${getRetainedClinicsFilter('sb_clinic_name')}`
  );
  const mongoOrders = await OrderModel.countDocuments();
  results.push({
    tableName: 'Orders',
    mssqlCount: mssqlOrders,
    mongoCount: mongoOrders,
    match: mssqlOrders === mongoOrders,
    difference: mssqlOrders - mongoOrders,
    percentageMatch: (mongoOrders / mssqlOrders) * 100
  });

  const mssqlAppointments = await getMSSQLRecordCount(
    'Appointments',
    `WHERE ${getRetainedClinicsFilter('ClinicName')}`
  );
  const mongoAppointments = await AppointmentModel.countDocuments();
  results.push({
    tableName: 'Appointments',
    mssqlCount: mssqlAppointments,
    mongoCount: mongoAppointments,
    match: mssqlAppointments === mongoAppointments,
    difference: mssqlAppointments - mongoAppointments,
    percentageMatch: (mongoAppointments / mssqlAppointments) * 100
  });

  return results;
}

export async function findOrphanedRecords(connection: Connection): Promise<OrphanedRecords[]> {
  const orphanedResults: OrphanedRecords[] = [];

  const ClientModel = connection.model('Client');
  const PaymentModel = connection.model('Payment');
  const OrderModel = connection.model('Order');
  const AppointmentModel = connection.model('Appointment');

  const orphanedPayments = await PaymentModel.aggregate([
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: 'clientKey',
        as: 'client'
      }
    },
    { $match: { client: { $eq: [] } } },
    { $limit: 10 }
  ]);

  if (orphanedPayments.length > 0) {
    const count = await PaymentModel.aggregate([
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: 'clientKey',
          as: 'client'
        }
      },
      { $match: { client: { $eq: [] } } },
      { $count: 'total' }
    ]);

    orphanedResults.push({
      collection: 'Payments',
      count: count[0]?.total || 0,
      samples: orphanedPayments.map(p => ({
        paymentId: p.paymentId,
        clientId: p.clientId,
        clinicName: p.clinicName
      }))
    });
  }

  const orphanedOrders = await OrderModel.aggregate([
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: 'clientKey',
        as: 'client'
      }
    },
    { $match: { client: { $eq: [] } } },
    { $limit: 10 }
  ]);

  if (orphanedOrders.length > 0) {
    const count = await OrderModel.aggregate([
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: 'clientKey',
          as: 'client'
        }
      },
      { $match: { client: { $eq: [] } } },
      { $count: 'total' }
    ]);

    orphanedResults.push({
      collection: 'Orders',
      count: count[0]?.total || 0,
      samples: orphanedOrders.map(o => ({
        orderNumber: o.orderNumber,
        clientId: o.clientId,
        clinicName: o.clinicName
      }))
    });
  }

  const orphanedAppointments = await AppointmentModel.aggregate([
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: 'clientKey',
        as: 'client'
      }
    },
    { $match: { client: { $eq: [] } } },
    { $limit: 10 }
  ]);

  if (orphanedAppointments.length > 0) {
    const count = await AppointmentModel.aggregate([
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: 'clientKey',
          as: 'client'
        }
      },
      { $match: { client: { $eq: [] } } },
      { $count: 'total' }
    ]);

    orphanedResults.push({
      collection: 'Appointments',
      count: count[0]?.total || 0,
      samples: orphanedAppointments.map(a => ({
        appointmentId: a.appointmentId,
        clientId: a.clientId,
        clinicName: a.clinicName
      }))
    });
  }

  return orphanedResults;
}

export async function validateComputedFields(connection: Connection): Promise<{
  clientFullNames: number;
  phoneFormatting: number;
  postalCodes: number;
  paymentTotals: number;
}> {
  const errors = {
    clientFullNames: 0,
    phoneFormatting: 0,
    postalCodes: 0,
    paymentTotals: 0
  };

  const ClientModel = connection.model('Client');
  const PaymentModel = connection.model('Payment');

  const sampleClients = await ClientModel.find().limit(1000);
  for (const client of sampleClients) {
    const expectedFullName = `${client.personalInfo.lastName}, ${client.personalInfo.firstName}`;
    if (client.personalInfo.fullName !== expectedFullName) {
      errors.clientFullNames++;
    }

    if (client.contact.phones.home) {
      const expectedFull = `(${client.contact.phones.home.areaCode}) ${client.contact.phones.home.number}`;
      if (client.contact.phones.home.full !== expectedFull) {
        errors.phoneFormatting++;
      }
    }

    if (client.contact.address.postalCode.first3 && client.contact.address.postalCode.last3) {
      const expectedFull = `${client.contact.address.postalCode.first3} ${client.contact.address.postalCode.last3}`;
      if (client.contact.address.postalCode.full !== expectedFull) {
        errors.postalCodes++;
      }
    }
  }

  const samplePayments = await PaymentModel.find().limit(1000);
  for (const payment of samplePayments) {
    const calculatedTotal = payment.calculateTotal();
    if (Math.abs(calculatedTotal - payment.amounts.totalPaid) > 0.01) {
      errors.paymentTotals++;
    }
  }

  return errors;
}

export function printValidationReport(results: ValidationResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION VALIDATION REPORT');
  console.log('='.repeat(60) + '\n');

  for (const result of results) {
    console.log(`${result.tableName}:`);
    console.log(`  MSSQL Count:      ${result.mssqlCount.toLocaleString()}`);
    console.log(`  MongoDB Count:    ${result.mongoCount.toLocaleString()}`);
    console.log(`  Match:            ${result.match ? '✅ YES' : '❌ NO'}`);
    console.log(`  Difference:       ${result.difference.toLocaleString()}`);
    console.log(`  Match Percentage: ${result.percentageMatch.toFixed(2)}%`);
    console.log('');
  }

  const allMatch = results.every(r => r.match);
  console.log('='.repeat(60));
  console.log(`Overall Status: ${allMatch ? '✅ ALL COUNTS MATCH' : '❌ MISMATCHES FOUND'}`);
  console.log('='.repeat(60) + '\n');
}
