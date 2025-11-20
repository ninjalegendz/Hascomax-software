import React from "react";
import type { Return } from "@/types";
import { formatDateSafe } from "@/utils/date";
import { useCurrency } from "@/hooks/useCurrency";
import { useSettings } from "@/contexts/SettingsContext";

interface ReturnReceiptTemplateProps {
  returnData: Return;
}

export const ReturnReceiptTemplate = React.forwardRef<HTMLDivElement, ReturnReceiptTemplateProps>(
  ({ returnData }, ref) => {
    const { format } = useCurrency();
    const { settings } = useSettings();
    const companyAddress = settings?.companyAddress || '';
    const companyLogoUrl = settings?.companyLogoUrl || '';

    if (!returnData) return null;

    const itemsSubtotal = returnData.items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);

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
          <h2 className="text-2xl font-semibold text-gray-700">RETURN RECEIPT</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <h3 className="font-semibold text-gray-600 mb-1">RETURN FROM</h3>
            <p className="font-bold">{returnData.customer_name}</p>
            {returnData.customer_address && <p className="whitespace-pre-wrap">{returnData.customer_address}</p>}
            {returnData.customer_phone && <p>{returnData.customer_phone}</p>}
          </div>
          <div className="text-right">
            <p><span className="font-semibold text-gray-600">Return Date:</span> {formatDateSafe(returnData.return_date)}</p>
            <p><span className="font-semibold text-gray-600">Return Number:</span> {returnData.return_receipt_number}</p>
            <p><span className="font-semibold text-gray-600">Original Receipt:</span> {returnData.original_invoice_number}</p>
          </div>
        </div>

        <h3 className="font-semibold text-gray-600 mb-2">RETURNED ITEMS</h3>
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-gray-100 print-bg-gray-100">
              <th className="text-left p-2 font-semibold text-gray-600">Item</th>
              <th className="text-right p-2 font-semibold text-gray-600">Qty</th>
              <th className="text-right p-2 font-semibold text-gray-600">Unit Price</th>
              <th className="text-right p-2 font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {returnData.items.map(item => (
              <tr key={item.id} className="border-b">
                <td className="p-2">{item.product_name || item.description}</td>
                <td className="text-right p-2">{item.quantity}</td>
                <td className="text-right p-2">{format(item.unit_price)}</td>
                <td className="text-right p-2">{format(item.quantity * item.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-1/2 space-y-1">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Items Subtotal:</span>
              <span>{format(itemsSubtotal)}</span>
            </div>
            <div className="flex justify-between py-1 font-bold text-lg border-t mt-2 pt-2">
              <span>TOTAL REFUND:</span>
              <span>{format(returnData.total_refund_amount)}</span>
            </div>
          </div>
        </div>

        {returnData.payments && returnData.payments.length > 0 && (
            <div className="mb-8">
                <h3 className="font-semibold text-gray-600 mb-2">Refund Details</h3>
                {returnData.payments.map(p => (
                    <div key={p.id} className="flex justify-between text-sm">
                        <span>Refund via {p.payment_method} on {formatDateSafe(p.date)}</span>
                        <span>{format(p.amount)}</span>
                    </div>
                ))}
            </div>
        )}

        {returnData.notes && (
          <div className="mt-8">
            <h4 className="font-semibold text-gray-600 mb-1">Notes</h4>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{returnData.notes}</p>
          </div>
        )}
      </div>
    );
  }
);