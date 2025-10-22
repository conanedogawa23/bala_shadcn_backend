import mongoose, { Document, Schema, Model } from 'mongoose';

// FHIR-aligned enums
export enum ProductCategory {
  PHYSIOTHERAPY = 'physiotherapy',
  ORTHOTIC = 'orthotic',
  MASSAGE = 'massage',
  CONSULTATION = 'consultation',
  ASSESSMENT = 'assessment',
  TREATMENT = 'treatment',
  DEVICE = 'device',
  MEDICATION = 'medication',
  THERAPY = 'therapy',
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
  DRAFT = 'draft',
}

export enum FHIRProductType {
  DEVICE = 'Device',
  MEDICATION = 'Medication',
  SERVICE = 'ServiceRequest',
  PROCEDURE = 'Procedure',
}

// FHIR-aligned interfaces
export interface IProductIdentifier {
  system: string; // FHIR identifier system
  value: string; // FHIR identifier value
  use?: 'usual' | 'official' | 'temp' | 'secondary';
}

export interface IProductCoding {
  system: string;
  code: string;
  display: string;
}

export interface IProductUsage {
  totalOrders: number;
  totalRevenue: number;
  lastOrderDate?: Date;
  averageOrderValue: number;
  popularityScore: number;
}

export interface IProduct extends Document {
  // FHIR-aligned Core Fields
  identifier: IProductIdentifier[];
  resourceType: FHIRProductType;

  // Legacy Support
  productKey: number;

  // Business Fields
  name: string;
  description?: string;
  category: ProductCategory;
  type: string;

  // FHIR Device/Medication Fields
  deviceName?: string;
  manufacturer?: string;
  deviceModel?: string;
  version?: string;
  code: IProductCoding[];

  // Business Logic
  duration: number; // in minutes
  price: number;
  currency: string;

  // Status and Lifecycle
  status: ProductStatus;
  isActive: boolean;
  isDiscontinued: boolean;

  // Business Rules
  clinics: string[];
  isAvailableForAllClinics: boolean;

  // Analytics
  usage: IProductUsage;

  // Audit Fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  // Instance Methods
  updateUsageStats(orderValue: number, orderDate?: Date): Promise<void>;
  isAvailableForClinic(clinicName: string): boolean;
  getFormattedInfo(): any;
  toFHIRResource(): any;
}

// FHIR Identifier Schema
const ProductIdentifierSchema = new Schema<IProductIdentifier>(
  {
    system: { type: String, required: true },
    value: { type: String, required: true },
    use: {
      type: String,
      enum: ['usual', 'official', 'temp', 'secondary'],
      default: 'usual'
    }
  },
  { _id: false }
);

// FHIR Coding Schema
const ProductCodingSchema = new Schema<IProductCoding>(
  {
    system: { type: String, required: true },
    code: { type: String, required: true },
    display: { type: String, required: true }
  },
  { _id: false }
);

// Usage Statistics Schema
const ProductUsageSchema = new Schema<IProductUsage>(
  {
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    lastOrderDate: { type: Date },
    averageOrderValue: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 }
  },
  { _id: false }
);

