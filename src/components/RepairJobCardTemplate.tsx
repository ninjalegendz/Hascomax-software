import React from "react";
import type { Repair } from "@/types";
import { formatDateSafe } from "@/utils/date";
import { useSettings } from "@/contexts/SettingsContext";
import { useCurrency } from "@/hooks/useCurrency";

interface RepairJobCardTemplateProps {
  repair: Repair;
}

export const RepairJobCardTemplate = React.forwardRef<HTMLDivElement, RepairJobCardTemplateProps>(
  ({ repair }, ref) => {
    const { settings } = useSettings();
    const { format } = useCurrency();
    const companyName = settings?.companyName || 'BizManager Inc.';
    const companyAddress = settings?.companyAddress || '';

    const totalPartsCost = repair.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const finalTotal = (repair.repair_fee || 0) + totalPartsCost;

    return (
      <div ref={ref} className="p-8 bg-white text-black text-sm font-sans">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold">{companyName}</h1>
            <p className="text-xs whitespace-pre-wrap">{companyAddress}</p>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-gray-700">REPAIR JOB CARD</h2>
            <p className="font-semibold">Job #: {repair.repair_number}</p>
          </div>
        </div>

        {/* Customer and Item Details */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-semibold text-gray-600 mb-2 border-b">CUSTOMER DETAILS</h3>
            <p><span className="font-semibold">Name:</span> {repair.customer_name}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-600 mb-2 border-b">ITEM DETAILS</h3>
            <p><span className="font-semibold">Item:</span> {repair.product_name}</p>
            <p><span className="font-semibold">Date Received:</span> {formatDateSafe(repair.received_date)}</p>
          </div>
        </div>

        {/* Reported Problem */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-600 mb-2 border-b">REPORTED PROBLEM</h3>
          <p className="text-gray-800 whitespace-pre-wrap p-2 bg-gray-50 rounded-md min-h-[60px]">{repair.reported_problem}</p>
        </div>

        {/* Technician's Diagnosis */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-600 mb-2 border-b">TECHNICIAN'S DIAGNOSIS & NOTES</h3>
          <div className="border rounded-md p-2 min-h-[120px]"></div>
        </div>

        {/* Spare Parts Used */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-600 mb-2 border-b">SPARE PARTS USED</h3>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 print-bg-gray-100">
                <th className="text-left p-2 font-semibold text-gray-600">Part Description</th>
                <th className="text-center p-2 font-semibold text-gray-600">Qty</th>
                <th className="text-right p-2 font-semibold text-gray-600">Unit Price</th>
                <th className="text-right p-2 font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {repair.items.length > 0 ? (
                repair.items.map(item => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{item.product_name} ({item.product_sku})</td>
                    <td className="text-center p-2">{item.quantity}</td>
                    <td className="text-right p-2">{format(item.unit_price)}</td>
                    <td className="text-right p-2">{format(item.quantity * item.unit_price)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-2 text-center text-gray-500 h-12">No spare parts recorded.</td>
                </tr>
              )}
              <tr className="border-b"><td className="p-2 h-8"></td><td></td><td></td><td></td></tr>
              <tr className="border-b"><td className="p-2 h-8"></td><td></td><td></td><td></td></tr>
            </tbody>
          </table>
        </div>

        {/* Summary and Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t mt-8">
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold text-gray-600 mb-2">TECHNICIAN</h3>
              <div className="border-b mt-8"></div>
              <p className="text-xs text-center mt-1">Signature & Name</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-600 mb-2">CUSTOMER</h3>
              <div className="border-b mt-8"></div>
              <p className="text-xs text-center mt-1">Signature & Name (upon collection)</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">TOTAL REPAIR COST:</p>
            <div className="border-2 rounded-md p-4 mt-2 text-2xl font-bold">
              {repair.status === 'Completed' ? format(finalTotal) : 'TBD'}
            </div>
          </div>
        </div>
      </div>
    );
  }
);