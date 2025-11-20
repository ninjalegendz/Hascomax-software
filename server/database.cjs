const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

// Use environment variable for DB path if available, otherwise default to local
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'main.db');

// The directory for the database file is assumed to exist.
// On Render, the mount path (e.g., /var/data) is guaranteed to exist.
// Locally, the 'server' directory exists.

let dbInstance = null;

async function initializeDatabase() {
    if (dbInstance) return dbInstance;

    const SQL = await initSqlJs({
        locateFile: file => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
    });

    let db;
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    const schema = `
      CREATE TABLE IF NOT EXISTS roles ( id TEXT PRIMARY KEY, user_id TEXT, name TEXT, description TEXT, permissions TEXT, created_at TEXT );
      CREATE TABLE IF NOT EXISTS profiles ( id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, role_id TEXT, admin_id TEXT, requires_password_change INTEGER, updated_at TEXT, password TEXT );
      CREATE TABLE IF NOT EXISTS customers ( id TEXT PRIMARY KEY, user_id TEXT, customer_number TEXT, name TEXT, email TEXT, phone TEXT, secondary_phone TEXT, address TEXT, status TEXT, balance REAL, created_at TEXT, linked_account_ids TEXT, created_by TEXT );
      CREATE TABLE IF NOT EXISTS invoices ( id TEXT PRIMARY KEY, user_id TEXT, customer_id TEXT, customer_name TEXT, invoice_number TEXT, issue_date TEXT, due_date TEXT, line_items TEXT, total REAL, status TEXT, created_at TEXT, created_by TEXT, discount REAL, delivery_charge REAL, notes TEXT, show_product_descriptions INTEGER, terms_and_conditions TEXT, show_previous_balance INTEGER, show_notes INTEGER, show_warranty INTEGER, show_warranty_end_date INTEGER );
      CREATE TABLE IF NOT EXISTS transactions ( id TEXT PRIMARY KEY, user_id TEXT, customer_id TEXT, date TEXT, description TEXT, type TEXT, amount REAL, invoice_id TEXT );
      CREATE TABLE IF NOT EXISTS activities ( id TEXT PRIMARY KEY, user_id TEXT, message TEXT, timestamp TEXT, customer_id TEXT, invoice_id TEXT, performer_id TEXT, details TEXT, quotation_id TEXT );
      CREATE TABLE IF NOT EXISTS products ( id TEXT PRIMARY KEY, user_id TEXT, name TEXT, sku TEXT, barcode TEXT, description TEXT, invoice_description TEXT, price REAL, category TEXT, created_at TEXT, created_by TEXT, warranty_period_days INTEGER, warranty_period_unit TEXT, weight REAL DEFAULT 0, product_type TEXT DEFAULT 'standard' );
      CREATE TABLE IF NOT EXISTS bundle_components ( id TEXT PRIMARY KEY, bundle_product_id TEXT, sub_product_id TEXT, quantity INTEGER );
      CREATE TABLE IF NOT EXISTS product_categories (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, is_active INTEGER DEFAULT 1, created_at TEXT);
      CREATE TABLE IF NOT EXISTS product_units (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, is_active INTEGER DEFAULT 1, created_at TEXT);
      CREATE TABLE IF NOT EXISTS inventory_purchases ( id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, purchase_date TEXT, quantity_purchased INTEGER, quantity_remaining INTEGER, unit_cost REAL, supplier TEXT, created_at TEXT, created_by TEXT );
      CREATE TABLE IF NOT EXISTS sales ( id TEXT PRIMARY KEY, user_id TEXT, customer_id TEXT, total_amount REAL, sale_date TEXT, created_by TEXT, invoice_id TEXT );
      CREATE TABLE IF NOT EXISTS sale_items ( id TEXT PRIMARY KEY, sale_id TEXT, product_id TEXT, quantity INTEGER, unit_price REAL, total_price REAL );
      CREATE TABLE IF NOT EXISTS tasks ( id TEXT PRIMARY KEY, user_id TEXT, title TEXT, description TEXT, status TEXT, priority TEXT, due_date TEXT, assignee_id TEXT, created_by TEXT, created_at TEXT );
      CREATE TABLE IF NOT EXISTS task_comments ( id TEXT PRIMARY KEY, user_id TEXT, task_id TEXT, parent_id TEXT, content TEXT, created_at TEXT, created_by TEXT );
      CREATE TABLE IF NOT EXISTS notifications ( id TEXT PRIMARY KEY, user_id TEXT, recipient_id TEXT, actor_id TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT );
      CREATE TABLE IF NOT EXISTS conversations ( id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT, last_message_at TEXT );
      CREATE TABLE IF NOT EXISTS conversation_participants ( id TEXT PRIMARY KEY, conversation_id TEXT, profile_id TEXT );
      CREATE TABLE IF NOT EXISTS messages ( id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, content TEXT, created_at TEXT, is_read INTEGER DEFAULT 0 );
      CREATE TABLE IF NOT EXISTS app_settings ( user_id TEXT PRIMARY KEY, settings TEXT );
      CREATE TABLE IF NOT EXISTS quotations ( id TEXT PRIMARY KEY, user_id TEXT, customer_id TEXT, customer_name TEXT, quotation_number TEXT, issue_date TEXT, expiry_date TEXT, line_items TEXT, total REAL, status TEXT, created_at TEXT, created_by TEXT, converted_invoice_id TEXT, show_notes INTEGER, show_warranty INTEGER, show_warranty_end_date INTEGER, delivery_charge REAL, show_product_descriptions INTEGER, terms_and_conditions TEXT );
      CREATE TABLE IF NOT EXISTS payment_methods (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, is_active INTEGER DEFAULT 1, created_at TEXT);
      CREATE TABLE IF NOT EXISTS purchase_receipts ( id TEXT PRIMARY KEY, purchase_id TEXT, received_by TEXT, received_at TEXT, quantity_received INTEGER, quantity_damaged INTEGER );
      CREATE TABLE IF NOT EXISTS damaged_stock_log ( id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, purchase_receipt_id TEXT, quantity INTEGER, notes TEXT, logged_at TEXT, logged_by TEXT, status TEXT, repair_id TEXT );
      CREATE TABLE IF NOT EXISTS returns ( id TEXT PRIMARY KEY, user_id TEXT, original_invoice_id TEXT, customer_id TEXT, return_receipt_number TEXT, return_date TEXT, total_refund_amount REAL, total_expense_amount REAL, notes TEXT, created_by TEXT, created_at TEXT, restocked INTEGER );
      CREATE TABLE IF NOT EXISTS return_items ( id TEXT PRIMARY KEY, return_id TEXT, sale_item_id TEXT, product_id TEXT, quantity INTEGER, unit_price REAL );
      CREATE TABLE IF NOT EXISTS return_expenses ( id TEXT PRIMARY KEY, return_id TEXT, description TEXT, amount REAL );
      CREATE TABLE IF NOT EXISTS repairs ( id TEXT PRIMARY KEY, user_id TEXT, repair_number TEXT, customer_id TEXT, original_invoice_id TEXT, original_sale_item_id TEXT, product_name TEXT, product_serial_number TEXT, reported_problem TEXT, status TEXT, received_date TEXT, completed_date TEXT, is_warranty INTEGER, warranty_void_reason TEXT, repair_fee REAL, repair_invoice_id TEXT, created_by TEXT, created_at TEXT, damage_log_id TEXT, is_replacement INTEGER DEFAULT 0, replacement_details TEXT );
      CREATE TABLE IF NOT EXISTS repair_items ( id TEXT PRIMARY KEY, repair_id TEXT, product_id TEXT, quantity INTEGER, unit_price REAL );
      CREATE TABLE IF NOT EXISTS repair_images ( id TEXT PRIMARY KEY, repair_id TEXT, image_url TEXT, stage TEXT, side TEXT );
      CREATE TABLE IF NOT EXISTS couriers (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, first_kg_price REAL, additional_kg_price REAL, is_active INTEGER DEFAULT 1, created_at TEXT);
      CREATE TABLE IF NOT EXISTS expense_categories (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, is_active INTEGER DEFAULT 1, created_at TEXT);
      CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, user_id TEXT, date TEXT, description TEXT, amount REAL, category_id TEXT, vendor TEXT, receipt_url TEXT, created_at TEXT, created_by TEXT);
      CREATE TABLE IF NOT EXISTS api_keys ( id TEXT PRIMARY KEY, user_id TEXT, name TEXT, key_prefix TEXT, hashed_key TEXT, created_at TEXT, last_used_at TEXT );
    `;
    db.exec(schema);

    // Migration logic
    try {
        const tablesToMigrate = ['customers', 'invoices', 'transactions', 'activities', 'products', 'inventory_purchases', 'sales'];
        const profilesInfoRes = db.exec("PRAGMA table_info(profiles)");
        const profilesColumns = profilesInfoRes[0].values.map(col => col[1]);
        if (!profilesColumns.includes('password')) {
            db.exec("ALTER TABLE profiles ADD COLUMN password TEXT;");
        }
        
        for (const table of tablesToMigrate) {
            const tableInfoRes = db.exec(`PRAGMA table_info(${table})`);
            const tableColumns = tableInfoRes[0].values.map(col => col[1]);
            if (!tableColumns.includes('user_id')) {
                db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT;`);
            }
        }

        const productsInfoRes = db.exec("PRAGMA table_info(products)");
        const productColumns = productsInfoRes[0].values.map(col => col[1]);
        if (!productColumns.includes('barcode')) {
            db.exec("ALTER TABLE products ADD COLUMN barcode TEXT;");
        }
        if (!productColumns.includes('invoice_description')) {
            db.exec("ALTER TABLE products ADD COLUMN invoice_description TEXT;");
        }
        if (!productColumns.includes('warranty_period_days')) {
            db.exec("ALTER TABLE products ADD COLUMN warranty_period_days INTEGER;");
        }
        if (!productColumns.includes('warranty_period_unit')) {
            db.exec("ALTER TABLE products ADD COLUMN warranty_period_unit TEXT;");
        }
        if (!productColumns.includes('unit')) {
            db.exec("ALTER TABLE products ADD COLUMN unit TEXT;");
        }
        if (!productColumns.includes('weight')) {
            db.exec("ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;");
        }
        if (!productColumns.includes('product_type')) {
            db.exec("ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'standard';");
        }

        const invoicesInfoRes = db.exec("PRAGMA table_info(invoices)");
        const invoiceColumns = invoicesInfoRes[0].values.map(col => col[1]);
        if (!invoiceColumns.includes('discount')) {
            db.exec("ALTER TABLE invoices ADD COLUMN discount REAL;");
        }
        if (!invoiceColumns.includes('delivery_charge')) {
            db.exec("ALTER TABLE invoices ADD COLUMN delivery_charge REAL;");
        }
        if (!invoiceColumns.includes('notes')) {
            db.exec("ALTER TABLE invoices ADD COLUMN notes TEXT;");
        }
        if (!invoiceColumns.includes('show_product_descriptions')) {
            db.exec("ALTER TABLE invoices ADD COLUMN show_product_descriptions INTEGER;");
        }
        if (!invoiceColumns.includes('terms_and_conditions')) {
            db.exec("ALTER TABLE invoices ADD COLUMN terms_and_conditions TEXT;");
        }
        if (!invoiceColumns.includes('show_previous_balance')) {
            db.exec("ALTER TABLE invoices ADD COLUMN show_previous_balance INTEGER;");
        }
        if (!invoiceColumns.includes('return_status')) {
            db.exec("ALTER TABLE invoices ADD COLUMN return_status TEXT DEFAULT 'None';");
        }
        if (!invoiceColumns.includes('show_notes')) {
            db.exec("ALTER TABLE invoices ADD COLUMN show_notes INTEGER;");
        }
        if (!invoiceColumns.includes('show_warranty')) {
            db.exec("ALTER TABLE invoices ADD COLUMN show_warranty INTEGER;");
        }
        if (!invoiceColumns.includes('show_warranty_end_date')) {
            db.exec("ALTER TABLE invoices ADD COLUMN show_warranty_end_date INTEGER;");
        }

        const saleItemsInfoRes = db.exec("PRAGMA table_info(sale_items)");
        const saleItemsColumns = saleItemsInfoRes[0].values.map(col => col[1]);
        if (!saleItemsColumns.includes('quantity_returned')) {
            db.exec("ALTER TABLE sale_items ADD COLUMN quantity_returned INTEGER DEFAULT 0;");
        }

        const salesInfoRes = db.exec("PRAGMA table_info(sales)");
        const salesColumns = salesInfoRes[0].values.map(col => col[1]);
        if (!salesColumns.includes('invoice_id')) {
            db.exec("ALTER TABLE sales ADD COLUMN invoice_id TEXT;");
        }

        const tablesWithCreatedBy = ['customers', 'invoices', 'products', 'inventory_purchases', 'sales'];
        for (const table of tablesWithCreatedBy) {
            const tableInfoRes = db.exec(`PRAGMA table_info(${table})`);
            const tableColumns = tableInfoRes[0].values.map(col => col[1]);
            if (!tableColumns.includes('created_by')) {
                db.exec(`ALTER TABLE ${table} ADD COLUMN created_by TEXT;`);
            }
        }

        const activityInfoRes = db.exec(`PRAGMA table_info(activities)`);
        const activityColumns = activityInfoRes[0].values.map(col => col[1]);
        if (!activityColumns.includes('performer_id')) {
            db.exec(`ALTER TABLE activities ADD COLUMN performer_id TEXT;`);
        }
        if (!activityColumns.includes('details')) {
            db.exec(`ALTER TABLE activities ADD COLUMN details TEXT;`);
        }
        if (!activityColumns.includes('quotation_id')) {
            db.exec(`ALTER TABLE activities ADD COLUMN quotation_id TEXT;`);
        }
        const taskCommentsInfoRes = db.exec(`PRAGMA table_info(task_comments)`);
        const taskCommentsColumns = taskCommentsInfoRes[0].values.map(col => col[1]);
        if (!taskCommentsColumns.includes('parent_id')) {
            db.exec(`ALTER TABLE task_comments ADD COLUMN parent_id TEXT;`);
        }
        const transactionsInfoRes = db.exec(`PRAGMA table_info(transactions)`);
        const transactionsColumns = transactionsInfoRes[0].values.map(col => col[1]);
        if (!transactionsColumns.includes('invoice_id')) {
            db.exec(`ALTER TABLE transactions ADD COLUMN invoice_id TEXT;`);
        }
        if (!transactionsColumns.includes('payment_method')) {
            db.exec(`ALTER TABLE transactions ADD COLUMN payment_method TEXT;`);
        }
        if (!transactionsColumns.includes('cheque_number')) {
            db.exec(`ALTER TABLE transactions ADD COLUMN cheque_number TEXT;`);
        }
        const quotationInfoRes = db.exec(`PRAGMA table_info(quotations)`);
        const quotationColumns = quotationInfoRes[0].values.map(col => col[1]);
        if (!quotationColumns.includes('converted_invoice_id')) {
            db.exec(`ALTER TABLE quotations ADD COLUMN converted_invoice_id TEXT;`);
        }
        if (!quotationColumns.includes('show_notes')) {
            db.exec("ALTER TABLE quotations ADD COLUMN show_notes INTEGER;");
        }
        if (!quotationColumns.includes('show_warranty')) {
            db.exec("ALTER TABLE quotations ADD COLUMN show_warranty INTEGER;");
        }
        if (!quotationColumns.includes('show_warranty_end_date')) {
            db.exec("ALTER TABLE quotations ADD COLUMN show_warranty_end_date INTEGER;");
        }
        if (!quotationColumns.includes('delivery_charge')) {
            db.exec("ALTER TABLE quotations ADD COLUMN delivery_charge REAL;");
        }
        if (!quotationColumns.includes('show_product_descriptions')) {
            db.exec("ALTER TABLE quotations ADD COLUMN show_product_descriptions INTEGER;");
        }
        if (!quotationColumns.includes('terms_and_conditions')) {
            db.exec("ALTER TABLE quotations ADD COLUMN terms_and_conditions TEXT;");
        }
        const purchasesInfoRes = db.exec("PRAGMA table_info(inventory_purchases)");
        const purchasesColumns = purchasesInfoRes[0].values.map(col => col[1]);
        if (!purchasesColumns.includes('status')) {
            db.exec("ALTER TABLE inventory_purchases ADD COLUMN status TEXT;");
            db.exec("UPDATE inventory_purchases SET status = 'Completed' WHERE status IS NULL;");
        }
        if (!purchasesColumns.includes('total_received')) {
            db.exec("ALTER TABLE inventory_purchases ADD COLUMN total_received INTEGER DEFAULT 0;");
            db.exec("UPDATE inventory_purchases SET total_received = quantity_purchased WHERE total_received = 0;");
        }
        const returnsInfoRes = db.exec("PRAGMA table_info(returns)");
        const returnsColumns = returnsInfoRes[0].values.map(col => col[1]);
        if (!returnsColumns.includes('restocked')) {
            db.exec("ALTER TABLE returns ADD COLUMN restocked INTEGER;");
        }
        const damagesInfoRes = db.exec("PRAGMA table_info(damaged_stock_log)");
        const damagesColumns = damagesInfoRes[0].values.map(col => col[1]);
        if (!damagesColumns.includes('status')) {
            db.exec("ALTER TABLE damaged_stock_log ADD COLUMN status TEXT;");
        }
        if (!damagesColumns.includes('repair_id')) {
            db.exec("ALTER TABLE damaged_stock_log ADD COLUMN repair_id TEXT;");
        }

        const repairsInfoRes = db.exec("PRAGMA table_info(repairs)");
        const repairsColumns = repairsInfoRes[0].values.map(col => col[1]);
        if (!repairsColumns.includes('damage_log_id')) {
            db.exec("ALTER TABLE repairs ADD COLUMN damage_log_id TEXT;");
        }
        if (!repairsColumns.includes('is_replacement')) {
            db.exec("ALTER TABLE repairs ADD COLUMN is_replacement INTEGER DEFAULT 0;");
        }
        if (!repairsColumns.includes('replacement_details')) {
            db.exec("ALTER TABLE repairs ADD COLUMN replacement_details TEXT;");
        }
        if (!repairsColumns.includes('is_warranty')) {
            db.exec("ALTER TABLE repairs ADD COLUMN is_warranty INTEGER;");
        }
        if (!repairsColumns.includes('warranty_void_reason')) {
            db.exec("ALTER TABLE repairs ADD COLUMN warranty_void_reason TEXT;");
        }
        if (!repairsColumns.includes('replacement_invoice_id')) {
            db.exec("ALTER TABLE repairs ADD COLUMN replacement_invoice_id TEXT;");
        }
        const productCategoriesInfoRes = db.exec("PRAGMA table_info(product_categories)");
        const productCategoriesColumns = productCategoriesInfoRes[0].values.map(col => col[1]);
        if (!productCategoriesColumns.includes('is_active')) {
            db.exec("ALTER TABLE product_categories ADD COLUMN is_active INTEGER DEFAULT 1;");
        }
    } catch (e) {
        console.log("Could not run migrations, probably because tables are new.", e.message);
    }
    
    if (!fs.existsSync(DB_PATH)) {
        saveDatabase(db);
    }

    console.log(`sql.js database connected and schema ensured at ${DB_PATH}`);
    dbInstance = db;
    return db;
}

function saveDatabase(db) {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error("Failed to save database:", err);
    }
}

module.exports = { initializeDatabase, saveDatabase };