import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone: z.string()
    .min(1, "Phone number is required.")
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length >= 9 && val.length <= 12, {
        message: "Phone must contain 9 to 12 digits."
    }),
  secondaryPhone: z.string().optional().or(z.literal('')).transform(val => val.replace(/\D/g, '')).refine(
    (val) => val === '' || (val.length >= 9 && val.length <= 12),
    {
        message: "Phone must contain 9 to 12 digits."
    }
  ),
  address: z.string().optional().or(z.literal('')),
  status: z.enum(["Active", "Inactive"]),
  openingBalance: z.coerce.number().default(0),
  balanceType: z.enum(["credit", "debit"]).default("credit"),
});

export type StagedCustomer = z.infer<typeof customerSchema>;

export const productImportSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  sku: z.string().min(1, "SKU is required."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
  barcode: z.string().optional(),
  description: z.string().optional(),
  invoice_description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  startingStock: z.coerce.number().int().min(0).optional(),
  startingCost: z.coerce.number().min(0).optional(),
  weight: z.coerce.number().min(0).optional(),
  warranty_period_days: z.coerce.number().int().min(0).optional(),
  warranty_period_unit: z.enum(['Days', 'Months', 'Years']).optional(),
});

export type StagedProduct = z.infer<typeof productImportSchema>;