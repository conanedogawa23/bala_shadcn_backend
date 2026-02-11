import sql from 'mssql';

const mssqlConfig: sql.config = {
  server: process.env.MSSQL_SERVER || 'localhost',
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DATABASE || 'VISIO_11',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 300000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolConnection: sql.ConnectionPool | null = null;

export async function getMSSQLConnection(): Promise<sql.ConnectionPool> {
  if (poolConnection && poolConnection.connected) {
    return poolConnection;
  }

  poolConnection = await sql.connect(mssqlConfig);
  console.log('✅ MSSQL connection established');
  console.log(`📊 Database: ${mssqlConfig.database}`);
  return poolConnection;
}

export async function closeMSSQLConnection(): Promise<void> {
  if (poolConnection) {
    await poolConnection.close();
    poolConnection = null;
    console.log('🔒 MSSQL connection closed');
  }
}

export async function executeMSSQLQuery<T = any>(query: string, params?: Record<string, any>): Promise<sql.IResult<T>> {
  const pool = await getMSSQLConnection();
  const request = pool.request();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  return request.query<T>(query);
}

export async function getMSSQLRecordCount(tableName: string, whereClause?: string): Promise<number> {
  const query = `SELECT COUNT(*) as cnt FROM ${tableName} ${whereClause || ''}`;
  const result = await executeMSSQLQuery<{ cnt: number }>(query);
  return result.recordset[0]?.cnt ?? 0;
}

// Actual MSSQL clinic name values (verified via SELECT DISTINCT queries)
export const RETAINED_CLINICS = [
  'BodyBlissPhysio',
  'BodyBlissOneCare',
  'Century Care',
  'Ortholine Duncan Mills',
  'My Cloud',
  'Physio Bliss'
];

export function getRetainedClinicsFilter(columnName: string = 'sb_default_clinic'): string {
  const clinicsList = RETAINED_CLINICS.map(c => `'${c}'`).join(', ');
  // Use LTRIM/RTRIM for CHAR-padded columns (sb_clinic_name in orders/payments)
  return `LTRIM(RTRIM(${columnName})) IN (${clinicsList})`;
}

// Case-insensitive match helper for in-memory clinic filtering
export function isRetainedClinic(clinicName: string): boolean {
  const trimmed = clinicName?.toString().trim();
  return RETAINED_CLINICS.some(rc => rc.toLowerCase() === trimmed.toLowerCase());
}
