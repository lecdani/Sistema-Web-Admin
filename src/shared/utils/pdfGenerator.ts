import { Invoice, Order } from '../types';

/**
 * Genera y descarga una factura en formato PDF
 * Usa la API de impresión del navegador para generar el PDF
 */
export async function generateInvoicePDF(invoice: Invoice, order: Order, companyName: string = "TU EMPRESA") {
  // Crear un contenedor temporal para el contenido del PDF
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresión. Por favor, permite las ventanas emergentes.');
  }

  const issueDate = invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('es-ES') : 'N/A';
  
  // HTML de la factura con estilos inline
  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Factura ${invoice.invoiceNumber}</title>
      <style>
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
          background: white;
        }
        
        .invoice-container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 10mm;
          background: white;
        }
        
        .header {
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
        }
        
        .company-info h1 {
          font-size: 24px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        
        .company-info p {
          font-size: 11px;
          margin-bottom: 2px;
        }
        
        .invoice-info {
          text-align: right;
        }
        
        .logo-box {
          background: #000;
          color: #fff;
          padding: 5px 15px;
          display: inline-block;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        
        .info-grid {
          border: 2px solid #000;
          padding: 8px;
          display: inline-block;
          min-width: 200px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
          font-size: 11px;
        }
        
        .info-row:last-child {
          margin-bottom: 0;
        }
        
        .info-label {
          font-weight: bold;
        }
        
        .store-section {
          display: flex;
          gap: 30px;
          margin-bottom: 15px;
        }
        
        .store-section div {
          flex: 1;
        }
        
        .store-section p {
          font-size: 11px;
        }
        
        .store-section .section-title {
          font-weight: bold;
          margin-bottom: 3px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          margin-bottom: 15px;
        }
        
        th {
          background-color: #e5e5e5;
          border: 2px solid #000;
          padding: 8px;
          text-align: left;
          font-weight: bold;
          font-size: 11px;
        }
        
        td {
          border: 2px solid #000;
          padding: 8px;
          font-size: 11px;
        }
        
        .text-right {
          text-align: right;
        }
        
        .total-row {
          background-color: #e5e5e5;
          font-weight: bold;
        }
        
        .total-row td {
          padding: 10px 8px;
        }
        
        .total-amount {
          font-size: 14px;
        }
        
        .comments-box {
          border: 2px solid #000;
          padding: 10px;
          margin-bottom: 15px;
          min-height: 80px;
        }
        
        .comments-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .footer {
          text-align: center;
          font-size: 10px;
          color: #666;
          margin-top: 20px;
        }
        
        .footer p {
          margin-bottom: 5px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <h1>${companyName}</h1>
            <p>1904 N Main St, Miami, FL 23145</p>
            <p>Phone: (305) 555-9265</p>
          </div>
          
          <div class="invoice-info">
            <div class="logo-box">∞</div>
            <div class="info-grid">
              <div class="info-row">
                <span class="info-label">INVOICE #:</span>
                <span>${invoice.invoiceNumber || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">DATE:</span>
                <span>${issueDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">VENDOR №:</span>
                <span>${order.salespersonId?.slice(0, 8) || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">2F/3№</span>
                <span>-</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Store Information -->
        <div class="store-section">
          <div>
            <p class="section-title">STORE:</p>
            <p>${order.storeName || 'N/A'}</p>
          </div>
          <div>
            <p class="section-title">ADDRESS:</p>
            <p>Información no disponible</p>
          </div>
        </div>

        <!-- Products Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">QTY</th>
              <th style="width: 100px;">CODE</th>
              <th>DESCRIPTION</th>
              <th style="width: 80px;" class="text-right">PRICE</th>
              <th style="width: 90px;" class="text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.quantity || 0}</td>
                <td>${item.productId.slice(0, 10)}</td>
                <td>${item.productName || 'N/A'}</td>
                <td class="text-right">€${(item.unitPrice || 0).toFixed(2)}</td>
                <td class="text-right">€${(item.subtotal || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
            
            ${Array.from({ length: Math.max(0, 8 - order.items.length) }).map(() => `
              <tr>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            `).join('')}

            <tr class="total-row">
              <td colspan="2">TOTAL PCS</td>
              <td>${order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)} unidades</td>
              <td class="text-right">TOTAL</td>
              <td class="text-right total-amount">€${(invoice.totalAmount || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Comments -->
        <div class="comments-box">
          <p class="comments-title">COMMENTS:</p>
          <p>${invoice.notes || order.notes || 'Sin comentarios'}</p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>IVA: €${(invoice.taxAmount || 0).toFixed(2)} | Subtotal: €${(order.subtotal || 0).toFixed(2)}</p>
          <p>Fecha de creación del pedido: ${new Date(order.createdAt).toLocaleString('es-ES')}</p>
          <p>Vendedor: ${order.sellerName || 'N/A'} | Planograma: ${order.planogramName || 'N/A'}</p>
        </div>
      </div>
      
      <script>
        // Auto-print when the window loads
        window.onload = function() {
          window.print();
          // Close the window after printing (user can cancel)
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(invoiceHTML);
  printWindow.document.close();
}
