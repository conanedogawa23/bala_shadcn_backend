import mongoose, { Schema, Document } from 'mongoose';

export interface ICity extends Document {
  id: number;
  cityName: string;
  province?: string;
  country: string;
  postalCodePrefix?: string;
  timeZone?: string;
  isActive: boolean;
  
  // Usage statistics
  stats: {
    clientCount: number;
    clinicCount: number;
    lastUsed?: Date;
  };
  
  // Administrative
  createdAt: Date;
  updatedAt?: Date;
}

const CitySchema = new Schema<ICity>({
  id: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  cityName: {
    type: String,
    required: true,
    maxlength: 100,
    index: true,
    trim: true
  },
  province: {
    type: String,
    maxlength: 50,
    index: true,
    trim: true
  },
  country: {
    type: String,
    maxlength: 50,
    default: 'Canada',
    index: true
  },
  postalCodePrefix: {
    type: String,
    maxlength: 3,
    uppercase: true,
    sparse: true,
    index: true
  },
  timeZone: {
    type: String,
    maxlength: 50,
    default: 'America/Toronto'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  stats: {
    clientCount: {
      type: Number,
      default: 0,
      min: 0
    },
    clinicCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsed: {
      type: Date,
      index: true
    }
  }
  // createdAt and updatedAt managed by timestamps: true
}, {
  id: false, // Disable Mongoose virtual 'id' getter to avoid shadowing explicit id: Number field
  timestamps: true, // Auto-manages createdAt and updatedAt
  collection: 'cities'
});

// Compound indexes for optimal performance
CitySchema.index({ cityName: 1, province: 1, country: 1 }, { unique: true });
CitySchema.index({ province: 1, isActive: 1 });
CitySchema.index({ country: 1, isActive: 1 });
CitySchema.index({ postalCodePrefix: 1 }, { sparse: true });

// Text search index
CitySchema.index({
  cityName: 'text',
  province: 'text'
});

// Instance methods
CitySchema.methods.updateStats = function(type: 'client' | 'clinic', increment = 1): void {
  if (type === 'client') {
    this.stats.clientCount += increment;
  } else if (type === 'clinic') {
    this.stats.clinicCount += increment;
  }
  
  this.stats.lastUsed = new Date();
  this.updatedAt = new Date();
};

CitySchema.methods.getFullName = function(): string {
  return this.province ? `${this.cityName}, ${this.province}` : this.cityName;
};

// Static methods
CitySchema.statics.findByProvince = function(province: string) {
  return this.find({ 
    province: new RegExp(province, 'i'), 
    isActive: true 
  })
    .sort({ cityName: 1 })
    .lean();
};

CitySchema.statics.findByPostalPrefix = function(prefix: string) {
  return this.find({ 
    postalCodePrefix: prefix.toUpperCase(), 
    isActive: true 
  })
    .sort({ cityName: 1 })
    .lean();
};

CitySchema.statics.searchCities = function(searchTerm: string, limit = 20) {
  return this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
    .select('cityName province country postalCodePrefix')
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
};

CitySchema.statics.getPopularCities = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'stats.clientCount': -1, cityName: 1 })
    .limit(limit)
    .lean();
};

CitySchema.statics.getCityStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$province',
        totalCities: { $sum: 1 },
        totalClients: { $sum: '$stats.clientCount' },
        totalClinics: { $sum: '$stats.clinicCount' }
      }
    },
    { $sort: { totalClients: -1 } }
  ]);
};

// Pre-save middleware
CitySchema.pre('save', async function(next) {
  try {
    // Auto-generate incremental business id for new records
    if (this.isNew && !this.id) {
      const model = this.constructor as mongoose.Model<ICity>;
      const highestIdDoc = await model
        .findOne()
        .sort({ id: -1 })
        .select('id')
        .lean() as { id?: number } | null;

      this.id = (highestIdDoc?.id || 0) + 1;
    }
  } catch (error) {
    next(error as Error);
    return;
  }

  // updatedAt is auto-managed by timestamps: true
  
  // Normalize city name and province
  if (this.cityName) {
    this.cityName = this.cityName.trim();
  }
  
  if (this.province) {
    this.province = this.province.trim();
  }
  
  // Validate and normalize postal code prefix
  if (this.postalCodePrefix) {
    const prefix = this.postalCodePrefix.replace(/\s/g, '').toUpperCase();
    if (prefix.length > 3) {
      this.postalCodePrefix = prefix.substring(0, 3);
    } else {
      this.postalCodePrefix = prefix;
    }
  }
  
  next();
});

export const CityModel = mongoose.model<ICity>('City', CitySchema);
export default CityModel;
