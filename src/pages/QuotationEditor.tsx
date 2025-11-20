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
import type { Product, SalesCustomer, Quotation, LineItem } from '@/types';
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

const QuotationEditor = () => {
  const { id: quotationId } = useParams<{ id: string }>();
  const isEditing = !!quotationId;
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
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(new Date());
  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [showNotes, setShowNotes] = useState(false);
  const [showWarranty, setShowWarranty] = useState(false);
  const [showWarrantyEndDate, setShowWarrantyEndDate] = useState(false);
  const [isDelivery, setIsDelivery] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('');
  const [deliveryWeight, setDeliveryWeight] = useState(1);
  const [isWeightManuallyEdited, setIsWeightManuallyEdited] = useState(false);
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [customizingBundle, setCustomizingBundle] = useState<CartItem | null>(null);

  const { data: quotationData, isLoading: isLoadingQuotation } = useQuery<Quotation>({
    queryKey: ['quotation', quotationId],
    queryFn: async () => {
      const data = await authenticatedFetch(`/api/quotations/${quotationId}`);
      // Manually convert snake_case to camelCase to match LineItem type
      data.line_items = data.line_items.map((item: any) => ({
          ...item,
          unitPrice: item.unitPrice || item.unit_price,
          isBundle: item.isBundle || item.is_bundle,
      }));
      return data;
    },
    enabled: isEditing,
  });

  const { data: productsData } = useQuery<ProductWithQuantity[]>({
    queryKey: ['products-for-sale'],
    queryFn: () => authenticatedFetch('/api/products-for-sale'),
    enabled: !!profile,
  });

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery<SalesCustomer[]>({
    queryKey: ['customers-for-sale-edit', quotationData?.customer_id],
    queryFn: () => {
      let url = '/api/customers-for-sale';
      if (isEditing && quotationData?.customer_id) {
        url += `?includeId=${quotationData.customer_id}`;
      }
      return authenticatedFetch(url);
    },
    enabled: !!profile && (!isEditing || !!quotationData),
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
    if (isEditing && quotationData) {
      if (quotationData.status !== 'Draft') {
        showError("Only draft quotations can be edited.");
        navigate(`/quotations/${quotationId}`);
        return;
      }
      setSelectedCustomerId(quotationData.customer_id);
      setNotes(quotationData.notes || '');
      setTerms(quotationData.terms_and_conditions || '');
      setShowTerms(!!quotationData.terms_and_conditions);
      setExpiryDate(new Date(quotationData.expiry_date));
      setIssueDate(new Date(quotationData.issue_date));
      setShowNotes(quotationData.showNotes ?? true);
      setShowWarranty(quotationData.showWarranty ?? true);
      setShowWarrantyEndDate(quotationData.showWarrantyEndDate ?? false);
      setDeliveryCharge(quotationData.delivery_charge || 0);
      setIsDelivery((quotationData.delivery_charge || 0) > 0);
      setShowDescriptions(quotationData.show_product_descriptions || false);
    }
  }, [isEditing, quotationData, navigate, quotationId]);

  useEffect(() => {
    if (isEditing && quotationData && productsData) {
      const newCart: CartItem[] = quotationData.line_items.map(item => {
        const product = productsData.find(p => p.id === item.product_id || p.name === item.description);
        return {
          productId: product?.id || `custom-${item.id}`,
          name: item.description,
          sku: product?.sku || 'N/A',
          quantity: item.quantity,
          price: item.unitPrice,
          stock: product ? product.quantity + item.quantity : item.quantity,
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
  }, [isEditing, quotationData, productsData]);

  const customers = customersData || [];

  const addToCart = (product: ProductWithQuantity) => {
    if (!product) return;
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      if (existingItem) {
        return prevCart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
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
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart(prevCart => {
      if (newQuantity > 0) {
        return prevCart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item);
      }
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
    return { subtotal: sub, totalItemDiscount: disc, total: sub - disc + deliveryCharge };
  }, [cart, deliveryCharge]);

  const handleSaveQuotation = async () => {
    if (cart.length === 0) { showError("Cart cannot be empty."); return; }
    if (!selectedCustomerId) { showError("Please select a customer."); return; }

    setIsProcessing(true);
    const toastId = showLoading(isEditing ? "Updating quotation..." : "Creating quotation...");
    const lineItems = cart.map(item => {
      const product = productsData?.find(p => p.id === item.productId);
      return {
        id: item.productId.startsWith('custom-') ? item.productId.replace('custom-', '') : crypto.randomUUID(),
        product_id: product?.id,
        description: item.name,
        invoice_description: item.invoice_description,
        barcode: product?.barcode,
        quantity: item.quantity,
        unit_price: item.price,
        unit: item.unit,
        discount: item.discount,
        warranty_period_days: item.warranty_period_days,
        warranty_period_unit: item.warranty_period_unit,
        product_type: item.product_type,
        components: item.components,
      };
    });

    const payload = {
      customer_id: selectedCustomerId,
      line_items: lineItems,
      total,
      notes: showNotes ? notes : '',
      terms_and_conditions: showTerms ? terms : '',
      expiry_date: expiryDate,
      issue_date: issueDate.toISOString(),
      show_notes: showNotes,
      show_warranty: showWarranty,
      show_warranty_end_date: showWarrantyEndDate,
      delivery_charge: deliveryCharge,
      show_product_descriptions: showDescriptions,
    };

    const url = isEditing ? `/api/quotations/${quotationId}` : '/api/quotations';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      dismissToast(toastId);
      showSuccess(isEditing ? "Quotation updated successfully!" : "Quotation created successfully!");
      
      const newId = isEditing ? quotationId : response.quotationId;

      await queryClient.invalidateQueries({ queryKey: ['quotations'] });
      
      await queryClient.prefetchQuery({
        queryKey: ['quotation', newId],
        queryFn: async () => {
          const data = await authenticatedFetch(`/api/quotations/${newId}`);
          data.line_items = data.line_items.map((item: any) => ({
              ...item,
              unitPrice: item.unitPrice || item.unit_price,
              isBundle: item.isBundle !== undefined ? item.isBundle : (item.product_type === 'bundle'),
          }));
          return data;
        },
      });
      
      navigate(`/quotations/${newId}`);
    } catch (error) {
      dismissToast(toastId);
      showError(`Failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const customerOptions = customers.map(c => ({ 
    value: c.id, 
    label: `${c.name} (${c.phone})` 
  }));

  if (isEditing && isLoadingQuotation) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <Button asChild variant="outline" size="icon"><Link to={isEditing ? `/quotations/${quotationId}` : '/quotations'}><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold tracking-tight">{isEditing ? `Edit Quotation ${quotationData?.quotation_number}` : 'New Quotation'}</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-grow flex flex-col">
            <CardHeader>
              <CardTitle>Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 flex flex-col">
              {isLoadingCustomers ? (
                <div className="flex items-center justify-center h-10 border rounded-md"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <Combobox options={customerOptions} value={selectedCustomerId} onChange={setSelectedCustomerId} placeholder="Select a customer..." searchPlaceholder="Search customers..." emptyMessage="No customers found." />
              )}
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
                <div className="flex justify-between"><span className="text-muted-foreground">Total Discount</span><span className="text-destructive">-{format(totalItemDiscount)}</span></div>
                <div className="flex justify-between items-center"><Label htmlFor="delivery">Delivery Charge</Label><Input id="delivery" type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(parseFloat(e.target.value) || 0)} className="h-8 w-24 text-right" placeholder="0.00" disabled={isFreeShipping || (isDelivery && selectedCourierId !== 'custom')} /></div>
              </div>
              <Separator />
              <div className="w-full flex justify-between text-xl font-bold"><span>Total</span><span>{format(total)}</span></div>
              <Button className="w-full" size="lg" onClick={handleSaveQuotation} disabled={isProcessing}><Save className="mr-2 h-5 w-5" /> {isEditing ? 'Save Changes' : 'Create Quotation'}</Button>
            </CardFooter>
          </Card>
        </div>
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Options</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Issue Date</Label><DatePicker date={issueDate} setDate={setIssueDate} /></div>
              <div className="space-y-2"><Label>Expiry Date</Label><DatePicker date={expiryDate} setDate={setExpiryDate} /></div>
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
              <div className="flex items-center space-x-2"><Switch id="show-notes" checked={showNotes} onCheckedChange={setShowNotes} /><Label htmlFor="show-notes">Show Notes</Label></div>
              {showNotes && (<div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes for this quotation..." /></div>)}
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
    </>
  );
};

export default QuotationEditor;