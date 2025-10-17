import { Schema, model, Document, Model } from 'mongoose';

export interface ICategory extends Document {
  categoryId: number; // category_id from MSSQL
  categoryName: string; // category_name from MSSQL
  categoryImage?: string; // category_image from MSSQL

  // Audit fields
  dateCreated: Date;
  dateModified: Date;

  // Instance methods
  getDisplayName(): string;
  isValidCategory(): boolean;
}

interface ICategoryModel extends Model<ICategory> {
  findByName(categoryName: string): Promise<ICategory | null>;
  findActiveCategories(): Promise<ICategory[]>;
  searchCategories(searchTerm: string): Promise<ICategory[]>;
}

const CategorySchema = new Schema<ICategory>({
  categoryId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    min: 1
  },
  categoryName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    index: true
  },
  categoryImage: {
    type: String,
    trim: true,
    maxlength: 100
  },

  // Audit fields
  dateCreated: {
    type: Date,
    default: Date.now,
    index: true
  },
  dateModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'dateCreated', updatedAt: 'dateModified' },
  toJSON: {
    transform: function(doc, ret: any) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for optimal performance
CategorySchema.index({ categoryName: 1 }, { unique: true });
CategorySchema.index({ dateCreated: -1 });

// Text search index
CategorySchema.index({
  categoryName: 'text'
});

// Instance methods
CategorySchema.methods.getDisplayName = function(): string {
  return this.categoryName.trim();
};

CategorySchema.methods.isValidCategory = function(): boolean {
  return this.categoryName && this.categoryName.trim().length > 0;
};

// Static methods
CategorySchema.statics.findByName = function(categoryName: string) {
  return this.findOne({
    categoryName: new RegExp(`^${categoryName}$`, 'i')
  });
};

CategorySchema.statics.findActiveCategories = function() {
  return this.find({})
    .sort({ categoryName: 1 })
    .lean();
};

CategorySchema.statics.searchCategories = function(searchTerm: string) {
  return this.find({
    $text: { $search: searchTerm }
  })
    .select('categoryName categoryImage')
    .sort({ score: { $meta: 'textScore' } })
    .limit(20)
    .lean();
};

// Pre-save middleware
CategorySchema.pre('save', function(next) {
  this.dateModified = new Date();

  // Normalize category name
  if (this.categoryName) {
    this.categoryName = this.categoryName.trim();
  }

  // Normalize image path
  if (this.categoryImage) {
    this.categoryImage = this.categoryImage.trim();
  }

  next();
});

export const CategoryModel = model<ICategory, ICategoryModel>('Category', CategorySchema);
