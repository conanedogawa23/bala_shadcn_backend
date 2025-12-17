import { Request, Response } from 'express';
import Product, { IProduct, ProductCategory, ProductStatus } from '../models/Product';
import { logger } from '../utils/logger';

interface ProductQuery {
  page?: string;
  limit?: string;
  category?: ProductCategory;
  status?: ProductStatus;
  clinicName?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ProductResponse {
  success: boolean;
  data?: IProduct | IProduct[] | any;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ProductController {

  /**
   * Get all products with filtering and pagination
   */
  static async getAllProducts(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        category,
        status = ProductStatus.ACTIVE,
        clinicName,
        search,
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query as ProductQuery;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
      const filter: any = {};
      
      if (status) {
        filter.status = status;
      }
      
      if (category) {
        filter.category = category;
      }
      
      if (clinicName) {
        filter.$or = [
          { clinics: clinicName },
          { applicableClinics: clinicName }
        ];
      }

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
          { name: searchRegex },
          { description: searchRegex }
        ];
      }

      // Build sort query
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      const sortQuery: any = {};
      
      if (sortBy === 'popularity') {
        sortQuery['usage.totalAppointments'] = -1;
      } else if (sortBy === 'price') {
        sortQuery.price = sortDirection;
      } else {
        sortQuery[sortBy] = sortDirection;
      }

      // Execute queries
      const [products, total] = await Promise.all([
        Product.find(filter)
          .sort(sortQuery)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(filter)
      ]);

      const response: ProductResponse = {
        success: true,
        data: products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error fetching products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get product by ID or ProductKey
   */
  static async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Product ID is required',
            code: 'MISSING_PRODUCT_ID'
          }
        });
        return;
      }
      
      // Check if ID is a ProductKey (number) or MongoDB ObjectId
      const isProductKey = /^\d+$/.test(id);
      const query = isProductKey ? { productKey: parseInt(id) } : { _id: id };
      
      const product = await Product.findOne(query);
      
      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      const response: ProductResponse = {
        success: true,
        data: product
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error fetching product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get products by clinic
   */
  static async getProductsByClinic(req: Request, res: Response): Promise<void> {
    try {
      const { clinicName } = req.params;
      const { status = ProductStatus.ACTIVE } = req.query as ProductQuery;

      const products = await Product.find({
        $or: [
          { clinics: clinicName },
          { applicableClinics: clinicName }
        ],
        status,
        isActive: true
      }).sort({ name: 1 });

      const response: ProductResponse = {
        success: true,
        data: products
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error fetching clinic products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinic products',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get products by category
   */
  static async getProductsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      
      if (!Object.values(ProductCategory).includes(category as ProductCategory)) {
        res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
        return;
      }

      const products = await Product.find({
        category: category as ProductCategory,
        isActive: true
      }).sort({ 'usage.totalAppointments': -1 });

      const response: ProductResponse = {
        success: true,
        data: products
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error fetching category products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category products',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get popular products
   */
  static async getPopularProducts(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '10' } = req.query;
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

      const products = await Product.find({ isActive: true })
        .sort({ 'usage.totalAppointments': -1 })
        .limit(limitNum);

      const response: ProductResponse = {
        success: true,
        data: products
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error fetching popular products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch popular products',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Search products
   */
  static async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const { q, query } = req.query;
      const searchTerm = q || query; // Accept both q and query params
      
      if (!searchTerm || typeof searchTerm !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search term is required'
        });
        return;
      }

      const searchRegex = new RegExp(searchTerm, 'i');
      const products = await Product.find({
        $or: [
          { name: searchRegex },
          { description: searchRegex }
        ],
        isActive: true
      }).sort({ name: 1 }).limit(20);

      const response: ProductResponse = {
        success: true,
        data: products
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error searching products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search products',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create new product
   */
  static async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const productData = req.body;

      // Validate required fields
      const requiredFields = ['productKey', 'name', 'category', 'duration', 'price'];
      const missingFields = requiredFields.filter(field => !productData[field]);
      
      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        });
        return;
      }

      // Validate field types
      if (typeof productData.productKey !== 'number' || productData.productKey <= 0) {
        res.status(400).json({
          success: false,
          message: 'productKey must be a positive number'
        });
        return;
      }

      if (typeof productData.price !== 'number' || productData.price < 0) {
        res.status(400).json({
          success: false,
          message: 'price must be a non-negative number'
        });
        return;
      }

      if (typeof productData.duration !== 'number' || productData.duration <= 0) {
        res.status(400).json({
          success: false,
          message: 'duration must be a positive number'
        });
        return;
      }

      if (!Object.values(ProductCategory).includes(productData.category)) {
        res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${Object.values(ProductCategory).join(', ')}`
        });
        return;
      }

      // Check if productKey already exists
      const existingProduct = await Product.findOne({ productKey: productData.productKey });
      if (existingProduct) {
        res.status(409).json({
          success: false,
          message: 'ProductKey already exists'
        });
        return;
      }

      // Set defaults for optional fields
      const newProductData = {
        ...productData,
        isActive: productData.isActive !== false,
        status: productData.status || ProductStatus.ACTIVE,
        clinics: productData.clinics || [],
        applicableClinics: productData.applicableClinics || []
      };

      const product = new Product(newProductData);
      await product.save();

      const response: ProductResponse = {
        success: true,
        data: product,
        message: 'Product created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating product:', error);
      
      // Handle Mongoose validation errors
      if (error instanceof Error) {
        if (error.name === 'ValidationError') {
          res.status(400).json({
            success: false,
            message: 'Product validation failed',
            error: error.message
          });
          return;
        }
        if (error.name === 'MongoServerError' && (error as any).code === 11000) {
          res.status(409).json({
            success: false,
            message: 'Product with this productKey already exists'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update product
   */
  static async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Product ID is required',
            code: 'MISSING_PRODUCT_ID'
          }
        });
        return;
      }

      // Remove fields that shouldn't be updated
      delete updateData.productKey;
      delete updateData.usage;
      delete updateData.createdAt;

      const isProductKey = /^\d+$/.test(id);
      const query = isProductKey ? { productKey: parseInt(id) } : { _id: id };

      const product = await Product.findOneAndUpdate(
        query,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      const response: ProductResponse = {
        success: true,
        data: product,
        message: 'Product updated successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error updating product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Deactivate product (soft delete)
   */
  static async deactivateProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Product ID is required',
            code: 'MISSING_PRODUCT_ID'
          }
        });
        return;
      }

      const isProductKey = /^\d+$/.test(id);
      const query = isProductKey ? { productKey: parseInt(id) } : { _id: id };

      const product = await Product.findOneAndUpdate(
        query,
        { 
          $set: { 
            isActive: false,
            status: ProductStatus.DISCONTINUED
          }
        },
        { new: true }
      );

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }

      const response: ProductResponse = {
        success: true,
        data: product,
        message: 'Product deactivated successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error deactivating product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate product',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get product analytics
   */
  static async getProductAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const analytics = await Product.aggregate([
        {
          $group: {
            _id: '$category',
            totalProducts: { $sum: 1 },
            activeProducts: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            totalAppointments: { $sum: '$usage.totalAppointments' },
            avgPrice: { $avg: '$price' }
          }
        },
        {
          $sort: { totalAppointments: -1 }
        }
      ]);

      const response: ProductResponse = {
        success: true,
        data: analytics
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error fetching product analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
