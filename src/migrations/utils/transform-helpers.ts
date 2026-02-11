import { IInsurance } from '../../models/Client';

export function trimString(value: any): string {
  return value?.toString().trim() || '';
}

export function toBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const upperValue = value.toUpperCase().trim();
    return upperValue === 'YES' || upperValue === 'TRUE' || upperValue === '1';
  }
  return false;
}

export function toNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function toDate(value: any): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

export function buildPhoneObject(countryCode: string, areaCode: string, number: string, extension?: string) {
  const cc = trimString(countryCode) || '1';
  const ac = trimString(areaCode);
  const num = trimString(number);

  if (!ac || !num) return undefined;

  const full = `(${ac}) ${num}`;
  return {
    countryCode: cc,
    areaCode: ac,
    number: num,
    extension: extension ? trimString(extension) : undefined,
    full: extension ? `${full} ext. ${trimString(extension)}` : full
  };
}

export function buildPostalCode(first3: string, last3: string) {
  const f3 = trimString(first3).toUpperCase();
  const l3 = trimString(last3).toUpperCase();

  return {
    first3: f3,
    last3: l3,
    full: f3 && l3 ? `${f3} ${l3}` : ''
  };
}

export function buildInsuranceObject(
  type: '1st' | '2nd' | '3rd',
  sqlRow: any,
  prefix: string
): IInsurance | null {
  const company = trimString(sqlRow[`${prefix}_insurance_insurance_company`]);

  if (!company) return null;

  return {
    type,
    dpa: toBoolean(sqlRow[`${prefix}_DPA`]),
    policyHolder: trimString(sqlRow[`${prefix}_insurance_policy_holder`]),
    cob: trimString(sqlRow[`${prefix}_insurance_cob`]) || 'NO',
    policyHolderName: trimString(sqlRow[`${prefix}_insurance_policy_holder_name`]),
    birthday: {
      day: trimString(sqlRow[`${prefix}_insurance_birthday_day`]),
      month: trimString(sqlRow[`${prefix}_insurance_birthday_month`]),
      year: trimString(sqlRow[`${prefix}_insurance_birthday_year`])
    },
    company,
    companyAddress: trimString(sqlRow[`${prefix}_insurance_company_address`]),
    city: trimString(sqlRow[`${prefix}_insurance_city`]),
    province: trimString(sqlRow[`${prefix}_insurance_province`]),
    postalCode: {
      first3: trimString(sqlRow[`${prefix}_insurance_postal_code_first3Digits`]),
      last3: trimString(sqlRow[`${prefix}_insurance_postal_code_last3Digits`])
    },
    groupNumber: trimString(sqlRow[`${prefix}_insurance_group_number`]),
    certificateNumber: trimString(sqlRow[`${prefix}_insurance_certifiate_number`]),
    coverage: {
      numberOfOrthotics: trimString(sqlRow[`${prefix}_coverage_numberOfOrthotics`]),
      totalAmountPerOrthotic: toNumber(sqlRow[`${prefix}_coverage_totalAmountPerOrthotic`]),
      totalAmountPerYear: toNumber(sqlRow[`${prefix}_coverage_totalAmountPerYear`]),
      frequency: trimString(sqlRow[`${prefix}_coverage_frequency`]),
      numOrthoticsPerYear: trimString(sqlRow[`${prefix}_coverage_num_orthotics_per_year`]),
      orthopedicShoes: toNumber(sqlRow[`${prefix}_coverage_orthopedic_shoes`]),
      compressionStockings: toNumber(sqlRow[`${prefix}_coverage_comp_stockings`]),
      physiotherapy: toNumber(sqlRow[`${prefix}_coverage_physiotherapy`]),
      massage: toNumber(sqlRow[`${prefix}_coverage_massage`]),
      other: toNumber(sqlRow[`${prefix}_coverage_other`])
    }
  };
}

export function buildInsuranceArray(sqlRow: any): IInsurance[] {
  const insurance: IInsurance[] = [];

  const first = buildInsuranceObject('1st', sqlRow, 'sb_clients_1st');
  if (first) insurance.push(first);

  const second = buildInsuranceObject('2nd', sqlRow, 'sb_clients_2nd');
  if (second) insurance.push(second);

  // 3rd insurance tier intentionally NOT migrated per client requirements:
  // visio_req.md: "Remove 3rd Insurance Column"

  return insurance;
}

export function buildClientFullName(firstName: string, lastName: string): string {
  const first = trimString(firstName);
  const last = trimString(lastName);
  return `${last}, ${first}`;
}

export function parseBirthday(day: string, month: string, year: string): Date | undefined {
  const d = parseInt(trimString(day));
  const m = parseInt(trimString(month));
  const y = parseInt(trimString(year));

  if (isNaN(d) || isNaN(m) || isNaN(y)) return undefined;
  if (d <= 0 || d > 31 || m <= 0 || m > 12 || y < 1900 || y > 2030) return undefined;

  return new Date(y, m - 1, d);
}

export function generateOrderNumber(appointmentId?: number, clientId?: number): string {
  if (appointmentId) {
    return `ORD-${appointmentId}`;
  }

  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const clientSuffix = clientId ? `-${clientId}` : '';
  return `ORD-${timestamp}${clientSuffix}-${random}`;
}

export function generatePaymentId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAY-${timestamp}-${randomPart}`;
}

export function cleanClinicName(clinicName: string): string {
  return trimString(clinicName).toLowerCase();
}