// Main Product Schema with FHIR alignment
const ProductSchema = new Schema<IProduct>(
  {
    // FHIR Core Fields
    identifier: [ProductIdentifierSchema],
    resourceType: {
      type: String,
      enum: Object.values(FHIRProductType),
      default: FHIRProductType.SERVICE
    },

    // Legacy Support (for backward compatibility)
    productKey: {
      type: Number,
      required: true,
      unique: true
    },

    // Business Fields
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    category: {
      type: String,
      enum: Object.values(ProductCategory),
      required: true
    },
    type: {
      type: String,
      required: true,
      trim: true
    },

    // FHIR Device/Medication Fields
    deviceName: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    deviceModel: { type: String, trim: true },
    version: { type: String, trim: true },
    code: [ProductCodingSchema],

    // Business Logic
    duration: {
      type: Number,
      default: 60,
      min: 1,
      max: 480 // 8 hours max
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'CAD',
      enum: ['CAD', 'USD', 'EUR']
    },

    // Status and Lifecycle
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      default: ProductStatus.ACTIVE
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDiscontinued: {
      type: Boolean,
      default: false
    },

    // Business Rules
    clinics: [
      {
        type: String,
        trim: true
      }
    ],
    isAvailableForAllClinics: {
      type: Boolean,
      default: false
    },

    // Analytics
    usage: {
      type: ProductUsageSchema,
      default: () => ({})
    },

    // Audit Fields
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// BUSINESS RULE: Discontinued Product Codes (from VISIO CSV analysis)
const DISCONTINUED_PRODUCT_CODES = [
  'AC',
  'AC50',
  'AC60',
  'AC80',
  'ALLE',
  'ANX',
  'ARTH',
  'BNP',
  'BPH',
  'CANPREV5HTP',
  'CANPREVALA',
  'CANPREVEP',
  'CANPREVHH',
  'CANPREVKRILL',
  'CANPREVMAG',
  'CANPREVMVIT',
  'CANPREVOM3',
  'CANPREVPRB',
  'CANPREVVITB',
  'CANPREVVITC',
  'CANPREVVITD',
  'CHLST',
  'CIRCUL',
  'CX2',
  'DETOX',
  'DIGT',
  'ED',
  'EMOT',
  'ENRG',
  'ENZM',
  'EUCAN',
  'EUHRT',
  'EUJNT',
  'EUMEM',
  'EUMENS',
  'EUSTOM',
  'EUWOM',
  'FIBR',
  'FLSHES',
  'GLANDM',
  'GLANDS',
  'HBP',
  'HEADNO',
  'HLTH',
  'HMN',
  'HRBN',
  'IMUN',
  'INFLAM',
  'INSOM',
  'LIV',
  'METAB',
  'MST',
  'NAIL',
  'NUTRA',
  'OBES',
  'OSTEO',
  'PARA',
  'PMS',
  'RESP',
  'SKIN',
  'SMKG',
  'STRESS',
  'SUP',
  'THRYD',
  'UTI',
  'VIT',
  'WGT'
];

// Indexes for optimal performance
// Note: productKey already has unique index from unique: true in schema
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ isActive: 1, isDiscontinued: 1 });
ProductSchema.index({ clinics: 1 });
ProductSchema.index({ 'usage.popularityScore': -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

// Virtual for popularity score calculation
ProductSchema.virtual('popularityScore').get(function (this: IProduct) {
  const { totalOrders, totalRevenue, lastOrderDate } = this.usage;
  const daysSinceLastOrder = lastOrderDate
    ? (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    : 365;

  const recencyFactor = Math.max(0, 1 - daysSinceLastOrder / 365);
  return (
    Math.round(
      (totalOrders * 0.4 + (totalRevenue / 100) * 0.4 + recencyFactor * 0.2) *
        100
    ) / 100
  );
});

// Pre-save middleware for business rules
ProductSchema.pre<IProduct>('save', async function (next) {
  // Auto-set discontinued status based on business rules
  if (
    DISCONTINUED_PRODUCT_CODES.includes(this.productKey.toString()) ||
    DISCONTINUED_PRODUCT_CODES.includes(this.name.toUpperCase())
  ) {
    this.isDiscontinued = true;
    this.status = ProductStatus.DISCONTINUED;
    this.isActive = false;
  }

  // FHIR identifier auto-generation
  if (this.isNew && (!this.identifier || this.identifier.length === 0)) {
    this.identifier = [
      {
        system: 'http://visio-health.com/fhir/product-identifier',
        value: `PROD-${this.productKey}`,
        use: 'official'
      }
    ];
  }

  // FHIR code auto-generation
  if (this.isNew && (!this.code || this.code.length === 0)) {
    this.code = [
      {
        system: 'http://visio-health.com/fhir/product-codes',
        code: this.productKey.toString(),
        display: this.name
      }
    ];
  }

  next();
});

// Instance Methods
ProductSchema.methods.updateUsageStats = async function (
  orderValue: number,
  orderDate?: Date
): Promise<void> {
  this.usage.totalOrders += 1;
  this.usage.totalRevenue += orderValue;
  this.usage.lastOrderDate = orderDate || new Date();
  this.usage.averageOrderValue =
    this.usage.totalRevenue / this.usage.totalOrders;
  this.usage.popularityScore = this.popularityScore;
  return this.save();
};

ProductSchema.methods.isAvailableForClinic = function (
  clinicName: string
): boolean {
  if (this.isDiscontinued || !this.isActive) {
    return false;
  }
  if (this.isAvailableForAllClinics) {
    return true;
  }
  return this.clinics.includes(clinicName);
};

ProductSchema.methods.getFormattedInfo = function (): any {
  return {
    id: this._id,
    productKey: this.productKey,
    name: this.name,
    category: this.category,
    price: `${this.price} ${this.currency}`,
    duration: `${this.duration} min`,
    status: this.status,
    isDiscontinued: this.isDiscontinued,
    popularityScore: this.popularityScore
  };
};

ProductSchema.methods.toFHIRResource = function (): any {
  const fhirResource = {
    resourceType: this.resourceType,
    id: this._id.toString(),
    identifier: this.identifier,
    code: this.code,
    status: this.status === ProductStatus.ACTIVE ? 'active' : 'inactive',
    deviceName: this.deviceName,
    manufacturer: this.manufacturer,
    model: this.deviceModel,
    version: this.version
  };

  // Add service-specific fields if it's a service
  if (this.resourceType === FHIRProductType.SERVICE) {
    return {
      ...fhirResource,
      category: [
        {
          coding: [
            {
              system: 'http://visio-health.com/fhir/service-categories',
              code: this.category,
              display: this.category
            }
          ]
        }
      ],
      subject: null, // To be filled when used
      occurrenceDateTime: null, // To be filled when scheduled
      performerType: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '158965000',
              display: 'Medical practitioner'
            }
          ]
        }
      ]
    };
  }

  return fhirResource;
};

