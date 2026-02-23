import ReferringDoctor, { IReferringDoctor } from '../models/ReferringDoctor';
import { logger } from '../utils/logger';

export class ReferringDoctorService {
  static async getAll(options: {
    page?: number;
    limit?: number;
    search?: string;
    clinicName?: string;
    isActive?: boolean;
  } = {}): Promise<{ doctors: IReferringDoctor[]; total: number }> {
    const { page = 1, limit = 50, search, clinicName, isActive = true } = options;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (clinicName) {
      filter.$or = [{ clinicName }, { clinicName: { $exists: false } }];
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { fullName: regex },
        { specialty: regex }
      ];
    }

    const [doctors, total] = await Promise.all([
      ReferringDoctor.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit).lean(),
      ReferringDoctor.countDocuments(filter)
    ]);

    return { doctors: doctors as IReferringDoctor[], total };
  }

  static async getById(id: string): Promise<IReferringDoctor | null> {
    return ReferringDoctor.findById(id).lean() as Promise<IReferringDoctor | null>;
  }

  static async create(data: Partial<IReferringDoctor>): Promise<IReferringDoctor> {
    const doctor = new ReferringDoctor(data);
    return doctor.save();
  }

  static async update(id: string, data: Partial<IReferringDoctor>): Promise<IReferringDoctor | null> {
    delete (data as any)._id;
    delete (data as any).doctorId;
    if (data.firstName || data.lastName) {
      data.fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    }
    return ReferringDoctor.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean() as Promise<IReferringDoctor | null>;
  }

  static async deactivate(id: string): Promise<IReferringDoctor | null> {
    return ReferringDoctor.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean() as Promise<IReferringDoctor | null>;
  }

  static async search(query: string): Promise<IReferringDoctor[]> {
    return ReferringDoctor.searchDoctors(query) as Promise<IReferringDoctor[]>;
  }
}
