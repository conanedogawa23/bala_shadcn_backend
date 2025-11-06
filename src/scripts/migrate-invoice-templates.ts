import mongoose from 'mongoose';
import { InvoiceTemplateModel } from '../models/InvoiceTemplate';

/**
 * Default HTML templates based on InvoiceTemplate.tsx component
 */
const DEFAULT_HTML_TEMPLATES = {
  header: `
<div class="invoice-header">
  <div class="clinic-branding">
    {{#if clinicLogo}}
    <img src="{{clinicLogo}}" alt="{{clinicName}}" class="clinic-logo" />
    {{/if}}
    <div class="clinic-name">{{clinicDisplayName}}</div>
  </div>
  <div class="clinic-info">
    <p class="clinic-full-name">{{clinicName}}</p>
    <p>{{clinicAddress}}</p>
    <p>{{clinicCity}}, {{clinicProvince}} {{clinicPostalCode}}</p>
    {{#if clinicPhone}}<p>T: {{clinicPhone}}</p>{{/if}}
    {{#if clinicFax}}<p>F: {{clinicFax}}</p>{{/if}}
  </div>
  <div class="invoice-title">
    <h1>INVOICE</h1>
  </div>
  <div class="invoice-meta">
    <div class="invoice-details">
      <p><span class="label">Payment No.</span>{{paymentNumber}}</p>
      <p><span class="label">Customer Name:</span>{{clientName}}</p>
      <p><span class="label">Address:</span>{{clientAddress}}</p>
    </div>
    <div class="invoice-dates">
      <p>Date: {{invoiceDate}}</p>
      <p>Referring No: {{referringNo}}</p>
    </div>
  </div>
</div>`,

  clientInfo: `
<div class="client-info-section">
  <h3>Bill To:</h3>
  <div class="client-details">
    <p class="client-name">{{clientName}}</p>
    <p>{{clientAddress}}</p>
    <p>{{clientCity}}, {{clientProvince}} {{clientPostalCode}}</p>
  </div>
</div>`,

  serviceTable: `
<table class="service-table">
  <thead>
    <tr>
      <th>PAYMENT TYPE</th>
      <th class="text-right">AMOUNT</th>
      <th class="text-center">DATE</th>
    </tr>
  </thead>
  <tbody>
    {{#each services}}
    <tr>
      <td>{{description}}</td>
      <td class="text-right">{{currencySymbol}}{{amount}}</td>
      <td class="text-center">{{serviceDate}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`,

  totals: `
<div class="totals-section">
  <div class="total-line">
    <span class="total-label">Total:</span>
    <span class="total-amount">{{currencySymbol}}{{totalAmount}}</span>
  </div>
  <div class="paid-line">
    <span class="paid-label">Paid:</span>
    <span class="paid-amount">{{currencySymbol}}{{paidAmount}}</span>
  </div>
  <div class="outstanding-line">
    <span class="outstanding-label">Outstanding:</span>
    <span class="outstanding-amount">{{currencySymbol}}{{outstandingAmount}}</span>
  </div>
</div>`,

  footer: `
<div class="invoice-footer">
  <div class="payment-details">
    <p>Total Amount: {{currencySymbol}}{{totalAmount}}</p>
    <p>Amount Paid: {{currencySymbol}}{{paidAmount}}</p>
    <p>Amount Due: {{currencySymbol}}{{outstandingAmount}}</p>
    <p>Payment Date: {{paymentDate}}</p>
    <p>Payment Method: {{paymentMethod}}</p>
  </div>
  <div class="signature-section">
    <p class="signature-label">Signed:</p>
    <div class="signature-line"></div>
  </div>
  {{#if footerMessage}}
  <div class="footer-message">
    <p>{{footerMessage}}</p>
  </div>
  {{/if}}
</div>`,

  paymentBreakdown: `
<table class="payment-breakdown-table">
  <thead>
    <tr>
      <th>PAYMENT TYPE</th>
      <th class="text-right">AMOUNT</th>
      <th class="text-center">DATE</th>
    </tr>
  </thead>
  <tbody>
    {{#if popAmount}}
    <tr>
      <td>Patient Out of Pocket (POP)</td>
      <td class="text-right">{{currencySymbol}}{{popAmount}}</td>
      <td class="text-center">-</td>
    </tr>
    {{/if}}
    {{#if dpaAmount}}
    <tr>
      <td>Direct Payment Authorization (DPA)</td>
      <td class="text-right">{{currencySymbol}}{{dpaAmount}}</td>
      <td class="text-center">-</td>
    </tr>
    {{/if}}
    {{#if insurance1stAmount}}
    <tr>
      <td>Insurance (Primary)</td>
      <td class="text-right">{{currencySymbol}}{{insurance1stAmount}}</td>
      <td class="text-center">-</td>
    </tr>
    {{/if}}
  </tbody>
</table>`
};

