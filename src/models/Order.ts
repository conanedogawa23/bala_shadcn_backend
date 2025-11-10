import mongoose, { Schema, Document, Types } from 'mongoose';

// Order Status Enum based on appointment workflow
export enum OrderStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

// Payment Status Enum
export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  REFUNDED = 'refunded'
}

// Order Line Item Interface
export interface IOrderLineItem {
  productKey: number;
  productName: string;
  quantity: number;
  duration: number;
  unitPrice: number;
  subtotal: number;
}

// Order Interface
export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  appointmentId?: number;
  clientId: number;
  clientName: string;
  clinicName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  orderDate: Date;
  serviceDate: Date;
  endDate: Date;
  items: IOrderLineItem[];
  totalAmount: number;
  billDate?: Date;
  readyToBill: boolean;
  invoiceDate?: Date;
  location?: string;
  description?: string;
  appointmentStatus: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  updateStatus(newStatus: OrderStatus): Promise<IOrder>;
  markReadyForBilling(): Promise<IOrder>;
  processPayment(amount: number, paymentDate?: Date): Promise<IOrder>;
}

// Order Line Item Schema
const OrderLineItemSchema = new Schema<IOrderLineItem>({
  productKey: {
    type: Number,
    required: true
  },
  productName: {
    type: String,
    required: true,
    maxlength: 200
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  duration: {
    type: Number,
    required: true,
    min: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative']
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  }
}, { _id: false });

// Order Schema with optimized indexing
const OrderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: true,
    unique: true
    // Note: unique: true automatically creates index
  },
  appointmentId: {
    type: Number,
    required: false,
    unique: true,
    sparse: true // Allow multiple null values for orders without appointments
  },
  clientId: {
    type: Schema.Types.Mixed, // Accept both String and Number for legacy data compatibility (matches Client model)
    required: true
  },
  clientName: {
    type: String,
    required: true,
    maxlength: 200
  },
  clinicName: {
    type: String,
    required: true,
    maxlength: 100
  },
  status: {
    type: String,
    enum: Object.values(OrderStatus),
    required: true,
    default: OrderStatus.SCHEDULED
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING
  },
  orderDate: {
    type: Date,
    required: true
  },
  serviceDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  items: [OrderLineItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Order amount cannot be negative']
  },
  billDate: Date,
  readyToBill: {
    type: Boolean,
    required: true,
    default: false
  },
  invoiceDate: Date,
  location: {
    type: String,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  appointmentStatus: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for optimized queries
OrderSchema.index({ clientId: 1, orderDate: -1 });
OrderSchema.index({ clinicName: 1, orderDate: -1 });
OrderSchema.index({ status: 1, paymentStatus: 1 });
OrderSchema.index({ serviceDate: 1, clinicName: 1 });
OrderSchema.index({ readyToBill: 1, billDate: 1 });
OrderSchema.index({ 'items.productKey': 1 });

// Static methods for business logic
OrderSchema.statics = {
  // Find orders by client
  findByClient: function(clientId: number | string, limit: number = 50) {
    const numericClientId = typeof clientId === 'string' ? Number(clientId) : clientId;
    return this.find({
      $or: [
        { clientId: numericClientId },
        { clientId: String(clientId) }
      ]
    })
      .sort({ orderDate: -1 })
      .limit(limit)
      .populate('items');
  },

  // Find orders by clinic with date range
  findByClinicAndDateRange: function(clinicName: string, startDate: Date, endDate: Date) {
    return this.find({
      clinicName,
      serviceDate: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ serviceDate: 1 });
  },

  // Find orders ready for billing
  findReadyForBilling: function(clinicName?: string) {
    const query: any = {
      readyToBill: true,
      billDate: null,
      status: { $in: [OrderStatus.COMPLETED, OrderStatus.IN_PROGRESS] }
    };
    
    if (clinicName) {
      query.clinicName = clinicName;
    }
    
    return this.find(query).sort({ serviceDate: 1 });
  },

  // Find overdue orders
  findOverdueOrders: function(daysOverdue: number = 30) {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysOverdue);
    
    return this.find({
      serviceDate: { $lt: overdueDate },
      paymentStatus: { $in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
      status: { $ne: OrderStatus.CANCELLED }
    }).sort({ serviceDate: 1 });
  },

  // Get revenue analytics
  getRevenueAnalytics: function(clinicName: string, startDate: Date, endDate: Date) {
    return this.aggregate([
      {
        $match: {
          clinicName,
          serviceDate: { $gte: startDate, $lte: endDate },
          status: { $ne: OrderStatus.CANCELLED }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$serviceDate' },
            month: { $month: '$serviceDate' }
          },
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
  },

  // Get product performance
  getProductPerformance: function(startDate: Date, endDate: Date) {
    return this.aggregate([
      {
        $match: {
          serviceDate: { $gte: startDate, $lte: endDate },
          status: { $ne: OrderStatus.CANCELLED }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productKey',
          productName: { $first: '$items.productName' },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$items.subtotal' },
          avgPrice: { $avg: '$items.unitPrice' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);
  }
};

// Instance methods
OrderSchema.methods = {
  // Calculate total amount from items
  calculateTotal: function(): number {
    return this.items.reduce((total: number, item: IOrderLineItem) => total + item.subtotal, 0);
  },

  // Update order status with validation
  updateStatus: function(newStatus: OrderStatus): Promise<IOrder> {
    // Validate status transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.SCHEDULED]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED, OrderStatus.NO_SHOW],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [OrderStatus.CANCELLED], // Allow cancellation for refunds
      [OrderStatus.CANCELLED]: [], // Final state
      [OrderStatus.NO_SHOW]: [OrderStatus.SCHEDULED] // Allow rescheduling
    };

    const currentStatus = this.status as OrderStatus;
    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    this.status = newStatus;
    
    // Update payment status based on order status
    if (newStatus === OrderStatus.COMPLETED && this.paymentStatus === PaymentStatus.PENDING) {
      this.readyToBill = true;
    } else if (newStatus === OrderStatus.CANCELLED) {
      this.paymentStatus = PaymentStatus.REFUNDED;
    }

    return this.save();
  },

  // Mark ready for billing
  markReadyForBilling: function(): Promise<IOrder> {
    if (this.status !== OrderStatus.COMPLETED) {
      throw new Error('Order must be completed before marking ready for billing');
    }
    
    this.readyToBill = true;
    return this.save();
  },

  // Process payment
  processPayment: function(amount: number, paymentDate: Date = new Date()): Promise<IOrder> {
    if (amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    // Update payment status based on amount
    if (amount >= this.totalAmount) {
      this.paymentStatus = PaymentStatus.PAID;
      this.billDate = paymentDate;
    } else {
      this.paymentStatus = PaymentStatus.PARTIAL;
    }

    return this.save();
  },

  // Get formatted order summary
  getOrderSummary: function() {
    return {
      orderNumber: this.orderNumber,
      clientName: this.clientName,
      serviceDate: this.serviceDate,
      totalAmount: this.totalAmount,
      status: this.status,
      paymentStatus: this.paymentStatus,
      itemCount: this.items.length
    };
  },

  // Check if order is billable
  isBillable: function(): boolean {
    return this.status === OrderStatus.COMPLETED && 
           this.paymentStatus !== PaymentStatus.PAID &&
           this.paymentStatus !== PaymentStatus.REFUNDED;
  }
};

// Virtual for duration total
OrderSchema.virtual('totalDuration').get(function() {
  return this.items.reduce((total, item) => total + item.duration, 0);
});

// Virtual for days since service
OrderSchema.virtual('daysSinceService').get(function() {
  if (!this.serviceDate) {return null;}
  
  const serviceDate = this.serviceDate instanceof Date 
    ? this.serviceDate 
    : new Date(this.serviceDate);
    
  if (isNaN(serviceDate.getTime())) {return null;}
  
  const now = new Date();
  const diffTime = now.getTime() - serviceDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to ensure data consistency
OrderSchema.pre('save', async function(next) {
  const order = this as IOrder;
  
  // Auto-calculate total if items changed
  if (order.isModified('items')) {
    order.totalAmount = order.items.reduce((total: number, item: IOrderLineItem) => total + item.subtotal, 0);
  }
  
  // Generate order number if not set
  if (!order.orderNumber) {
    if (order.appointmentId) {
      order.orderNumber = `ORD-${order.appointmentId}`;
    } else {
      // Generate unique order number for standalone orders without appointment
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      order.orderNumber = `ORD-${timestamp}-${random}`;
    }
  }
  
  next();
});

// Ensure virtual fields are serialized
OrderSchema.set('toJSON', { virtuals: true });

const Order = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
