import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, PlusCircle, Loader2, ArrowUpDown, Settings, Trash2, Download, Upload, Wrench } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTablePagination } from "@/components/DataTablePagination";
import { showError, showSuccess } from "@/utils/toast";
import type { Product, BundleComponent } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { useCurrency } from "@/hooks/useCurrency";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox } from "@/components/ui/combobox";
import { CategoryManagerDialog } from "@/components/CategoryManagerDialog";
import { UnitManagerDialog } from "@/components/UnitManagerDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useLocalStorageState from "@/hooks/useLocalStorageState";
import { useIsMobile } from "@/hooks/use-mobile";
import { InventoryCard } from "@/components/InventoryCard";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExport } from "@/hooks/useExport";
import { ProductImporter } from "@/components/ProductImporter";
import { StockAdjustmentDialog } from "@/components/StockAdjustmentDialog";

type ProductWithQuantity = Product & { quantity: number };

const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  sku: z.string().min(1, "SKU is required."),
  barcode: z.string().optional(),
  description: z.string().optional(),
  invoice_description: z.string().optional(),
  price: z.coerce.number().min(0, "Price cannot be negative."),
  category: z.string().optional(),
  unit: z.string().optional(),
  warranty_period_days: z.coerce.number().int().min(0, "Warranty must be a positive number.").optional(),
  warranty_period_unit: z.string().optional(),
  weight: z.coerce.number().min(0, "Weight cannot be negative.").optional(),
  product_type: z.enum(['standard', 'bundle']),
  components: z.array(z.object({
    sub_product_id: z.string(),
    quantity: z.coerce.number().int().min(1),
  })).optional(),
  startingStock: z.coerce.number().int().min(0).optional(),
  startingCost: z.coerce.number().min(0).optional(),
}).refine(data => {
    if (data.product_type === 'bundle') {
        return data.components && data.components.length > 0;
    }
    return true;
}, {
    message: "A bundle must have at least one component.",
    path: ["components"],
});