// Static Methods with business filtering
interface IProductModel extends Model<IProduct> {
  findActiveByClinic(clinicName: string, options?: any): Promise<IProduct[]>;
  findByCategory(category: ProductCategory, options?: any): Promise<IProduct[]>;
  findPopular(limit?: number): Promise<IProduct[]>;
  searchProducts(query: string, options?: any): Promise<IProduct[]>;
  findNonDiscontinued(options?: any): Promise<IProduct[]>;
  getDiscontinuedProductCodes(): string[];
}

ProductSchema.statics.findActiveByClinic = function (
  clinicName: string,
  options: any = {}
) {
  const filter = {
    isActive: true,
    isDiscontinued: false,
    $or: [{ isAvailableForAllClinics: true }, { clinics: clinicName }],
    ...options.filter
  };

  return this.find(filter)
    .sort(options.sort || { 'usage.popularityScore': -1 })
    .limit(options.limit || 50);
};

ProductSchema.statics.findByCategory = function (
  category: ProductCategory,
  options: any = {}
) {
  const filter = {
    category,
    isActive: true,
    isDiscontinued: false,
    ...options.filter
  };

  return this.find(filter)
    .sort(options.sort || { name: 1 })
    .limit(options.limit || 100);
};

ProductSchema.statics.findPopular = function (limit: number = 10) {
  return this.find({
    isActive: true,
    isDiscontinued: false,
    'usage.totalOrders': { $gt: 0 }
  })
    .sort({ 'usage.popularityScore': -1, 'usage.totalOrders': -1 })
    .limit(limit);
};

ProductSchema.statics.searchProducts = function (
  query: string,
  options: any = {}
) {
  const searchFilter = {
    $and: [
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { type: { $regex: query, $options: 'i' } }
        ]
      },
      {
        isActive: true,
        isDiscontinued: false,
        ...options.filter
      }
    ]
  };

  return this.find(searchFilter)
    .sort(options.sort || { 'usage.popularityScore': -1 })
    .limit(options.limit || 20);
};

ProductSchema.statics.findNonDiscontinued = function (options: any = {}) {
  const filter = {
    isDiscontinued: false,
    productKey: {
      $nin: DISCONTINUED_PRODUCT_CODES.map((code) => parseInt(code) || code)
    },
    ...options.filter
  };

  return this.find(filter)
    .sort(options.sort || { name: 1 })
    .limit(options.limit || 1000);
};

ProductSchema.statics.getDiscontinuedProductCodes = function (): string[] {
  return DISCONTINUED_PRODUCT_CODES;
};

// Export the model
const Product = mongoose.model<IProduct, IProductModel>(
  'Product',
  ProductSchema
);
export default Product;
