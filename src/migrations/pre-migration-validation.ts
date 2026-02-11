import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter, RETAINED_CLINICS } from './utils/mssql-connection';

interface ValidationCheck {
  name: string;
  description: string;
  query: string;
  expectedResult?: 'zero' | 'positive';
  result?: number;
  status?: 'pass' | 'fail' | 'warning';
  message?: string;
}

async function runValidationChecks(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('PRE-MIGRATION VALIDATION');
  console.log('='.repeat(70) + '\n');

  const checks: ValidationCheck[] = [
    {
      name: 'Orphaned Payments',
      description: 'Find payments without valid client references',
      query: `
        SELECT COUNT(*) as cnt FROM sb_payment_history p
        LEFT JOIN sb_clients c ON p.sb_client_id = c.sb_clients_id
        WHERE c.sb_clients_id IS NULL
          AND ${getRetainedClinicsFilter('p.sb_clinic_name')}
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Orphaned Orders',
      description: 'Find orders without valid client references',
      query: `
        SELECT COUNT(*) as cnt FROM sb_orders o
        LEFT JOIN sb_clients c ON o.sb_client_id = c.sb_clients_id
        WHERE c.sb_clients_id IS NULL
          AND ${getRetainedClinicsFilter('o.sb_clinic_name')}
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Orphaned Appointments',
      description: 'Find appointments without valid client references',
      query: `
        SELECT COUNT(*) as cnt FROM Appointments a
        LEFT JOIN sb_clients c ON a.ClientID = c.sb_clients_key
        WHERE c.sb_clients_key IS NULL
          AND ${getRetainedClinicsFilter('a.ClinicName')}
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Clients Missing First Name',
      description: 'Find clients with null or empty first name',
      query: `
        SELECT COUNT(*) as cnt FROM sb_clients
        WHERE (sb_clients_first_name IS NULL OR LTRIM(RTRIM(sb_clients_first_name)) = '')
          AND ${getRetainedClinicsFilter()}
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Clients Missing Last Name',
      description: 'Find clients with null or empty last name',
      query: `
        SELECT COUNT(*) as cnt FROM sb_clients
        WHERE (sb_clients_last_name IS NULL OR LTRIM(RTRIM(sb_clients_last_name)) = '')
          AND ${getRetainedClinicsFilter()}
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Clients Missing Default Clinic',
      description: 'Find clients without a default clinic',
      query: `
        SELECT COUNT(*) as cnt FROM sb_clients
        WHERE sb_default_clinic IS NULL
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Invalid Clinic Names',
      description: 'Find clients with clinics not in retained list',
      query: `
        SELECT COUNT(*) as cnt FROM sb_clients
        WHERE sb_default_clinic NOT IN (${RETAINED_CLINICS.map(c => `'${c}'`).join(', ')})
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Total Clients (6 Retained Clinics)',
      description: 'Count of clients in retained clinics',
      query: `
        SELECT COUNT(*) as cnt FROM sb_clients
        WHERE ${getRetainedClinicsFilter()}
      `,
      expectedResult: 'positive'
    },
    {
      name: 'Total Payments (6 Retained Clinics)',
      description: 'Count of payments in retained clinics',
      query: `
        SELECT COUNT(*) as cnt FROM sb_payment_history
        WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
      `,
      expectedResult: 'positive'
    },
    {
      name: 'Total Orders (6 Retained Clinics)',
      description: 'Count of orders in retained clinics',
      query: `
        SELECT COUNT(*) as cnt FROM sb_orders
        WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
      `,
      expectedResult: 'positive'
    },
    {
      name: 'Total Appointments (6 Retained Clinics)',
      description: 'Count of appointments in retained clinics',
      query: `
        SELECT COUNT(*) as cnt FROM Appointments
        WHERE ${getRetainedClinicsFilter('ClinicName')}
      `,
      expectedResult: 'positive'
    },
    {
      name: 'Payments with Negative Amounts',
      description: 'Find payments with negative amounts',
      query: `
        SELECT COUNT(*) as cnt FROM sb_payment_history
        WHERE (sb_payment_total_payment_amount < 0 
            OR sb_payment_total_paid < 0 
            OR sb_payment_total_owed < 0)
          AND ${getRetainedClinicsFilter('sb_clinic_name')}
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Orders with Zero or Negative Prices',
      description: 'Find orders with invalid pricing',
      query: `
        SELECT COUNT(*) as cnt FROM sb_orders
        WHERE (sb_orders_unit_price <= 0 OR sb_orders_subtotal < 0)
          AND ${getRetainedClinicsFilter('sb_clinic_name')}
      `,
      expectedResult: 'zero'
    },
    {
      name: 'Clients with Insurance',
      description: 'Count of clients with at least one insurance',
      query: `
        SELECT COUNT(*) as cnt FROM sb_clients
        WHERE (sb_clients_1st_insurance_insurance_company IS NOT NULL 
            OR sb_clients_2nd_insurance_insurance_company IS NOT NULL
            OR sb_clients_3rd_insurance_insurance_company IS NOT NULL)
          AND ${getRetainedClinicsFilter()}
      `,
      expectedResult: 'positive'
    }
  ];

  try {
    const connection = await getMSSQLConnection();

    for (const check of checks) {
      try {
        const result = await connection.request().query(check.query);
        check.result = result.recordset[0].cnt;

        if (check.expectedResult === 'zero') {
          check.status = check.result === 0 ? 'pass' : 'fail';
          check.message = check.result === 0 
            ? 'No issues found' 
            : `Found ${check.result} records - NEEDS ATTENTION`;
        } else if (check.expectedResult === 'positive') {
          check.status = (check.result ?? 0) > 0 ? 'pass' : 'warning';
          check.message = (check.result ?? 0) > 0 
            ? `Found ${check.result!.toLocaleString()} records` 
            : 'No records found - may be empty';
        }
      } catch (error) {
        check.status = 'fail';
        check.message = `Query failed: ${error}`;
      }
    }

    printValidationReport(checks);

  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  } finally {
    await closeMSSQLConnection();
  }
}

function printValidationReport(checks: ValidationCheck[]): void {
  console.log('\n📋 VALIDATION RESULTS:\n');

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  for (const check of checks) {
    const statusIcon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${check.name}`);
    console.log(`   ${check.description}`);
    console.log(`   Result: ${check.result?.toLocaleString()} records`);
    console.log(`   ${check.message}`);
    console.log('');
  }

  console.log('='.repeat(70));
  console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`);
  console.log('='.repeat(70));

  if (failCount > 0) {
    console.log('\n⚠️  WARNING: Found data quality issues that need attention before migration');
    console.log('Please review the failed checks and clean the data if necessary.\n');
  } else {
    console.log('\n✅ All validation checks passed! Data is ready for migration.\n');
  }
}

if (require.main === module) {
  runValidationChecks()
    .then(() => {
      console.log('✅ Pre-migration validation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Pre-migration validation failed:', error);
      process.exit(1);
    });
}

export { runValidationChecks };
