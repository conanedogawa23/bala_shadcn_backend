import Order from '../models/Order';
import mongoose from 'mongoose';

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  clinicName: string;
  clinicAddress: string;
  clinicCity: string;
  clinicProvince: string;
  clinicPostalCode: string;
  clinicPhone: string;
  clinicFax: string;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientProvince: string;
  clientPostalCode: string;
  items: Array<{
    productCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    serviceDate: string;
  }>;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  currencySymbol: string;
}

export class InvoiceService {
  /**
   * Generate HTML invoice based on order data
   */
  static async generateInvoiceHtml(invoiceData: InvoiceData): Promise<string> {
    // Route to clinic-specific template based on clinic name
    switch (invoiceData.clinicName.toLowerCase()) {
    case 'century care':
      return this.generateCenturyCareInvoice(invoiceData);
    case 'ortholine duncan mills':
    case 'ortholine-duncan-mills':
      return this.generateOrtholineInvoice(invoiceData);
    case 'bodybliss one care':
    case 'bodybliss-onecare':
      return this.generateBodyBlissOneCareInvoice(invoiceData);
    case 'bodybliss physiotherapy':
    case 'bodyblissphysio':
      return this.generateBodyBlissPhysioInvoice(invoiceData);
    case 'my cloud':
    case 'my-cloud':
      return this.generateMyCloudInvoice(invoiceData);
    case 'physio bliss':
    case 'physio-bliss':
      return this.generatePhysioBlissInvoice(invoiceData);
    default:
      return this.generateCenturyCareInvoice(invoiceData);
    }
  }

