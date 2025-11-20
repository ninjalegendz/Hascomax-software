import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Receipt, FileQuestion, PlusCircle, Trash2 } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { Switch } from './ui/switch';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '@/lib/utils';

export type SaleType = 'receipt' | 'invoice' | 'quotation';
type Payment = { id: string; amount: string; method: string; chequeNumber?: string };

interface CheckoutDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  totalAmount: number;
  onConfirm: (type: SaleType, payments: { amount: number; method: string; chequeNumber?: string }[], settleBalance: boolean, creditToApply: number) => void;
  isProcessing: boolean;
  customerBalance: number;
  customerName: string;
  isWalkIn: boolean;
}

export function CheckoutDialog({ isOpen, onOpenChange, totalAmount, onConfirm, isProcessing, customerBalance, customerName, isWalkIn }: CheckoutDialogProps) {
  const [saleType, setSaleType] = useState<SaleType>('receipt');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settleBalance, setSettleBalance] = useState(false);
  const [creditToApply, setCreditToApply] = useState(0);
  const { format } = useCurrency();

  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ['paymentMethods'],
    queryFn: () => authenticatedFetch('/api/payment-methods'),
    enabled: isOpen,
  });

  const availableCredit = customerBalance > 0 ? customerBalance : 0;
  const outstandingBalance = customerBalance < 0 ? Math.abs(customerBalance) : 0;
  
  const cartTotalAfterCredit = totalAmount - creditToApply;
  const finalTotal = settleBalance ? cartTotalAfterCredit + outstandingBalance : cartTotalAfterCredit;

  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [payments]);
  const amountDue = useMemo(() => finalTotal - totalPaid, [finalTotal, totalPaid]);

  useEffect(() => {
    if (isOpen) {
      if (isWalkIn) {
        setSaleType('receipt');
      }
      setCreditToApply(0);
      setSettleBalance(false);
      if (paymentMethods && paymentMethods.length > 0) {
        setPayments([{ id: crypto.randomUUID(), amount: String(totalAmount), method: paymentMethods[0].name, chequeNumber: '' }]);
      } else {
        setPayments([{ id: crypto.randomUUID(), amount: String(totalAmount), method: '', chequeNumber: '' }]);
      }
    }
  }, [isOpen, totalAmount, paymentMethods, isWalkIn]);

  useEffect(() => {
    if (payments.length === 1) {
      setPayments(prev => [{ ...prev[0], amount: String(finalTotal.toFixed(2)) }]);
    }
  }, [finalTotal]);

  const handleCreditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    const maxApplicable = Math.min(availableCredit, totalAmount);
    setCreditToApply(Math.max(0, Math.min(value, maxApplicable)));
  };

  const handlePaymentChange = (id: string, field: 'amount' | 'method' | 'chequeNumber', value: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPaymentLine = () => {
    if (amountDue > 0 && paymentMethods) {
      setPayments(prev => [...prev, { id: crypto.randomUUID(), amount: String(amountDue.toFixed(2)), method: paymentMethods[0]?.name || '', chequeNumber: '' }]);
    }
  };

  const removePaymentLine = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const isChange = useMemo(() => saleType === 'receipt' && totalPaid > finalTotal, [saleType, totalPaid, finalTotal]);
  const changeAmount = useMemo(() => (isChange ? totalPaid - finalTotal : 0), [isChange, totalPaid, finalTotal]);

  const handleConfirm = () => {
    const processedPayments = payments.map(p => ({ amount: parseFloat(p.amount) || 0, method: p.method, chequeNumber: p.chequeNumber })).filter(p => p.amount > 0);
    onConfirm(saleType, processedPayments, settleBalance, creditToApply);
  };

  const usedPaymentMethods = useMemo(() => new Set(payments.map(p => p.method)), [payments]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalize Transaction</DialogTitle>
          <DialogDescription>Select the type of transaction to create for {customerName}.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Cart Total</p>
            <p className="text-2xl font-bold">{format(totalAmount)}</p>
          </div>

          {availableCredit > 0 && (
            <div className="p-3 bg-muted/50 rounded-md space-y-2">
              <Label>Apply Customer Credit (Available: {format(availableCredit)})</Label>
              <div className="flex items-center gap-2">
                <Input type="number" value={creditToApply} onChange={handleCreditChange} max={Math.min(availableCredit, totalAmount)} />
                <Button variant="outline" onClick={() => setCreditToApply(Math.min(availableCredit, totalAmount))}>Max</Button>
              </div>
            </div>
          )}

          {outstandingBalance > 0 && saleType === 'receipt' && (
            <div className="flex items-center justify-center space-x-2 p-3 bg-muted/50 rounded-md">
              <Switch id="settle-balance" checked={settleBalance} onCheckedChange={setSettleBalance} />
              <Label htmlFor="settle-balance">Include outstanding balance of {format(outstandingBalance)}</Label>
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Final Total</p>
            <p className="text-4xl font-bold">{format(finalTotal)}</p>
          </div>

          <RadioGroup value={saleType} onValueChange={(v) => setSaleType(v as SaleType)}>
            <div className="grid grid-cols-3 gap-4">
              <Label htmlFor="receipt" className="border rounded-md p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent [&:has([data-state=checked])]:border-primary">
                <Receipt className="h-6 w-6" />
                <RadioGroupItem value="receipt" id="receipt" className="sr-only" />
                Sales Receipt
              </Label>
              <Label htmlFor="invoice" className={cn("border rounded-md p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent [&:has([data-state=checked])]:border-primary", isWalkIn && "cursor-not-allowed opacity-50")}>
                <FileText className="h-6 w-6" />
                <RadioGroupItem value="invoice" id="invoice" className="sr-only" disabled={isWalkIn} />
                Invoice
              </Label>
              <Label htmlFor="quotation" className={cn("border rounded-md p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent [&:has([data-state=checked])]:border-primary", isWalkIn && "cursor-not-allowed opacity-50")}>
                <FileQuestion className="h-6 w-6" />
                <RadioGroupItem value="quotation" id="quotation" className="sr-only" disabled={isWalkIn} />
                Quotation
              </Label>
            </div>
          </RadioGroup>

          {saleType === 'receipt' && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Payment Details</h4>
              {payments.map((payment, index) => (
                <div key={payment.id} className="space-y-2 p-2 border rounded-md">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <div className="space-y-1">
                      {index === 0 && <Label>Amount</Label>}
                      <Input type="number" value={payment.amount} onChange={(e) => handlePaymentChange(payment.id, 'amount', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label>Method</Label>}
                      <Select value={payment.method} onValueChange={(value) => handlePaymentChange(payment.id, 'method', value)}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {paymentMethods?.filter(m => m.name === payment.method || !usedPaymentMethods.has(m.name)).map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removePaymentLine(payment.id)} disabled={payments.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {payment.method.toLowerCase() === 'cheque' && (
                    <div className="pl-1">
                      <Label htmlFor={`cheque-${payment.id}`}>Cheque Number</Label>
                      <Input id={`cheque-${payment.id}`} placeholder="Enter cheque number" value={payment.chequeNumber || ''} onChange={(e) => handlePaymentChange(payment.id, 'chequeNumber', e.target.value)} />
                    </div>
                  )}
                </div>
              ))}
              {amountDue > 0.009 && <Button variant="outline" size="sm" onClick={addPaymentLine}><PlusCircle className="mr-2 h-4 w-4" />Add Payment</Button>}
              
              <div className={cn("text-center p-2 bg-muted rounded-md font-medium", amountDue !== 0 && 'text-destructive')}>
                {isChange ? `Change Due: ${format(changeAmount)}` : `Amount Due: ${format(amountDue)}`}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={isProcessing || (saleType === 'receipt' && isWalkIn && amountDue !== 0)}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}