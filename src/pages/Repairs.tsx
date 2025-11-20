import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Download } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Repair } from '@/types';
import { formatDateSafe } from '@/utils/date';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { RepairCard } from '@/components/RepairCard';
import { useExport } from '@/hooks/useExport';

const Repairs = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canCreate = usePermissions('repairs:create');
  const isMobile = useIsMobile();
  const { handleExport } = useExport();

  const { data: repairs, isLoading } = useQuery<Repair[]>({
    queryKey: ['repairs'],
    queryFn: () => authenticatedFetch('/api/repairs'),
    enabled: !!profile,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Repair Orders</CardTitle>
          <CardDescription>Manage and track all repair jobs.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('repairs')}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          {canCreate && (
            <Button size="sm" className="gap-1" onClick={() => navigate('/repairs/new')}>
              <PlusCircle className="h-3.5 w-3.5" />
              New Repair Order
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : repairs && repairs.length > 0 ? (
              repairs.map((item) => (
                <RepairCard
                  key={item.id}
                  repair={item}
                  onNavigate={(id) => navigate(`/repairs/${id}`)}
                />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-10">No repair orders found.</p>
            )}
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repair #</TableHead>
                  <TableHead>Date Received</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : repairs && repairs.length > 0 ? (
                  repairs.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/repairs/${item.id}`)}>
                      <TableCell className="font-medium">{item.repair_number}</TableCell>
                      <TableCell>{formatDateSafe(item.received_date, "PPP")}</TableCell>
                      <TableCell>{item.customer_name}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell><Badge>{item.status}</Badge></TableCell>
                      <TableCell>{item.creator_name}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No repair orders found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Repairs;