const Inventory = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isUnitManagerOpen, setIsUnitManagerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithQuantity | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useLocalStorageState('inventory-sorting', { sortBy: 'created_at', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [componentPickerValue, setComponentPickerValue] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<ProductWithQuantity | null>(null);

  const { profile } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { handleExport } = useExport();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['inventory', searchTerm, currentPage, pageSize, sorting, categoryFilter, stockStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        searchTerm, 
        page: String(currentPage), 
        pageSize: String(pageSize), 
        sortBy: sorting.sortBy, 
        sortOrder: sorting.sortOrder,
        category: categoryFilter,
        stockStatus: stockStatusFilter
      });
      const res = await authenticatedFetch(`/api/products?${params}`);
      return res as { products: ProductWithQuantity[], count: number };
    },
    enabled: !!profile,
  });

  const { data: categories } = useQuery<{ id: string, name: string }[]>({
    queryKey: ['productCategories'],
    queryFn: () => authenticatedFetch('/api/product-categories'),
    enabled: !!profile,
  });

  const { data: units } = useQuery<{ id: string, name: string }[]>({
    queryKey: ['productUnits'],
    queryFn: () => authenticatedFetch('/api/product-units'),
    enabled: !!profile,
  });

  const { data: standardProductsForBundle } = useQuery<ProductWithQuantity[]>({
    queryKey: ['standardProductsForBundle'],
    queryFn: () => authenticatedFetch('/api/products?type=standard').then(data => data.products),
    enabled: isAddDialogOpen,
  });

  const importMutation = useMutation({
    mutationFn: (products: any[]) => authenticatedFetch('/api/products/import', {
      method: 'POST',
      body: JSON.stringify(products),
    }),
    onSuccess: (data) => {
      showSuccess(data.message);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => showError(`Failed to import products: ${(error as Error).message}`),
  });

  const stockAdjustmentMutation = useMutation({
    mutationFn: ({ productId, newQuantity, reason }: { productId: string, newQuantity: number, reason: string }) => 
      authenticatedFetch(`/api/products/${productId}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({ newQuantity, reason }),
      }),
    onSuccess: () => {
      showSuccess("Stock adjusted successfully.");
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsAdjustStockOpen(false);
    },
    onError: (error) => showError((error as Error).message),
  });

  const products = data?.products || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", sku: "", barcode: "", description: "", invoice_description: "", price: 0, category: "", unit: "", warranty_period_days: 0, warranty_period_unit: "Days", weight: 0, product_type: 'standard', components: [] },
  });

  React.useEffect(() => {
    if (isAddDialogOpen) {
      if (editingProduct) {
        form.reset({
          ...editingProduct,
          barcode: editingProduct.barcode || "",
          description: editingProduct.description || "",
          invoice_description: editingProduct.invoice_description || "",
          category: editingProduct.category || "",
          unit: editingProduct.unit || "",
          price: editingProduct.price || 0,
          warranty_period_days: editingProduct.warranty_period_days || 0,
          warranty_period_unit: editingProduct.warranty_period_unit || "Days",
          weight: editingProduct.weight || 0,
          product_type: editingProduct.product_type || 'standard',
          components: editingProduct.components?.map(c => ({ sub_product_id: c.sub_product_id, quantity: c.quantity })) || [],
        });
      } else {
        form.reset({ name: "", sku: "", barcode: "", description: "", invoice_description: "", price: 0, category: "", unit: "", warranty_period_days: 0, warranty_period_unit: "Days", weight: 0, product_type: 'standard', components: [] });
      }
    }
  }, [editingProduct, form, isAddDialogOpen]);

  const handleSort = (column: string) => {
    setSorting(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  async function onSubmit(values: z.infer<typeof productSchema>) {
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      await authenticatedFetch(url, { method, body: JSON.stringify(values) });
      showSuccess(editingProduct ? "Product updated!" : "Product added!");
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      handleAddDialogClose();
    } catch (error) {
      showError((error as Error).message);
    }
  }

  async function confirmDelete() {
    if (!productToDelete) return;
    try {
      await authenticatedFetch(`/api/products/${productToDelete.id}`, { method: 'DELETE' });
      showSuccess("Product deleted.");
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setProductToDelete(null);
    }
  }

  const getStockStatus = (quantity: number) => {
    if (quantity <= 0) return { text: "Out of Stock", variant: "destructive" as const };
    if (quantity <= 10) return { text: "Low Stock", variant: "secondary" as const };
    return { text: "In Stock", variant: "default" as const };
  };

  const handleEditClick = (product: ProductWithQuantity) => {
    setEditingProduct(product);
    setIsAddDialogOpen(true);
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setIsAddDialogOpen(true);
  };

  const handleAddDialogClose = () => {
    setIsAddDialogOpen(false);
    setEditingProduct(null);
  };

  const handleImportProducts = (stagedProducts: any[]) => {
    importMutation.mutate(stagedProducts);
    setIsImportDialogOpen(false);
  };

  const handleAdjustStockClick = (product: ProductWithQuantity) => {
    setStockAdjustProduct(product);
    setIsAdjustStockOpen(true);
  };

  const handleConfirmStockAdjustment = (values: { newQuantity: number, reason: string }) => {
    if (stockAdjustProduct) {
      stockAdjustmentMutation.mutate({ productId: stockAdjustProduct.id, ...values });
    }
  };

  const categoryOptions = categories?.map(c => ({ value: c.name, label: c.name })) || [];
  const unitOptions = units?.map(u => ({ value: u.name, label: u.name })) || [];
  const standardProductOptions = standardProductsForBundle
    ?.filter(p => p.id !== editingProduct?.id)
    .map(p => ({ value: p.id, label: `${p.name} (${p.sku})` })) || [];

  const productType = form.watch('product_type');
  const components = form.watch('components') || [];

  const addComponent = (sub_product_id: string) => {
    if (sub_product_id && !components.some(c => c.sub_product_id === sub_product_id)) {
      form.setValue('components', [...components, { sub_product_id, quantity: 1 }]);
    }
  };

  const updateComponentQuantity = (sub_product_id: string, quantity: number) => {
    form.setValue('components', components.map(c => c.sub_product_id === sub_product_id ? { ...c, quantity } : c));
  };

  const removeComponent = (sub_product_id: string) => {
    form.setValue('components', components.filter(c => c.sub_product_id !== sub_product_id));
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Inventory Items</CardTitle>
            <CardDescription>Manage your products. Stock levels are updated from Purchases.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('inventory')}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export all inventory to a CSV file</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsImportDialogOpen(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Import</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Import products from a CSV file</p></TooltipContent>
            </Tooltip>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1" onClick={handleAddClick}>
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-rap">Add Product</span>
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add a new product to your inventory.</p>
                </TooltipContent>
              </Tooltip>
              <DialogContent className="sm:max-w-2xl" onCloseAutoFocus={handleAddDialogClose}>
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                  <DialogDescription>Fill in the product details below.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] -mx-6">
                  <div className="px-6">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="product_type" render={({ field }) => (
                          <FormItem className="space-y-3"><FormLabel>Product Type</FormLabel>
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="standard" /></FormControl><FormLabel className="font-normal">Standard</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="bundle" /></FormControl><FormLabel className="font-normal">Bundle</FormLabel></FormItem>
                              </RadioGroup>
                            </FormControl><FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Product Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU</FormLabel><FormControl><Input placeholder="SKU-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="barcode" render={({ field }) => (<FormItem><FormLabel>Barcode (optional)</FormLabel><FormControl><Input placeholder="123456789012" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Product description..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="invoice_description" render={({ field }) => (<FormItem><FormLabel>Invoice Description (optional)</FormLabel><FormControl><Textarea placeholder="A short description to show on invoices..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Selling Price</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="space-y-2">
                            <FormLabel>Warranty</FormLabel>
                            <div className="grid grid-cols-2 gap-2">
                              <FormField control={form.control} name="warranty_period_days" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="e.g., 1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name="warranty_period_unit" render={({ field }) => (
                                <FormItem>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="Days">Days</SelectItem>
                                      <SelectItem value="Months">Months</SelectItem>
                                      <SelectItem value="Years">Years</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                          </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem><FormLabel>Category</FormLabel>
                              <div className="flex gap-2">
                                <Combobox options={categoryOptions} value={field.value} onChange={field.onChange} placeholder="Select a category..." searchPlaceholder="Search categories..." emptyMessage="No categories found." />
                                <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryManagerOpen(true)}><Settings className="h-4 w-4" /></Button>
                              </div><FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="unit" render={({ field }) => (
                            <FormItem><FormLabel>Unit</FormLabel>
                              <div className="flex gap-2">
                                <Combobox options={unitOptions} value={field.value} onChange={field.onChange} placeholder="Select a unit..." searchPlaceholder="Search units..." emptyMessage="No units found." />
                                <Button type="button" variant="outline" size="icon" onClick={() => setIsUnitManagerOpen(true)}><Settings className="h-4 w-4" /></Button>
                              </div><FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        {productType === 'bundle' ? (
                          <div className="space-y-4 pt-4 border-t">
                            <h3 className="font-medium">Bundle Components</h3>
                            <Combobox
                              options={standardProductOptions}
                              value={componentPickerValue}
                              onChange={(value) => {
                                addComponent(value);
                                setComponentPickerValue('');
                              }}
                              placeholder="Add a component..."
                              searchPlaceholder="Search products..."
                            />
                            <div className="space-y-2">
                              {components.map(comp => {
                                const product = standardProductOptions.find(p => p.value === comp.sub_product_id);
                                return (
                                  <div key={comp.sub_product_id} className="flex items-center gap-2">
                                    <span className="flex-1">{product?.label}</span>
                                    <Input type="number" value={comp.quantity} onChange={e => updateComponentQuantity(comp.sub_product_id, parseInt(e.target.value) || 1)} className="w-20 h-8" />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeComponent(comp.sub_product_id)}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                );
                              })}
                            </div>
                            <FormField control={form.control} name="components" render={() => <FormItem><FormMessage /></FormItem>} />
                          </div>
                        ) : !editingProduct && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <FormField control={form.control} name="startingStock" render={({ field }) => (<FormItem><FormLabel>Starting Stock</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="startingCost" render={({ field }) => (<FormItem><FormLabel>Unit Cost</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                        )}
                        <DialogFooter className="pt-4">
                          <DialogClose asChild><Button type="button" variant="secondary" onClick={handleAddDialogClose}>Cancel</Button></DialogClose>
                          <Button type="submit">{editingProduct ? "Save Changes" : "Add Product"}</Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 mb-4">
            <Input
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by stock status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Statuses</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isMobile ? (
            <div className="space-y-4">
              {isLoading || isFetching ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : products.length > 0 ? (
                products.map((product) => (
                  <InventoryCard
                    key={product.id}
                    product={product}
                    onEdit={() => handleEditClick(product)}
                    onDelete={setProductToDelete}
                    onNavigate={(id) => navigate(`/inventory/${id}`)}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-10">No products found.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('sku')}>SKU <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Name <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('quantity')}>Total Quantity <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('creatorName')}>Created By <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('price')}>Price <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : products.length > 0 ? (
                    products.map((product) => {
                      const status = getStockStatus(product.quantity);
                      return (
                        <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/inventory/${product.id}`)}>
                          <TableCell className="font-medium">{product.sku}</TableCell>
                          <TableCell>{product.name} {product.product_type === 'bundle' && <Badge variant="secondary">Bundle</Badge>}</TableCell>
                          <TableCell><Badge variant={status.variant}>{status.text}</Badge></TableCell>
                          <TableCell>{product.quantity} {product.product_type === 'bundle' ? <span className="text-xs text-muted-foreground">(Calculated)</span> : product.unit || ''}</TableCell>
                          <TableCell>{product.creatorName || 'N/A'}</TableCell>
                          <TableCell className="text-right">{format(product.price)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>More actions</p>
                                </TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditClick(product)}>Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAdjustStockClick(product)}>Adjust Stock</DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setProductToDelete(product)} className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No products found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {totalPages > 0 && (
          <div className="p-4 border-t">
            <DataTablePagination 
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              setPage={setCurrentPage}
              setPageSize={setPageSize}
              totalCount={totalCount}
            />
          </div>
        )}
      </Card>
      <CategoryManagerDialog isOpen={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen} />
      <UnitManagerDialog isOpen={isUnitManagerOpen} onOpenChange={setIsUnitManagerOpen} />
      <AlertDialog open={!!productToDelete} onOpenChange={(isOpen) => !isOpen && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this product and all associated purchase history.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <ProductImporter onImport={handleImportProducts} />
        </DialogContent>
      </Dialog>
      <StockAdjustmentDialog
        isOpen={isAdjustStockOpen}
        onOpenChange={setIsAdjustStockOpen}
        product={stockAdjustProduct}
        onConfirm={handleConfirmStockAdjustment}
        isAdjusting={stockAdjustmentMutation.isPending}
      />
    </>
  );
};

export default Inventory;