import { IClient, IInsurance } from '@/models/Client';

export class ClientView {
  /**
   * Format single client for API response
   */
  static formatClient(client: IClient) {
    return {
      id: client.clientId,
      personalInfo: {
        firstName: client.personalInfo.firstName,
        lastName: client.personalInfo.lastName,
        fullName: client.getFullName(),
        dateOfBirth: client.personalInfo.dateOfBirth,
        age: client.getAge(),
        gender: client.personalInfo.gender
      },
      contact: {
        address: client.contact.address,
        phones: client.contact.phones,
        email: client.contact.email,
        company: client.contact.company,
        companyOther: client.contact.companyOther
      },
      medical: client.medical,
      insurance: client.insurance.map(this.formatInsurance),
      hasInsurance: client.hasInsurance(),
      primaryInsurance: client.getPrimaryInsurance() 
        ? this.formatInsurance(client.getPrimaryInsurance()!) 
        : null,
      clinics: client.clinics,
      defaultClinic: client.defaultClinic,
      isActive: client.isActive,
      createdAt: client.dateCreated,
      updatedAt: client.dateModified
    };
  }

  /**
   * Format client for frontend compatibility (matches mock data structure)
   */
  static formatClientForFrontend(client: IClient) {
    const dateOfBirth = client.personalInfo.dateOfBirth;
    const birthday = dateOfBirth ? {
      day: dateOfBirth.getDate().toString().padStart(2, '0'),
      month: (dateOfBirth.getMonth() + 1).toString().padStart(2, '0'),
      year: dateOfBirth.getFullYear().toString()
    } : {
      day: '',
      month: '',
      year: ''
    };

    return {
      id: client.clientId,
      name: client.getFullName(),
      firstName: client.personalInfo.firstName,
      lastName: client.personalInfo.lastName,
      birthday,
      gender: client.personalInfo.gender,
      city: client.contact.address.city,
      province: client.contact.address.province,
      phone: client.contact.phones.cell || client.contact.phones.home || '',
      email: client.contact.email || '',
      clinic: client.defaultClinic
    };
  }

  /**
   * Format client summary (minimal data for lists)
   */
  static formatClientSummary(client: IClient) {
    return {
      id: client.clientId,
      name: client.getFullName(),
      firstName: client.personalInfo.firstName,
      lastName: client.personalInfo.lastName,
      email: client.contact.email,
      phone: client.contact.phones.cell || client.contact.phones.home,
      age: client.getAge(),
      gender: client.personalInfo.gender,
      hasInsurance: client.hasInsurance(),
      defaultClinic: client.defaultClinic,
      isActive: client.isActive,
      createdAt: client.dateCreated
    };
  }

  /**
   * Format client list with pagination
   */
  static formatClientList(clients: IClient[], page: number, limit: number, total: number) {
    return {
      success: true,
      data: clients.map(this.formatClientSummary),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Format insurance information
   */
  static formatInsurance(insurance: IInsurance) {
    return {
      type: insurance.type,
      policyHolder: insurance.policyHolder,
      policyHolderName: insurance.policyHolderName,
      company: insurance.company,
      companyAddress: insurance.companyAddress,
      groupNumber: insurance.groupNumber,
      certificateNumber: insurance.certificateNumber,
      coverage: insurance.coverage,
      birthday: insurance.birthday
    };
  }

  /**
   * Format client for autocomplete/search results
   */
  static formatClientSearch(client: IClient) {
    return {
      id: client.clientId,
      name: client.getFullName(),
      email: client.contact.email,
      phone: client.contact.phones.cell || client.contact.phones.home,
      clinic: client.defaultClinic,
      isActive: client.isActive
    };
  }

  /**
   * Format search results
   */
  static formatSearchResults(clients: IClient[], searchTerm: string, total: number) {
    return {
      success: true,
      searchTerm,
      results: clients.map(this.formatClientSearch),
      totalResults: total,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format error response
   */
  static formatError(message: string, code?: string) {
    return {
      success: false,
      error: {
        code: code || 'CLIENT_ERROR',
        message
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format success response with custom message
   */
  static formatSuccess(data: any, message?: string) {
    return {
      success: true,
      data,
      message: message || 'Operation completed successfully',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format validation error for client data
   */
  static formatValidationError(errors: any[]) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Client data validation failed',
        details: errors
      },
      timestamp: new Date().toISOString()
    };
  }
}
