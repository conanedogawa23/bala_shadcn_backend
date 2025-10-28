import { IClient, IInsurance } from '@/models/Client';

export class ClientView {
  /**
   * Format single client for API response
   */
  static formatClient(client: IClient) {
    // Build formatted address string
    const addressParts = [];
    if (client.contact?.address?.street) {
      addressParts.push(client.contact.address.street);
    }
    if (client.contact?.address?.apartment) {
      addressParts.push(`Apt ${client.contact.address.apartment}`);
    }
    if (client.contact?.address?.city) {
      addressParts.push(client.contact.address.city);
    }
    if (client.contact?.address?.province) {
      addressParts.push(client.contact.address.province);
    }
    if (client.contact?.address?.postalCode?.full) {
      addressParts.push(client.contact.address.postalCode.full);
    }
    const formattedAddress = addressParts.join(', ');

    // Extract primary phone number
    const primaryPhone = client.contact?.phones?.cell?.full || 
                        client.contact?.phones?.home?.full || 
                        client.contact?.phones?.work?.full || 
                        '';

    return {
      id: client.clientId,
      clientId: client.clientId,
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
        formattedAddress, // Add formatted address for easy display
        phones: client.contact.phones,
        primaryPhone, // Add primary phone for easy access
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

    // Extract phone number safely from nested structure
    let phone = '';
    if (client.contact?.phones?.cell?.full) {
      phone = client.contact.phones.cell.full;
    } else if (client.contact?.phones?.home?.full) {
      phone = client.contact.phones.home.full;
    } else if (client.contact?.phones?.work?.full) {
      phone = client.contact.phones.work.full;
    } else if (typeof client.contact?.phones?.cell === 'string') {
      // Handle legacy string format
      phone = client.contact.phones.cell;
    } else if (typeof client.contact?.phones?.home === 'string') {
      // Handle legacy string format
      phone = client.contact.phones.home;
    }

    // Build address string from components
    let address = '';
    const addressParts = [];
    
    if (client.contact?.address?.street) {
      addressParts.push(client.contact.address.street);
    }
    if (client.contact?.address?.apartment) {
      addressParts.push(`Apt ${client.contact.address.apartment}`);
    }
    if (client.contact?.address?.city) {
      addressParts.push(client.contact.address.city);
    }
    if (client.contact?.address?.province) {
      addressParts.push(client.contact.address.province);
    }
    if (client.contact?.address?.postalCode?.full) {
      addressParts.push(client.contact.address.postalCode.full);
    }
    
    address = addressParts.join(', ');

    // Determine clinic name from multiple possible fields
    let clinic = '';
    
    if (client.defaultClinic) {
      clinic = client.defaultClinic;
    } else if (client.clinicId) {
      clinic = client.clinicId;
    } else if (client.clinics && client.clinics.length > 0 && client.clinics[0]) {
      clinic = client.clinics[0];
    }

    return {
      id: client.clientId,
      clientId: client.clientId, // Add explicit clientId field
      name: client.getFullName(),
      firstName: client.personalInfo.firstName,
      lastName: client.personalInfo.lastName,
      birthday,
      gender: client.personalInfo.gender,
      city: client.contact?.address?.city || '',
      province: client.contact?.address?.province || '',
      address, // Full formatted address for display
      phone,
      email: client.contact?.email || '',
      clinic,
      status: client.isActive ? 'active' : 'inactive',
      dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : '',
      insurance: client.insurance || [], // Include full insurance array
      createdAt: client.dateCreated ? client.dateCreated.toISOString() : '',
      updatedAt: client.dateModified ? client.dateModified.toISOString() : ''
    };
  }

  /**
   * Format client summary (minimal data for lists)
   */
  static formatClientSummary(client: IClient) {
    // Extract phone number safely
    const phone = client.contact?.phones?.cell?.full || 
                 client.contact?.phones?.home?.full || 
                 client.contact?.phones?.work?.full || 
                 '';

    return {
      id: client.clientId,
      clientId: client.clientId,
      name: client.getFullName(),
      firstName: client.personalInfo.firstName,
      lastName: client.personalInfo.lastName,
      email: client.contact?.email || '',
      phone,
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
    // Extract phone number safely
    const phone = client.contact?.phones?.cell?.full || 
                 client.contact?.phones?.home?.full || 
                 client.contact?.phones?.work?.full || 
                 '';

    return {
      id: client.clientId,
      clientId: client.clientId,
      name: client.getFullName(),
      email: client.contact?.email || '',
      phone,
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
