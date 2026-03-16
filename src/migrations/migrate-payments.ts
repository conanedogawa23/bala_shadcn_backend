import { getMSSQLConnection, closeMSSQLConnection, getRetainedClinicsFilter } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import { trimString, toNumber, toDate, generatePaymentId } from './utils/transform-helpers';
import { buildClientLookupMap, getClientKeyById, getClientNameById } from './utils/client-lookup';
import { PaymentModel, PaymentMethod, PaymentType, PaymentStatus } from '../models/Payment';
import { MigrationProgressModel } from '../models/MigrationProgress';

const BATCH_SIZE = 5000;

async function migratePayments(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('PAYMENTS MIGRATION');
  console.log('='.repeat(70) + '\n');

  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const Payment = mongoConn.model('Payment', PaymentModel.schema);
  const MigrationProgress = mongoConn.model('MigrationProgress', MigrationProgressModel.schema);

  try {
    console.log('🔨 Building client lookup map...');
    await buildClientLookupMap(mongoConn);

    const totalCountResult = await mssqlConn.request().query(`
      SELECT COUNT(*) as cnt FROM sb_payment_history
      WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
    `);
    const totalRecords = totalCountResult.recordset[0].cnt;

    console.log(`📊 Total payments to migrate: ${totalRecords.toLocaleString()}`);

    // Clean existing data for idempotent re-runs
    const existingPayments = await Payment.countDocuments();
    if (existingPayments > 0) {
      console.log(`🧹 Clearing ${existingPayments.toLocaleString()} existing payments for clean re-run...`);
      await Payment.deleteMany({});
    }

    // Reset migration progress for clean start
    await MigrationProgress.deleteOne({ tableName: 'sb_payment_history' });
    const progress = new MigrationProgress({
      tableName: 'sb_payment_history',
      totalRecords,
      status: 'in_progress',
      metadata: { batchSize: BATCH_SIZE }
    });
    await progress.save();

    let offset = 0;
    let migratedCount = 0;
    let failedCount = progress.failedRecords;

    while (offset < totalRecords) {
      console.log(`\n📦 Processing batch: ${offset + 1} to ${Math.min(offset + BATCH_SIZE, totalRecords)} of ${totalRecords.toLocaleString()}`);

      const result = await mssqlConn.request()
        .input('offset', offset)
        .input('batchSize', BATCH_SIZE)
        .query(`
          SELECT 
            sb_payment_history_key, sb_client_id, sb_order_number, sb_payment_number,
            sb_payment_date, sb_payment_total_payment_amount, sb_payment_total_paid,
            sb_payment_total_owed, sb_payment_POP_amount, sb_payment_POPFP_amount,
            sb_payment_SALESREFUND_amount, sb_payment_DPA_amount, sb_payment_DPAFP_amount,
            sb_payment_WRITEOFF_amount, sb_payment_COB_1_amount, sb_payment_COB_2_amount,
            sb_payment_COB_3_amount, sb_payment_1st_insurance_cheque_amount,
            sb_payment_2nd_insurance_cheque_amount, sb_payment_3rd_insurance_cheque_amount,
            sb_payment_refund_amount, sb_payment_method, sb_payment_type, sb_payment_status,
            sb_payment_referring_no, sb_payment_note, sb_deleted_status, sb_clinic_name,
            sb_date_created, sb_debugging_column, sb_no_insur_fp, UserLoginName, BadDebtAmount
          FROM sb_payment_history
          WHERE ${getRetainedClinicsFilter('sb_clinic_name')}
          ORDER BY sb_payment_history_key
          OFFSET @offset ROWS
          FETCH NEXT @batchSize ROWS ONLY
        `);

      const batch = [];
      for (const row of result.recordset) {
        try {
          const clientKey = getClientKeyById(row.sb_client_id);

          if (!clientKey) {
            console.warn(`  ⚠️  Skipping payment ${row.sb_payment_number} - client not found: ${row.sb_client_id}`);
            failedCount++;
            continue;
          }

          const clientName = getClientNameById(row.sb_client_id);
          const payment = transformPaymentRow(row, clientKey, clientName);
          batch.push(payment);
        } catch (error) {
          console.error(`  ⚠️  Failed to transform payment ${row.sb_payment_history_key}:`, error);
          progress.recordError(offset, `Transform error: ${error}`, { paymentKey: row.sb_payment_history_key });
          failedCount++;
        }
      }

      if (batch.length > 0) {
        try {
          // Use raw MongoDB driver to bypass Mongoose validation issues
          const rawCollection = mongoConn.db!.collection('payments');
          const result = await rawCollection.insertMany(batch, { ordered: false });
          migratedCount += result.insertedCount;
          console.log(`  ✅ Inserted ${result.insertedCount} payments (Total: ${migratedCount.toLocaleString()})`);
        } catch (error: any) {
          if (error.writeErrors) {
            const successCount = batch.length - error.writeErrors.length;
            migratedCount += successCount;
            failedCount += error.writeErrors.length;
            console.log(`  ⚠️  Partial success: ${successCount}/${batch.length} inserted`);
            for (const writeError of error.writeErrors) {
              progress.recordError(offset + writeError.index, writeError.errmsg);
            }
          } else {
            console.error('  ❌ Batch insert failed:', error);
            failedCount += batch.length;
          }
        }
      }

      offset += BATCH_SIZE;
      
      progress.updateProgress(batch.length, offset);
      await progress.save();

      const percentage = ((offset / totalRecords) * 100).toFixed(2);
      console.log(`  📈 Progress: ${percentage}% complete`);
      
      if (progress.metadata?.estimatedCompletion) {
        const eta = new Date(progress.metadata.estimatedCompletion);
        console.log(`  ⏱️  ETA: ${eta.toLocaleTimeString()}`);
      }
    }

    progress.status = 'completed';
    progress.endTime = new Date();
    await progress.save();

    console.log('\n' + '='.repeat(70));
    console.log('✅ PAYMENTS MIGRATION COMPLETE');
    console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`   Migrated: ${migratedCount.toLocaleString()}`);
    console.log(`   Failed: ${failedCount.toLocaleString()}`);
    console.log(`   Duration: ${Math.round((progress.endTime.getTime() - progress.startTime.getTime()) / 1000)}s`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Payments migration failed:', error);
    const progress = await MigrationProgress.findOne({ tableName: 'sb_payment_history' });
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

function transformPaymentRow(row: any, clientKey: number, clientName: string): any {
  const paymentNumber = trimString(row.sb_payment_number) || generatePaymentId();
  const paymentMethod = mapPaymentMethod(row.sb_payment_method);
  const paymentType = mapPaymentType(row.sb_payment_type);
  const status = mapPaymentStatus(row.sb_payment_status);

  return {
    paymentNumber,
    paymentId: paymentNumber,
    orderNumber: trimString(row.sb_order_number),
    clientId: clientKey,
    clientName, // D9 fix: populated from client lookup instead of empty string
    clinicName: trimString(row.sb_clinic_name),
    paymentDate: toDate(row.sb_payment_date) || new Date(),
    paymentMethod,
    paymentType,
    status,
    amounts: {
      totalPaymentAmount: toNumber(row.sb_payment_total_payment_amount),
      totalPaid: toNumber(row.sb_payment_total_paid),
      totalOwed: toNumber(row.sb_payment_total_owed),
      popAmount: toNumber(row.sb_payment_POP_amount),
      popfpAmount: toNumber(row.sb_payment_POPFP_amount),
      dpaAmount: toNumber(row.sb_payment_DPA_amount),
      dpafpAmount: toNumber(row.sb_payment_DPAFP_amount),
      cob1Amount: toNumber(row.sb_payment_COB_1_amount),
      cob2Amount: toNumber(row.sb_payment_COB_2_amount),
      // D7 fix: 3rd insurance/COB amounts intentionally NOT migrated per requirements
      // "Remove 3rd Insurance Column" and "Remove Co-pay (Ins. 3)"
      cob3Amount: 0,
      insurance1stAmount: toNumber(row.sb_payment_1st_insurance_cheque_amount),
      insurance2ndAmount: toNumber(row.sb_payment_2nd_insurance_cheque_amount),
      insurance3rdAmount: 0, // D7 fix: 3rd insurance not migrated
      refundAmount: toNumber(row.sb_payment_refund_amount),
      salesRefundAmount: toNumber(row.sb_payment_SALESREFUND_amount),
      writeoffAmount: toNumber(row.sb_payment_WRITEOFF_amount),
      noInsurFpAmount: toNumber(row.sb_no_insur_fp),
      badDebtAmount: toNumber(row.BadDebtAmount)
    },
    referringNo: trimString(row.sb_payment_referring_no),
    notes: trimString(row.sb_payment_note),
    deletedStatus: trimString(row.sb_deleted_status),
    userLoginName: trimString(row.UserLoginName),
    debuggingColumn: trimString(row.sb_debugging_column),
    createdAt: toDate(row.sb_date_created) || new Date(),
    updatedAt: new Date()
  };
}

// D10 fix: Comprehensive payment method mapping based on verified MSSQL distinct values
function mapPaymentMethod(method: string): PaymentMethod {
  const methodStr = trimString(method).toLowerCase();

  // Credit cards (VISA, MasterCard, American Express, Discover Card)
  if (methodStr === 'visa' || methodStr === 'mastercard' || methodStr === 'master card') {return PaymentMethod.CREDIT_CARD;}
  if (methodStr === 'american express' || methodStr === 'amex') {return PaymentMethod.CREDIT_CARD;}
  if (methodStr === 'discover card' || methodStr === 'discover') {return PaymentMethod.CREDIT_CARD;}
  if (methodStr.includes('credit')) {return PaymentMethod.CREDIT_CARD;}

  // Debit (INTERACT is Interac debit in Canada)
  if (methodStr === 'interact' || methodStr === 'interac') {return PaymentMethod.DEBIT;}
  if (methodStr.includes('debit')) {return PaymentMethod.DEBIT;}

  // Cash
  if (methodStr === 'cash') {return PaymentMethod.CASH;}

  // Cheque variants
  if (methodStr === 'cheque' || methodStr === 'check') {return PaymentMethod.CHEQUE;}
  if (methodStr === 'cheque payment') {return PaymentMethod.CHEQUE;}
  if (methodStr === 'security cheque') {return PaymentMethod.CHEQUE;}

  // Insurance / DPA (Direct Payment Authorization)
  if (methodStr === 'direct payment authorization' || methodStr === 'dpa') {return PaymentMethod.INSURANCE;}
  if (methodStr === 'dpafp') {return PaymentMethod.INSURANCE;}
  if (methodStr === 'popfp') {return PaymentMethod.OTHER;}

  // Mailed payments (typically cheques sent by mail)
  if (methodStr === 'mailed') {return PaymentMethod.CHEQUE;}

  // None / empty
  if (methodStr === 'none' || methodStr === '') {return PaymentMethod.OTHER;}

  return PaymentMethod.OTHER;
}

// D11 fix: Payment type mapping based on verified MSSQL sb_payment_type values
// MSSQL stores descriptive text, not technical codes
function mapPaymentType(type: string): PaymentType {
  const typeStr = trimString(type).toLowerCase();

  // Insurance Payment -> DPA (Direct Payment Authorization from insurance)
  if (typeStr === 'insurance payment') {return PaymentType.DPA;}

  // Make Payment -> POP (Patient Out of Pocket)
  if (typeStr === 'make payment') {return PaymentType.POP;}

  // REFUND PAYMENT -> SALES_REFUND
  if (typeStr === 'refund payment') {return PaymentType.SALES_REFUND;}

  // Bad Debt -> WRITEOFF
  if (typeStr === 'bad debt') {return PaymentType.WRITEOFF;}

  // Cheque (as a type) -> POP (patient paying by cheque is still out-of-pocket)
  if (typeStr === 'cheque') {return PaymentType.POP;}

  // UNREFUND -> SALES_REFUND (reversal of a refund)
  if (typeStr === 'unrefund') {return PaymentType.SALES_REFUND;}

  // Technical code fallbacks (for any data that already uses codes)
  const upperStr = typeStr.toUpperCase();
  if (upperStr === 'POPFP') {return PaymentType.POPFP;}
  if (upperStr === 'DPAFP') {return PaymentType.DPAFP;}
  if (upperStr === 'COB_1') {return PaymentType.COB_1;}
  if (upperStr === 'COB_2') {return PaymentType.COB_2;}
  if (upperStr.includes('WRITEOFF')) {return PaymentType.WRITEOFF;}

  return PaymentType.POP;
}

// D12 fix: Payment status mapping with correct ordering
// Critical fix: check 'partial' BEFORE 'paid' to prevent "Partial Paid" matching "paid" first
function mapPaymentStatus(status: string): PaymentStatus {
  const statusStr = trimString(status).toLowerCase();

  if (!statusStr) {return PaymentStatus.PENDING;}

  // Check partial FIRST (before paid) -- "Partial Paid" must match partial, not paid
  if (statusStr.includes('partial')) {return PaymentStatus.PARTIAL;}

  // Final Paid -> COMPLETED
  if (statusStr === 'final paid' || statusStr === 'finalpaid') {return PaymentStatus.COMPLETED;}
  // Generic "paid" only after partial is ruled out
  if (statusStr === 'paid') {return PaymentStatus.COMPLETED;}

  // Bad debt -> WRITEOFF (not PENDING)
  if (statusStr.includes('bad debt')) {return PaymentStatus.WRITEOFF;}

  // Refund statuses
  if (statusStr.includes('refund') && !statusStr.includes('writeoff')) {return PaymentStatus.REFUNDED;}

  // WriteOff statuses (Pending WriteOff, Pending WriteOff 1, etc.)
  if (statusStr.includes('writeoff') || statusStr.includes('write off')) {return PaymentStatus.WRITEOFF;}

  // Completed
  if (statusStr.includes('completed')) {return PaymentStatus.COMPLETED;}

  // Failed
  if (statusStr.includes('failed')) {return PaymentStatus.FAILED;}

  // DPA to POP transitions and other complex statuses -> PENDING
  if (statusStr.includes('from dpa') || statusStr.includes('to pop')) {return PaymentStatus.PENDING;}

  // Unpaid
  if (statusStr.includes('unpaid')) {return PaymentStatus.PENDING;}

  return PaymentStatus.PENDING;
}

if (require.main === module) {
  migratePayments()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migratePayments };
