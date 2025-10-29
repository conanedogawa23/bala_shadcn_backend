import { Schema, model, Document, Model } from 'mongoose';

// Font configuration interface
export interface IFontConfig {
  family: string;
  size: number;
  weight?: string;
  color?: string;
}

// Color scheme interface
export interface IColorScheme {
  primary: string;
  secondary: string;
  text: string;
  accent: string;
  border?: string;
  background?: string;
}

// Layout configuration interface
export interface ILayoutConfig {
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  pageSize: 'letter' | 'A4';
  headerHeight: number;
  footerHeight: number;
  lineHeight?: number;
}

// Styling configuration interface
export interface IStylingConfig {
  fonts: {
    header: IFontConfig;
    body: IFontConfig;
    footer: IFontConfig;
    tableHeader?: IFontConfig;
    total?: IFontConfig;
  };
  colors: IColorScheme;
  layout: ILayoutConfig;
}

// HTML templates interface
export interface IHTMLTemplates {
  header: string;        // HTML template with {{variables}}
  clientInfo: string;    // Customer/Bill-To section
  serviceTable: string;  // Services/items table
  totals: string;        // Financial summary
  footer: string;        // Payment terms & signature
  paymentBreakdown?: string; // Payment breakdown table
}

// Main invoice template interface
export interface IInvoiceTemplate extends Document {
  // Clinic identification
  clinicId: number;
  clinicName: string;
  displayName: string;
  
  // Clinic contact information
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone?: string;
  fax?: string;
  
  // Invoice numbering
  invoicePrefix: string;
  invoiceNumberFormat?: string;
  
  // Financial configuration
  taxRate: number;
  currency: string;
  currencySymbol: string;
  
  // Payment configuration
  paymentTerms?: string;
  paymentMethods?: string[];
  
  // Template styling configuration
  styling: IStylingConfig;
  
  // HTML template structures
  htmlTemplates: IHTMLTemplates;
  
  // Template metadata
  isActive: boolean;
  version?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Font configuration sub-schema
const FontConfigSchema = new Schema<IFontConfig>({
  family: { type: String, required: true, default: 'Helvetica' },
  size: { type: Number, required: true, default: 12 },
  weight: { type: String, default: 'normal' },
  color: { type: String, default: '#000000' }
}, { _id: false });

// Color scheme sub-schema
const ColorSchemeSchema = new Schema<IColorScheme>({
  primary: { type: String, required: true, default: '#0066CC' },
  secondary: { type: String, required: true, default: '#666666' },
  text: { type: String, required: true, default: '#333333' },
  accent: { type: String, required: true, default: '#FF6600' },
  border: { type: String, default: '#CCCCCC' },
  background: { type: String, default: '#FFFFFF' }
}, { _id: false });

// Layout configuration sub-schema
const LayoutConfigSchema = new Schema<ILayoutConfig>({
  margins: {
    top: { type: Number, required: true, default: 50 },
    right: { type: Number, required: true, default: 50 },
    bottom: { type: Number, required: true, default: 50 },
    left: { type: Number, required: true, default: 50 }
  },
  pageSize: { 
    type: String, 
    enum: ['letter', 'A4'], 
    required: true, 
    default: 'letter' 
  },
  headerHeight: { type: Number, required: true, default: 150 },
  footerHeight: { type: Number, required: true, default: 100 },
  lineHeight: { type: Number, default: 1.5 }
}, { _id: false });

// Styling configuration sub-schema
const StylingConfigSchema = new Schema<IStylingConfig>({
  fonts: {
    header: { type: FontConfigSchema, required: true },
    body: { type: FontConfigSchema, required: true },
    footer: { type: FontConfigSchema, required: true },
    tableHeader: FontConfigSchema,
    total: FontConfigSchema
  },
  colors: { type: ColorSchemeSchema, required: true },
  layout: { type: LayoutConfigSchema, required: true }
}, { _id: false });

// HTML templates sub-schema
const HTMLTemplatesSchema = new Schema<IHTMLTemplates>({
  header: { type: String, required: true },
  clientInfo: { type: String, required: true },
  serviceTable: { type: String, required: true },
  totals: { type: String, required: true },
  footer: { type: String, required: true },
  paymentBreakdown: { type: String }
}, { _id: false });

// Main invoice template schema
const InvoiceTemplateSchema = new Schema<IInvoiceTemplate>({
  // Clinic identification
  clinicId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  clinicName: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Clinic contact information
  address: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  postalCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  fax: {
    type: String,
    trim: true
  },
  
  // Invoice numbering
  invoicePrefix: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  invoiceNumberFormat: {
    type: String,
    trim: true,
    default: '{{prefix}}-{{year}}-{{sequence}}'
  },
  
  // Financial configuration
  taxRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 13
  },
  currency: {
    type: String,
    required: true,
    default: 'CAD',
    uppercase: true
  },
  currencySymbol: {
    type: String,
    required: true,
    default: '$'
  },
  
  // Payment configuration
  paymentTerms: {
    type: String,
    default: 'Due within 30 days'
  },
  paymentMethods: {
    type: [String],
    default: ['Cash', 'Credit Card', 'Debit', 'Check', 'Bank Transfer']
  },
  
  // Template styling configuration
  styling: {
    type: StylingConfigSchema,
    required: true
  },
  
  // HTML template structures
  htmlTemplates: {
    type: HTMLTemplatesSchema,
    required: true
  },
  
  // Template metadata
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  version: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true,
  collection: 'invoice_templates'
});

// Index for faster clinic lookups
InvoiceTemplateSchema.index({ clinicName: 1, isActive: 1 });

// Instance method to get formatted clinic info
InvoiceTemplateSchema.methods.getFormattedClinicInfo = function(): string {
  return `${this.displayName}\n${this.address}\n${this.city}, ${this.province} ${this.postalCode}${this.phone ? `\nPhone: ${this.phone}` : ''}${this.fax ? `\nFax: ${this.fax}` : ''}`;
};

// Instance method to replace template variables
InvoiceTemplateSchema.methods.replaceVariables = function(
  template: string, 
  data: Record<string, any>
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value || ''));
  }
  return result;
};

// Static methods interface
export interface IInvoiceTemplateModel extends Model<IInvoiceTemplate> {
  findActiveByClinicId(clinicId: number): Promise<IInvoiceTemplate | null>;
  findByClinicName(clinicName: string): Promise<IInvoiceTemplate | null>;
}

// Static method to find active template by clinic ID
InvoiceTemplateSchema.statics.findActiveByClinicId = function(
  clinicId: number
): Promise<IInvoiceTemplate | null> {
  return this.findOne({ clinicId, isActive: true });
};

// Static method to find template by clinic name
InvoiceTemplateSchema.statics.findByClinicName = function(
  clinicName: string
): Promise<IInvoiceTemplate | null> {
  return this.findOne({ clinicName, isActive: true });
};

// Export model
export const InvoiceTemplateModel = model<IInvoiceTemplate, IInvoiceTemplateModel>(
  'InvoiceTemplate', 
  InvoiceTemplateSchema
);

