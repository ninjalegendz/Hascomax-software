import React, { useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, FileText, Loader2, Edit } from "lucide-react";
import type { Quotation } from "@/types";
import { QuotationTemplate } from "@/components/QuotationTemplate";
import { showSuccess, showError } from "@/utils/toast";
import { authenticatedFetch } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { PrintControl } from "@/components/PrintControl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentTimeline } from "@/components/DocumentTimeline";
import { BundleContentsCard } from "@/components/BundleContentsCard";

const QuotationDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const canConvert = usePermissions('quotations:convert');
  const canEdit = usePermissions('quotations:edit');

  const { data: quotation, isLoading, isError } = useQuery<Quotation>({
    queryKey: ['quotation', id],
    queryFn: async () => {
      const data = await authenticatedFetch(`/api/quotations/${id}`);
      // Handle backward compatibility for old data structures
      data.line_items = data.line_items.map((item: any) => ({
          ...item,
          unitPrice: item.unitPrice || item.unit_price,
          isBundle: item.isBundle !== undefined ? item.isBundle : (item.product_type === 'bundle'),
      }));
      return data;
    },
    enabled: !!id,
  });

  const conversionMutation = useMutation({
    mutationFn: () => authenticatedFetch(`/api/quotations/${id}/convert`, { method: 'POST' }),
    onSuccess: (data: { invoiceId: string }) => {
      showSuccess("Quotation converted to invoice successfully!");
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      navigate(`/invoices/${data.invoiceId}`);
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  if (isLoading) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  if (isError || !quotation) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-destructive">Quotation not found.</h2>
        <Button asChild variant="link" className="mt-4">
          <Link to="/quotations"><ArrowLeft className="mr-2 h-4 w-4" />Back to Quotations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon"><Link to="/quotations"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-2xl font-bold tracking-tight">Quotation {quotation.quotation_number}</h1>
        </div>
        <div className="flex gap-2">
          <PrintControl documentRef={printRef} fileName={`Quotation-${quotation.quotation_number}`} />
          {quotation.status === 'Draft' && canEdit && (
            <Button asChild>
              <Link to={`/quotations/${quotation.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
          {quotation.status === 'Converted' && quotation.converted_invoice_id ? (
            <Button asChild>
              <Link to={`/invoices/${quotation.converted_invoice_id}`}>
                <FileText className="mr-2 h-4 w-4" />
                Go to Invoice
              </Link>
            </Button>
          ) : canConvert && quotation.status !== 'Converted' ? (
            <Button onClick={() => conversionMutation.mutate()} disabled={conversionMutation.isPending}>
              {conversionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Convert to Invoice
            </Button>
          ) : null}
        </div>
      </div>
      <Tabs defaultValue="document">
        <TabsList>
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="document" className="space-y-6">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <QuotationTemplate ref={printRef} quotation={quotation} />
            </CardContent>
          </Card>
          <BundleContentsCard lineItems={quotation.line_items} />
        </TabsContent>
        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-6">
              <DocumentTimeline documentId={quotation.id} documentType="quotation" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuotationDetails;