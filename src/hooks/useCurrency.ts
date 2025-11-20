import { useSettings } from '@/contexts/SettingsContext';
import { useCallback } from 'react';

export const useCurrency = () => {
  const { settings } = useSettings();
  const currency = settings?.currency || '$';

  const format = useCallback((amount: number | undefined | null) => {
    if (amount === undefined || amount === null) {
      return `${currency}0.00`;
    }
    const formattedAmount = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${currency}${formattedAmount}`;
  }, [currency]);

  return { currency, format };
};