/**
 * Get clinic-specific styling configuration
 */
function getClinicStyling(clinicName: string) {
  const isBodyBliss = clinicName.toLowerCase().includes('bodybliss');
  
  return {
    fonts: {
      header: {
        family: 'Helvetica',
        size: isBodyBliss ? 24 : 20,
        weight: isBodyBliss ? 'light' : 'bold',
        color: isBodyBliss ? '#4A5568' : '#0066CC'
      },
      body: {
        family: 'Helvetica',
        size: 10,
        weight: 'normal',
        color: '#333333'
      },
      footer: {
        family: 'Helvetica',
        size: 9,
        weight: 'normal',
        color: '#666666'
      },
      tableHeader: {
        family: 'Helvetica-Bold',
        size: 10,
        weight: 'bold',
        color: '#000000'
      },
      total: {
        family: 'Helvetica-Bold',
        size: 14,
        weight: 'bold',
        color: '#000000'
      }
    },
    colors: {
      primary: isBodyBliss ? '#4A5568' : '#0066CC',
      secondary: '#666666',
      text: '#333333',
      accent: isBodyBliss ? '#A0AEC0' : '#FF6600',
      border: '#000000',
      background: '#FFFFFF'
    },
    layout: {
      margins: {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50
      },
      pageSize: 'letter' as const,
      headerHeight: 150,
      footerHeight: 100,
      lineHeight: 1.5
    }
  };
}

/**
 * Migrate existing invoice templates with enhanced structure
 */
async function migrateInvoiceTemplates() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/visio';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB (visio database)');

    // Fetch existing templates from the native collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const existingTemplates = await db
      .collection('invoice_templates')
      .find({})
      .toArray();

    console.log(`Found ${existingTemplates.length} existing templates`);

    let successCount = 0;
    let errorCount = 0;

    for (const template of existingTemplates) {
      try {
        console.log(`\nProcessing template for ${template.clinicName}...`);

        // Get clinic-specific styling
        const styling = getClinicStyling(template.clinicDisplayName || template.clinicName);

        // Check if enhanced template already exists
        const existingEnhanced = await InvoiceTemplateModel.findOne({ 
          clinicId: template.clinicId 
        });

        const enhancedTemplate = {
          clinicId: template.clinicId,
          clinicName: template.clinicName,
          displayName: template.clinicDisplayName || template.clinicName,
          address: template.clinicAddress || '',
          city: template.clinicCity || '',
          province: template.clinicProvince || 'Ontario',
          postalCode: template.clinicPostalCode || '',
          phone: template.phone || '',
          fax: template.fax || '',
          invoicePrefix: template.invoiceNumberPrefix || 'INV',
          invoiceNumberFormat: template.invoiceNumberFormat || '{{prefix}}-{{year}}-{{sequence}}',
          taxRate: template.taxRate || 13,
          currency: template.currency || 'CAD',
          currencySymbol: template.currencySymbol || '$',
          paymentTerms: template.paymentTerms || 'Due within 30 days',
          paymentMethods: template.paymentMethods || ['Cash', 'Credit Card', 'Debit', 'Check'],
          styling: styling,
          htmlTemplates: DEFAULT_HTML_TEMPLATES,
          isActive: template.isActive !== false,
          version: '1.0.0'
        };

        if (existingEnhanced) {
          // Update existing enhanced template
          await InvoiceTemplateModel.updateOne(
            { clinicId: template.clinicId },
            { $set: enhancedTemplate }
          );
          console.log(`✓ Updated enhanced template for ${template.clinicName}`);
        } else {
          // Create new enhanced template
          await InvoiceTemplateModel.create(enhancedTemplate);
          console.log(`✓ Created enhanced template for ${template.clinicName}`);
        }

        console.log(`  - Clinic ID: ${template.clinicId}`);
        console.log(`  - Display Name: ${enhancedTemplate.displayName}`);
        console.log(`  - Invoice Prefix: ${enhancedTemplate.invoicePrefix}`);
        console.log(`  - Tax Rate: ${enhancedTemplate.taxRate}%`);
        
        successCount++;
      } catch (error) {
        console.error(`✗ Error processing template for ${template.clinicName}:`, error);
        errorCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`✓ Success: ${successCount}`);
    console.log(`✗ Errors: ${errorCount}`);
    console.log(`Total: ${existingTemplates.length}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  migrateInvoiceTemplates()
    .then(() => {
      console.log('\n✓ Template migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Template migration failed:', error);
      process.exit(1);
    });
}

export { migrateInvoiceTemplates };

