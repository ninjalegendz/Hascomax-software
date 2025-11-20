import React from "react";
import { Link } from "react-router-dom";
import type { Quotation } from "@/types";
import { formatDateSafe, calculateExpiryDate } from "@/utils/date";
import { useCurrency } from "@/hooks/useCurrency";
import { useSettings } from "@/contexts/SettingsContext";
import { toWords } from "@/utils/numberToWords";

interface QuotationTemplateProps {
  quotation: Quotation;
}

export const QuotationTemplate = React.forwardRef<HTMLDivElement, QuotationTemplateProps>(
  ({ quotation }, ref) => {
    const { format } = useCurrency();
    const { settings } = useSettings();
    const companyAddress = settings?.companyAddress || '';
    const companyLogoUrl = settings?.companyLogoUrl || '';
    const invoiceFooter = settings?.invoiceFooter || '';

    if (!quotation) return null;

    const subtotal = quotation.line_items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const totalItemDiscount = quotation.line_items.reduce((acc, item) => acc + (item.discount || 0), 0);

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
          <h2 className="text-2xl font-semibold text-gray-700">QUOTATION</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <h3 className="font-semibold text-gray-600 mb-1">QUOTE FOR</h3>
            <p className="font-bold">
              <Link to={`/customers/${quotation.customer_id}`} className="text-current hover:underline">
                {quotation.customer_name}
              </Link>
            </p>
            {quotation.customerAddress && <p className="whitespace-pre-wrap">{quotation.customerAddress}</p>}
            {quotation.customerPhone && <p>{quotation.customerPhone}</p>}
            {quotation.customerSecondaryPhone && <p>{quotation.customerSecondaryPhone}</p>}
          </div>
          <div className="text-right">
            <p><span className="font-semibold text-gray-600">Issue Date:</span> {formatDateSafe(quotation.issue_date)}</p>
            <p><span className="font-semibold text-gray-600">Expiry Date:</span> {formatDateSafe(quotation.expiry_date)}</p>
            <p><span className="font-semibold text-gray-600">Quotation Number:</span> {quotation.quotation_number}</p>
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
            {quotation.line_items.map((item, index) => {
              const warrantyEndDate = item.warranty_period_days && item.warranty_period_days > 0
                ? calculateExpiryDate(quotation.issue_date, item.warranty_period_days, item.warranty_period_unit)
                : null;

              return (
                <tr key={item.id || index} className="border-b">
                  <td className="p-2">
                    {item.description}{item.barcode ? ` (${item.barcode})` : ''}
                    {quotation.showWarranty && item.warranty_period_days && item.warranty_period_days > 0 && (
                      <p className="text-xs text-gray-500 pl-2">
                        Warranty: {item.warranty_period_days} {item.warranty_period_unit || 'Days'}
                        {quotation.showWarrantyEndDate && warrantyEndDate && ` (Expires on: ${formatDateSafe(warrantyEndDate)})`}
                      </p>
                    )}
                    {quotation.show_product_descriptions && item.invoice_description && (
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
          <div className="w-1/2">
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
            {(quotation.delivery_charge || 0) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Delivery Charge:</span>
                <span>+{format(quotation.delivery_charge)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 font-bold text-lg border-t mt-2 pt-2">
              <span>TOTAL:</span>
              <span>{format(quotation.total)}</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-xs text-gray-600">
            {toWords(quotation.total)}
          </p>
        </div>

        {quotation.showNotes && quotation.notes && (
          <div className="mt-8">
            <h4 className="font-semibold text-gray-600 mb-1">Notes</h4>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        )}

        {quotation.terms_and_conditions && (
          <div className="mt-8">
            <h4 className="font-semibold text-gray-600 mb-1">Terms & Conditions</h4>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{quotation.terms_and_conditions}</p>
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