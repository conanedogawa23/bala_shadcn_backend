import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReferringDoctor extends Document {
  doctorId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  specialty?: string;
  phone?: string;
  fax?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  clinicName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IReferringDoctorModel extends Model<IReferringDoctor> {
  findActiveByClinic(clinicName: string): Promise<IReferringDoctor[]>;
  searchDoctors(query: string): Promise<IReferringDoctor[]>;
}

const ReferringDoctorSchema = new Schema<IReferringDoctor>(
  {
    doctorId: {
      type: Number,
      unique: true,
      sparse: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: 200
    },
    specialty: {
      type: String,
      trim: true,
      maxlength: 100
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20
    },
    fax: {
      type: String,
      trim: true,
      maxlength: 20
    },
    email: {
      type: String,
      trim: true,
      maxlength: 100
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      province: { type: String, trim: true },
      postalCode: { type: String, trim: true }
    },
    clinicName: {
      type: String,
      trim: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'referringdoctors'
  }
);

ReferringDoctorSchema.index({ lastName: 1, firstName: 1 });
ReferringDoctorSchema.index({ fullName: 'text', specialty: 'text' });

ReferringDoctorSchema.pre<IReferringDoctor>('save', async function (next) {
  if (!this.doctorId) {
    const DoctorModel = this.constructor as Model<IReferringDoctor>;
    const highest = await DoctorModel.findOne()
      .sort({ doctorId: -1 })
      .select('doctorId')
      .lean();
    this.doctorId = (highest?.doctorId || 0) + 1;
  }
  this.fullName = `${this.firstName} ${this.lastName}`.trim();
  next();
});

ReferringDoctorSchema.statics.findActiveByClinic = function (clinicName: string) {
  return this.find({
    isActive: true,
    $or: [{ clinicName }, { clinicName: { $exists: false } }]
  }).sort({ lastName: 1, firstName: 1 });
};

ReferringDoctorSchema.statics.searchDoctors = function (query: string) {
  const regex = new RegExp(query, 'i');
  return this.find({
    isActive: true,
    $or: [
      { firstName: regex },
      { lastName: regex },
      { fullName: regex },
      { specialty: regex }
    ]
  })
    .sort({ lastName: 1 })
    .limit(20);
};

const ReferringDoctor = mongoose.model<IReferringDoctor, IReferringDoctorModel>(
  'ReferringDoctor',
  ReferringDoctorSchema
);

export default ReferringDoctor;
