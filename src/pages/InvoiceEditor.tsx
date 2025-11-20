import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus, Save, Loader2, PackagePlus, ArrowLeft, Truck, Settings } from 'lucide-react';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Product, SalesCustomer } from '@/types';
import { authenticatedFetch } from '@/lib/api';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AddProductToSaleDialog } from '@/components/AddProductToSaleDialog';
import { useCurrency } from '@/hooks/useCurrency';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DatePicker } from '@/components/ui/datepicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomizeBundleDialog, type BundleComponent } from '@/components/CustomizeBundleDialog';
import { CheckoutDialog, type SaleType } from '@/components/CheckoutDialog';

type ProductWithQuantity = Product & { quantity: number };

type CartItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  stock: number;
  unit?: string;
  discount: number;
  discountInput: string;
  warranty_period_days?: number;
  warranty_period_unit?: string;
  weight?: number;
  invoice_description?: string;
  product_type?: 'standard' | 'bundle';
  components?: BundleComponent[];
};

type Courier = {
  id: string;
  name: string;
  first_kg_price: number;
  additional_kg_price: number;
};

const InvoiceEditor = () => {
  const { id: invoiceId } = useParams<{ id: string }>();
  const isEditing = !!invoiceId;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { format } = useCurrency();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [showNotes, setShowNotes] = useState(false);
  const [showWarranty, setShowWarranty] = useState(false);
  const [showWarrantyEndDate, setShowWarrantyEndDate] = useState(false);
  const [showPreviousBalance, setShowPreviousBalance] = useState(false);
  const [totalDiscountInput, setTotalDiscountInput] = useState('');
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [isDelivery, setIsDelivery] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('');
  const [deliveryWeight, setDeliveryWeight] = useState(1);
  const [isWeightManuallyEdited, setIsWeightManuallyEdited] = useState(false);
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [customizingBundle, setCustomizingBundle] = useState<CartItem | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const { data: invoiceData, isLoading: isLoadingInvoice } = useQuery<any>({
    queryKey: ['invoice-for-edit', invoiceId],
    queryFn: () => authenticatedFetch(`/api/invoices/${invoiceId}`).then(data => {
      const raw = data.invoice;
      return {
        ...raw,
        line_items: JSON.parse(raw.line_items),
        show_product_descriptions: raw.show_product_descriptions,
        show_previous_balance: raw.show_previous_balance,
        show_notes: raw.show_notes,
        show_warranty: raw.show_warranty,
        show_warranty_end_date: raw.show_warranty_end_date,
      };
    }),
    enabled: isEditing,
  });

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery<SalesCustomer[]>({
    queryKey: ['customers-for-sale-edit', invoiceData?.customer_id],
    queryFn: () => {
      let url = '/api/customers-for-sale';
      if (isEditing && invoiceData?.customer_id) {
        url += `?includeId=${invoiceData.customer_id}`;
      }
      return authenticatedFetch(url);
    },
    enabled: !!profile && (!isEditing || !!invoiceData),
  });

  const { data: productsData } = useQuery<ProductWithQuantity[]>({
    queryKey: ['products-for-sale'],
    queryFn: () => authenticatedFetch('/api/products-for-sale'),
    enabled: !!profile,
  });

  const { data: couriersData } = useQuery<Courier[]>({
    queryKey: ['couriers'],
    queryFn: () => authenticatedFetch('/api/couriers'),
    enabled: !!profile && isDelivery,
  });

  const selectedCourier = useMemo(() => couriersData?.find(c => c.id === selectedCourierId), [couriersData, selectedCourierId]);

  const totalCartWeight = useMemo(() => {
    return cart.reduce((total, item) => total + (item.weight || 0) * item.quantity, 0);
  }, [cart]);

  useEffect(() => {
    if (isDelivery && !isWeightManuallyEdited) {
      setDeliveryWeight(totalCartWeight);
    }
  }, [totalCartWeight, isDelivery, isWeightManuallyEdited]);

  useEffect(() => {
    if (!isDelivery) {
      setDeliveryCharge(0);
      setIsWeightManuallyEdited(false);
      setIsFreeShipping(false);
      return;
    }

    if (isFreeShipping) {
      setDeliveryCharge(0);
      return;
    }

    if (selectedCourierId === 'custom') {
      // User will set deliveryCharge manually
    } else if (selectedCourier) {
      const weight = Math.max(0, deliveryWeight);
      if (weight === 0) {
        setDeliveryCharge(0);
      } else {
        const firstKgPrice = selectedCourier.first_kg_price || 0;
        const additionalKgPrice = selectedCourier.additional_kg_price || 0;
        const calculatedCharge = firstKgPrice + Math.max(0, weight - 1) * additionalKgPrice;
        setDeliveryCharge(calculatedCharge);
      }
    }
  }, [isDelivery, selectedCourierId, selectedCourier, deliveryWeight, isFreeShipping]);

  useEffect(() => {
    if (isEditing && invoiceData) {
      setSelectedCustomerId(invoiceData.customer_id);
      setDeliveryCharge(invoiceData.delivery_charge || 0);
      setIsDelivery((invoiceData.delivery_charge || 0) > 0);
      setNotes(invoiceData.notes || '');
      setTerms(invoiceData.terms_and_conditions || '');
      setShowDescriptions(invoiceData.show_product_descriptions || false);
      setShowTerms(!!invoiceData.terms_and_conditions);
      setIssueDate(new Date(invoiceData.issue_date));
      setShowNotes(invoiceData.show_notes ?? true);
      setShowWarranty(invoiceData.show_warranty ?? true);
      setShowWarrantyEndDate(invoiceData.show_warranty_end_date ?? false);
      setShowPreviousBalance(invoiceData.show_previous_balance ?? true);
      setOverallDiscount(invoiceData.discount || 0);
      setTotalDiscountInput(String(invoiceData.discount || ''));
    }
  }, [isEditing, invoiceData]);

  useEffect(() => {
    if (isEditing && invoiceData && productsData) {
      const newCart: CartItem[] = invoiceData.line_items.map((item: any) => {
        const product = productsData.find(p => p.id === item.product_id || p.name === item.description);
        const originalQuantity = item.quantity;
        const currentStock = product ? product.quantity : 0;
        return {
          productId: product?.id || `custom-${item.id}`,
          name: item.description,
          sku: product?.sku || 'N/A',
          quantity: originalQuantity,
          price: item.unitPrice,
          stock: currentStock + originalQuantity,
          unit: product?.unit,
          discount: item.discount || 0,
          discountInput: String(item.discount || ''),
          warranty_period_days: item.warranty_period_days,
          warranty_period_unit: item.warranty_period_unit,
          weight: product?.weight,
          invoice_description: item.invoice_description || product?.invoice_description || '',
          product_type: item.isBundle ? 'bundle' : 'standard',
          components: item.components,
        };
      });
      setCart(newCart);
    }
  }, [isEditing, invoiceData, productsData]);

  const customers = customersData || [];

  const addToCart = (product: ProductWithQuantity) => {
    if (!product) return;
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      if (existingItem) {
        if (existingItem.quantity < product.quantity) {
          return prevCart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
        } else {
          showError("Not enough stock available.");
          return prevCart;
        }
      }
      if (product.quantity > 0) {
        return [...prevCart, { 
          productId: product.id, 
          name: product.name, 
          sku: product.sku, 
          quantity: 1, 
          price: product.price, 
          stock: product.quantity, 
          unit: product.unit, 
          discount: 0, 
          discountInput: '',
          warranty_period_days: product.warranty_period_days,
          warranty_period_unit: product.warranty_period_unit,
          weight: product.weight,
          invoice_description: product.invoice_description || '',
          product_type: product.product_type,
          components: product.components,
        }];
      } else {
        showError("Product is out of stock.");
        return prevCart;
      }
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart(prevCart => {
      const itemToUpdate = prevCart.find(item => item.productId === productId);
      if (itemToUpdate && newQuantity > 0 && newQuantity <= itemToUpdate.stock) {
        return prevCart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item);
      }
      if (itemToUpdate && newQuantity > itemToUpdate.stock) showError("Not enough stock available.");
      return prevCart;
    });
  };

  const updateItemPrice = (productId: string, newPrice: number) => {
    setCart(prevCart => prevCart.map(item => item.productId === productId ? { ...item, price: newPrice } : item));
  };

  const updateItemDiscount = (productId: string, value: string) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.productId === productId) {
        let numericDiscount = 0;
        const itemTotal = item.price * item.quantity;
        if (value.includes('%')) {
          const percentage = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          numericDiscount = (itemTotal * percentage) / 100;
        } else {
          numericDiscount = parseFloat(value) || 0;
        }
        const validDiscount = Math.max(0, Math.min(numericDiscount, itemTotal));
        return { ...item, discount: validDiscount, discountInput: value };
      }
      return item;
    }));
  };

  const updateItemWarranty = (productId: string, field: 'days' | 'unit', value: string | number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.productId === productId) {
        if (field === 'days') {
          return { ...item, warranty_period_days: Number(value) };
        }
        return { ...item, warranty_period_unit: String(value) };
      }
      return item;
    }));
  };

  const updateItemInvoiceDescription = (productId: string, description: string) => {
    setCart(prevCart => prevCart.map(item => item.productId === productId ? { ...item, invoice_description: description } : item));
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  const handleSaveBundleCustomization = (updatedComponents: BundleComponent[]) => {
    if (!customizingBundle) return;
    setCart(prev => prev.map(item => 
      item.productId === customizingBundle.productId 
        ? { ...item, components: updatedComponents } 
        : item
    ));
  };

  const { subtotal, totalItemDiscount, total } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const disc = cart.reduce((sum, item) => sum + item.discount, 0);
    const tot = sub - disc - overallDiscount + deliveryCharge;
    return { subtotal: sub, totalItemDiscount: disc, total: tot };
  }, [cart, deliveryCharge, overallDiscount]);

  useEffect(() => {
    let numericDiscount = 0;
    if (totalDiscountInput.includes('%')) {
      const percentage = parseFloat(totalDiscountInput.replace(/[^0-9.]/g, '')) || 0;
      numericDiscount = (subtotal * percentage) / 100;
    } else {
      numericDiscount = parseFloat(totalDiscountInput) || 0;
    }
    const validDiscount = Math.max(0, Math.min(numericDiscount, subtotal - totalItemDiscount));
    setOverallDiscount(validDiscount);
  }, [totalDiscountInput, subtotal, totalItemDiscount]);

  const handleSaveInvoice = async () => {
    if (cart.length === 0) { showError("Cart cannot be empty."); return; }
    if (!selectedCustomerId) { showError("Please select a customer."); return; }

    setIsProcessing(true);
    const toastId = showLoading("Updating invoice...");
    
    const saleItems = cart.map(item => ({ 
      product_id: item.productId.startsWith('custom-') ? null : item.productId,
      description: item.name,
      invoice_description: item.invoice_description,
      quantity: item.quantity, 
      unit_price: item.price, 
      discount: item.discount,
      warranty_period_days: item.warranty_period_days,
      warranty_period_unit: item.warranty_period_unit,
      product_type: item.product_type,
      components: item.components,
    }));

    const payload = {
      customer_id: selectedCustomerId,
      sale_items: saleItems,
      total,
      discount: overallDiscount,
      delivery_charge: deliveryCharge,
      notes: showNotes ? notes : '',
      terms_and_conditions: showTerms ? terms : '',
      show_product_descriptions: showDescriptions,
      show_previous_balance: showPreviousBalance,
      show_notes: showNotes,
      show_warranty: showWarranty,
      show_warranty_end_date: showWarrantyEndDate,
      issue_date: issueDate.toISOString(),
    };

    try {
      await authenticatedFetch(`/api/invoices/${invoiceId}`, { method: 'PUT', body: JSON.stringify(payload) });
      dismissToast(toastId);
      showSuccess("Invoice updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-sale'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      navigate(`/invoices/${invoiceId}`);
    } catch (error) {
      dismissToast(toastId);
      showError(`Failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) { showError("Cart cannot be empty."); return; }
    if (!selectedCustomerId) { showError("Please select a customer."); return; }
    setIsCheckoutOpen(true);
  };

  const handleConfirmCheckout = async (saleType: SaleType, payments: { amount: number; method: string }[], settleBalance: boolean, creditToApply: number) => {
    setIsProcessing(true);
    const toastId = showLoading("Processing transaction...");
  
    const saleItems = cart.map(item => ({
      product_id: item.productId.startsWith('custom-') ? null : item.productId,
      description: item.name,
      invoice_description: item.invoice_description,
      quantity: item.quantity,
      unit_price: item.price,
      discount: item.discount,
      warranty_period_days: item.warranty_period_days,
      warranty_period_unit: item.warranty_period_unit,
      product_type: item.product_type,
      components: item.components,
    }));
  
    if (saleType === 'quotation') {
      const quotationPayload = {
        customer_id: selectedCustomerId,
        line_items: saleItems,
        total,
        notes: showNotes ? notes : '',
        terms_and_conditions: showTerms ? terms : '',
        expiry_date: new Date(new Date().setDate(new Date().getDate() + 30)),
        issue_date: issueDate.toISOString(),
        show_notes: showNotes,
        show_warranty: showWarranty,
        delivery_charge: deliveryCharge,
        show_product_descriptions: showDescriptions,
        show_warranty_end_date: showWarrantyEndDate,
      };
      try {
        const response = await authenticatedFetch('/api/quotations', { method: 'POST', body: JSON.stringify(quotationPayload) });
        dismissToast(toastId);
        showSuccess("Quotation created successfully!");
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        navigate(`/quotations/${response.quotationId}`);
      } catch (error) {
        dismissToast(toastId);
        showError(`Failed: ${(error as Error).message}`);
      } finally {
        setIsProcessing(false);
      }
      return;
    }
  
    const payload = {
      customer_id: selectedCustomerId,
      sale_items: saleItems,
      total,
      discount: overallDiscount,
      delivery_charge: deliveryCharge,
      notes: showNotes ? notes : '',
      terms_and_conditions: showTerms ? terms : '',
      show_product_descriptions: showDescriptions,
      show_previous_balance: showPreviousBalance,
      show_notes: showNotes,
      show_warranty: showWarranty,
      show_warranty_end_date: showWarrantyEndDate,
      issue_date: issueDate.toISOString(),
      saleType,
      payments,
      settleBalance,
      creditToApply,
    };
  
    try {
      const response = await authenticatedFetch('/api/invoices', { method: 'POST', body: JSON.stringify(payload) });
      dismissToast(toastId);
      showSuccess("Transaction completed successfully!");
      
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['products-for-sale'] });
  
      navigate(`/invoices/${response.invoiceId}`);
    } catch (error) {
      dismissToast(toastId);
      showError(`Failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const customerOptions = customers.map(c => ({ 
    value: c.id, 
    label: `${c.name} (${c.phone}${c.secondary_phone ? `, ${c.secondary_phone}` : ''})` 
  }));

  const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

  if (isLoadingInvoice || isLoadingCustomers) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <Button asChild variant="outline" size="icon"><Link to={isEditing ? `/invoices/${invoiceId}` : '/invoices'}><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold tracking-tight">{isEditing ? `Edit Invoice ${invoiceData?.invoice_number}` : 'New Invoice'}</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-grow flex flex-col">
            <CardHeader><CardTitle>Invoice Items</CardTitle></CardHeader>
            <CardContent className="flex-grow space-y-4 flex flex-col">
              <Combobox options={customerOptions} value={selectedCustomerId} onChange={setSelectedCustomerId} placeholder="Select a customer..." searchPlaceholder="Search customers..." emptyMessage="No customers found." />
              <Button onClick={() => setIsAddProductOpen(true)} variant="outline" className="w-full"><PackagePlus className="mr-2 h-4 w-4" /> Add Product</Button>
              <div className="flex-grow relative border rounded-md overflow-x-auto">
                <ScrollArea className="absolute inset-0">
                  {cart.length > 0 ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="w-40 text-center">Quantity</TableHead><TableHead className="w-28">Discount</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {cart.map(item => (
                          <TableRow key={item.productId}>
                            <TableCell>
                              <p className="font-medium">{item.name}</p>
                              <Input type="number" value={item.price} onChange={(e) => updateItemPrice(item.productId, parseFloat(e.target.value) || 0)} className="h-8 w-24 text-sm" />
                              {item.product_type === 'bundle' && (
                                <Button variant="link" size="sm" className="h-auto p-0 mt-1" onClick={() => setCustomizingBundle(item)}>Customize</Button>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Input type="number" value={item.warranty_period_days || ''} onChange={(e) => updateItemWarranty(item.productId, 'days', e.target.value)} className="h-8 w-20 text-sm" placeholder="Days" />
                                <Select value={item.warranty_period_unit || 'Days'} onValueChange={(value) => updateItemWarranty(item.productId, 'unit', value)}>
                                  <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Days">Days</SelectItem>
                                    <SelectItem value="Months">Months</SelectItem>
                                    <SelectItem value="Years">Years</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {showDescriptions && (
                                <Textarea
                                  value={item.invoice_description}
                                  onChange={(e) => updateItemInvoiceDescription(item.productId, e.target.value)}
                                  placeholder="Invoice description..."
                                  className="mt-2 text-sm"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                                <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1)} className="h-8 w-12 text-center" />
                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                            <TableCell><Input type="text" value={item.discountInput} onChange={(e) => updateItemDiscount(item.productId, e.target.value)} className="h-8 w-24 text-right" placeholder="5% or 10" /></TableCell>
                            <TableCell className="text-right font-medium">{format((item.price * item.quantity) - item.discount)}</TableCell>
                            <TableCell>
                              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.productId)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Remove item</p></TooltipContent></Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : ( <p className="text-center text-muted-foreground pt-10">Your cart is empty.</p> )}
                </ScrollArea>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 mt-auto pt-4">
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{format(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Item Discounts</span><span className="text-destructive">-{format(totalItemDiscount)}</span></div>
                <div className="flex justify-between items-center"><Label htmlFor="overall-discount">Overall Discount</Label><Input id="overall-discount" type="text" value={totalDiscountInput} onChange={e => setTotalDiscountInput(e.target.value)} className="h-8 w-24 text-right" placeholder="5% or 10" /></div>
                <div className="flex justify-between items-center"><Label htmlFor="delivery">Delivery Charge</Label><Input id="delivery" type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(parseFloat(e.target.value) || 0)} className="h-8 w-24 text-right" placeholder="0.00" disabled={isFreeShipping || (isDelivery && selectedCourierId !== 'custom')} /></div>
              </div>
              <Separator />
              <div className="w-full flex justify-between text-xl font-bold"><span>Total</span><span>{format(total)}</span></div>
              {isEditing ? (
                <Button className="w-full" size="lg" onClick={handleSaveInvoice} disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-5 w-5" /> Save Changes
                </Button>
              ) : (
                <Button className="w-full" size="lg" onClick={handleCheckout} disabled={isProcessing || cart.length === 0 || !selectedCustomerId}>
                  Proceed to Checkout
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Options</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Issue Date</Label><DatePicker date={issueDate} setDate={setIssueDate} /></div>
              <div className="flex items-center space-x-2"><Switch id="delivery-switch" checked={isDelivery} onCheckedChange={setIsDelivery} /><Label htmlFor="delivery-switch" className="flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery</Label></div>
              {isDelivery && (
                <div className="pl-6 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="free-shipping" checked={isFreeShipping} onCheckedChange={setIsFreeShipping} />
                    <Label htmlFor="free-shipping">Free Shipping</Label>
                  </div>
                  <Select value={selectedCourierId} onValueChange={setSelectedCourierId} disabled={isFreeShipping}>
                    <SelectTrigger><SelectValue placeholder="Select a courier..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      {couriersData?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedCourierId && selectedCourierId !== 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="weight">Weight (KG)</Label>
                      <Input id="weight" type="number" value={deliveryWeight} onChange={e => { setDeliveryWeight(parseFloat(e.target.value) || 0); setIsWeightManuallyEdited(true); }} disabled={isFreeShipping} />
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center space-x-2"><Switch id="show-notes" checked={showNotes} onCheckedChange={setShowNotes} /><Label htmlFor="show-notes">Show Notes on document</Label></div>
              {showNotes && (<div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes for this sale..." /></div>)}
              <div className="flex items-center space-x-2"><Switch id="show-terms" checked={showTerms} onCheckedChange={setShowTerms} /><Label htmlFor="show-terms">Show Terms & Conditions</Label></div>
              {showTerms && (<div className="space-y-2"><Label htmlFor="terms">Terms & Conditions</Label><Textarea id="terms" value={terms} onChange={e => setTerms(e.target.value)} placeholder="Enter terms and conditions..." /></div>)}
              <div className="flex items-center space-x-2"><Switch id="show-desc" checked={showDescriptions} onCheckedChange={setShowDescriptions} /><Label htmlFor="show-desc">Show product descriptions</Label></div>
              <div className="flex items-center space-x-2"><Switch id="show-warranty" checked={showWarranty} onCheckedChange={setShowWarranty} /><Label htmlFor="show-warranty">Show warranty information</Label></div>
              {showWarranty && (
                <div className="pl-8 flex items-center space-x-2">
                  <Switch id="show-warranty-end-date" checked={showWarrantyEndDate} onCheckedChange={setShowWarrantyEndDate} />
                  <Label htmlFor="show-warranty-end-date">Show warranty end date</Label>
                </div>
              )}
              <div className="flex items-center space-x-2"><Switch id="show-prev-balance" checked={showPreviousBalance} onCheckedChange={setShowPreviousBalance} /><Label htmlFor="show-prev-balance">Show previous balance on receipt</Label></div>
            </CardContent>
          </Card>
        </div>
      </div>
      <AddProductToSaleDialog isOpen={isAddProductOpen} onOpenChange={setIsAddProductOpen} onAddToCart={addToCart} />
      <CustomizeBundleDialog
        isOpen={!!customizingBundle}
        onOpenChange={() => setCustomizingBundle(null)}
        cartItem={customizingBundle}
        onSave={handleSaveBundleCustomization}
        standardProducts={productsData?.filter(p => p.product_type === 'standard') || []}
      />
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        totalAmount={total}
        onConfirm={handleConfirmCheckout}
        isProcessing={isProcessing}
        customerBalance={selectedCustomer?.balance || 0}
        customerName={selectedCustomer?.name || ''}
        isWalkIn={selectedCustomer?.name === 'Walk-in Customer'}
      />
    </>
  );
};

export default InvoiceEditor;