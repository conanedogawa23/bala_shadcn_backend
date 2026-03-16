import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import { trimString, toNumber, toDate, generateOrderNumber } from './utils/transform-helpers';
import { buildClientLookupMap, getClientKeyById, getClientNameById } from './utils/client-lookup';
import OrderModel, { OrderStatus, PaymentStatus } from '../models/Order';
import { MigrationProgressModel } from '../models/MigrationProgress';

const BATCH_SIZE = 2000;

interface OrderLineItem {
  productKey: number;
  productName: string;
  quantity: number;
  duration: number;
  unitPrice: number;
  subtotal: number;
}

interface GroupedOrder {
  orderNumber: string;
  appointmentId?: number;
  clientId: number;
  clientName: string;
  clinicName: string;
  status: string;
  paymentStatus: string;
  orderDate: Date;
  serviceDate: Date;
  endDate: Date;
  items: OrderLineItem[];
  totalAmount: number;
  billDate?: Date;
  readyToBill: boolean;
  invoiceNumber?: string;
  invoiceDate?: Date;
  location?: string;
  description?: string;
  appointmentStatus: number;
}

async function migrateOrders(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('ORDERS MIGRATION');
  console.log('='.repeat(70) + '\n');

  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const Order = mongoConn.model('Order', OrderModel.schema);
  const MigrationProgress = mongoConn.model('MigrationProgress', MigrationProgressModel.schema);

  try {
    console.log('🔨 Building client lookup map...');
    await buildClientLookupMap(mongoConn);

    const totalCountResult = await mssqlConn.request().query(`
      SELECT COUNT(*) as cnt FROM sb_orders
      WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
    `);
    const totalRecords = totalCountResult.recordset[0].cnt;

    console.log(`📊 Total order rows to migrate: ${totalRecords.toLocaleString()}`);

    // Clean existing data for idempotent re-runs
    const existingCount = await Order.countDocuments();
    if (existingCount > 0) {
      console.log(`🧹 Clearing ${existingCount.toLocaleString()} existing orders for clean re-run...`);
      await Order.deleteMany({});
    }

    // Drop old unique indexes that may conflict with migration data
    try {
      await Order.collection.dropIndex('appointmentId_1');
      console.log('  Dropped old unique appointmentId index');
    } catch { /* Index may not exist */ }
    try {
      await Order.collection.dropIndex('orderNumber_1');
      console.log('  Dropped old unique orderNumber index');
    } catch { /* Index may not exist */ }

    // Reset migration progress for clean start
    await MigrationProgress.deleteOne({ tableName: 'sb_orders' });
    const progress = new MigrationProgress({
      tableName: 'sb_orders',
      totalRecords,
      status: 'in_progress',
      metadata: { batchSize: BATCH_SIZE }
    });
    await progress.save();

    let offset = 0;
    let migratedRowCount = progress.migratedRecords;
    let failedCount = progress.failedRecords;
    let orderDocCount = 0;

    const ordersMap = new Map<string, GroupedOrder>();

    while (offset < totalRecords) {
      console.log(`\n📦 Processing batch: ${offset + 1} to ${Math.min(offset + BATCH_SIZE, totalRecords)} of ${totalRecords.toLocaleString()}`);

      const result = await mssqlConn.request()
        .input('offset', offset)
        .input('batchSize', BATCH_SIZE)
        .query(`
          SELECT 
            sb_orders_key, sb_client_id, sb_orders_number, sb_orders_date,
            sb_orders_qty, sb_dispensed_qty, sb_remaining_qty,
            sb_orders_product_name, sb_orders_product_description,
            sb_orders_unit_price, sb_orders_product_type, sb_orders_subtotal,
            sb_orders_service_date, sb_orders_referringMD, sb_orders_status,
            sb_orders_invoice_number, sb_orders_invoice_date, sb_orders_payment_date,
            sb_orders_paid, sb_orders_method_of_payment, sb_orders_ref_number,
            sb_product_dispensing, sb_clinic_name, sb_note, sb_created_date,
            AppointmentId, last_modify_userid, sb_isdispensable
          FROM sb_orders
          WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
          ORDER BY sb_orders_key
          OFFSET @offset ROWS
          FETCH NEXT @batchSize ROWS ONLY
        `);

      for (const row of result.recordset) {
        try {
          const orderNumber = trimString(row.sb_orders_number) || generateOrderNumber(row.AppointmentId);
          const clientKey = getClientKeyById(row.sb_client_id);

          if (!clientKey) {
            console.warn(`  ⚠️  Skipping order ${orderNumber} - client not found: ${row.sb_client_id}`);
            failedCount++;
            continue;
          }

          if (!ordersMap.has(orderNumber)) {
            // D9 fix: populate clientName from client lookup
            const clientName = getClientNameById(row.sb_client_id);
            // D1 fix: map MSSQL order status to OrderStatus enum
            const orderStatus = mapOrderStatus(row.sb_orders_status);
            // D2 fix: map MSSQL paid flag to PaymentStatus enum
            const paymentStat = mapOrderPaymentStatus(row.sb_orders_status, row.sb_orders_paid);
            const serviceDate = toDate(row.sb_orders_service_date) || new Date();

            ordersMap.set(orderNumber, {
              orderNumber,
              appointmentId: row.AppointmentId,
              clientId: clientKey,
              clientName,
              clinicName: trimString(row.sb_clinic_name),
              status: orderStatus,
              paymentStatus: paymentStat,
              orderDate: toDate(row.sb_orders_date) || new Date(),
              serviceDate,
              endDate: serviceDate, // Default endDate to serviceDate
              items: [],
              totalAmount: 0,
              billDate: toDate(row.sb_orders_payment_date),
              readyToBill: orderStatus === OrderStatus.COMPLETED,
              invoiceNumber: trimString(row.sb_orders_invoice_number) || undefined,
              invoiceDate: toDate(row.sb_orders_invoice_date),
              location: trimString(row.sb_orders_referringMD),
              description: trimString(row.sb_note),
              appointmentStatus: 0
            });
          }

          const order = ordersMap.get(orderNumber)!;
          order.items.push({
            productKey: row.sb_orders_key,
            productName: trimString(row.sb_orders_product_name),
            quantity: row.sb_orders_qty || 1,
            duration: 0,
            unitPrice: toNumber(row.sb_orders_unit_price),
            subtotal: toNumber(row.sb_orders_subtotal)
          });

          order.totalAmount += toNumber(row.sb_orders_subtotal);
          migratedRowCount++;

        } catch (error) {
          console.error(`  ⚠️  Failed to process order row ${row.sb_orders_key}:`, error);
          failedCount++;
        }
      }

      offset += BATCH_SIZE;
      progress.updateProgress(result.recordset.length, offset);
      await progress.save();
    }

    console.log(`\n💾 Inserting ${ordersMap.size.toLocaleString()} order documents...`);

    const ordersArray = Array.from(ordersMap.values());
    let insertedCount = 0;

    for (let i = 0; i < ordersArray.length; i += 1000) {
      const chunk = ordersArray.slice(i, i + 1000);
      try {
        await Order.insertMany(chunk, { ordered: false });
        insertedCount += chunk.length;
        console.log(`  ✅ Inserted ${insertedCount.toLocaleString()} / ${ordersArray.length.toLocaleString()} orders`);
      } catch (error: any) {
        if (error.writeErrors) {
          insertedCount += chunk.length - error.writeErrors.length;
          console.log(`  ⚠️  Partial success: ${insertedCount.toLocaleString()} / ${ordersArray.length.toLocaleString()}`);
        }
      }
    }

    orderDocCount = insertedCount;

    progress.status = 'completed';
    progress.endTime = new Date();
    await progress.save();

    console.log('\n' + '='.repeat(70));
    console.log('✅ ORDERS MIGRATION COMPLETE');
    console.log(`   Total Rows: ${totalRecords.toLocaleString()}`);
    console.log(`   Migrated Rows: ${migratedRowCount.toLocaleString()}`);
    console.log(`   Order Documents: ${orderDocCount.toLocaleString()}`);
    console.log(`   Failed: ${failedCount.toLocaleString()}`);
    console.log(`   Duration: ${Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000)}s`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Orders migration failed:', error);
    const progress = await MigrationProgress.findOne({ tableName: 'sb_orders' });
    if (progress) {
      progress.status = 'failed';
      await progress.save();
    }
    throw error;
  } finally {
    await closeMSSQLConnection();
    await closeMigrationConnection();
  }
}

// D1 fix: Map MSSQL sb_orders_status to OrderStatus enum
// Verified MSSQL values: TRUE, False, Pending Sales Refund 1, Pending Sales Refund 1 & COB 1,
// Pending WriteOff, Pending WriteOff 1, Pending WriteOff 1 & COB 1, Unpaid, null, empty
function mapOrderStatus(mssqlStatus: string): OrderStatus {
  const statusStr = trimString(mssqlStatus).toLowerCase();

  if (!statusStr) {return OrderStatus.SCHEDULED;}

  // TRUE means the order is completed/billed
  if (statusStr === 'true') {return OrderStatus.COMPLETED;}

  // False means not yet completed
  if (statusStr === 'false') {return OrderStatus.SCHEDULED;}

  // Pending Sales Refund -> order was completed, refund is pending
  if (statusStr.includes('pending sales refund')) {return OrderStatus.COMPLETED;}

  // Pending WriteOff -> order was completed, writeoff is pending
  if (statusStr.includes('pending writeoff') || statusStr.includes('pending write off')) {return OrderStatus.COMPLETED;}

  // Unpaid -> order was completed but not paid
  if (statusStr === 'unpaid') {return OrderStatus.COMPLETED;}

  return OrderStatus.SCHEDULED;
}

// D2 fix: Map MSSQL sb_orders_status + sb_orders_paid to Order.PaymentStatus
function mapOrderPaymentStatus(mssqlStatus: string, paidFlag: any): PaymentStatus {
  const statusStr = trimString(mssqlStatus).toLowerCase();

  // Check paid flag first
  if (paidFlag === true || paidFlag === 1 || trimString(String(paidFlag)).toLowerCase() === 'true') {
    return PaymentStatus.PAID;
  }

  // Refund statuses
  if (statusStr.includes('pending sales refund')) {return PaymentStatus.REFUNDED;}

  // WriteOff statuses -> OVERDUE (closest match)
  if (statusStr.includes('pending writeoff') || statusStr.includes('pending write off')) {return PaymentStatus.OVERDUE;}

  // Unpaid
  if (statusStr === 'unpaid') {return PaymentStatus.PENDING;}

  // TRUE with no paid flag -> could be partial or pending
  if (statusStr === 'true') {return PaymentStatus.PENDING;}

  return PaymentStatus.PENDING;
}

if (require.main === module) {
  migrateOrders()
    .then(() => {
      console.log('[OK] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[ERROR] Migration failed:', error);
      process.exit(1);
    });
}

export { migrateOrders };
