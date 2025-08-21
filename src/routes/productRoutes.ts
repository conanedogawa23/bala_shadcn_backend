import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';

const router = Router();

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with filtering and pagination
 * @access  Public
 * @params  page, limit, category, status, clinicName, search, sortBy, sortOrder
 */
router.get('/', ProductController.getAllProducts);

/**
 * @route   GET /api/v1/products/popular
 * @desc    Get popular products by usage
 * @access  Public
 * @params  limit
 */
router.get('/popular', ProductController.getPopularProducts);

/**
 * @route   GET /api/v1/products/search
 * @desc    Search products by name or description
 * @access  Public
 * @params  q (search term)
 */
router.get('/search', ProductController.searchProducts);

/**
 * @route   GET /api/v1/products/analytics
 * @desc    Get product analytics by category
 * @access  Public
 */
router.get('/analytics', ProductController.getProductAnalytics);

/**
 * @route   GET /api/v1/products/category/:category
 * @desc    Get products by category
 * @access  Public
 */
router.get('/category/:category', ProductController.getProductsByCategory);

/**
 * @route   GET /api/v1/products/clinic/:clinicName
 * @desc    Get products available for specific clinic
 * @access  Public
 * @params  status
 */
router.get('/clinic/:clinicName', ProductController.getProductsByClinic);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get product by ID or ProductKey
 * @access  Public
 */
router.get('/:id', ProductController.getProductById);

/**
 * @route   POST /api/v1/products
 * @desc    Create new product
 * @access  Private (Admin)
 */
router.post('/', ProductController.createProduct);

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update product by ID or ProductKey
 * @access  Private (Admin)
 */
router.put('/:id', ProductController.updateProduct);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Deactivate product (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', ProductController.deactivateProduct);

export default router;
