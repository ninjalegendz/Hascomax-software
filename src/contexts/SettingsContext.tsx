import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from './AuthContext';
import { showError, showSuccess } from '@/utils/toast';

export interface AppSettings {
  currency: string;
  companyName: string;
  companyAddress: string;
  companyLogoUrl?: string;
  companyLogoSize: number;
  invoiceFooter?: string;
  defaultInvoiceNotes?: string;
  defaultInvoiceTerms?: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  quotationPrefix: string;
  nextQuotationNumber: number;
  nextReturnNumber: number;
  defaultDueDateDays: number;
  paymentMethods: string;
  showPreviousBalanceOnReceipt: boolean;
  isSystemSleeping: boolean;
  autoWakeUpTime: string;
}

interface SettingsContextType {
  settings: AppSettings | undefined;
  updateSettings: (settings: AppSettings) => void;
  isLoading: boolean;
  isUpdating: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => authenticatedFetch('/api/settings'),
    enabled: !!profile,
  });

  const mutation = useMutation({
    mutationFn: (newSettings: AppSettings) => 
      authenticatedFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      }),
    onSuccess: () => {
      showSuccess('Settings saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      showError(`Failed to save settings: ${error.message}`);
    },
  });

  const updateSettings = (newSettings: AppSettings) => {
    mutation.mutate(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ 
      settings,
      updateSettings,
      isLoading,
      isUpdating: mutation.isPending,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};