import { useQuery, useMutation } from '@tanstack/react-query';
import type { Customer, Invoice, Transaction, Activity, Quotation } from '@/types';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api';

const CUSTOMER_QUERY_KEY = 'customers';

const formatData = (data: any) => {
    const customer: Customer = { 
        ...data.customer, 
        customerNumber: data.customer.customer_number, 
        secondaryPhone: data.customer.secondary_phone, 
        linkedAccountIds: data.customer.linked_account_ids ? JSON.parse(data.customer.linked_account_ids) : [], 
        createdAt: data.customer.created_at 
    };

    const allCustomers: Customer[] = data.allCustomers.map((c: any) => ({ 
        ...c, 
        customerNumber: c.customer_number, 
        secondaryPhone: c.secondary_phone, 
        linkedAccountIds: c.linked_account_ids ? JSON.parse(c.linked_account_ids) : [], 
        createdAt: c.created_at 
    }));

    const invoices: Invoice[] = data.invoices.map((i: any) => ({ 
        ...i, 
        invoiceNumber: i.invoice_number, 
        customerName: i.customer_name, 
        issueDate: i.issue_date, 
        dueDate: i.due_date, 
        lineItems: JSON.parse(i.line_items), 
        createdAt: i.created_at 
    }));

    const transactions: Transaction[] = data.transactions;
    const activities: Activity[] = data.activities.map((a: any) => ({
        ...a,
        performerName: a.performer_name || 'System'
    }));

    const quotations: Quotation[] = data.quotations.map((q: any) => ({
        ...q,
        line_items: JSON.parse(q.line_items)
    }));

    return { customer, allCustomers, invoices, transactions, activities, quotations };
};

export const useCustomerDetails = (customerId: string | undefined) => {
  const { profile } = useAuth();

  return useQuery({
    queryKey: [CUSTOMER_QUERY_KEY, customerId],
    queryFn: async () => {
      if (!profile || !customerId) return null;
      
      const data = await authenticatedFetch(`/api/customers/${customerId}`);
      return formatData(data);
    },
    enabled: !!profile && !!customerId,
    staleTime: 1000 * 60, // 1 minute
  });
};

export const useLinkCustomer = () => {
  return useMutation({
    mutationFn: async ({ sourceCustomer, targetCustomerId }: { sourceCustomer: Customer, targetCustomerId: string }) => {
      await authenticatedFetch('/api/customers/link', {
        method: 'POST',
        body: JSON.stringify({ sourceCustomerId: sourceCustomer.id, targetCustomerId }),
      });
      return { sourceCustomer };
    },
    onSuccess: () => {
      showSuccess("Customers linked successfully!");
    },
    onError: (error) => {
      showError(`Failed to link customers: ${error.message}`);
    },
  });
};

export const useUnlinkCustomer = () => {
  return useMutation({
    mutationFn: async ({ sourceCustomer, targetCustomerId }: { sourceCustomer: Customer, targetCustomerId: string }) => {
      await authenticatedFetch('/api/customers/unlink', {
        method: 'POST',
        body: JSON.stringify({ sourceCustomerId: sourceCustomer.id, targetCustomerId }),
      });
      return { sourceCustomer };
    },
    onSuccess: () => {
      showSuccess("Customers unlinked successfully!");
    },
    onError: (error) => {
      showError(`Failed to unlink customers: ${error.message}`);
    },
  });
};