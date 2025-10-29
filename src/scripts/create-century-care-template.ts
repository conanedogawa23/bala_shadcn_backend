import mongoose from 'mongoose';
import { InvoiceTemplateModel } from '../models/InvoiceTemplate';

/**
 * HTML templates for Century Care (same as other clinics)
 */
const HTML_TEMPLATES = {
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
 * Century Care styling configuration (traditional blue header style)
 */
const CENTURY_CARE_STYLING = {
  fonts: {
    header: {
      family: 'Helvetica',
      size: 20,
      weight: 'bold',
      color: '#0066CC'
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
    primary: '#0066CC',
    secondary: '#666666',
    text: '#333333',
    accent: '#FF6600',
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

/**
 * Create Century Care invoice template
 */
async function createCenturyCareTemplate() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/visio';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB (visio database)');

    // Check if Century Care template already exists
    const existingTemplate = await InvoiceTemplateModel.findOne({ 
      clinicId: 21 
    });

    if (existingTemplate) {
      console.log('⚠ Century Care template already exists. Updating...');
      
      const updatedTemplate = await InvoiceTemplateModel.updateOne(
        { clinicId: 21 },
        {
          $set: {
            clinicName: 'century-care',
            displayName: 'Century Care',
            address: '1315 Derry Road East, Unit4,2F',
            city: 'Mississauga',
            province: 'Ontario',
            postalCode: 'L5T 1B6',
            phone: '905-817-8170',
            fax: '905-XXX-XXXX',
            invoicePrefix: 'CC',
            invoiceNumberFormat: 'CC-{{year}}-{{sequence}}',
            taxRate: 13,
            currency: 'CAD',
            currencySymbol: '$',
            paymentTerms: 'Due within 30 days',
            paymentMethods: ['Cash', 'Credit Card', 'Debit', 'Check', 'Bank Transfer'],
            styling: CENTURY_CARE_STYLING,
            htmlTemplates: HTML_TEMPLATES,
            isActive: true,
            version: '1.0.0'
          }
        }
      );
      
      console.log('✓ Century Care template updated successfully');
      console.log(`  - Modified Count: ${updatedTemplate.modifiedCount}`);
    } else {
      // Create new template
      const centuryCareTemplate = await InvoiceTemplateModel.create({
        clinicId: 21,
        clinicName: 'century-care',
        displayName: 'Century Care',
        address: '1315 Derry Road East, Unit4,2F',
        city: 'Mississauga',
        province: 'Ontario',
        postalCode: 'L5T 1B6',
        phone: '905-817-8170',
        fax: '905-XXX-XXXX',
        invoicePrefix: 'CC',
        invoiceNumberFormat: 'CC-{{year}}-{{sequence}}',
        taxRate: 13,
        currency: 'CAD',
        currencySymbol: '$',
        paymentTerms: 'Due within 30 days',
        paymentMethods: ['Cash', 'Credit Card', 'Debit', 'Check', 'Bank Transfer'],
        styling: CENTURY_CARE_STYLING,
        htmlTemplates: HTML_TEMPLATES,
        isActive: true,
        version: '1.0.0'
      });

      console.log('✓ Century Care template created successfully');
      console.log(`  - Template ID: ${centuryCareTemplate._id}`);
    }

    console.log('\n=== Century Care Template Details ===');
    console.log('Clinic ID: 21');
    console.log('Clinic Name: century-care');
    console.log('Display Name: Century Care');
    console.log('Address: 1315 Derry Road East, Unit4,2F');
    console.log('City: Mississauga, ON L5T 1B6');
    console.log('Phone: 905-817-8170');
    console.log('Invoice Prefix: CC');
    console.log('Tax Rate: 13%');
    console.log('Status: Active');

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
  createCenturyCareTemplate()
    .then(() => {
      console.log('\n✓ Century Care template creation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Century Care template creation failed:', error);
      process.exit(1);
    });
}

export { createCenturyCareTemplate };

