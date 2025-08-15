import { InsuranceCompanyAddressModel, IInsuranceCompanyAddress } from '../models/InsuranceCompanyAddress';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class InsuranceCompanyAddressService {
  /**
   * Get all insurance company addresses with optional filtering
   */
  static async getAllAddresses(filters: {
    company?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    addresses: IInsuranceCompanyAddress[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, limit = 50, company, city, province, postalCode } = filters;
      const skip = (page - 1) * limit;
      
      // Build query
      const query: any = {};
      
      if (company) {
        query.companyName = new RegExp(company, 'i');
      }
      
      if (city) {
        query.city = new RegExp(city, 'i');
      }
      
      if (province) {
        query.province = new RegExp(province, 'i');
      }
      
      if (postalCode) {
        const cleanPostal = postalCode.replace(/\s+/g, '').toUpperCase();
        if (cleanPostal.length >= 3) {
          const first3 = cleanPostal.substring(0, 3);
          const last3 = cleanPostal.length >= 6 ? cleanPostal.substring(3, 6) : '';
          
          if (last3) {
            query.$and = [
              { postalCodeFirst3: first3 },
              { postalCodeLast3: last3 }
            ];
          } else {
            query.postalCodeFirst3 = new RegExp(`^${first3}`, 'i');
          }
        }
      }
      
      const [addresses, total] = await Promise.all([
        InsuranceCompanyAddressModel.find(query)
          .sort({ companyName: 1, addressName: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        InsuranceCompanyAddressModel.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      logger.info(`Retrieved ${addresses.length} insurance addresses (page ${page}/${totalPages})`);
      
      return {
        addresses,
        total,
        page,
        totalPages
      };
    } catch (error) {
      logger.error('Error getting insurance addresses:', error);
      throw new AppError('Failed to retrieve insurance addresses', 500);
    }
  }

  /**
   * Get insurance address by ID
   */
  static async getAddressById(id: string): Promise<IInsuranceCompanyAddress | null> {
    try {
      const address = await InsuranceCompanyAddressModel.findById(id).lean();
      
      if (!address) {
        logger.warn(`Insurance address not found: ${id}`);
        return null;
      }
      
      logger.info(`Retrieved insurance address: ${address.addressName}`);
      return address;
    } catch (error) {
      logger.error(`Error getting insurance address ${id}:`, error);
      throw new AppError('Failed to retrieve insurance address', 500);
    }
  }

  /**
   * Get insurance address by address key
   */
  static async getAddressByKey(addressKey: number): Promise<IInsuranceCompanyAddress | null> {
    try {
      const address = await InsuranceCompanyAddressModel.findOne({ addressKey }).lean();
      
      if (!address) {
        logger.warn(`Insurance address not found for key: ${addressKey}`);
        return null;
      }
      
      logger.info(`Retrieved insurance address by key: ${address.addressName}`);
      return address;
    } catch (error) {
      logger.error(`Error getting insurance address by key ${addressKey}:`, error);
      throw new AppError('Failed to retrieve insurance address', 500);
    }
  }

  /**
   * Get addresses by company name
   */
  static async getAddressesByCompany(companyName: string): Promise<IInsuranceCompanyAddress[]> {
    try {
      const addresses = await InsuranceCompanyAddressModel.findByCompany(companyName).lean();
      
      logger.info(`Retrieved ${addresses.length} addresses for company: ${companyName}`);
      return addresses;
    } catch (error) {
      logger.error(`Error getting addresses for company ${companyName}:`, error);
      throw new AppError('Failed to retrieve company addresses', 500);
    }
  }

  /**
   * Get addresses by province
   */
  static async getAddressesByProvince(province: string): Promise<IInsuranceCompanyAddress[]> {
    try {
      const addresses = await InsuranceCompanyAddressModel.findByProvince(province).lean();
      
      logger.info(`Retrieved ${addresses.length} addresses for province: ${province}`);
      return addresses;
    } catch (error) {
      logger.error(`Error getting addresses for province ${province}:`, error);
      throw new AppError('Failed to retrieve province addresses', 500);
    }
  }

  /**
   * Get addresses by city
   */
  static async getAddressesByCity(city: string): Promise<IInsuranceCompanyAddress[]> {
    try {
      const addresses = await InsuranceCompanyAddressModel.findByCity(city).lean();
      
      logger.info(`Retrieved ${addresses.length} addresses for city: ${city}`);
      return addresses;
    } catch (error) {
      logger.error(`Error getting addresses for city ${city}:`, error);
      throw new AppError('Failed to retrieve city addresses', 500);
    }
  }

  /**
   * Search addresses by postal code
   */
  static async searchByPostalCode(postalCode: string): Promise<IInsuranceCompanyAddress[]> {
    try {
      const addresses = await InsuranceCompanyAddressModel.findByPostalCode(postalCode).lean();
      
      logger.info(`Retrieved ${addresses.length} addresses for postal code: ${postalCode}`);
      return addresses;
    } catch (error) {
      logger.error(`Error searching addresses by postal code ${postalCode}:`, error);
      throw new AppError('Failed to search addresses by postal code', 500);
    }
  }

  /**
   * Create new insurance address
   */
  static async createAddress(addressData: Partial<IInsuranceCompanyAddress>): Promise<IInsuranceCompanyAddress> {
    try {
      // Check if address key already exists
      if (addressData.addressKey) {
        const existing = await InsuranceCompanyAddressModel.findOne({ 
          addressKey: addressData.addressKey 
        });
        
        if (existing) {
          throw new AppError(`Insurance address with key ${addressData.addressKey} already exists`, 409);
        }
      }
      
      const address = new InsuranceCompanyAddressModel(addressData);
      await address.save();
      
      logger.info(`Created insurance address: ${address.addressName} (Key: ${address.addressKey})`);
      return address.toObject();
    } catch (error) {
      if (error instanceof AppError) {throw error;}
      
      logger.error('Error creating insurance address:', error);
      throw new AppError('Failed to create insurance address', 500);
    }
  }

  /**
   * Update insurance address
   */
  static async updateAddress(id: string, updateData: Partial<IInsuranceCompanyAddress>): Promise<IInsuranceCompanyAddress | null> {
    try {
      // Don't allow updating the unique addressKey
      delete updateData.addressKey;
      
      const address = await InsuranceCompanyAddressModel.findByIdAndUpdate(
        id,
        { ...updateData, dateModified: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!address) {
        logger.warn(`Insurance address not found for update: ${id}`);
        return null;
      }
      
      logger.info(`Updated insurance address: ${address.addressName}`);
      return address.toObject();
    } catch (error) {
      logger.error(`Error updating insurance address ${id}:`, error);
      throw new AppError('Failed to update insurance address', 500);
    }
  }

  /**
   * Delete insurance address
   */
  static async deleteAddress(id: string): Promise<boolean> {
    try {
      const result = await InsuranceCompanyAddressModel.findByIdAndDelete(id);
      
      if (!result) {
        logger.warn(`Insurance address not found for deletion: ${id}`);
        return false;
      }
      
      logger.info(`Deleted insurance address: ${result.addressName}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting insurance address ${id}:`, error);
      throw new AppError('Failed to delete insurance address', 500);
    }
  }

  /**
   * Get address statistics
   */
  static async getAddressStats(): Promise<{
    totalAddresses: number;
    companiesCount: number;
    provincesCount: number;
    citiesCount: number;
    topCompanies: Array<{ company: string; count: number }>;
    topProvinces: Array<{ province: string; count: number }>;
  }> {
    try {
      const [
        totalAddresses,
        companiesAgg,
        provincesAgg,
        citiesAgg
      ] = await Promise.all([
        InsuranceCompanyAddressModel.countDocuments(),
        InsuranceCompanyAddressModel.aggregate([
          { $group: { _id: '$companyName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        InsuranceCompanyAddressModel.aggregate([
          { $group: { _id: '$province', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        InsuranceCompanyAddressModel.distinct('city')
      ]);
      
      const topCompanies = companiesAgg.map(item => ({
        company: item._id,
        count: item.count
      }));
      
      const topProvinces = provincesAgg.map(item => ({
        province: item._id,
        count: item.count
      }));
      
      const stats = {
        totalAddresses,
        companiesCount: topCompanies.length,
        provincesCount: topProvinces.length,
        citiesCount: citiesAgg.length,
        topCompanies,
        topProvinces
      };
      
      logger.info('Retrieved insurance address statistics');
      return stats;
    } catch (error) {
      logger.error('Error getting insurance address statistics:', error);
      throw new AppError('Failed to retrieve address statistics', 500);
    }
  }
}
