import { ClientCompanyModel, IClientCompany } from '../models/ClientCompany';
import { logger } from '../utils/logger';

export class ClientCompanyService {
  static async getAll(options: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  } = {}): Promise<{ companies: IClientCompany[]; total: number }> {
    const { page = 1, limit = 50, search, isActive = true } = options;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (isActive !== undefined) {filter.isActive = isActive;}
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { companyName: regex },
        { displayName: regex },
        { industry: regex }
      ];
    }

    const [companies, total] = await Promise.all([
      ClientCompanyModel.find(filter).sort({ companyName: 1 }).skip(skip).limit(limit).lean(),
      ClientCompanyModel.countDocuments(filter)
    ]);

    return { companies: companies as IClientCompany[], total };
  }

  static async getById(id: string): Promise<IClientCompany | null> {
    return ClientCompanyModel.findById(id).lean() as Promise<IClientCompany | null>;
  }

  static async create(data: Partial<IClientCompany>): Promise<IClientCompany> {
    const company = new ClientCompanyModel(data);
    return company.save();
  }

  static async update(id: string, data: Partial<IClientCompany>): Promise<IClientCompany | null> {
    delete (data as any)._id;
    return ClientCompanyModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean() as Promise<IClientCompany | null>;
  }

  static async deactivate(id: string): Promise<IClientCompany | null> {
    return ClientCompanyModel.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean() as Promise<IClientCompany | null>;
  }

  static async search(query: string): Promise<IClientCompany[]> {
    const regex = new RegExp(query, 'i');
    return ClientCompanyModel.find({
      isActive: true,
      $or: [{ companyName: regex }, { displayName: regex }]
    }).sort({ companyName: 1 }).limit(20).lean() as Promise<IClientCompany[]>;
  }
}
