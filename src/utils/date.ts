import { format, isValid, formatDistanceToNow, addDays, addMonths, addYears } from 'date-fns';

export const formatDateSafe = (
  date: string | Date | undefined | null,
  formatString: string = 'PPP',
  fallback: string = 'N/A'
): string => {
  if (!date) {
    return fallback;
  }
  const dateObj = new Date(date);
  if (isValid(dateObj)) {
    return format(dateObj, formatString);
  }
  return fallback;
};

export const formatDistanceToNowSafe = (
  date: string | Date | undefined | null,
  options?: {
    includeSeconds?: boolean;
    addSuffix?: boolean;
    locale?: any;
  },
  fallback: string = 'a while ago'
): string => {
  if (!date) {
    return fallback;
  }
  const dateObj = new Date(date);
  if (isValid(dateObj)) {
    return formatDistanceToNow(dateObj, options);
  }
  return fallback;
};

export const calculateExpiryDate = (
  startDate: string | Date,
  duration: number,
  unit: 'Days' | 'Months' | 'Years' | string | undefined | null
): Date | null => {
  const dateObj = new Date(startDate);
  if (!isValid(dateObj) || !duration || duration <= 0) {
    return null;
  }

  switch (unit) {
    case 'Days':
      return addDays(dateObj, duration);
    case 'Months':
      return addMonths(dateObj, duration);
    case 'Years':
      return addYears(dateObj, duration);
    default:
      return addDays(dateObj, duration); // Default to days if unit is not specified
  }
};