  // ===== CENTURY CARE TEMPLATE =====
  private static generateCenturyCareInvoice(invoiceData: InvoiceData): string {
    const itemsHtml = invoiceData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ccc;">${this.escapeHtml(item.description)}</td>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoiceData.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #333; background: #fff; padding: 40px; }
          .invoice-container { max-width: 900px; margin: 0 auto; background: white; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
          .clinic-logo { font-size: 28px; font-weight: bold; color: #000; width: 40%; }
          .clinic-details { text-align: right; font-size: 12px; line-height: 1.6; width: 50%; }
          .clinic-details div { margin-bottom: 4px; }
          .invoice-meta { display: flex; justify-content: space-between; margin-bottom: 30px; align-items: flex-start; }
          .invoice-title { font-size: 24px; font-weight: bold; flex: 1; }
          .invoice-right { text-align: right; flex: 1; }
          .invoice-number { font-size: 18px; margin-bottom: 10px; font-weight: bold; }
          .invoice-date { font-size: 14px; margin-bottom: 10px; }
          .total-amount { font-size: 36px; font-weight: bold; color: #000; margin-top: 10px; }
          .customer-section { margin-bottom: 30px; }
          .customer-name { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
          .customer-address { font-size: 12px; line-height: 1.5; }
          .items-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          .items-table thead { background-color: #000; color: white; }
          .items-table th { padding: 12px; text-align: left; font-weight: bold; font-size: 13px; }
          .items-table td { padding: 10px; border: 1px solid #ccc; font-size: 13px; }
          .items-table tr:last-child td { border-bottom: 2px solid #000; }
          .summary-section { width: 100%; margin-top: 20px; }
          .summary-row { display: flex; justify-content: flex-end; margin-bottom: 12px; font-size: 13px; }
          .summary-label { width: 200px; font-weight: bold; text-align: left; }
          .summary-value { width: 120px; text-align: right; }
          .total-row { border-top: 1px solid #ccc; border-bottom: 2px solid #000; padding-top: 8px; padding-bottom: 8px; font-weight: bold; font-size: 14px; }
          .amount-paid-row { border-bottom: 1px solid #ccc; padding-top: 8px; padding-bottom: 8px; }
          .balance-row { border-bottom: 2px solid #000; padding-top: 8px; padding-bottom: 8px; font-weight: bold; }
          .footer { margin-top: 40px; font-size: 12px; }
          .footer-line { margin-bottom: 15px; }
          .footer-label { font-weight: bold; display: inline-block; width: 200px; }
          .footer-input { border-bottom: 1px solid #000; display: inline-block; width: 300px; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="clinic-logo">${this.escapeHtml(invoiceData.clinicName)}</div>
            <div class="clinic-details">
              <div>${this.escapeHtml(invoiceData.clinicAddress)}</div>
              <div>${this.escapeHtml(invoiceData.clinicCity)}, ${this.escapeHtml(invoiceData.clinicProvince)}</div>
              <div>${this.escapeHtml(invoiceData.clinicPostalCode)}</div>
              <div>${this.escapeHtml(invoiceData.clinicPhone)}</div>
            </div>
          </div>
          <div class="invoice-meta">
            <div class="invoice-title"></div>
            <div class="invoice-right">
              <div class="invoice-number">INVOICE #${this.escapeHtml(invoiceData.invoiceNumber)}</div>
              <div class="invoice-date">DATE:${invoiceData.invoiceDate}</div>
              <div class="total-amount">${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
            </div>
          </div>
          <div class="customer-section">
            <div class="customer-name">${this.escapeHtml(invoiceData.clientName)}</div>
            <div class="customer-address">
              ${this.escapeHtml(invoiceData.clientAddress)}<br>
              ${this.escapeHtml(invoiceData.clientCity)}, ${this.escapeHtml(invoiceData.clientProvince)} ${this.escapeHtml(invoiceData.clientPostalCode)}
            </div>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item / Item Description</th>
                <th style="text-align: center;">QTY</th>
                <th style="text-align: right;">Unit Cost</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="summary-section">
            <div class="summary-row total-row">
              <span class="summary-label">TOTAL</span>
              <span class="summary-value">${invoiceData.currencySymbol}${invoiceData.subtotal.toFixed(2)}</span>
            </div>
            <div class="summary-row amount-paid-row">
              <span class="summary-label">AMOUNT PAID</span>
              <span class="summary-value">${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</span>
            </div>
            <div class="summary-row balance-row">
              <span class="summary-label">BALANCE</span>
              <span class="summary-value">${invoiceData.currencySymbol}$0.00</span>
            </div>
          </div>
          <div class="footer">
            <div class="footer-line">
              <span class="footer-label">DATE DISPENSED:</span>
              <span class="footer-input"></span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ===== ORTHOLINE TEMPLATE =====
  private static generateOrtholineInvoice(invoiceData: InvoiceData): string {
    const itemsHtml = invoiceData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 8px; border: 1px solid black;">${this.escapeHtml(item.description)}</td>
        <td style="padding: 8px; border: 1px solid black; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid black; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid black; text-align: right;">$${item.total.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid black; text-align: center;">${item.serviceDate}</td>
      </tr>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoiceData.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 40px; }
          .invoice-container { max-width: 900px; margin: 0 auto; background: white; }
          .header-line { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; margin-bottom: 20px; text-align: center; }
          .clinic-logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .clinic-info { font-size: 11px; line-height: 1.4; }
          .invoice-title { text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; }
          .invoice-title-line { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; }
          .invoice-meta { display: flex; justify-content: space-between; font-size: 12px; margin: 20px 0; }
          .customer-section { margin: 20px 0; border-bottom: 1px solid #000; padding-bottom: 10px; font-size: 12px; line-height: 1.6; }
          .customer-label { font-weight: bold; display: inline-block; width: 80px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
          .items-table th { border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; }
          .items-table td { border: 1px solid #000; padding: 8px; }
          .items-table tr:first-child { font-weight: bold; }
          .total-line { text-align: right; font-weight: bold; margin: 15px 0; font-size: 12px; }
          .payment-section { margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; font-size: 12px; line-height: 1.6; }
          .payment-label { font-weight: bold; display: inline-block; width: 100px; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header-line">
            <div class="clinic-logo">Ortholine</div>
            <div class="clinic-logo">Duncan Mills</div>
            <div class="clinic-info">${this.escapeHtml(invoiceData.clinicAddress)}, Unit 317, ${this.escapeHtml(invoiceData.clinicCity)} ${this.escapeHtml(invoiceData.clinicProvince)} ${this.escapeHtml(invoiceData.clinicPostalCode)}, Telephone: ${this.escapeHtml(invoiceData.clinicPhone)}, Fax: ${this.escapeHtml(invoiceData.clinicFax)}</div>
          </div>
          
          <div class="invoice-title-line">
            <div class="invoice-title">INVOICE</div>
          </div>
          
          <div class="invoice-meta">
            <div>Invoice No. ${this.escapeHtml(invoiceData.invoiceNumber)}</div>
            <div>Invoice Date: ${invoiceData.invoiceDate}</div>
          </div>
          
          <div class="customer-section">
            <div><span class="customer-label">Name:</span> ${this.escapeHtml(invoiceData.clientName)}</div>
            <div><span class="customer-label">Address:</span> ${this.escapeHtml(invoiceData.clientAddress)}</div>
            <div style="margin-left: 80px;">${this.escapeHtml(invoiceData.clientCity)}, ${this.escapeHtml(invoiceData.clientProvince)} ${this.escapeHtml(invoiceData.clientPostalCode)}</div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>ITEM DESCRIPTION</th>
                <th style="text-align: center;">QTY</th>
                <th style="text-align: right;">PRICE</th>
                <th style="text-align: right;">AMOUNT</th>
                <th style="text-align: center;">Service Date</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          
          <div class="total-line">Total: ${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
          
          <div class="payment-section">
            <div><span class="payment-label">Dispense Date:</span> ${invoiceData.invoiceDate}</div>
            <div><span class="payment-label">Amount:</span> ${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
            <div><span class="payment-label">Amount Due:</span> $0.00</div>
            <div><span class="payment-label">Method:</span></div>
            <div><span class="payment-label">Payment Date:</span></div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ===== BODYBLISS ONE CARE TEMPLATE =====
  private static generateBodyBlissOneCareInvoice(invoiceData: InvoiceData): string {
    const itemsHtml = invoiceData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #000;">${this.escapeHtml(item.description)}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: right;">$${item.total.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.serviceDate}</td>
      </tr>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoiceData.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #000; background: #fff; padding: 40px; }
          .invoice-container { max-width: 900px; margin: 0 auto; background: white; }
          .clinic-header { margin-bottom: 30px; }
          .clinic-logo { font-size: 20px; font-weight: normal; letter-spacing: 2px; margin-bottom: 10px; }
          .clinic-info { font-size: 11px; line-height: 1.6; }
          .invoice-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px 0; }
          .invoice-meta { font-size: 12px; margin-bottom: 15px; line-height: 1.6; }
          .customer-section { font-size: 12px; margin-bottom: 20px; line-height: 1.6; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
          .items-table th { border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; }
          .items-table td { border: 1px solid #000; padding: 8px; }
          .total-line { text-align: right; font-weight: bold; margin: 20px 0; font-size: 12px; }
          .payment-info { font-size: 12px; margin-top: 20px; line-height: 1.8; }
          .payment-label { font-weight: bold; display: inline-block; width: 140px; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="clinic-header">
            <div class="clinic-logo">bodybliss</div>
            <div class="clinic-logo">one care</div>
            <div class="clinic-info">
              ${this.escapeHtml(invoiceData.clinicName)}<br>
              ${this.escapeHtml(invoiceData.clinicAddress)}<br>
              ${this.escapeHtml(invoiceData.clinicCity)}, ${this.escapeHtml(invoiceData.clinicProvince)} ${this.escapeHtml(invoiceData.clinicPostalCode)}<br>
              T: ${this.escapeHtml(invoiceData.clinicPhone)}<br>
              F: ${this.escapeHtml(invoiceData.clinicFax)}
            </div>
          </div>
          
          <div class="invoice-title">INVOICE</div>
          
          <div class="invoice-meta">
            <div>Invoice No. ${this.escapeHtml(invoiceData.invoiceNumber)}<span style="margin-left: 100px;">Date: ${invoiceData.invoiceDate}</span></div>
            <div>Customer Name: ${this.escapeHtml(invoiceData.clientName)}</div>
            <div>Address: ${this.escapeHtml(invoiceData.clientAddress)}</div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>ITEM DESCRIPTION</th>
                <th style="text-align: center;">QTY</th>
                <th style="text-align: right;">PRICE</th>
                <th style="text-align: right;">AMOUNT</th>
                <th style="text-align: center;">SERVICE DATE</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          
          <div class="total-line">Total:${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
          
          <div class="payment-info">
            <div><span class="payment-label">Amount:</span>${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
            <div><span class="payment-label">Amount Due:</span> $0.00</div>
            <div><span class="payment-label">Dispense Date:</span> ${invoiceData.invoiceDate}</div>
            <div><span class="payment-label">Payment Method:</span></div>
            <div><span class="payment-label">Payment Date:</span></div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ===== BODYBLISS PHYSIOTHERAPY TEMPLATE =====
  private static generateBodyBlissPhysioInvoice(invoiceData: InvoiceData): string {
    const itemsHtml = invoiceData.items
      .map(
        (item) => `
      <tr style="border: 2px dotted #000;">
        <td style="padding: 8px; border-right: 2px dotted #000;">${this.escapeHtml(item.description)}</td>
        <td style="padding: 8px; border-right: 2px dotted #000; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-right: 2px dotted #000; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-right: 2px dotted #000; text-align: right;">$${item.total.toFixed(2)}</td>
        <td style="padding: 8px; text-align: center;">${item.serviceDate}</td>
      </tr>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoiceData.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #000; background: #fff; padding: 40px; }
          .invoice-container { max-width: 900px; margin: 0 auto; background: white; }
          .header { text-align: center; margin-bottom: 20px; }
          .clinic-logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .clinic-info { font-size: 11px; line-height: 1.4; }
          .divider { border-top: 1px solid #000; margin: 15px 0; }
          .invoice-title { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0; }
          .invoice-meta { display: flex; justify-content: space-between; font-size: 12px; margin: 15px 0; border-bottom: 1px solid #000; padding-bottom: 10px; }
          .customer-info { font-size: 12px; margin: 15px 0; border-bottom: 1px solid #000; padding-bottom: 10px; line-height: 1.5; }
          .customer-label { font-weight: bold; display: inline-block; width: 80px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
          .items-table th { border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; }
          .total-section { margin-top: 15px; }
          .total-line { text-align: right; font-weight: bold; margin: 10px 0; font-size: 12px; }
          .payment-section { margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; font-size: 12px; line-height: 1.8; }
          .payment-label { font-weight: bold; display: inline-block; width: 120px; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="clinic-logo">${this.escapeHtml(invoiceData.clinicName)}</div>
            <div class="clinic-info">${this.escapeHtml(invoiceData.clinicAddress)} ${this.escapeHtml(invoiceData.clinicCity)},${this.escapeHtml(invoiceData.clinicProvince)} ${this.escapeHtml(invoiceData.clinicPostalCode)}</div>
            <div class="clinic-info">Tel # ${this.escapeHtml(invoiceData.clinicPhone)} Fax ${this.escapeHtml(invoiceData.clinicFax)}</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="invoice-title">INVOICE</div>
          
          <div class="divider"></div>
          
          <div class="invoice-meta">
            <div>Invoice No. ${this.escapeHtml(invoiceData.invoiceNumber)}</div>
            <div>Date: ${invoiceData.invoiceDate}</div>
          </div>
          
          <div class="customer-info">
            <div><span class="customer-label">Customer Name:</span> ${this.escapeHtml(invoiceData.clientName)}</div>
            <div><span class="customer-label">Referring MD:</span></div>
            <div><span class="customer-label">Address:</span> ${this.escapeHtml(invoiceData.clientAddress)}</div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>ITEM DESCRIPTION</th>
                <th style="text-align: center;">QTY</th>
                <th style="text-align: right;">PRICE</th>
                <th style="text-align: right;">AMOUNT</th>
                <th style="text-align: center;">SERVICE DATE</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          
          <div class="total-section">
            <div class="total-line">Total: ${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
          </div>
          
          <div class="payment-section">
            <div><span class="payment-label">Amount:</span> ${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
            <div><span class="payment-label">Amount Due:</span> $0.00</div>
            <div><span class="payment-label">Dispense Date:</span></div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ===== MY CLOUD TEMPLATE =====
  private static generateMyCloudInvoice(invoiceData: InvoiceData): string {
    const itemsHtml = invoiceData.items
      .map(
        (item) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #000;">${this.escapeHtml(item.description)}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.serviceDate}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #000; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoiceData.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #000; background: #fff; padding: 40px; }
          .invoice-container { max-width: 900px; margin: 0 auto; background: white; }
          .clinic-header { margin-bottom: 30px; font-size: 12px; line-height: 1.6; }
          .clinic-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
          .clinic-info { font-size: 11px; }
          .boxes { display: flex; justify-content: space-between; margin: 20px 0; }
          .patient-box { border: 2px solid #000; padding: 15px; width: 60%; font-size: 11px; line-height: 1.6; }
          .invoice-box { border: 2px solid #000; padding: 15px; width: 35%; font-size: 11px; line-height: 1.6; }
          .box-label { font-weight: bold; margin-bottom: 5px; }
          .box-content { font-size: 11px; line-height: 1.5; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
          .items-table th { border: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; }
          .items-table td { border: 1px solid #000; padding: 8px; }
          .invoice-notes { border: 2px solid #000; padding: 15px; margin: 20px 0; min-height: 80px; }
          .notes-label { font-weight: bold; margin-bottom: 10px; }
          .summary-box { border: 2px solid #000; padding: 15px; width: 40%; margin-left: auto; margin-top: 20px; font-size: 12px; line-height: 1.8; }
          .summary-label { font-weight: bold; display: inline-block; width: 100px; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="clinic-header">
            <div class="clinic-name">${this.escapeHtml(invoiceData.clinicName)}</div>
            <div class="clinic-info">
              ${this.escapeHtml(invoiceData.clinicAddress)}<br>
              ${this.escapeHtml(invoiceData.clinicCity)},${this.escapeHtml(invoiceData.clinicProvince)}, ${this.escapeHtml(invoiceData.clinicPostalCode)}<br>
              Tel# ${this.escapeHtml(invoiceData.clinicPhone)} Fax # - ${this.escapeHtml(invoiceData.clinicFax)}
            </div>
          </div>
          
          <div class="boxes">
            <div class="patient-box">
              <div class="box-label">PATIENT NAME: ${this.escapeHtml(invoiceData.clientName)}</div>
              <div class="box-content">ADDRESS:${this.escapeHtml(invoiceData.clientAddress)}<br>${this.escapeHtml(invoiceData.clientCity)} ${this.escapeHtml(invoiceData.clientProvince)}<br>${this.escapeHtml(invoiceData.clientPostalCode)}</div>
            </div>
            <div class="invoice-box">
              <div class="box-label">INVOICE #: ${this.escapeHtml(invoiceData.invoiceNumber)}</div>
              <div class="box-content">DATE: ${invoiceData.invoiceDate}</div>
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>NAME / DESCRIPTION</th>
                <th style="text-align: center;">QTY</th>
                <th style="text-align: center;">Service Date</th>
                <th style="text-align: right;">UNIT PRICE</th>
                <th style="text-align: right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          
          <div class="invoice-notes">
            <div class="notes-label">INVOICE NOTES</div>
            <div style="font-size: 11px; margin-top: 5px;">Date Product Received</div>
            <div style="border-top: 1px solid #000; margin-top: 20px; height: 30px;"></div>
          </div>
          
          <div class="summary-box">
            <div><span class="summary-label">Total</span>${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
            <div><span class="summary-label">Amount Paid</span> ${invoiceData.currencySymbol}${invoiceData.total.toFixed(2)}</div>
            <div><span class="summary-label">Balance Due</span> <u>$0.00</u></div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ===== PHYSIO BLISS TEMPLATE (default to Century Care style) =====
  private static generatePhysioBlissInvoice(invoiceData: InvoiceData): string {
    return this.generateCenturyCareInvoice(invoiceData);
  }
  
  /**
   * Generate invoices for a date range
   */
  static async generateInvoicesForDateRange(
    startDate: Date,
    endDate: Date,
    clinicName?: string
  ): Promise<InvoiceData[]> {
    const invoices: InvoiceData[] = [];
    
    const orderFilter: any = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (clinicName) {
      orderFilter.clinic = clinicName;
    }
    
    const orders = await Order.find(orderFilter)
      .populate('clientId')
      .populate('clinicId')
      .lean();
    
    for (const order of orders) {
      const invoiceData = await this.buildInvoiceData(order);
      if (invoiceData) {
        invoices.push(invoiceData);
      }
    }
    
    return invoices;
  }
  
  /**
   * Build invoice data from order
   */
  private static async buildInvoiceData(order: any): Promise<InvoiceData | null> {
    try {
      const client = order.clientId;
      const clinic = order.clinicId;
      
      if (!client || !clinic) {return null;}
      
      // Get invoice template for clinic
      const invoiceTemplate = await mongoose.connection.collection('invoice_templates').findOne({
        clinicName: clinic.name
      });
      
      // Generate invoice number
      const invoiceNumber = this.generateInvoiceNumber(
        clinic.name,
        new Date(order.createdAt || Date.now())
      );
      
      // Build line items from order
      const items = [];
      if (order.products && Array.isArray(order.products)) {
        for (const product of order.products) {
          items.push({
            productCode: product.productKey || product._id,
            description: product.name || 'Service',
            quantity: product.quantity || 1,
            unitPrice: product.price || 0,
            total: (product.quantity || 1) * (product.price || 0),
            serviceDate: this.formatDate(new Date(order.createdAt || Date.now()))
          });
        }
      }
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = invoiceTemplate?.taxRate || 13;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;
      
      return {
        invoiceNumber,
        invoiceDate: this.formatDate(new Date(order.createdAt || Date.now())),
        clinicName: clinic.name || 'Clinic',
        clinicAddress: clinic.address || '',
        clinicCity: clinic.city || '',
        clinicProvince: clinic.province || 'Ontario',
        clinicPostalCode: clinic.postalCode || '',
        clinicPhone: clinic.phone || '416-224-9900',
        clinicFax: clinic.fax || '416-949-0363',
        clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
        clientAddress: client.contact?.address || '',
        clientCity: client.contact?.city || '',
        clientProvince: client.contact?.province || 'Ontario',
        clientPostalCode: client.contact?.postalCode || '',
        items,
        subtotal,
        tax,
        taxRate,
        total,
        currencySymbol: invoiceTemplate?.currencySymbol || '$'
      };
    } catch (error) {
      console.error('Error building invoice data:', error);
      return null;
    }
  }
  
  /**
   * Generate unique invoice number
   */
  private static generateInvoiceNumber(clinicName: string, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 100000);
    
    return `${year}${month}${day}${random}`;
  }
  
  /**
   * Format date to MM/DD/YYYY
   */
  private static formatDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  private static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m] || m);
  }
}
