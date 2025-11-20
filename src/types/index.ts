export type Customer = {
  id: string;
  user_id: string;
  customerNumber: string;
  name: string;
  email?: string;
  phone: string;
  secondaryPhone?: string;
  address: string;
  status: "Active" | "Inactive";
  balance: number;
  createdAt: string; // ISO string
  linkedAccountIds?: string[];
  creatorName?: string;
};

export type SalesCustomer = {
  id: string;
  name: string;
  phone: string;
  secondary_phone?: string;
  balance: number;
};

export type BundleComponent = {
  sub_product_id: string;
  sub_product_name: string;
  sub_product_sku: string;
  quantity: number;
};

export type Product = {
  id: string;
  user_id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  invoice_description?: string;
  price: number;
  category?: string;
  unit?: string;
  createdAt: string; // ISO string
  creatorName?: string;
  warranty_period_days?: number;
  warranty_period_unit?: string;
  weight?: number;
  product_type?: 'standard' | 'bundle';
  components?: BundleComponent[];
};

export type Purchase = {
  id: string;
  user_id: string;
  product_id: string;
  purchase_date: string; // ISO string
  quantity_purchased: number;
  quantity_remaining: number;
  total_received: number;
  status: 'Pending' | 'Partially Received' | 'Completed';
  unit_cost: number;
  supplier?: string;
  created_at: string; // ISO string
  products: { name: string, sku: string }; // For displaying product info
  creatorName?: string;
};

export type PurchaseReceipt = {
  id: string;
  received_at: string;
  receiver_name: string;
  quantity_received: number;
  quantity_damaged: number;
};

export type DamagedItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  notes: string;
  logged_at: string;
  logger_name: string;
  status?: 'Pending Assessment' | 'Repairable' | 'Unrepairable' | 'In Repair' | 'Repaired';
  repair_id?: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  customerId: string;
  date: string; // ISO string
  description: string;
  type: "credit" | "debit";
  amount: number;
  payment_method?: string;
  cheque_number?: string;
};

export type Activity = {
  id: string;
  user_id: string;
  message: string;
  timestamp: string; // ISO string
  customerId?: string;
  invoiceId?: string;
  performerName?: string;
  details?: any;
};

export type LineItem = {
  id: string;
  product_id?: string;
  description: string;
  barcode?: string;
  invoice_description?: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  discount?: number;
  warranty_period_days?: number;
  warranty_period_unit?: string;
  isBundle?: boolean;
  components?: {
    sub_product_id: string;
    sub_product_name: string;
    sub_product_sku: string;
    quantity: number;
  }[];
};

export type Invoice = {
  id: string;
  user_id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerSecondaryPhone?: string;
  issueDate: string; // ISO string
  dueDate: string; // ISO string
  lineItems: LineItem[];
  total: number;
  status: "Draft" | "Sent" | "Paid" | "Overdue" | "Partially Paid";
  createdAt: string;
  creatorName?: string;
  discount?: number;
  deliveryCharge?: number;
  notes?: string;
  showProductDescriptions?: boolean;
  termsAndConditions?: string;
  showPreviousBalance?: boolean;
  showNotes?: boolean;
  showWarranty?: boolean;
  showWarrantyEndDate?: boolean;
  return_status?: 'None' | 'Partially Returned' | 'Fully Returned';
  total_paid?: number;
};

export type Quotation = {
  id: string;
  user_id: string;
  quotation_number: string;
  customer_id: string;
  customer_name: string;
  customerAddress?: string;
  customerPhone?: string;
  customerSecondaryPhone?: string;
  issue_date: string; // ISO string
  expiry_date: string; // ISO string
  line_items: LineItem[];
  total: number;
  status: "Draft" | "Sent" | "Accepted" | "Declined" | "Converted";
  created_at: string;
  created_by: string;
  creator_name?: string;
  notes?: string;
  terms_and_conditions?: string;
  converted_invoice_id?: string;
  showNotes?: boolean;
  showWarranty?: boolean;
  showWarrantyEndDate?: boolean;
  delivery_charge?: number;
  show_product_descriptions?: boolean;
};

export type Sale = {
  id: string;
  user_id: string;
  customer_id: string;
  total_amount: number;
  sale_date: string; // ISO string
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High';
  due_date?: string;
  assignee_id?: string;
  assignee_name?: string;
  created_by: string;
  creator_name?: string;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  creator_name: string;
  created_by: string;
};

export type Conversation = {
  id: string;
  participantName: string;
  participantId: string;
  lastMessage: string;
  lastMessageAt: string; // ISO string
  unreadCount: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string; // ISO string
  is_read: number;
};

export type ReturnItem = {
  id: string;
  return_id: string;
  sale_item_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  description: string;
};

export type ReturnExpense = {
  id: string;
  return_id: string;
  description: string;
  amount: number;
};

export type Return = {
  id: string;
  original_invoice_id: string;
  original_invoice_number: string;
  customer_name: string;
  customer_address?: string;
  customer_phone?: string;
  return_receipt_number: string;
  return_date: string;
  total_refund_amount: number;
  total_expense_amount: number;
  notes?: string;
  creator_name?: string;
  created_at: string;
  items: ReturnItem[];
  expenses: ReturnExpense[];
  payments: Transaction[];
};

export type RepairImage = {
  id: string;
  image_url: string;
  stage: 'before' | 'after';
  side: 'front' | 'back' | 'left' | 'right' | 'top';
};

export type RepairItem = {
  id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
};

export type Repair = {
  id: string;
  repair_number: string;
  customer_id: string;
  customer_name: string;
  original_invoice_id?: string;
  product_name: string;
  reported_problem: string;
  status: 'Received' | 'In Progress' | 'Repaired' | 'Unrepairable' | 'Completed' | 'Completed (Replaced)' | 'Completed (Credit)';
  received_date: string;
  completed_date?: string;
  created_by: string;
  creator_name: string;
  created_at: string;
  images: RepairImage[];
  items: RepairItem[];
  repair_fee?: number;
  repair_invoice_id?: string;
  damage_log_id?: string;
  replacement_invoice_id?: string;
  is_warranty: boolean;
  warranty_void_reason?: string;
};

export type ExpenseCategory = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  category_id: string;
  category_name: string;
  vendor?: string;
  receipt_url?: string;
  created_at: string; // ISO string
  creator_name: string;
};