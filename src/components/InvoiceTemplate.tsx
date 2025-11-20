import React from "react";
import { Link } from "react-router-dom";
import type { Invoice, Transaction } from "@/types";
import { formatDateSafe, calculateExpiryDate } from "@/utils/date";
import { useCurrency } from "@/hooks/useCurrency";
import { useSettings } from "@/contexts/SettingsContext";
import { toWords } from "@/utils/numberToWords";

interface InvoiceTemplateProps {
  invoice: Invoice;
  transactions?: Transaction[];
  isReceipt?: boolean;
  totalPaid?: number;
  customerBalance?: number;
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(
  ({ invoice, transactions, isReceipt = false, totalPaid = 0, customerBalance = 0 }, ref) => {
    const { format } = useCurrency();
    const { settings } = useSettings();
    const companyAddress = settings?.companyAddress || '';
    const companyLogoUrl = settings?.companyLogoUrl || '';
    const invoiceFooter = settings?.invoiceFooter || '';

    if (!invoice) return null;

    const subtotal = invoice.lineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const totalItemDiscount = invoice.lineItems.reduce((acc, item) => acc + (item.discount || 0), 0);
    const remainingBalanceOnInvoice = invoice.total - totalPaid;

    const creditAppliedTransaction = transactions?.find(t => t.description === 'Credit applied to sale');
    const creditApplied = creditAppliedTransaction?.amount || 0;

    const previousBalance = customerBalance + invoice.total - totalPaid - creditApplied;
    
    const paymentTransactions = transactions?.filter(t => t.type === 'credit') || [];

    const getStatusInfo = () => {
      switch (invoice.status) {
        case 'Paid':
          return { text: 'PAID', color: 'text-green-600' };
        case 'Partially Paid':
          return { text: 'DUE', color: 'text-yellow-600' };
        default:
          return { text: 'DUE', color: 'text-red-600' };
      }
    };
    const statusInfo = getStatusInfo();

    const shouldShowPreviousBalance = invoice.showPreviousBalance ?? settings?.showPreviousBalanceOnReceipt;

    return (
      <div ref={ref} className="p-8 bg-white text-black text-sm font-sans">
        <div className="flex justify-between items-start mb-4">
          <div className="w-1/2">
            <p className="whitespace-pre-wrap">{companyAddress}</p>
          </div>
          <div className="w-1/2 text-right">
            {companyLogoUrl && <img src={companyLogoUrl} alt="Company Logo" className="inline-block" style={{ maxHeight: `${settings?.companyLogoSize || 80}px` }} />}
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-700">{isReceipt ? 'SALES RECEIPT' : 'INVOICE'}</h2>
          {isReceipt && <h3 className={`text-xl font-bold ${statusInfo.color}`}>{statusInfo.text}</h3>}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <h3 className="font-semibold text-gray-600 mb-1">BILL TO</h3>
            <p className="font-bold">
              <Link to={`/customers/${invoice.customerId}`} className="text-current hover:underline">
                {invoice.customerName}
              </Link>
            </p>
            {invoice.customerAddress && <p className="whitespace-pre-wrap">{invoice.customerAddress}</p>}
            {invoice.customerPhone && <p>{invoice.customerPhone}</p>}
            {invoice.customerSecondaryPhone && <p>{invoice.customerSecondaryPhone}</p>}
          </div>
          <div className="text-right">
            <p><span className="font-semibold text-gray-600">Issue Date:</span> {formatDateSafe(invoice.issueDate)}</p>
            {!isReceipt && <p><span className="font-semibold text-gray-600">Due Date:</span> {formatDateSafe(invoice.dueDate)}</p>}
            <p><span className="font-semibold text-gray-600">{isReceipt ? 'Receipt' : 'Invoice'} Number:</span> {invoice.invoiceNumber}</p>
          </div>
        </div>

        <table className="w-full mb-8">
          <thead>
            <tr className="bg-gray-100 print-bg-gray-100">
              <th className="text-left p-2 font-semibold text-gray-600">Item</th>
              <th className="text-right p-2 font-semibold text-gray-600">Qty</th>
              <th className="text-right p-2 font-semibold text-gray-600">Unit Price</th>
              <th className="text-right p-2 font-semibold text-gray-600">Discount</th>
              <th className="text-right p-2 font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map(item => {
              const warrantyEndDate = item.warranty_period_days && item.warranty_period_days > 0
                ? calculateExpiryDate(invoice.issueDate, item.warranty_period_days, item.warranty_period_unit)
                : null;

              return (
                <tr key={item.id} className="border-b">
                  <td className="p-2">
                    {item.description}{item.barcode ? ` (${item.barcode})` : ''}
                    {invoice.showWarranty && item.warranty_period_days && item.warranty_period_days > 0 && (
                      <p className="text-xs text-gray-500 pl-2">
                        Warranty: {item.warranty_period_days} {item.warranty_period_unit || 'Days'}
                        {invoice.showWarrantyEndDate && warrantyEndDate && ` (Expires on: ${formatDateSafe(warrantyEndDate)})`}
                      </p>
                    )}
                    {invoice.showProductDescriptions && item.invoice_description && (
                      <p className="text-xs text-gray-500 pl-2 whitespace-pre-wrap">{item.invoice_description}</p>
                    )}
                  </td>
                  <td className="text-right p-2">{item.quantity.toFixed(2)} {item.unit || ''}</td>
                  <td className="text-right p-2">{format(item.unitPrice)}</td>
                  <td className="text-right p-2">{(item.discount || 0) > 0 ? `-${format(item.discount)}` : '-'}</td>
                  <td className="text-right p-2">{format((item.quantity * item.unitPrice) - (item.discount || 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end mb-4">
          <div className="w-1/2 space-y-1">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Subtotal:</span>
              <span>{format(subtotal)}</span>
            </div>
            {totalItemDiscount > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Item Discounts:</span>
                <span>-{format(totalItemDiscount)}</span>
              </div>
            )}
            {(invoice.discount || 0) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Overall Discount:</span>
                <span>-{format(invoice.discount)}</span>
              </div>
            )}
            {(invoice.deliveryCharge || 0) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Delivery Charge:</span>
                <span>+{format(invoice.deliveryCharge)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 font-bold text-lg border-t mt-2 pt-2">
              <span>{isReceipt ? 'Invoice Total:' : 'TOTAL:'}</span>
              <span>{format(invoice.total)}</span>
            </div>

            {isReceipt && (
              <>
                {creditApplied > 0 && (
                  <div className="flex justify-between py-1 text-gray-600">
                    <span>Credit Applied:</span>
                    <span>-{format(creditApplied)}</span>
                  </div>
                )}
                {shouldShowPreviousBalance && previousBalance < 0 && (
                  <div className="flex justify-between py-1 text-gray-600">
                    <span>Previous Due:</span>
                    <span>{format(Math.abs(previousBalance))}</span>
                  </div>
                )}
                {paymentTransactions.map(payment => (
                  <div key={payment.id} className="flex justify-between py-1 text-gray-600">
                    <span>Paid ({payment.payment_method || 'N/A'}{payment.cheque_number ? ` - Chq #${payment.cheque_number}` : ''}):</span>
                    <span>{format(payment.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1 font-bold text-lg border-t mt-2 pt-2">
                  <span>Balance Due:</span>
                  <span>{format(remainingBalanceOnInvoice > 0 ? remainingBalanceOnInvoice : 0)}</span>
                </div>
                {remainingBalanceOnInvoice < 0 && (
                  <div className="flex justify-between py-1 font-bold text-lg text-green-600">
                    <span>Credit:</span>
                    <span>{format(Math.abs(remainingBalanceOnInvoice))}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs text-gray-600">
            {toWords(invoice.total)}
          </p>
        </div>

        {invoice.showNotes && invoice.notes && (
          <div className="mt-8">
            <h4 className="font-semibold text-gray-600 mb-1">Notes</h4>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {invoice.termsAndConditions && (
          <div className="mt-8">
            <h4 className="font-semibold text-gray-600 mb-1">Terms & Conditions</h4>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{invoice.termsAndConditions}</p>
          </div>
        )}

        <div className="text-center text-gray-500 text-xs mt-8 border-t pt-4">
          <p className="mb-2">Thank you for your business!</p>
          {invoiceFooter && <p className="whitespace-pre-wrap">{invoiceFooter}</p>}
        </div>
      </div>
    );
  }
);