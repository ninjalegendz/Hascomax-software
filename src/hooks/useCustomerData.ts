import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { Customer } from '@/types';
import { showError, showSuccess } from '@/utils/toast';
import { z } from 'zod';
import { customerSchema, type StagedCustomer } from '@/types/schemas';
import { authenticatedFetch } from '@/lib/api';

export type CustomerFormValues = z.infer<typeof customerSchema>;
const CUSTOMER_QUERY_KEY = 'customers';

interface FetchCustomersParams {
  searchTerm: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  status: string;
}

export const useCustomers = ({ searchTerm, page, pageSize, sortBy, sortOrder, status }: FetchCustomersParams) => {
  const { profile } = useAuth();

  return useQuery({
    queryKey: [CUSTOMER_QUERY_KEY, searchTerm, page, pageSize, sortBy, sortOrder, status],
    queryFn: async () => {
      const params = new URLSearchParams({ searchTerm, page: String(page), pageSize: String(pageSize), sortBy, sortOrder, status });
      const data = await authenticatedFetch(`/api/customers?${params}`);
      
      const formattedData: Customer[] = data.customers.map((c: any) => ({
        ...c,
        customerNumber: c.customer_number,
        secondaryPhone: c.secondary_phone,
        linkedAccountIds: c.linked_account_ids ? JSON.parse(c.linked_account_ids) : [],
        createdAt: c.created_at,
        creatorName: c.creator_name,
      }));
      
      return { customers: formattedData, count: data.count };
    },
    enabled: !!profile,
  });
};

export const useAddCustomer = () => {
  return useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      return authenticatedFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      showSuccess("Customer added successfully!");
    },
    onError: (error) => {
      showError(`Failed to add customer: ${error.message}`);
    },
  });
};

export const useUpdateCustomer = () => {
  return useMutation({
    mutationFn: async ({ id, values }: { id: string, values: CustomerFormValues }) => {
      return authenticatedFetch(`/api/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      showSuccess("Customer updated successfully!");
    },
    onError: (error) => {
      showError(`Failed to update customer: ${error.message}`);
    },
  });
};

export const useDeleteCustomer = () => {
  return useMutation({
    mutationFn: async (customer: Customer) => {
      return authenticatedFetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      showSuccess("Customer deleted.");
    },
    onError: (error) => {
      showError(`Failed to delete customer: ${error.message}`);
    },
  });
};

export const useBulkDeleteCustomers = () => {
  return useMutation({
    mutationFn: async (ids: string[]) => {
      return authenticatedFetch(`/api/customers/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    },
    onSuccess: (data) => {
      showSuccess(data.message || "Customers deleted.");
    },
    onError: (error) => {
      showError(`Failed to delete customers: ${error.message}`);
    },
  });
};

export const useMergeCustomers = () => {
  return useMutation({
    mutationFn: async ({ sourceId, destinationId }: { sourceId: string, destinationId: string }) => {
      return authenticatedFetch('/api/customers/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, destinationId }),
      });
    },
    onSuccess: () => {
      showSuccess("Customers merged successfully!");
    },
    onError: (error) => {
      showError(`Failed to merge customers: ${error.message}`);
    },
  });
};

export const useImportCustomers = () => {
  return useMutation({
    mutationFn: async (customers: StagedCustomer[]) => {
      return authenticatedFetch('/api/customers/import', {
        method: 'POST',
        body: JSON.stringify(customers),
      });
    },
    onSuccess: (data) => {
      showSuccess(data.message);
    },
    onError: (error) => {
      showError(`Failed to import customers: ${error.message}`);
    },
  });
};