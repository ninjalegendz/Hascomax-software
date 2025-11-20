import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Loader2, ArrowLeft } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { showError, showSuccess } from '@/utils/toast';
import type { SalesCustomer, LineItem } from '@/types';

interface EligibleReceipt {
  id: string;
  invoice_number: string;
  customer_name: string;
}

interface ReceiptDetails {
  lineItems: (LineItem & { quantity_returned: number })[];
}

const repairSchema = z.object({
  fromReceipt: z.boolean(),
  customerId: z.string().min(1, "Customer is required."),
  receiptId: z.string().optional(),
  saleItemId: z.string().optional(),
  productName: z.string().optional(),
  componentName: z.string().optional(),
  reportedProblem: z.string().min(5, "Please describe the problem in more detail."),
}).refine(data => {
  if (data.fromReceipt) {
    return !!data.receiptId && !!data.saleItemId;
  }
  return !!data.productName;
}, {
  message: "Required fields are missing for the selected repair type.",
  path: ["fromReceipt"],
});

const NewRepair = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fromReceipt, setFromReceipt] = useState(false);

  const form = useForm<z.infer<typeof repairSchema>>({
    resolver: zodResolver(repairSchema),
    defaultValues: {
      fromReceipt: false,
      customerId: '',
      reportedProblem: '',
    },
  });

  const { data: customers, isLoading: isLoadingCustomers } = useQuery<SalesCustomer[]>({
    queryKey: ['customers-for-sale'],
    queryFn: () => authenticatedFetch('/api/customers-for-sale'),
  });

  const { data: eligibleReceipts, isLoading: isLoadingReceipts } = useQuery<EligibleReceipt[]>({
    queryKey: ['eligibleReceiptsForRepair'],
    queryFn: () => authenticatedFetch('/api/repairs/eligible-receipts'),
    enabled: fromReceipt,
  });

  const selectedReceiptId = form.watch('receiptId');
  const { data: receiptDetails, isLoading: isLoadingReceiptDetails } = useQuery<ReceiptDetails>({
    queryKey: ['receiptDetailsForRepair', selectedReceiptId],
    queryFn: () => authenticatedFetch(`/api/repairs/receipt-details/${selectedReceiptId}`),
    enabled: !!selectedReceiptId,
  });

  const selectedSaleItemId = form.watch('saleItemId');
  const selectedItem = receiptDetails?.lineItems.find(item => item.id === selectedSaleItemId);
  const isBundle = selectedItem?.isBundle;

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof repairSchema>) => authenticatedFetch('/api/repairs', {
      method: 'POST',
      body: JSON.stringify(values),
    }),
    onSuccess: (data) => {
      showSuccess('Repair order created successfully!');
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      navigate(`/repairs/${data.id}`);
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  const onSubmit = (values: z.infer<typeof repairSchema>) => {
    mutation.mutate(values);
  };

  const customerOptions = customers?.map(c => ({ value: c.id, label: `${c.name} (${c.phone})` })) || [];
  const receiptOptions = eligibleReceipts?.map(r => ({ value: r.id, label: `${r.invoice_number} - ${r.customer_name}` })) || [];
  const itemOptions = receiptDetails?.lineItems
    .filter(item => item.quantity - item.quantity_returned > 0)
    .map(item => ({ value: item.id, label: item.description })) || [];

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/repairs')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <CardTitle>New Repair Order</CardTitle>
            <CardDescription>Log a new item received for repair.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fromReceipt"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Create from Sales Receipt?</FormLabel>
                    <p className="text-sm text-muted-foreground">This helps track warranty status and product details automatically.</p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setFromReceipt(checked);
                        form.reset({ ...form.getValues(), receiptId: '', saleItemId: '', productName: '', componentName: '' });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {fromReceipt ? (
              <>
                <FormField
                  control={form.control}
                  name="receiptId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Receipt</FormLabel>
                      {isLoadingReceipts ? (
                        <div className="flex items-center justify-center h-10 border rounded-md"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : (
                        <Combobox
                          options={receiptOptions}
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            const receipt = eligibleReceipts?.find(r => r.id === value);
                            const customer = customers?.find(c => c.name === receipt?.customer_name);
                            if (customer) form.setValue('customerId', customer.id);
                          }}
                          placeholder="Select a receipt..."
                          searchPlaceholder="Search receipts..."
                        />
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedReceiptId && (
                  <FormField
                    control={form.control}
                    name="saleItemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item to Repair</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger disabled={isLoadingReceiptDetails}>
                              <SelectValue placeholder={isLoadingReceiptDetails ? "Loading items..." : "Select an item..."} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {itemOptions.map(item => (
                              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {isBundle && (
                  <FormField
                    control={form.control}
                    name="componentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specific Component</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select the component to repair..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedItem?.components?.map(comp => (
                              <SelectItem key={comp.sub_product_id} value={comp.sub_product_name}>{comp.sub_product_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      {isLoadingCustomers ? (
                        <div className="flex items-center justify-center h-10 border rounded-md"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : (
                        <Combobox
                          options={customerOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a customer..."
                          searchPlaceholder="Search customers..."
                        />
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name / Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., iPhone 13 Pro, Serial #XYZ" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="reportedProblem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reported Problem</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the issue reported by the customer..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="text-center text-muted-foreground text-sm p-4 border rounded-md">
              Image uploads for "Before" and "After" stages will be available on the repair details page after creation.
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Repair Order
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default NewRepair;