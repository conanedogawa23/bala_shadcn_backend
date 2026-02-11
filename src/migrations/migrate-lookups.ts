import { getMSSQLConnection, closeMSSQLConnection, RETAINED_CLINICS, isRetainedClinic } from './utils/mssql-connection';
import { getMigrationConnection, closeMigrationConnection } from './utils/mongodb-connection';
import { trimString, toNumber, toDate } from './utils/transform-helpers';
import { ClinicModel } from '../models/Clinic';
import Product from '../models/Product';
import { ResourceModel } from '../models/Resource';
import { CategoryModel } from '../models/Categories';

// Product codes to mark as discontinued per client requirements (visio_req.md)
const DISCONTINUED_PRODUCT_CODES = new Set([
  'AC', 'AC50', 'AC60', 'AC80', 'ALLE', 'ANX', 'ARTH', 'BNP',
  'BPH', 'CANPREV5HTP', 'CANPREVALA', 'CANPREVEP', 'CANPREVHH',
  'CANPREVHL', 'CANPREVIBS', 'CANPREVNEM', 'CANPREVPP', 'CANPREVTP',
  'CFOS', 'CHRF', 'CHS', 'CP', 'DeeP1', 'DLA300', 'DLFC', 'DLGMCM',
  'DLIG', 'DLLIV', 'DLMC', 'DLPSP', 'DLQ', 'DLTQ', 'DLTS', 'DLUPRO',
  'EVCO', 'HB', 'HC', 'IND', 'INS', 'LB01', 'LB02', 'LB03', 'LBCOS',
  'LCKK', 'LFB219', 'LS', 'ME', 'MenoPrev', 'MI', 'MIG00', 'MIG01',
  'MIG02', 'MIG03', 'MIG24', 'MIGM0', 'MIGSG', 'MIGTR',
  'NATser', 'NATser125', 'NATser140', 'NATser180', 'NATser25', 'NATser250',
  'NATser30', 'NATSer49', 'NATser80',
  'NSA', 'NSAUT', 'NSBA', 'NSFV1', 'NSFV10', 'NSFV15', 'NSFV20',
  'NSFV30', 'NSFV45', 'NSFV5', 'NSIV1', 'NSIV30', 'NSMR', 'NSU',
  'OCF63', 'OS', 'OS135', 'OS200', 'OSTAS', 'OSTT30', 'OSTT45', 'OSTT60',
  'PEB12', 'PEEX', 'PEHE', 'PELG', 'PELGD', 'PEOB', 'PEP', 'PEPB', 'PEV',
  'PM', 'PR1', 'PR2', 'SC', 'SFH', 'SFHCGS', 'SFHEDI', 'SH01', 'SHCOS',
  'SlimPro', 'UL', 'WH', 'WM', 'WSVB100', 'WSVB9995'
]);

// Map numeric MSSQL sb_category IDs to ProductCategory enum values
// MSSQL categories table: 1=Main, 2=Duncan Mill, 3=BodyBliss, 4=Bioform, 5=OOA, 6=Markham
// Product model enum: physiotherapy, orthotic, massage, consultation, assessment, treatment, device, medication, therapy
function mapProductCategory(categoryId: number): string {
  // These are clinic-based categories in MSSQL, not product-type categories.
  // Default to 'therapy' as the most general match.
  return 'therapy';
}

// Map MSSQL product type string to a valid type for the Product model
function mapProductType(productType: string): string {
  const pt = trimString(productType).toLowerCase();
  if (pt.includes('physio')) return 'physiotherapy';
  if (pt.includes('orthotic') || pt.includes('ortho')) return 'orthotic_service';
  if (pt.includes('massage')) return 'massage';
  if (pt.includes('assess')) return 'assessment';
  if (pt.includes('consult')) return 'consultation';
  if (pt.includes('device')) return 'device';
  // Default to a generic service type
  return 'SERVICE';
}

async function migrateClinicLookup(): Promise<void> {
  console.log('\n-- Migrating Clinics...');
  
  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const result = await mssqlConn.request().query(`
    SELECT 
      ClinicId, ClinicName, ClinicAddress, City, Province, PostalCode,
      DateCreated, DateModified, CompleteName
    FROM sb_clinic
  `);

  const Clinic = mongoConn.model('Clinic', ClinicModel.schema);
  let migratedCount = 0;
  let skippedCount = 0;

  for (const row of result.recordset) {
    const clinicNameTrimmed = trimString(row.ClinicName);

    if (!isRetainedClinic(clinicNameTrimmed)) {
      skippedCount++;
      continue;
    }

    try {
      // Write to actual Clinic schema fields (name, displayName, address nested object)
      // NOT the virtual-backed flat fields (clinicName, clinicAddress, city, etc.)
      await Clinic.findOneAndUpdate(
        { clinicId: row.ClinicId },
        {
          clinicId: row.ClinicId,
          name: clinicNameTrimmed,
          displayName: trimString(row.CompleteName) || clinicNameTrimmed,
          address: {
            street: trimString(row.ClinicAddress),
            city: trimString(row.City),
            province: trimString(row.Province),
            postalCode: trimString(row.PostalCode)
          },
          isRetainedClinic: true,
          dateCreated: toDate(row.DateCreated) || new Date(),
          dateModified: toDate(row.DateModified) || new Date()
        },
        { upsert: true, new: true }
      );
      migratedCount++;
    } catch (error) {
      console.error(`  [ERROR] Failed to migrate clinic ${row.ClinicId}:`, error);
    }
  }

  console.log(`  [OK] Migrated ${migratedCount} clinics (skipped ${skippedCount} non-retained)`);
}

