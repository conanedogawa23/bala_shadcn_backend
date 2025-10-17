import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';

const router = Router();

/**
 * @route   GET /api/v1/orders
 * @desc    Get all orders with filtering and pagination
 * @access  Public
 * @params  page, limit, status, paymentStatus, clinicName, clientId, startDate, endDate, search, readyToBill
 */
router.get('/', OrderController.getAllOrders);

/**
 * @route   GET /api/v1/orders/billing/ready
 * @desc    Get orders ready for billing
 * @access  Public
 * @params  clinicName
 */
router.get('/billing/ready', OrderController.getOrdersReadyForBilling);

/**
 * @route   GET /api/v1/orders/billing/overdue
 * @desc    Get overdue orders
 * @access  Public
 * @params  daysOverdue
 */
router.get('/billing/overdue', OrderController.getOverdueOrders);

/**
 * @route   GET /api/v1/orders/analytics/revenue
 * @desc    Get revenue analytics for clinic
 * @access  Public
 * @params  clinicName (required), startDate, endDate
 */
router.get('/analytics/revenue', OrderController.getRevenueAnalytics);

/**
 * @route   GET /api/v1/orders/analytics/products
 * @desc    Get product performance analytics
 * @access  Public
 * @params  startDate, endDate
 */
router.get('/analytics/products', OrderController.getProductPerformance);

/**
 * @route   GET /api/v1/orders/client/:clientId
 * @desc    Get orders by client ID
 * @access  Public
 * @params  limit
 */
router.get('/client/:clientId', OrderController.getOrdersByClient);

/**
 * @route   GET /api/v1/orders/clinic/:clinicName
 * @desc    Get orders by clinic with date range filtering
 * @access  Public
 * @params  startDate, endDate, status
 */
router.get('/clinic/:clinicName', OrderController.getOrdersByClinic);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order by ID or Order Number
 * @access  Public
 */
router.get('/:id', OrderController.getOrderById);

/**
 * @route   POST /api/v1/orders
 * @desc    Create new order
 * @access  Private
 */
router.post('/', OrderController.createOrder);

/**
 * @route   PUT /api/v1/orders/:id
 * @desc    Update order by ID or Order Number
 * @access  Private
 */
router.put('/:id', OrderController.updateOrder);

/**
 * @route   PUT /api/v1/orders/:id/status
 * @desc    Update order status with validation
 * @access  Private
 */
router.put('/:id/status', OrderController.updateOrderStatus);

/**
 * @route   PUT /api/v1/orders/:id/billing/ready
 * @desc    Mark order ready for billing
 * @access  Private
 */
router.put('/:id/billing/ready', OrderController.markReadyForBilling);

/**
 * @route   POST /api/v1/orders/:id/payment
 * @desc    Process payment for order
 * @access  Private
 */
router.post('/:id/payment', OrderController.processPayment);

/**
 * @route   PUT /api/v1/orders/:id/cancel
 * @desc    Cancel order with reason
 * @access  Private
 */
router.put('/:id/cancel', OrderController.cancelOrder);

export default router;
