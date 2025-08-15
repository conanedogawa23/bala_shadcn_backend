import { IInsuranceCompanyAddress } from '../models/InsuranceCompanyAddress';

export interface InsuranceCompanyAddressResponse {
  id: string;
  addressKey: number;
  addressName: string;
  companyName: string;
  city: string;
  province: string;
  postalCode: string;
  formattedAddress: string;
  dateCreated: string;
  dateModified: string;
}

export interface InsuranceCompanyAddressListResponse {
  addresses: InsuranceCompanyAddressResponse[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface InsuranceCompanyAddressStatsResponse {
  totalAddresses: number;
  companiesCount: number;
  provincesCount: number;
  citiesCount: number;
  topCompanies: Array<{ company: string; count: number }>;
  topProvinces: Array<{ province: string; count: number }>;
}

export class InsuranceCompanyAddressView {
  /**
   * Format single insurance company address for response
   */
  static formatAddress(address: IInsuranceCompanyAddress): InsuranceCompanyAddressResponse {
    return {
      id: address._id.toString(),
      addressKey: address.addressKey,
      addressName: address.addressName?.trim() || '',
      companyName: address.companyName?.trim() || '',
      city: address.city?.trim() || '',
      province: address.province?.trim() || '',
      postalCode: this.formatPostalCode(address.postalCodeFirst3, address.postalCodeLast3),
      formattedAddress: this.getFormattedAddress(address),
      dateCreated: address.dateCreated.toISOString(),
      dateModified: address.dateModified.toISOString()
    };
  }

  /**
   * Format multiple insurance company addresses for response
   */
  static formatAddresses(addresses: IInsuranceCompanyAddress[]): InsuranceCompanyAddressResponse[] {
    return addresses.map(address => this.formatAddress(address));
  }

  /**
   * Format insurance company address list with pagination
   */
  static formatAddressList(data: {
    addresses: IInsuranceCompanyAddress[];
    total: number;
    page: number;
    totalPages: number;
    limit?: number;
  }): InsuranceCompanyAddressListResponse {
    return {
      addresses: this.formatAddresses(data.addresses),
      pagination: {
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
        limit: data.limit || 50
      }
    };
  }

  /**
   * Format insurance company address statistics
   */
  static formatAddressStats(stats: {
    totalAddresses: number;
    companiesCount: number;
    provincesCount: number;
    citiesCount: number;
    topCompanies: Array<{ company: string; count: number }>;
    topProvinces: Array<{ province: string; count: number }>;
  }): InsuranceCompanyAddressStatsResponse {
    return {
      totalAddresses: stats.totalAddresses,
      companiesCount: stats.companiesCount,
      provincesCount: stats.provincesCount,
      citiesCount: stats.citiesCount,
      topCompanies: stats.topCompanies.map(item => ({
        company: item.company?.trim() || 'Unknown',
        count: item.count
      })),
      topProvinces: stats.topProvinces.map(item => ({
        province: item.province?.trim() || 'Unknown',
        count: item.count
      }))
    };
  }

  /**
   * Format postal code from separate first3 and last3 fields
   */
  private static formatPostalCode(first3?: string, last3?: string): string {
    const first = (first3 || '').trim().toUpperCase();
    const last = (last3 || '').trim().toUpperCase();
    
    if (first && last) {
      return `${first} ${last}`;
    }
    return first + last;
  }

  /**
   * Get formatted address string
   */
  private static getFormattedAddress(address: IInsuranceCompanyAddress): string {
    const parts = [
      address.addressName?.trim(),
      address.city?.trim(),
      address.province?.trim(),
      this.formatPostalCode(address.postalCodeFirst3, address.postalCodeLast3)
    ].filter(part => part && part.length > 0);
    
    return parts.join(', ');
  }

  /**
   * Format for frontend compatibility (if needed for mock data replacement)
   */
  static formatAddressForFrontend(address: IInsuranceCompanyAddress): any {
    return {
      id: address._id.toString(),
      key: address.addressKey,
      name: address.addressName?.trim() || '',
      company: address.companyName?.trim() || '',
      location: {
        city: address.city?.trim() || '',
        province: address.province?.trim() || '',
        postalCode: this.formatPostalCode(address.postalCodeFirst3, address.postalCodeLast3)
      },
      address: this.getFormattedAddress(address),
      created: address.dateCreated.toISOString(),
      updated: address.dateModified.toISOString()
    };
  }

  /**
   * Format multiple addresses for frontend compatibility
   */
  static formatAddressesForFrontend(addresses: IInsuranceCompanyAddress[]): any[] {
    return addresses.map(address => this.formatAddressForFrontend(address));
  }

  /**
   * Format search results
   */
  static formatSearchResults(addresses: IInsuranceCompanyAddress[], searchTerm: string): {
    results: InsuranceCompanyAddressResponse[];
    searchTerm: string;
    count: number;
  } {
    return {
      results: this.formatAddresses(addresses),
      searchTerm: searchTerm.trim(),
      count: addresses.length
    };
  }

  /**
   * Format company addresses group
   */
  static formatCompanyAddresses(companyName: string, addresses: IInsuranceCompanyAddress[]): {
    company: string;
    addresses: InsuranceCompanyAddressResponse[];
    count: number;
  } {
    return {
      company: companyName.trim(),
      addresses: this.formatAddresses(addresses),
      count: addresses.length
    };
  }

  /**
   * Format province addresses group
   */
  static formatProvinceAddresses(province: string, addresses: IInsuranceCompanyAddress[]): {
    province: string;
    addresses: InsuranceCompanyAddressResponse[];
    count: number;
  } {
    return {
      province: province.trim(),
      addresses: this.formatAddresses(addresses),
      count: addresses.length
    };
  }
}