async function migrateProductLookup(): Promise<void> {
  console.log('\n-- Migrating Products...');
  
  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const result = await mssqlConn.request().query(`
    SELECT 
      sb_product_key, sb_category, sb_product_name, sb_product_description,
      sb_product_unit_price, sb_product_type
    FROM sb_Product
  `);

  // Use default export Product model
  const ProductModel = mongoConn.model('Product', Product.schema);
  let migratedCount = 0;
  let discontinuedCount = 0;

  for (const row of result.recordset) {
    try {
      const productName = trimString(row.sb_product_name);
      const isDiscontinuedProduct = DISCONTINUED_PRODUCT_CODES.has(productName);

      if (isDiscontinuedProduct) {
        discontinuedCount++;
      }

      await ProductModel.findOneAndUpdate(
        { productKey: row.sb_product_key },
        {
          productKey: row.sb_product_key,
          // Map numeric category ID to enum string
          category: mapProductCategory(row.sb_category),
          name: productName,
          description: trimString(row.sb_product_description),
          // Correct field name: 'price' (not 'unitPrice')
          price: toNumber(row.sb_product_unit_price),
          // Correct field name: 'type' (not 'productType')
          type: mapProductType(row.sb_product_type),
          isActive: !isDiscontinuedProduct,
          isDiscontinued: isDiscontinuedProduct
        },
        { upsert: true, new: true }
      );
      migratedCount++;
    } catch (error) {
      console.error(`  [ERROR] Failed to migrate product ${row.sb_product_key}:`, error);
    }
  }

  console.log(`  [OK] Migrated ${migratedCount} products (${discontinuedCount} marked discontinued)`);
}

async function migrateResourceLookup(): Promise<void> {
  console.log('\n-- Migrating Resources...');
  
  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const result = await mssqlConn.request().query(`
    SELECT ResourceID, ResourceName, Color
    FROM Resources
  `);

  const Resource = mongoConn.model('Resource', ResourceModel.schema);
  let migratedCount = 0;

  for (const row of result.recordset) {
    try {
      await Resource.findOneAndUpdate(
        { resourceId: row.ResourceID },
        {
          resourceId: row.ResourceID,
          resourceName: trimString(row.ResourceName),
          // Fix: type is required, default to 'practitioner' (MSSQL Resources are primarily practitioners)
          type: 'practitioner',
          // Fix: color must be a String, not a number
          color: String(row.Color || '')
        },
        { upsert: true, new: true }
      );
      migratedCount++;
    } catch (error) {
      console.error(`  [ERROR] Failed to migrate resource ${row.ResourceID}:`, error);
    }
  }

  console.log(`  [OK] Migrated ${migratedCount} resources`);
}

async function migrateCategoriesLookup(): Promise<void> {
  console.log('\n-- Migrating Categories...');
  
  const mssqlConn = await getMSSQLConnection();
  const mongoConn = await getMigrationConnection();

  const result = await mssqlConn.request().query(`
    SELECT category_id, category_name, category_image
    FROM categories
  `);

  // Correct import name: CategoryModel (not CategoriesModel)
  const Categories = mongoConn.model('Category', CategoryModel.schema);
  let migratedCount = 0;

  for (const row of result.recordset) {
    try {
      await Categories.findOneAndUpdate(
        { categoryId: row.category_id },
        {
          categoryId: row.category_id,
          categoryName: trimString(row.category_name)
          // Note: categoryParentId and categoryOrder are NOT in the Categories schema
          // and will be silently discarded by Mongoose strict mode
        },
        { upsert: true, new: true }
      );
      migratedCount++;
    } catch (error) {
      console.error(`  [ERROR] Failed to migrate category ${row.category_id}:`, error);
    }
  }

  console.log(`  [OK] Migrated ${migratedCount} categories`);
}

async function migrateLookupTables(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('LOOKUP TABLES MIGRATION');
  console.log('='.repeat(70));

  try {
    await migrateClinicLookup();
    await migrateProductLookup();
    await migrateResourceLookup();
    await migrateCategoriesLookup();

    console.log('\n' + '='.repeat(70));
    console.log('[OK] Lookup tables migration complete!');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n[ERROR] Lookup tables migration failed:', error);
    throw error;
  } finally {
    await closeMSSQLConnection();
    await closeMigrationConnection();
  }
}

if (require.main === module) {
  migrateLookupTables()
    .then(() => {
      console.log('[OK] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[ERROR] Migration failed:', error);
      process.exit(1);
    });
}

export { migrateLookupTables };
