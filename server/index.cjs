const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { initializeDatabase, saveDatabase } = require("./database.cjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const https = require("https");
const Papa = require("papaparse");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[Backend Received] ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(__dirname, "uploads");
app.use("/uploads", express.static(UPLOADS_PATH));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(UPLOADS_PATH)) {
      fs.mkdirSync(UPLOADS_PATH, { recursive: true });
    }
    cb(null, UPLOADS_PATH);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only JPG, PNG, GIF, and WEBP are allowed."),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const PORT = 3000;
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "FATAL ERROR: JWT_SECRET is not set in production environment. Exiting."
    );
    process.exit(1);
  } else {
    JWT_SECRET = "temporary-development-secret";
    console.warn(
      "WARNING: JWT_SECRET is not set. Using a temporary secret for this session. SET THIS IN AN ENVIRONMENT VARIABLE FOR PRODUCTION!"
    );
  }
}

const MOCK_FIRST_NAMES = [
  "John",
  "Jane",
  "Peter",
  "Alice",
  "Michael",
  "Emily",
  "David",
  "Sarah",
  "Chris",
  "Laura",
];
const MOCK_LAST_NAMES = [
  "Smith",
  "Jones",
  "Williams",
  "Brown",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
];
const MOCK_NOUNS = [
  "Widget",
  "Gadget",
  "Thingamajig",
  "Doohickey",
  "Contraption",
  "Device",
  "Apparatus",
  "Gizmo",
];
const MOCK_ADJECTIVES = [
  "Super",
  "Mega",
  "Turbo",
  "Hyper",
  "Power",
  "Quantum",
  "Nano",
  "Giga",
];
const MOCK_STREETS = [
  "Main St",
  "Oak Ave",
  "Pine Ln",
  "Maple Dr",
  "Cedar Blvd",
  "Elm Ct",
  "Birch Rd",
];
const MOCK_CITIES = [
  "Springfield",
  "Shelbyville",
  "Capital City",
  "Ogdenville",
  "North Haverbrook",
];

const formatSqlJsResult = (res) => {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
};

const normalizePhoneNumber = (phone) => {
  if (!phone) return "";
  let normalized = phone.replace(/\D/g, "");
  if (normalized.startsWith("94") && normalized.length === 11) {
    return normalized.substring(2);
  }
  if (normalized.startsWith("0") && normalized.length === 10) {
    return normalized.substring(1);
  }
  return normalized;
};

// Fixed logActivity function - now properly saves to database
const logActivity = (db, message, options = {}) => {
  try {
    const {
      user_id,
      customer_id,
      invoice_id,
      performer_id,
      details,
      quotation_id,
    } = options;
    const newActivityId = crypto.randomUUID();

    const stmt = db.prepare(
      "INSERT INTO activities (id, user_id, message, customer_id, invoice_id, timestamp, performer_id, details, quotation_id) VALUES (:id, :user_id, :message, :customer_id, :invoice_id, :timestamp, :performer_id, :details, :quotation_id)"
    );

    stmt.run({
      ":id": newActivityId,
      ":user_id": user_id || null,
      ":message": message,
      ":customer_id": customer_id || null,
      ":invoice_id": invoice_id || null,
      ":timestamp": new Date().toISOString(),
      ":performer_id": performer_id || null,
      ":details": details ? JSON.stringify(details) : null,
      ":quotation_id": quotation_id || null,
    });

    stmt.free();
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const apiKeyMiddleware = async (req, res, next) => {
  const db = await initializeDatabase();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "API key is missing or improperly formatted." });
  }
  const apiKey = authHeader.split(" ")[1];

  try {
    const allKeysRes = db.exec(`SELECT id, user_id, hashed_key FROM api_keys`);
    const allKeys = formatSqlJsResult(allKeysRes);

    let validKey = null;
    for (const key of allKeys) {
      const isMatch = await bcrypt.compare(apiKey, key.hashed_key);
      if (isMatch) {
        validKey = key;
        break;
      }
    }

    if (!validKey) {
      return res.status(401).json({ error: "Invalid API key." });
    }

    req.user = { id: validKey.user_id, admin_id: validKey.user_id }; // Set user context for API requests

    // Update last_used_at without blocking the response
    db.run("UPDATE api_keys SET last_used_at = ? WHERE id = ?", [
      new Date().toISOString(),
      validKey.id,
    ]);
    saveDatabase(db);

    next();
  } catch (err) {
    res
      .status(500)
      .json({ error: "Internal server error during authentication." });
  }
};

const activeUsers = new Map(); // Map<socketId, { userId: string, name: string, isAdmin: boolean }>

async function main() {
  const db = await initializeDatabase();

  app.get("/api/image-proxy", authMiddleware, (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send("Image URL is required");
    }

    try {
      const parsedUrl = new URL(imageUrl);
      const { hostname, protocol } = parsedUrl;

      if (!["http:", "https:"].includes(protocol)) {
        return res.status(400).send("Invalid protocol.");
      }

      // Basic SSRF protection
      const forbiddenHostnames = ["localhost", "127.0.0.1", "169.254.169.254"];
      if (
        forbiddenHostnames.includes(hostname) ||
        hostname.endsWith(".internal") ||
        hostname.endsWith(".local")
      ) {
        return res.status(403).send("Forbidden host.");
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent": req.headers["user-agent"],
        },
      };

      const protocolToUse = parsedUrl.protocol === "https:" ? https : http;

      const proxyReq = protocolToUse.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, {
          end: true,
        });
      });

      proxyReq.on("error", (e) => {
        console.error(`Problem with image proxy request: ${e.message}`);
        res.status(502).send(`Error fetching image: ${e.message}`);
      });

      proxyReq.end();
    } catch (e) {
      console.error(`Invalid URL for image proxy: ${imageUrl}`);
      res.status(400).send("Invalid image URL");
    }
  });

  const defaultSettings = {
    currency: "$",
    companyName: "BizManager Inc.",
    companyAddress: "123 Innovation Drive, Tech City",
    companyLogoSize: 80,
    defaultInvoiceNotes: "Thank you for your business!",
    defaultInvoiceTerms: "Payment is due within 30 days.",
    invoicePrefix: "INV-",
    nextInvoiceNumber: 1,
    quotationPrefix: "QUO-",
    nextQuotationNumber: 1,
    nextReturnNumber: 1,
    defaultDueDateDays: 30,
    paymentMethods: "Cash,Card,Bank Transfer",
    showPreviousBalanceOnReceipt: false,
    isSystemSleeping: false,
    autoWakeUpTime: "08:00",
  };

  const getSettings = (db, adminId) => {
    const stmt = db.prepare(
      "SELECT settings FROM app_settings WHERE user_id = :adminId"
    );
    stmt.bind({ ":adminId": adminId });
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    if (result) {
      return { ...defaultSettings, ...JSON.parse(result.settings) };
    }
    return defaultSettings;
  };

  const fetchProfile = (db, userId) => {
    const stmt = db.prepare(
      "SELECT p.*, r.permissions FROM profiles p LEFT JOIN roles r ON p.role_id = r.id WHERE p.id = :userId"
    );
    stmt.bind({ ":userId": userId });
    const profile = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();

    if (!profile) return null;

    profile.permissions = profile.permissions
      ? JSON.parse(profile.permissions)
      : [];
    delete profile.password;
    return profile;
  };

  const getAdminId = (db, userId) => {
    const profile = fetchProfile(db, userId);
    return profile ? profile.admin_id : null;
  };

  const permissionMiddleware = (requiredPermissions) => {
    return (req, res, next) => {
      const userProfile = fetchProfile(db, req.user.id);
      if (!userProfile) {
        return res.status(401).json({ error: "User profile not found." });
      }

      const userPermissions = new Set(userProfile.permissions);
      const permissionsToCheck = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      const hasPermission = permissionsToCheck.every((p) =>
        userPermissions.has(p)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: "Forbidden: You do not have the required permissions.",
        });
      }
      next();
    };
  };

  // --- API V1 ROUTES ---
  const apiV1Router = express.Router();
  apiV1Router.use(apiKeyMiddleware);

  // Customers
  apiV1Router.get("/customers", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const { limit = 20, page = 1 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const totalCountStmt = db.prepare(
        "SELECT COUNT(*) as count FROM customers WHERE user_id = :adminId"
      );
      totalCountStmt.bind({ ":adminId": adminId });
      const totalCount = totalCountStmt.step()
        ? totalCountStmt.getAsObject().count
        : 0;
      totalCountStmt.free();

      const customersStmt = db.prepare(
        `SELECT id, customer_number, name, email, phone, secondary_phone, address, status, balance, created_at FROM customers WHERE user_id = :adminId ORDER BY created_at DESC LIMIT :limit OFFSET :offset`
      );
      customersStmt.bind({
        ":adminId": adminId,
        ":limit": parseInt(limit),
        ":offset": offset,
      });
      const customers = [];
      while (customersStmt.step()) customers.push(customersStmt.getAsObject());
      customersStmt.free();

      res.json({
        data: customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total_items: totalCount,
          total_pages: Math.ceil(totalCount / parseInt(limit)),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.get("/customers/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const stmt = db.prepare(
        "SELECT id, customer_number, name, email, phone, secondary_phone, address, status, balance, created_at FROM customers WHERE id = :id AND user_id = :adminId"
      );
      stmt.bind({ ":id": req.params.id, ":adminId": adminId });
      const customer = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      if (!customer)
        return res.status(404).json({ error: "Customer not found" });
      res.json({ data: customer });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.post("/customers", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const { name, email, phone, address, status = "Active" } = req.body;
      if (!name || !phone || !address)
        return res
          .status(400)
          .json({ error: "name, phone, and address are required." });

      const lastCustomerStmt = db.prepare(
        "SELECT customer_number FROM customers WHERE user_id = :adminId ORDER BY customer_number DESC LIMIT 1"
      );
      lastCustomerStmt.bind({ ":adminId": adminId });
      const lastCustomer = lastCustomerStmt.step()
        ? lastCustomerStmt.getAsObject()
        : null;
      lastCustomerStmt.free();

      let nextCustomerNum = 1;
      if (lastCustomer) {
        const lastNum = parseInt(lastCustomer.customer_number.split("-")[1]);
        nextCustomerNum = lastNum + 1;
      }
      const customerNumber = "CUS-" + String(nextCustomerNum).padStart(4, "0");
      const customerId = crypto.randomUUID();

      db.exec("BEGIN");
      db.run(
        "INSERT INTO customers (id, user_id, customer_number, name, email, phone, address, status, balance, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          customerId,
          adminId,
          customerNumber,
          name,
          email,
          phone,
          address,
          status,
          0,
          new Date().toISOString(),
          req.user.id,
        ]
      );
      logActivity(db, `created customer ${name} via API.`, {
        user_id: adminId,
        customer_id: customerId,
        performer_id: req.user.id,
      });
      db.exec("COMMIT");
      saveDatabase(db);

      io.emit("data_changed", { table: "customers" });
      io.emit("data_changed", { table: "activities" });

      const newCustomerStmt = db.prepare(
        "SELECT * FROM customers WHERE id = :id"
      );
      newCustomerStmt.bind({ ":id": customerId });
      const newCustomer = newCustomerStmt.step()
        ? newCustomerStmt.getAsObject()
        : null;
      newCustomerStmt.free();
      res.status(201).json({ data: newCustomer });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.put("/customers/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const customerId = req.params.id;
      const { name, email, phone, address, status } = req.body;

      db.exec("BEGIN");
      const oldCustomerStmt = db.prepare(
        "SELECT * FROM customers WHERE id = :id AND user_id = :adminId"
      );
      oldCustomerStmt.bind({ ":id": customerId, ":adminId": adminId });
      const oldCustomer = oldCustomerStmt.step()
        ? oldCustomerStmt.getAsObject()
        : null;
      oldCustomerStmt.free();

      if (!oldCustomer) {
        db.exec("ROLLBACK");
        return res.status(404).json({ error: "Customer not found" });
      }

      const updatedName = name !== undefined ? name : oldCustomer.name;
      const updatedEmail = email !== undefined ? email : oldCustomer.email;
      const updatedPhone = phone !== undefined ? phone : oldCustomer.phone;
      const updatedAddress =
        address !== undefined ? address : oldCustomer.address;
      const updatedStatus = status !== undefined ? status : oldCustomer.status;

      db.run(
        "UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, status = ? WHERE id = ?",
        [
          updatedName,
          updatedEmail,
          updatedPhone,
          updatedAddress,
          updatedStatus,
          customerId,
        ]
      );
      logActivity(db, `updated customer ${updatedName} via API.`, {
        user_id: adminId,
        customer_id: customerId,
        performer_id: req.user.id,
      });
      db.exec("COMMIT");
      saveDatabase(db);

      io.emit("data_changed", { table: "customers" });
      io.emit("data_changed", { table: "activities" });

      const updatedCustomerStmt = db.prepare(
        "SELECT * FROM customers WHERE id = :id"
      );
      updatedCustomerStmt.bind({ ":id": customerId });
      const updatedCustomer = updatedCustomerStmt.step()
        ? updatedCustomerStmt.getAsObject()
        : null;
      updatedCustomerStmt.free();
      res.json({ data: updatedCustomer });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.delete("/customers/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const customerId = req.params.id;
      db.exec("BEGIN");
      const customerStmt = db.prepare(
        "SELECT name FROM customers WHERE id = :id AND user_id = :adminId"
      );
      customerStmt.bind({ ":id": customerId, ":adminId": adminId });
      const customer = customerStmt.step() ? customerStmt.getAsObject() : null;
      customerStmt.free();
      if (!customer)
        return res.status(404).json({ error: "Customer not found" });
      db.run("DELETE FROM customers WHERE id = ?", [customerId]);
      logActivity(db, `deleted customer ${customer.name} via API.`, {
        user_id: adminId,
        performer_id: req.user.id,
      });
      db.exec("COMMIT");
      saveDatabase(db);
      io.emit("data_changed", { table: "customers" });
      io.emit("data_changed", { table: "activities" });
      res.status(204).send();
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  // Products
  apiV1Router.get("/products", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const { limit = 20, page = 1 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const totalCountStmt = db.prepare(
        "SELECT COUNT(*) as count FROM products WHERE user_id = :adminId"
      );
      totalCountStmt.bind({ ":adminId": adminId });
      const totalCount = totalCountStmt.step()
        ? totalCountStmt.getAsObject().count
        : 0;
      totalCountStmt.free();

      const productsStmt = db.prepare(
        `SELECT id, name, sku, barcode, description, price, category, created_at FROM products WHERE user_id = :adminId ORDER BY created_at DESC LIMIT :limit OFFSET :offset`
      );
      productsStmt.bind({
        ":adminId": adminId,
        ":limit": parseInt(limit),
        ":offset": offset,
      });
      const products = [];
      while (productsStmt.step()) products.push(productsStmt.getAsObject());
      productsStmt.free();

      res.json({
        data: products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total_items: totalCount,
          total_pages: Math.ceil(totalCount / parseInt(limit)),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.get("/products/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const stmt = db.prepare(
        "SELECT id, name, sku, barcode, description, price, category, created_at FROM products WHERE id = :id AND user_id = :adminId"
      );
      stmt.bind({ ":id": req.params.id, ":adminId": adminId });
      const product = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json({ data: product });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.post("/products", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const { name, sku, price, description, category, barcode } = req.body;
      if (!name || !sku || price === undefined)
        return res
          .status(400)
          .json({ error: "name, sku, and price are required." });

      const newProductId = crypto.randomUUID();
      db.exec("BEGIN");
      db.run(
        "INSERT INTO products (id, user_id, name, sku, price, description, category, barcode, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newProductId,
          adminId,
          name,
          sku,
          price,
          description,
          category,
          barcode,
          new Date().toISOString(),
          req.user.id,
        ]
      );
      logActivity(db, `created product ${name} via API.`, {
        user_id: adminId,
        performer_id: req.user.id,
      });
      db.exec("COMMIT");
      saveDatabase(db);

      io.emit("data_changed", { table: "products" });
      io.emit("data_changed", { table: "activities" });

      const newProductStmt = db.prepare(
        "SELECT * FROM products WHERE id = :id"
      );
      newProductStmt.bind({ ":id": newProductId });
      const newProduct = newProductStmt.step()
        ? newProductStmt.getAsObject()
        : null;
      newProductStmt.free();
      res.status(201).json({ data: newProduct });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.put("/products/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const productId = req.params.id;
      const { name, sku, price, description, category, barcode } = req.body;

      db.exec("BEGIN");
      const oldProductStmt = db.prepare(
        "SELECT * FROM products WHERE id = :id AND user_id = :adminId"
      );
      oldProductStmt.bind({ ":id": productId, ":adminId": adminId });
      const oldProduct = oldProductStmt.step()
        ? oldProductStmt.getAsObject()
        : null;
      oldProductStmt.free();

      if (!oldProduct) {
        db.exec("ROLLBACK");
        return res.status(404).json({ error: "Product not found" });
      }

      const updatedName = name !== undefined ? name : oldProduct.name;
      const updatedSku = sku !== undefined ? sku : oldProduct.sku;
      const updatedPrice = price !== undefined ? price : oldProduct.price;
      const updatedDescription =
        description !== undefined ? description : oldProduct.description;
      const updatedCategory =
        category !== undefined ? category : oldProduct.category;
      const updatedBarcode =
        barcode !== undefined ? barcode : oldProduct.barcode;

      db.run(
        "UPDATE products SET name = ?, sku = ?, price = ?, description = ?, category = ?, barcode = ? WHERE id = ?",
        [
          updatedName,
          updatedSku,
          updatedPrice,
          updatedDescription,
          updatedCategory,
          updatedBarcode,
          productId,
        ]
      );
      logActivity(db, `updated product ${updatedName} via API.`, {
        user_id: adminId,
        performer_id: req.user.id,
      });
      db.exec("COMMIT");
      saveDatabase(db);

      io.emit("data_changed", { table: "products" });
      io.emit("data_changed", { table: "activities" });

      const updatedProductStmt = db.prepare(
        "SELECT * FROM products WHERE id = :id"
      );
      updatedProductStmt.bind({ ":id": productId });
      const updatedProduct = updatedProductStmt.step()
        ? updatedProductStmt.getAsObject()
        : null;
      updatedProductStmt.free();
      res.json({ data: updatedProduct });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.delete("/products/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const productId = req.params.id;
      db.exec("BEGIN");
      const productStmt = db.prepare(
        "SELECT name FROM products WHERE id = :id AND user_id = :adminId"
      );
      productStmt.bind({ ":id": productId, ":adminId": adminId });
      const product = productStmt.step() ? productStmt.getAsObject() : null;
      productStmt.free();
      if (!product) return res.status(404).json({ error: "Product not found" });
      db.run("DELETE FROM products WHERE id = ?", [productId]);
      logActivity(db, `deleted product ${product.name} via API.`, {
        user_id: adminId,
        performer_id: req.user.id,
      });
      db.exec("COMMIT");
      saveDatabase(db);
      io.emit("data_changed", { table: "products" });
      io.emit("data_changed", { table: "activities" });
      res.status(204).send();
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  // Invoices
  apiV1Router.get("/invoices", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const { limit = 20, page = 1 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const totalCountStmt = db.prepare(
        "SELECT COUNT(*) as count FROM invoices WHERE user_id = :adminId"
      );
      totalCountStmt.bind({ ":adminId": adminId });
      const totalCount = totalCountStmt.step()
        ? totalCountStmt.getAsObject().count
        : 0;
      totalCountStmt.free();

      const invoicesStmt = db.prepare(
        `SELECT * FROM invoices WHERE user_id = :adminId ORDER BY issue_date DESC LIMIT :limit OFFSET :offset`
      );
      invoicesStmt.bind({
        ":adminId": adminId,
        ":limit": parseInt(limit),
        ":offset": offset,
      });
      const invoices = [];
      while (invoicesStmt.step()) invoices.push(invoicesStmt.getAsObject());
      invoicesStmt.free();

      res.json({
        data: invoices.map((i) => ({
          ...i,
          line_items: JSON.parse(i.line_items),
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total_items: totalCount,
          total_pages: Math.ceil(totalCount / parseInt(limit)),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.get("/invoices/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const stmt = db.prepare(
        "SELECT * FROM invoices WHERE id = :id AND user_id = :adminId"
      );
      stmt.bind({ ":id": req.params.id, ":adminId": adminId });
      const invoice = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json({
        data: { ...invoice, line_items: JSON.parse(invoice.line_items) },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.post("/invoices", (req, res) => {
    const adminId = req.user.admin_id;
    const creatorId = req.user.id;
    const { customer_id, line_items } = req.body;

    if (
      !customer_id ||
      !line_items ||
      !Array.isArray(line_items) ||
      line_items.length === 0
    ) {
      return res.status(400).json({
        error: "customer_id and a non-empty line_items array are required.",
      });
    }

    try {
      db.exec("BEGIN");

      const customerStmt = db.prepare(
        "SELECT name FROM customers WHERE id = :id AND user_id = :adminId"
      );
      customerStmt.bind({ ":id": customer_id, ":adminId": adminId });
      const customer = customerStmt.step() ? customerStmt.getAsObject() : null;
      customerStmt.free();
      if (!customer) throw new Error("Customer not found");

      let total = 0;
      const sale_items = [];

      for (const item of line_items) {
        const productStmt = db.prepare(
          "SELECT price, name FROM products WHERE id = :id AND user_id = :adminId"
        );
        productStmt.bind({ ":id": item.product_id, ":adminId": adminId });
        const product = productStmt.step() ? productStmt.getAsObject() : null;
        productStmt.free();
        if (!product)
          throw new Error(`Product with ID ${item.product_id} not found.`);

        const stockStmt = db.prepare(
          "SELECT COALESCE(SUM(quantity_remaining), 0) as stock FROM inventory_purchases WHERE product_id = :productId"
        );
        stockStmt.bind({ ":productId": item.product_id });
        const stock = stockStmt.step() ? stockStmt.getAsObject().stock : 0;
        stockStmt.free();
        if (stock < item.quantity)
          throw new Error(`Insufficient stock for product: ${product.name}`);

        const itemTotal = item.quantity * product.price;
        total += itemTotal;
        sale_items.push({
          ...item,
          unit_price: product.price,
          total_price: itemTotal,
          name: product.name,
        });
      }

      const settings = getSettings(db, adminId);
      const invoice_number = `${settings.invoicePrefix || "INV-"}${String(
        settings.nextInvoiceNumber || 1
      ).padStart(4, "0")}`;
      const newNextInvoiceNumber = (settings.nextInvoiceNumber || 1) + 1;
      const newInvoiceId = crypto.randomUUID();
      const sale_id = crypto.randomUUID();

      db.run(
        "INSERT INTO sales (id, user_id, customer_id, total_amount, sale_date, created_by, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          sale_id,
          adminId,
          customer_id,
          total,
          new Date().toISOString(),
          creatorId,
          newInvoiceId,
        ]
      );

      const final_line_items = [];
      for (const item of sale_items) {
        const sale_item_id = crypto.randomUUID();
        final_line_items.push({
          id: sale_item_id,
          product_id: item.product_id,
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        });
        db.run(
          "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)",
          [
            sale_item_id,
            sale_id,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.total_price,
          ]
        );

        let qtyToDeduct = item.quantity;
        const purchasesStmt = db.prepare(
          "SELECT * FROM inventory_purchases WHERE product_id = :productId AND quantity_remaining > 0 ORDER BY purchase_date ASC"
        );
        purchasesStmt.bind({ ":productId": item.product_id });
        const purchases = [];
        while (purchasesStmt.step())
          purchases.push(purchasesStmt.getAsObject());
        purchasesStmt.free();

        for (const p of purchases) {
          if (qtyToDeduct <= 0) break;
          const deduction = Math.min(qtyToDeduct, p.quantity_remaining);
          db.run(
            "UPDATE inventory_purchases SET quantity_remaining = ? WHERE id = ?",
            [p.quantity_remaining - deduction, p.id]
          );
          qtyToDeduct -= deduction;
        }
      }

      const issue_date = new Date();
      const due_date = new Date();
      due_date.setDate(
        issue_date.getDate() + (settings.defaultDueDateDays || 30)
      );

      db.run("UPDATE customers SET balance = balance - ? WHERE id = ?", [
        total,
        customer_id,
      ]);
      db.run(
        "INSERT INTO transactions (id, user_id, customer_id, date, description, type, amount, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          crypto.randomUUID(),
          adminId,
          customer_id,
          new Date().toISOString(),
          `Invoice ${invoice_number}`,
          "debit",
          total,
          newInvoiceId,
        ]
      );
      db.run(
        "INSERT INTO invoices (id, user_id, customer_id, customer_name, invoice_number, issue_date, due_date, line_items, total, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newInvoiceId,
          adminId,
          customer_id,
          customer.name,
          invoice_number,
          issue_date.toISOString(),
          due_date.toISOString(),
          JSON.stringify(final_line_items),
          total,
          "Sent",
          new Date().toISOString(),
          creatorId,
        ]
      );

      const updatedSettings = {
        ...settings,
        nextInvoiceNumber: newNextInvoiceNumber,
      };
      db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
        JSON.stringify(updatedSettings),
        adminId,
      ]);

      logActivity(
        db,
        `created invoice ${invoice_number} for ${customer.name} via API.`,
        {
          user_id: adminId,
          customer_id,
          performer_id: creatorId,
          invoice_id: newInvoiceId,
        }
      );

      db.exec("COMMIT");
      saveDatabase(db);
      [
        "sales",
        "inventory_purchases",
        "products",
        "transactions",
        "invoices",
        "customers",
        "activities",
      ].forEach((table) => io.emit("data_changed", { table }));

      const newInvoiceStmt = db.prepare(
        "SELECT * FROM invoices WHERE id = :id"
      );
      newInvoiceStmt.bind({ ":id": newInvoiceId });
      const newInvoice = newInvoiceStmt.step()
        ? newInvoiceStmt.getAsObject()
        : null;
      newInvoiceStmt.free();
      res.status(201).json({ data: newInvoice });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  apiV1Router.delete("/invoices/:id", (req, res) => {
    try {
      const adminId = req.user.admin_id;
      const creatorId = req.user.id;
      const invoiceId = req.params.id;
      db.exec("BEGIN");
      const invoiceStmt = db.prepare(
        "SELECT * FROM invoices WHERE id = :id AND user_id = :adminId"
      );
      invoiceStmt.bind({ ":id": invoiceId, ":adminId": adminId });
      const invoice = invoiceStmt.step() ? invoiceStmt.getAsObject() : null;
      invoiceStmt.free();
      if (!invoice) throw new Error("Invoice not found.");

      const quotationStmt = db.prepare(
        "SELECT id FROM quotations WHERE converted_invoice_id = :invoiceId AND user_id = :adminId"
      );
      quotationStmt.bind({ ":invoiceId": invoiceId, ":adminId": adminId });
      const quotation = quotationStmt.step()
        ? quotationStmt.getAsObject()
        : null;
      quotationStmt.free();
      if (quotation) {
        db.run(
          "UPDATE quotations SET status = 'Draft', converted_invoice_id = NULL WHERE id = ?",
          [quotation.id]
        );
        io.emit("data_changed", { table: "quotations" });
        logActivity(
          db,
          `reverted status of a linked quotation to Draft due to deletion of invoice ${invoice.invoice_number}.`,
          {
            user_id: adminId,
            customer_id: invoice.customer_id,
            performer_id: req.user.id,
          }
        );
      }

      const lineItems = JSON.parse(invoice.line_items);
      for (const item of lineItems) {
        if (item.isBundle && item.components && item.components.length > 0) {
          for (const component of item.components) {
            const restockQuantity = component.quantity * item.quantity;
            db.run(
              "INSERT INTO inventory_purchases (id, user_id, product_id, purchase_date, quantity_purchased, quantity_remaining, unit_cost, supplier, created_at, created_by, status, total_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                crypto.randomUUID(),
                adminId,
                component.sub_product_id,
                new Date().toISOString(),
                0,
                restockQuantity,
                0,
                `Return from Deleted Invoice ${invoice.invoice_number}`,
                new Date().toISOString(),
                creatorId,
                "Completed",
                restockQuantity,
              ]
            );
          }
        } else if (item.product_id && !item.product_id.startsWith("custom-")) {
          db.run(
            "INSERT INTO inventory_purchases (id, user_id, product_id, purchase_date, quantity_purchased, quantity_remaining, unit_cost, supplier, created_at, created_by, status, total_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              adminId,
              item.product_id,
              new Date().toISOString(),
              0,
              item.quantity,
              item.unitPrice,
              `Return from Deleted Invoice ${invoice.invoice_number}`,
              new Date().toISOString(),
              creatorId,
              "Completed",
              item.quantity,
            ]
          );
        }
      }

      const transactionsStmt = db.prepare(
        "SELECT type, amount, customer_id FROM transactions WHERE invoice_id = :invoiceId"
      );
      transactionsStmt.bind({ ":invoiceId": invoiceId });
      const transactions = [];
      while (transactionsStmt.step())
        transactions.push(transactionsStmt.getAsObject());
      transactionsStmt.free();

      for (const t of transactions) {
        const adjustment = t.type === "debit" ? t.amount : -t.amount;
        db.run("UPDATE customers SET balance = balance + ? WHERE id = ?", [
          adjustment,
          t.customer_id,
        ]);
      }

      db.run("DELETE FROM transactions WHERE invoice_id = ?", [invoiceId]);
      const saleStmt = db.prepare(
        "SELECT id FROM sales WHERE invoice_id = :invoiceId"
      );
      saleStmt.bind({ ":invoiceId": invoiceId });
      const sale = saleStmt.step() ? saleStmt.getAsObject() : null;
      saleStmt.free();
      if (sale) {
        db.run("DELETE FROM sale_items WHERE sale_id = ?", [sale.id]);
        db.run("DELETE FROM sales WHERE id = ?", [sale.id]);
      }

      db.run("DELETE FROM invoices WHERE id = ? AND user_id = ?", [
        invoiceId,
        adminId,
      ]);
      logActivity(
        db,
        `deleted invoice ${invoice.invoice_number} for ${invoice.customer_name} via API.`,
        {
          user_id: adminId,
          customer_id: invoice.customer_id,
          invoice_id: invoiceId,
          performer_id: req.user.id,
        }
      );
      db.exec("COMMIT");
      saveDatabase(db);
      io.emit("data_changed", { table: "invoices" });
      io.emit("data_changed", { table: "activities" });
      io.emit("data_changed", { table: "products" });
      io.emit("data_changed", { table: "inventory_purchases" });
      io.emit("data_changed", { table: "customers" });
      io.emit("data_changed", { table: "transactions" });
      res.status(204).send();
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  app.post(
    "/api/invoices/:id/payment",
    authMiddleware,
    permissionMiddleware("invoices:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const invoiceId = req.params.id;
        const { payments, payment_date } = req.body;
        const settings = getSettings(db, adminId);
        const currency = settings.currency || "$";

        db.exec("BEGIN");

        const invoiceStmt = db.prepare(
          "SELECT * FROM invoices WHERE id = :id AND user_id = :adminId"
        );
        invoiceStmt.bind({ ":id": invoiceId, ":adminId": adminId });
        const invoice = invoiceStmt.step() ? invoiceStmt.getAsObject() : null;
        invoiceStmt.free();
        if (!invoice) throw new Error("Invoice not found.");

        let totalPaymentAmount = 0;
        for (const payment of payments) {
          const { amount, method } = payment;
          db.run(
            "INSERT INTO transactions (id, user_id, customer_id, date, description, type, amount, invoice_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              adminId,
              invoice.customer_id,
              new Date(payment_date).toISOString(),
              `Payment for Invoice ${invoice.invoice_number} via ${method}`,
              "credit",
              amount,
              invoiceId,
              method,
            ]
          );
          totalPaymentAmount += amount;
        }

        const transactionsStmt = db.prepare(
          "SELECT type, amount FROM transactions WHERE invoice_id = :invoiceId AND user_id = :adminId"
        );
        transactionsStmt.bind({ ":invoiceId": invoiceId, ":adminId": adminId });
        const transactions = [];
        while (transactionsStmt.step())
          transactions.push(transactionsStmt.getAsObject());
        transactionsStmt.free();
        const totalPaid = transactions.reduce(
          (sum, t) => (t.type === "credit" ? sum + t.amount : sum),
          0
        );

        let newStatus = invoice.status;
        if (totalPaid >= invoice.total) {
          newStatus = "Paid";
        } else if (totalPaid > 0) {
          newStatus = "Partially Paid";
        }

        db.run("UPDATE customers SET balance = balance + ? WHERE id = ?", [
          totalPaymentAmount,
          invoice.customer_id,
        ]);
        db.run("UPDATE invoices SET status = ? WHERE id = ?", [
          newStatus,
          invoiceId,
        ]);

        const overpayment = totalPaid - invoice.total;
        let logMessage = `recorded a payment of ${currency}${totalPaymentAmount.toFixed(
          2
        )} for invoice ${invoice.invoice_number}.`;
        if (overpayment > 0) {
          logMessage += ` An overpayment of ${currency}${overpayment.toFixed(
            2
          )} was added to the customer's credit.`;
        }
        logActivity(db, logMessage, {
          user_id: adminId,
          customer_id: invoice.customer_id,
          invoice_id: invoiceId,
          performer_id: creatorId,
        });

        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "transactions" });
        io.emit("data_changed", { table: "invoices" });
        io.emit("data_changed", { table: "customers" });
        io.emit("data_changed", { table: "activities" });

        res.status(201).json({ message: "Payment recorded successfully." });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- RETURNS API ---
  app.get(
    "/api/returns/eligible-invoices",
    authMiddleware,
    permissionMiddleware("returns:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(`
                SELECT id, invoice_number, customer_name
                FROM invoices
                WHERE user_id = :adminId
                AND (status = 'Paid' OR status = 'Partially Paid')
                AND (return_status IS NULL OR return_status != 'Fully Returned')
                ORDER BY issue_date DESC
            `);
        stmt.bind({ ":adminId": adminId });
        const invoices = [];
        while (stmt.step()) invoices.push(stmt.getAsObject());
        stmt.free();
        res.json(invoices);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/returns/invoice-details/:id",
    authMiddleware,
    permissionMiddleware("returns:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const invoiceId = req.params.id;
        const invoiceStmt = db.prepare(
          "SELECT * FROM invoices WHERE id = :id AND user_id = :adminId"
        );
        invoiceStmt.bind({ ":id": invoiceId, ":adminId": adminId });
        const invoice = invoiceStmt.step() ? invoiceStmt.getAsObject() : null;
        invoiceStmt.free();
        if (!invoice)
          return res.status(404).json({ error: "Invoice not found" });

        const lineItems = JSON.parse(invoice.line_items);

        const transactionsStmt = db.prepare(
          "SELECT SUM(amount) as total_paid FROM transactions WHERE invoice_id = :invoiceId AND type = 'credit' AND user_id = :adminId"
        );
        transactionsStmt.bind({ ":invoiceId": invoiceId, ":adminId": adminId });
        const total_paid =
          (transactionsStmt.step()
            ? transactionsStmt.getAsObject().total_paid
            : 0) || 0;
        transactionsStmt.free();
        invoice.total_paid = total_paid;

        const saleStmt = db.prepare(
          "SELECT id FROM sales WHERE invoice_id = :invoiceId"
        );
        saleStmt.bind({ ":invoiceId": invoiceId });
        const sale = saleStmt.step() ? saleStmt.getAsObject() : null;
        saleStmt.free();

        let saleItemsWithReturns = [];
        if (sale) {
          for (const item of lineItems) {
            const saleItemStmt = db.prepare(
              "SELECT quantity_returned FROM sale_items WHERE id = :id AND sale_id = :saleId"
            );
            saleItemStmt.bind({ ":id": item.id, ":saleId": sale.id });
            const quantity_returned =
              (saleItemStmt.step()
                ? saleItemStmt.getAsObject().quantity_returned
                : 0) || 0;
            saleItemStmt.free();
            saleItemsWithReturns.push({ ...item, quantity_returned });
          }
        } else {
          // Legacy invoice without a sale record. Assume nothing has been returned.
          saleItemsWithReturns = lineItems.map((item) => ({
            ...item,
            quantity_returned: 0,
          }));
        }

        invoice.lineItems = saleItemsWithReturns;
        invoice.customerName = invoice.customer_name;
        res.json(invoice);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/returns",
    authMiddleware,
    permissionMiddleware("returns:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(`
                SELECT 
                    r.*,
                    i.invoice_number as original_invoice_number,
                    c.name as customer_name,
                    p.first_name || ' ' || p.last_name as creator_name
                FROM returns r
                JOIN invoices i ON r.original_invoice_id = i.id
                JOIN customers c ON r.customer_id = c.id
                JOIN profiles p ON r.created_by = p.id
                WHERE r.user_id = :adminId
                ORDER BY r.return_date DESC
            `);
        stmt.bind({ ":adminId": adminId });
        const returns = [];
        while (stmt.step()) returns.push(stmt.getAsObject());
        stmt.free();
        res.json(returns);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/returns/:id",
    authMiddleware,
    permissionMiddleware("returns:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const returnId = req.params.id;

        const returnStmt = db.prepare(`
                SELECT 
                    r.*,
                    i.invoice_number as original_invoice_number,
                    c.name as customer_name,
                    c.address as customer_address,
                    c.phone as customer_phone,
                    p.first_name || ' ' || p.last_name as creator_name
                FROM returns r
                JOIN invoices i ON r.original_invoice_id = i.id
                JOIN customers c ON r.customer_id = c.id
                JOIN profiles p ON r.created_by = p.id
                WHERE r.id = :id AND r.user_id = :adminId
            `);
        returnStmt.bind({ ":id": returnId, ":adminId": adminId });
        const returnData = returnStmt.step() ? returnStmt.getAsObject() : null;
        returnStmt.free();

        if (!returnData) {
          return res.status(404).json({ error: "Return not found" });
        }

        const itemsStmt = db.prepare(`
                SELECT ri.*, p.name as product_name, p.sku as product_sku
                FROM return_items ri
                LEFT JOIN products p ON ri.product_id = p.id
                WHERE ri.return_id = :returnId
            `);
        itemsStmt.bind({ ":returnId": returnId });
        returnData.items = [];
        while (itemsStmt.step()) returnData.items.push(itemsStmt.getAsObject());
        itemsStmt.free();

        const expensesStmt = db.prepare(
          "SELECT * FROM return_expenses WHERE return_id = :returnId"
        );
        expensesStmt.bind({ ":returnId": returnId });
        returnData.expenses = [];
        while (expensesStmt.step())
          returnData.expenses.push(expensesStmt.getAsObject());
        expensesStmt.free();

        const paymentsStmt = db.prepare(
          "SELECT * FROM transactions WHERE user_id = :adminId AND description = :description"
        );
        paymentsStmt.bind({
          ":adminId": adminId,
          ":description": `Refund for Return ${returnData.return_receipt_number}`,
        });
        returnData.payments = [];
        while (paymentsStmt.step())
          returnData.payments.push(paymentsStmt.getAsObject());
        paymentsStmt.free();

        res.json(returnData);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/returns",
    authMiddleware,
    permissionMiddleware("returns:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const {
          originalInvoiceId,
          items,
          deliveryChargeRefund,
          payments,
          expenses,
          notes,
          totalRefundAmount,
          restockItems,
        } = req.body;
        const settings = getSettings(db, adminId);
        const currency = settings.currency || "$";

        db.exec("BEGIN");

        const invoiceStmt = db.prepare(
          "SELECT * FROM invoices WHERE id = :id AND user_id = :adminId"
        );
        invoiceStmt.bind({ ":id": originalInvoiceId, ":adminId": adminId });
        const invoice = invoiceStmt.step() ? invoiceStmt.getAsObject() : null;
        invoiceStmt.free();
        if (!invoice) throw new Error("Original invoice not found.");

        const returnReceiptNumber = `RTN-${String(
          settings.nextReturnNumber || 1
        ).padStart(4, "0")}`;
        const newNextReturnNumber = (settings.nextReturnNumber || 1) + 1;

        const returnId = crypto.randomUUID();
        const totalExpenseAmount = expenses.reduce(
          (sum, exp) => sum + exp.amount,
          0
        );

        db.run(
          "INSERT INTO returns (id, user_id, original_invoice_id, customer_id, return_receipt_number, return_date, total_refund_amount, total_expense_amount, notes, created_by, created_at, restocked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            returnId,
            adminId,
            originalInvoiceId,
            invoice.customer_id,
            returnReceiptNumber,
            new Date().toISOString(),
            totalRefundAmount,
            totalExpenseAmount,
            notes,
            creatorId,
            new Date().toISOString(),
            restockItems ? 1 : 0,
          ]
        );

        const saleStmt = db.prepare(
          "SELECT id FROM sales WHERE invoice_id = :invoiceId"
        );
        saleStmt.bind({ ":invoiceId": originalInvoiceId });
        const sale = saleStmt.step() ? saleStmt.getAsObject() : null;
        saleStmt.free();
        if (!sale)
          throw new Error("Original sale record not found for this invoice.");
        const saleId = sale.id;

        for (const item of items) {
          const saleItemId = item.lineItemId;
          const saleItemCheckStmt = db.prepare(
            "SELECT id FROM sale_items WHERE id = :id AND sale_id = :saleId"
          );
          saleItemCheckStmt.bind({ ":id": saleItemId, ":saleId": saleId });
          const saleItemCheck = saleItemCheckStmt.step();
          saleItemCheckStmt.free();
          if (!saleItemCheck) {
            throw new Error(
              `Item ${item.description} does not belong to the original sale record.`
            );
          }

          db.run(
            "INSERT INTO return_items (id, return_id, sale_item_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              returnId,
              saleItemId,
              item.productId,
              item.quantity,
              item.unitPrice,
            ]
          );

          db.run(
            "UPDATE sale_items SET quantity_returned = quantity_returned + ? WHERE id = ?",
            [item.quantity, saleItemId]
          );

          if (
            restockItems &&
            item.productId &&
            !item.productId.startsWith("custom-")
          ) {
            db.run(
              "INSERT INTO inventory_purchases (id, user_id, product_id, purchase_date, quantity_purchased, quantity_remaining, unit_cost, supplier, created_at, created_by, status, total_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                crypto.randomUUID(),
                adminId,
                item.productId,
                new Date().toISOString(),
                0,
                item.quantity,
                item.unitPrice,
                `Return ${returnReceiptNumber}`,
                new Date().toISOString(),
                creatorId,
                "Completed",
                item.quantity,
              ]
            );
          }
        }

        for (const expense of expenses) {
          db.run(
            "INSERT INTO return_expenses (id, return_id, description, amount) VALUES (?, ?, ?, ?)",
            [crypto.randomUUID(), returnId, expense.description, expense.amount]
          );
        }

        const totalRecognizedRefund = payments.reduce(
          (sum, p) => sum + p.amount,
          0
        );

        if (totalRecognizedRefund > 0) {
          db.run(
            "INSERT INTO transactions (id, user_id, customer_id, date, description, type, amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              adminId,
              invoice.customer_id,
              new Date().toISOString(),
              `Value from Return ${returnReceiptNumber}`,
              "credit",
              totalRecognizedRefund,
            ]
          );
          db.run("UPDATE customers SET balance = balance + ? WHERE id = ?", [
            totalRecognizedRefund,
            invoice.customer_id,
          ]);
        }

        for (const payment of payments) {
          if (payment.method !== "Credits" && payment.amount > 0) {
            db.run("UPDATE customers SET balance = balance - ? WHERE id = ?", [
              payment.amount,
              invoice.customer_id,
            ]);
            db.run(
              "INSERT INTO transactions (id, user_id, customer_id, date, description, type, amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                crypto.randomUUID(),
                adminId,
                invoice.customer_id,
                new Date().toISOString(),
                `Refund for Return ${returnReceiptNumber}`,
                "debit",
                payment.amount,
                payment.method,
              ]
            );
          }
        }

        const allSaleItemsStmt = db.prepare(
          "SELECT quantity, quantity_returned FROM sale_items WHERE sale_id = :saleId"
        );
        allSaleItemsStmt.bind({ ":saleId": saleId });
        const allSaleItems = [];
        while (allSaleItemsStmt.step())
          allSaleItems.push(allSaleItemsStmt.getAsObject());
        allSaleItemsStmt.free();
        const totalQuantity = allSaleItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        const totalReturned = allSaleItems.reduce(
          (sum, item) => sum + item.quantity_returned,
          0
        );
        let newReturnStatus = "Partially Returned";
        if (totalReturned >= totalQuantity) {
          newReturnStatus = "Fully Returned";
        }
        db.run("UPDATE invoices SET return_status = ? WHERE id = ?", [
          newReturnStatus,
          originalInvoiceId,
        ]);

        logActivity(
          db,
          `processed return ${returnReceiptNumber} for invoice ${
            invoice.invoice_number
          }. Refunded ${currency}${totalRefundAmount.toFixed(2)}.`,
          {
            user_id: adminId,
            customer_id: invoice.customer_id,
            performer_id: creatorId,
          }
        );

        const updatedSettings = {
          ...settings,
          nextReturnNumber: newNextReturnNumber,
        };
        db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
          JSON.stringify(updatedSettings),
          adminId,
        ]);

        db.exec("COMMIT");
        saveDatabase(db);

        [
          "returns",
          "invoices",
          "products",
          "inventory_purchases",
          "customers",
          "transactions",
          "activities",
        ].forEach((table) => io.emit("data_changed", { table }));

        res.status(201).json({ returnId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/returns/:id",
    authMiddleware,
    permissionMiddleware("returns:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const returnId = req.params.id;

        db.exec("BEGIN");

        const returnStmt = db.prepare(
          "SELECT * FROM returns WHERE id = :id AND user_id = :adminId"
        );
        returnStmt.bind({ ":id": returnId, ":adminId": adminId });
        const returnData = returnStmt.step() ? returnStmt.getAsObject() : null;
        returnStmt.free();
        if (!returnData) throw new Error("Return not found.");

        const returnItemsStmt = db.prepare(
          "SELECT * FROM return_items WHERE return_id = :returnId"
        );
        returnItemsStmt.bind({ ":returnId": returnId });
        const returnItems = [];
        while (returnItemsStmt.step())
          returnItems.push(returnItemsStmt.getAsObject());
        returnItemsStmt.free();

        const refundPaymentsStmt = db.prepare(
          "SELECT * FROM transactions WHERE description = :description AND user_id = :adminId"
        );
        refundPaymentsStmt.bind({
          ":description": `Refund for Return ${returnData.return_receipt_number}`,
          ":adminId": adminId,
        });
        const refundPayments = [];
        while (refundPaymentsStmt.step())
          refundPayments.push(refundPaymentsStmt.getAsObject());
        refundPaymentsStmt.free();

        const creditTransactionStmt = db.prepare(
          "SELECT * FROM transactions WHERE description = :description AND user_id = :adminId"
        );
        creditTransactionStmt.bind({
          ":description": `Value from Return ${returnData.return_receipt_number}`,
          ":adminId": adminId,
        });
        const creditTransaction = creditTransactionStmt.step()
          ? creditTransactionStmt.getAsObject()
          : null;
        creditTransactionStmt.free();

        // 1. Reverse stock adjustments
        for (const item of returnItems) {
          db.run(
            "UPDATE sale_items SET quantity_returned = quantity_returned - ? WHERE id = ?",
            [item.quantity, item.sale_item_id]
          );
          if (returnData.restocked) {
            const restockPurchaseStmt = db.prepare(
              "SELECT id, quantity_remaining FROM inventory_purchases WHERE product_id = :productId AND supplier = :supplier"
            );
            restockPurchaseStmt.bind({
              ":productId": item.product_id,
              ":supplier": `Return ${returnData.return_receipt_number}`,
            });
            const restockPurchase = restockPurchaseStmt.step()
              ? restockPurchaseStmt.getAsObject()
              : null;
            restockPurchaseStmt.free();
            if (restockPurchase) {
              if (restockPurchase.quantity_remaining < item.quantity) {
                throw new Error(
                  `Cannot reverse return: restocked items for product ID ${item.product_id} have already been sold.`
                );
              }
              db.run(
                "UPDATE inventory_purchases SET quantity_remaining = quantity_remaining - ? WHERE id = ?",
                [item.quantity, restockPurchase.id]
              );
            } else {
              throw new Error(
                `Could not find the restocked inventory record for product ID ${item.product_id}. Reversal failed.`
              );
            }
          }
        }

        // 2. Reverse financial transactions
        let balanceAdjustment = 0;
        if (creditTransaction) {
          balanceAdjustment -= creditTransaction.amount; // Debit the customer
          db.run("DELETE FROM transactions WHERE id = ?", [
            creditTransaction.id,
          ]);
        }
        for (const payment of refundPayments) {
          balanceAdjustment += payment.amount; // Credit the customer
          db.run("DELETE FROM transactions WHERE id = ?", [payment.id]);
        }
        if (balanceAdjustment !== 0) {
          db.run("UPDATE customers SET balance = balance + ? WHERE id = ?", [
            balanceAdjustment,
            returnData.customer_id,
          ]);
        }

        // 3. Delete return records
        db.run("DELETE FROM return_items WHERE return_id = ?", [returnId]);
        db.run("DELETE FROM return_expenses WHERE return_id = ?", [returnId]);
        db.run("DELETE FROM returns WHERE id = ?", [returnId]);

        // 4. Update original invoice's return status
        const saleStmt = db.prepare(
          "SELECT id FROM sales WHERE invoice_id = :invoiceId"
        );
        saleStmt.bind({ ":invoiceId": returnData.original_invoice_id });
        const sale = saleStmt.step() ? saleStmt.getAsObject() : null;
        saleStmt.free();
        if (sale) {
          const allSaleItemsStmt = db.prepare(
            "SELECT quantity, quantity_returned FROM sale_items WHERE sale_id = :saleId"
          );
          allSaleItemsStmt.bind({ ":saleId": sale.id });
          const allSaleItems = [];
          while (allSaleItemsStmt.step())
            allSaleItems.push(allSaleItemsStmt.getAsObject());
          allSaleItemsStmt.free();
          const totalQuantity = allSaleItems.reduce(
            (sum, item) => sum + item.quantity,
            0
          );
          const totalReturned = allSaleItems.reduce(
            (sum, item) => sum + item.quantity_returned,
            0
          );

          let newReturnStatus = "None";
          if (totalReturned > 0 && totalReturned < totalQuantity) {
            newReturnStatus = "Partially Returned";
          } else if (totalReturned === 0) {
            newReturnStatus = "None";
          } else {
            newReturnStatus = "Fully Returned";
          }
          db.run("UPDATE invoices SET return_status = ? WHERE id = ?", [
            newReturnStatus,
            returnData.original_invoice_id,
          ]);
        }

        logActivity(
          db,
          `deleted and reversed return ${returnData.return_receipt_number}.`,
          { user_id: adminId, performer_id: req.user.id }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        [
          "returns",
          "invoices",
          "products",
          "inventory_purchases",
          "customers",
          "transactions",
          "activities",
        ].forEach((table) => io.emit("data_changed", { table }));

        res.json({ message: "Return deleted and reversed successfully." });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- REPAIRS API ---
  app.get(
    "/api/repairs",
    authMiddleware,
    permissionMiddleware("repairs:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(`
                SELECT 
                    r.*,
                    c.name as customer_name,
                    p.first_name || ' ' || p.last_name as creator_name
                FROM repairs r
                LEFT JOIN customers c ON r.customer_id = c.id
                LEFT JOIN profiles p ON r.created_by = p.id
                WHERE r.user_id = :adminId
                ORDER BY r.created_at DESC
            `);
        stmt.bind({ ":adminId": adminId });
        const repairs = [];
        while (stmt.step()) repairs.push(stmt.getAsObject());
        stmt.free();
        res.json(repairs);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/repairs/eligible-receipts",
    authMiddleware,
    permissionMiddleware("repairs:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(`
                SELECT id, invoice_number, customer_name
                FROM invoices
                WHERE user_id = :adminId AND (status = 'Paid' OR status = 'Partially Paid')
                ORDER BY issue_date DESC
            `);
        stmt.bind({ ":adminId": adminId });
        const invoices = [];
        while (stmt.step()) invoices.push(stmt.getAsObject());
        stmt.free();
        res.json(invoices);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/repairs/receipt-details/:id",
    authMiddleware,
    permissionMiddleware("repairs:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const invoiceId = req.params.id;
        const invoiceStmt = db.prepare(
          "SELECT line_items FROM invoices WHERE id = :id AND user_id = :adminId"
        );
        invoiceStmt.bind({ ":id": invoiceId, ":adminId": adminId });
        const invoice = invoiceStmt.step() ? invoiceStmt.getAsObject() : null;
        invoiceStmt.free();
        if (!invoice)
          return res.status(404).json({ error: "Invoice not found" });

        const lineItems = JSON.parse(invoice.line_items);

        const saleStmt = db.prepare(
          "SELECT id FROM sales WHERE invoice_id = :invoiceId"
        );
        saleStmt.bind({ ":invoiceId": invoiceId });
        const sale = saleStmt.step() ? saleStmt.getAsObject() : null;
        saleStmt.free();
        if (!sale) {
          return res.json({
            lineItems: lineItems.map((item) => ({
              ...item,
              quantity_returned: 0,
            })),
          });
        }
        const saleId = sale.id;

        const saleItemsWithReturns = [];
        for (const item of lineItems) {
          const saleItemStmt = db.prepare(
            "SELECT quantity_returned FROM sale_items WHERE id = :id AND sale_id = :saleId"
          );
          saleItemStmt.bind({ ":id": item.id, ":saleId": saleId });
          const quantity_returned =
            (saleItemStmt.step()
              ? saleItemStmt.getAsObject().quantity_returned
              : 0) || 0;
          saleItemStmt.free();
          saleItemsWithReturns.push({ ...item, quantity_returned });
        }

        res.json({ lineItems: saleItemsWithReturns });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs",
    authMiddleware,
    permissionMiddleware("repairs:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const {
          fromReceipt,
          customerId,
          receiptId,
          saleItemId,
          productName,
          componentName,
          reportedProblem,
        } = req.body;

        db.exec("BEGIN");

        const settings = getSettings(db, adminId);
        const repairNumber = `REP-${String(
          settings.nextRepairNumber || 1
        ).padStart(4, "0")}`;
        const newNextRepairNumber = (settings.nextRepairNumber || 1) + 1;

        let finalProductName = productName;
        let originalInvoiceId = null;
        let originalSaleItemId = null;
        let isWarranty = 0;

        if (fromReceipt) {
          const invoiceStmt = db.prepare(
            "SELECT line_items, issue_date FROM invoices WHERE id = :id"
          );
          invoiceStmt.bind({ ":id": receiptId });
          const invoice = invoiceStmt.step() ? invoiceStmt.getAsObject() : null;
          invoiceStmt.free();
          const lineItems = JSON.parse(invoice.line_items);
          const item = lineItems.find((i) => i.id === saleItemId);
          if (!item) throw new Error("Item not found in the selected receipt.");

          finalProductName = componentName
            ? `${item.description} (${componentName})`
            : item.description;
          originalInvoiceId = receiptId;
          originalSaleItemId = saleItemId;

          if (item.warranty_period_days && item.warranty_period_days > 0) {
            const issueDate = new Date(invoice.issue_date);
            const expiryDate = new Date(issueDate);
            const unit = item.warranty_period_unit || "Days";
            if (unit === "Days")
              expiryDate.setDate(
                issueDate.getDate() + item.warranty_period_days
              );
            if (unit === "Months")
              expiryDate.setMonth(
                issueDate.getMonth() + item.warranty_period_days
              );
            if (unit === "Years")
              expiryDate.setFullYear(
                issueDate.getFullYear() + item.warranty_period_days
              );

            if (new Date() <= expiryDate) {
              isWarranty = 1;
            }
          }
        }

        const newRepairId = crypto.randomUUID();
        db.run(
          "INSERT INTO repairs (id, user_id, repair_number, customer_id, original_invoice_id, original_sale_item_id, product_name, reported_problem, status, received_date, created_by, created_at, is_warranty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newRepairId,
            adminId,
            repairNumber,
            customerId,
            originalInvoiceId,
            originalSaleItemId,
            finalProductName,
            reportedProblem,
            "Received",
            new Date().toISOString(),
            creatorId,
            new Date().toISOString(),
            isWarranty,
          ]
        );

        const updatedSettings = {
          ...settings,
          nextRepairNumber: newNextRepairNumber,
        };
        db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
          JSON.stringify(updatedSettings),
          adminId,
        ]);

        logActivity(
          db,
          `created repair order ${repairNumber} for item "${finalProductName}".`,
          { user_id: adminId, customer_id: customerId, performer_id: creatorId }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "activities" });

        res.status(201).json({ id: newRepairId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/repairs/:id",
    authMiddleware,
    permissionMiddleware("repairs:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const repairId = req.params.id;
        const repairStmt = db.prepare(`
                SELECT 
                    r.*,
                    c.name as customer_name,
                    p.first_name || ' ' || p.last_name as creator_name
                FROM repairs r
                LEFT JOIN customers c ON r.customer_id = c.id
                LEFT JOIN profiles p ON r.created_by = p.id
                WHERE r.id = :id AND r.user_id = :adminId
            `);
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) {
          return res.status(404).json({ error: "Repair not found" });
        }

        const imagesStmt = db.prepare(
          "SELECT * FROM repair_images WHERE repair_id = :repairId"
        );
        imagesStmt.bind({ ":repairId": repairId });
        repair.images = [];
        while (imagesStmt.step()) repair.images.push(imagesStmt.getAsObject());
        imagesStmt.free();

        const itemsStmt = db.prepare(`
                SELECT ri.*, p.name as product_name, p.sku as product_sku
                FROM repair_items ri
                JOIN products p ON ri.product_id = p.id
                WHERE ri.repair_id = :repairId
            `);
        itemsStmt.bind({ ":repairId": repairId });
        repair.items = [];
        while (itemsStmt.step()) repair.items.push(itemsStmt.getAsObject());
        itemsStmt.free();
        res.json({ repair });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/images",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    upload.single("image"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const repairId = req.params.id;
        const { stage, side } = req.body;
        if (!req.file) {
          return res.status(400).json({ error: "No image file uploaded." });
        }
        const imageUrl = `/uploads/${req.file.filename}`;

        db.exec("BEGIN");
        const repairStmt = db.prepare(
          "SELECT id FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) {
          db.exec("ROLLBACK");
          fs.unlinkSync(path.join(__dirname, "uploads", req.file.filename)); // Clean up uploaded file
          return res.status(404).json({ error: "Repair order not found." });
        }

        db.run(
          "INSERT OR REPLACE INTO repair_images (id, repair_id, image_url, stage, side) VALUES ((SELECT id FROM repair_images WHERE repair_id = ? AND stage = ? AND side = ?), ?, ?, ?, ?)",
          [repairId, stage, side, repairId, imageUrl, stage, side]
        );
        logActivity(
          db,
          `uploaded a '${stage}' image for the '${side}' side of a repair item.`,
          { user_id: adminId, performer_id: req.user.id }
        );
        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "activities" });

        res.status(201).json({ imageUrl });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/repairs/:id/status",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const repairId = req.params.id;
        const { status } = req.body;
        const validStatuses = ["In Progress", "Unrepairable"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: "Invalid status update." });
        }
        db.exec("BEGIN");
        db.run("UPDATE repairs SET status = ? WHERE id = ? AND user_id = ?", [
          status,
          repairId,
          adminId,
        ]);
        logActivity(db, `updated repair status to '${status}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Status updated" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/items",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const repairId = req.params.id;
        const { productId, quantity } = req.body;

        db.exec("BEGIN");
        const repairStmt = db.prepare(
          "SELECT id FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Repair order not found." });
        }

        const productStmt = db.prepare(
          "SELECT price FROM products WHERE id = :id"
        );
        productStmt.bind({ ":id": productId });
        const product = productStmt.step() ? productStmt.getAsObject() : null;
        productStmt.free();
        if (!product) throw new Error("Product not found.");

        db.run(
          "INSERT INTO repair_items (id, repair_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)",
          [crypto.randomUUID(), repairId, productId, quantity, product.price]
        );

        let qtyToDeduct = quantity;
        const purchasesStmt = db.prepare(
          "SELECT * FROM inventory_purchases WHERE product_id = :productId AND user_id = :adminId AND quantity_remaining > 0 ORDER BY purchase_date ASC"
        );
        purchasesStmt.bind({ ":productId": productId, ":adminId": adminId });
        const purchasesForProduct = [];
        while (purchasesStmt.step())
          purchasesForProduct.push(purchasesStmt.getAsObject());
        purchasesStmt.free();
        for (const purchase of purchasesForProduct) {
          if (qtyToDeduct <= 0) break;
          const deduction = Math.min(qtyToDeduct, purchase.quantity_remaining);
          db.run(
            "UPDATE inventory_purchases SET quantity_remaining = ? WHERE id = ?",
            [purchase.quantity_remaining - deduction, purchase.id]
          );
          qtyToDeduct -= deduction;
        }
        if (qtyToDeduct > 0)
          throw new Error("Insufficient stock for the selected part.");

        logActivity(
          db,
          `added ${quantity} unit(s) of a spare part to repair order.`,
          { user_id: adminId, performer_id: req.user.id }
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "inventory_purchases" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ message: "Item added" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/repairs/:id/items/:itemId",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { id: repairId, itemId } = req.params;
        db.exec("BEGIN");
        const repairStmt = db.prepare(
          "SELECT id FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Repair order not found." });
        }

        const itemStmt = db.prepare(
          "SELECT * FROM repair_items WHERE id = :id AND repair_id = :repairId"
        );
        itemStmt.bind({ ":id": itemId, ":repairId": repairId });
        const item = itemStmt.step() ? itemStmt.getAsObject() : null;
        itemStmt.free();
        if (!item) throw new Error("Item not found on this repair order.");

        db.run("DELETE FROM repair_items WHERE id = ?", [itemId]);

        db.run(
          "INSERT INTO inventory_purchases (id, user_id, product_id, purchase_date, quantity_purchased, quantity_remaining, unit_cost, supplier, created_at, created_by, status, total_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            adminId,
            item.product_id,
            new Date().toISOString(),
            0,
            item.quantity,
            item.unit_price,
            `Return from Repair`,
            new Date().toISOString(),
            req.user.id,
            "Completed",
            item.quantity,
          ]
        );

        logActivity(db, `removed a spare part from a repair order.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "inventory_purchases" });
        io.emit("data_changed", { table: "activities" });
        res.status(204).send();
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/repairs/:repairId/items/:itemId",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { repairId, itemId } = req.params;
        const { price } = req.body;

        db.exec("BEGIN");

        const repairStmt = db.prepare(
          "SELECT id FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Repair order not found." });
        }

        db.run(
          "UPDATE repair_items SET unit_price = ? WHERE id = ? AND repair_id = ?",
          [price, itemId, repairId]
        );

        logActivity(db, `updated a spare part price on a repair order.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });

        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "activities" });

        res.json({ message: "Item price updated successfully." });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/complete",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const repairId = req.params.id;
        const { repairFee, notes } = req.body;
        const settings = getSettings(db, adminId);
        const currency = settings.currency || "$";

        db.exec("BEGIN");

        const repairStmt = db.prepare(`
                SELECT r.*, c.name as customer_name
                FROM repairs r
                JOIN customers c ON r.customer_id = c.id
                WHERE r.id = :id AND r.user_id = :adminId
            `);
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) throw new Error("Repair order not found.");

        if (repair.damage_log_id) {
          throw new Error(
            "This action is not valid for internal repairs. Use 'Mark as Repaired' instead."
          );
        }

        const repairItemsStmt = db.prepare(
          `SELECT ri.*, p.name as product_name FROM repair_items ri JOIN products p ON ri.product_id = p.id WHERE ri.repair_id = :repairId`
        );
        repairItemsStmt.bind({ ":repairId": repairId });
        const repairItems = [];
        while (repairItemsStmt.step())
          repairItems.push(repairItemsStmt.getAsObject());
        repairItemsStmt.free();

        const invoice_number = `${settings.invoicePrefix || "INV-"}${String(
          settings.nextInvoiceNumber || 1
        ).padStart(4, "0")}`;
        const newNextInvoiceNumber = (settings.nextInvoiceNumber || 1) + 1;

        const line_items = [];
        let total_amount = 0;

        if (repairFee > 0) {
          line_items.push({
            id: crypto.randomUUID(),
            description: `Repair Service for ${repair.product_name}`,
            quantity: 1,
            unitPrice: repairFee,
          });
          total_amount += repairFee;
        }
        for (const item of repairItems) {
          line_items.push({
            id: crypto.randomUUID(),
            product_id: item.product_id,
            description: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
          });
          total_amount += item.quantity * item.unit_price;
        }

        const newInvoiceId = crypto.randomUUID();
        const issue_date = new Date();
        const due_date = new Date();
        due_date.setDate(
          issue_date.getDate() + (settings.defaultDueDateDays || 30)
        );

        db.run(
          "INSERT INTO invoices (id, user_id, customer_id, customer_name, invoice_number, issue_date, due_date, line_items, total, status, created_at, created_by, show_warranty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newInvoiceId,
            adminId,
            repair.customer_id,
            repair.customer_name,
            invoice_number,
            issue_date.toISOString(),
            due_date.toISOString(),
            JSON.stringify(line_items),
            total_amount,
            "Sent",
            new Date().toISOString(),
            creatorId,
            1,
          ]
        );

        db.run("UPDATE customers SET balance = balance - ? WHERE id = ?", [
          total_amount,
          repair.customer_id,
        ]);
        db.run(
          "INSERT INTO transactions (id, user_id, customer_id, date, description, type, amount, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            adminId,
            repair.customer_id,
            new Date().toISOString(),
            `Invoice ${invoice_number} for Repair ${repair.repair_number}`,
            "debit",
            total_amount,
            newInvoiceId,
          ]
        );

        db.run(
          "UPDATE repairs SET status = 'Completed', completed_date = ?, repair_fee = ?, repair_invoice_id = ? WHERE id = ?",
          [new Date().toISOString(), repairFee, newInvoiceId, repairId]
        );

        const updatedSettings = {
          ...settings,
          nextInvoiceNumber: newNextInvoiceNumber,
        };
        db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
          JSON.stringify(updatedSettings),
          adminId,
        ]);

        logActivity(
          db,
          `completed repair ${repair.repair_number} and generated invoice ${invoice_number}.`,
          {
            user_id: adminId,
            customer_id: repair.customer_id,
            performer_id: creatorId,
          }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        [
          "repairs",
          "invoices",
          "transactions",
          "customers",
          "activities",
        ].forEach((table) => io.emit("data_changed", { table }));

        res.status(201).json({ invoiceId: newInvoiceId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/mark-repaired",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const repairId = req.params.id;

        db.exec("BEGIN");

        const repairStmt = db.prepare(
          "SELECT * FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) throw new Error("Repair order not found.");

        if (!repair.damage_log_id) {
          throw new Error(
            "This action is only for repairs originating from damaged stock."
          );
        }

        db.run(
          "UPDATE damaged_stock_log SET status = 'Repaired' WHERE id = ?",
          [repair.damage_log_id]
        );

        const damageLogStmt = db.prepare(
          "SELECT product_id FROM damaged_stock_log WHERE id = :id"
        );
        damageLogStmt.bind({ ":id": repair.damage_log_id });
        const productId = (
          damageLogStmt.step() ? damageLogStmt.getAsObject() : null
        ).product_id;
        damageLogStmt.free();

        db.run(
          "INSERT INTO inventory_purchases (id, user_id, product_id, purchase_date, quantity_purchased, quantity_remaining, unit_cost, supplier, created_at, created_by, status, total_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            adminId,
            productId,
            new Date().toISOString(),
            0,
            1,
            0,
            `Repaired Stock`,
            new Date().toISOString(),
            creatorId,
            "Completed",
            1,
          ]
        );

        db.run(
          "UPDATE repairs SET status = 'Repaired', completed_date = ? WHERE id = ?",
          [new Date().toISOString(), repairId]
        );

        logActivity(
          db,
          `marked repair ${repair.repair_number} as Repaired. The item has been returned to inventory.`,
          { user_id: adminId, performer_id: creatorId }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "damaged_stock_log" });
        io.emit("data_changed", { table: "inventory_purchases" });
        io.emit("data_changed", { table: "products" });
        io.emit("data_changed", { table: "activities" });

        res.json({ message: "Repair completed and item returned to stock." });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/mark-unrepairable",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const repairId = req.params.id;

        db.exec("BEGIN");

        const repairStmt = db.prepare(
          "SELECT * FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) throw new Error("Repair order not found.");

        if (repair.status !== "In Progress") {
          throw new Error(
            "Only repairs 'In Progress' can be marked as unrepairable."
          );
        }

        let productId;
        if (repair.original_sale_item_id) {
          const saleItemStmt = db.prepare(
            "SELECT product_id FROM sale_items WHERE id = :id"
          );
          saleItemStmt.bind({ ":id": repair.original_sale_item_id });
          const saleItem = saleItemStmt.step()
            ? saleItemStmt.getAsObject()
            : null;
          saleItemStmt.free();
          if (saleItem) {
            productId = saleItem.product_id;
          }
        }
        if (!productId) {
          const productStmt = db.prepare(
            "SELECT id FROM products WHERE name = :name AND user_id = :adminId"
          );
          productStmt.bind({
            ":name": repair.product_name,
            ":adminId": adminId,
          });
          const product = productStmt.step() ? productStmt.getAsObject() : null;
          productStmt.free();
          if (product) {
            productId = product.id;
          }
        }

        if (!productId) {
          throw new Error(
            "Could not determine the product associated with this repair."
          );
        }

        const notes = `Marked as unrepairable from Repair Order ${repair.repair_number}. Reported problem: ${repair.reported_problem}`;
        db.run(
          "INSERT INTO damaged_stock_log (id, user_id, product_id, quantity, notes, logged_at, logged_by, status, repair_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            adminId,
            productId,
            1,
            notes,
            new Date().toISOString(),
            creatorId,
            "Unrepairable",
            repairId,
          ]
        );

        db.run("UPDATE repairs SET status = 'Unrepairable' WHERE id = ?", [
          repairId,
        ]);

        logActivity(
          db,
          `marked repair ${repair.repair_number} for "${repair.product_name}" as Unrepairable.`,
          { user_id: adminId, performer_id: creatorId }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "damaged_stock_log" });
        io.emit("data_changed", { table: "activities" });

        res.json({
          message: "Repair marked as unrepairable and logged in damages.",
        });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/from-damage",
    authMiddleware,
    permissionMiddleware("repairs:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const { damageLogId } = req.body;

        db.exec("BEGIN");

        const damageLogStmt = db.prepare(
          "SELECT d.*, p.name as product_name FROM damaged_stock_log d JOIN products p ON d.product_id = p.id WHERE d.id = :id AND d.user_id = :adminId"
        );
        damageLogStmt.bind({ ":id": damageLogId, ":adminId": adminId });
        const damageLog = damageLogStmt.step()
          ? damageLogStmt.getAsObject()
          : null;
        damageLogStmt.free();
        if (!damageLog) throw new Error("Damage log not found.");

        if (damageLog.repair_id) {
          const existingRepairStmt = db.prepare(
            "SELECT repair_number FROM repairs WHERE id = :id"
          );
          existingRepairStmt.bind({ ":id": damageLog.repair_id });
          const existingRepair = existingRepairStmt.step()
            ? existingRepairStmt.getAsObject()
            : null;
          existingRepairStmt.free();
          if (existingRepair) {
            throw new Error(
              `A repair order (${existingRepair.repair_number}) already exists for this item.`
            );
          }
        }

        let internalCustomerStmt = db.prepare(
          "SELECT id FROM customers WHERE name = 'Internal' AND user_id = :adminId"
        );
        internalCustomerStmt.bind({ ":adminId": adminId });
        let internalCustomer = internalCustomerStmt.step()
          ? internalCustomerStmt.getAsObject()
          : null;
        internalCustomerStmt.free();
        let internalCustomerId;
        if (!internalCustomer) {
          internalCustomerId = crypto.randomUUID();
          db.run(
            "INSERT INTO customers (id, user_id, customer_number, name, phone, address, status, balance, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              internalCustomerId,
              adminId,
              "CUS-INTERNAL",
              "Internal",
              "N/A",
              "N/A",
              "Active",
              0,
              new Date().toISOString(),
              creatorId,
            ]
          );
        } else {
          internalCustomerId = internalCustomer.id;
        }

        const settings = getSettings(db, adminId);
        const repairNumber = `REP-${String(
          settings.nextRepairNumber || 1
        ).padStart(4, "0")}`;
        const newNextRepairNumber = (settings.nextRepairNumber || 1) + 1;

        const newRepairId = crypto.randomUUID();
        db.run(
          "INSERT INTO repairs (id, user_id, repair_number, customer_id, product_name, reported_problem, status, received_date, created_by, created_at, damage_log_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newRepairId,
            adminId,
            repairNumber,
            internalCustomerId,
            damageLog.product_name,
            damageLog.notes || "Item from damaged stock.",
            "Received",
            new Date().toISOString(),
            creatorId,
            new Date().toISOString(),
            damageLogId,
          ]
        );

        db.run(
          "UPDATE damaged_stock_log SET status = 'In Repair', repair_id = ? WHERE id = ?",
          [newRepairId, damageLogId]
        );

        const updatedSettings = {
          ...settings,
          nextRepairNumber: newNextRepairNumber,
        };
        db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
          JSON.stringify(updatedSettings),
          adminId,
        ]);

        logActivity(
          db,
          `started a repair (${repairNumber}) for a damaged item: ${damageLog.product_name}.`,
          { user_id: adminId, performer_id: creatorId }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "damaged_stock_log" });
        io.emit("data_changed", { table: "activities" });

        res.status(201).json({ repairId: newRepairId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/void-warranty",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const repairId = req.params.id;
        const { reason } = req.body;
        db.exec("BEGIN");
        db.run(
          "UPDATE repairs SET is_warranty = 0, warranty_void_reason = ? WHERE id = ? AND user_id = ?",
          [reason, repairId, adminId]
        );
        logActivity(db, `voided the warranty for repair order.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Warranty voided" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/create-replacement",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const repairId = req.params.id;
        const { replacementProductId, quantity, price, notes } = req.body;
        const settings = getSettings(db, adminId);
        const currency = settings.currency || "$";

        db.exec("BEGIN");

        const repairStmt = db.prepare(
          "SELECT * FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) throw new Error("Repair order not found.");

        const productStmt = db.prepare("SELECT * FROM products WHERE id = :id");
        productStmt.bind({ ":id": replacementProductId });
        const product = productStmt.step() ? productStmt.getAsObject() : null;
        productStmt.free();
        if (!product) throw new Error("Replacement product not found.");

        const invoice_number = `${settings.invoicePrefix || "INV-"}${String(
          settings.nextInvoiceNumber || 1
        ).padStart(4, "0")}`;
        const newNextInvoiceNumber = (settings.nextInvoiceNumber || 1) + 1;
        const newInvoiceId = crypto.randomUUID();
        const total = price * quantity;

        const line_items = [
          {
            id: crypto.randomUUID(),
            product_id: replacementProductId,
            description: product.name,
            quantity,
            unitPrice: price,
          },
        ];

        db.run(
          "INSERT INTO invoices (id, user_id, customer_id, customer_name, invoice_number, issue_date, due_date, line_items, total, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newInvoiceId,
            adminId,
            repair.customer_id,
            repair.customer_name,
            invoice_number,
            new Date().toISOString(),
            new Date().toISOString(),
            JSON.stringify(line_items),
            total,
            "Paid",
            new Date().toISOString(),
            creatorId,
          ]
        );

        db.run(
          "UPDATE repairs SET status = 'Completed (Replaced)', replacement_invoice_id = ? WHERE id = ?",
          [newInvoiceId, repairId]
        );

        let qtyToDeduct = quantity;
        const purchasesStmt = db.prepare(
          "SELECT * FROM inventory_purchases WHERE product_id = :productId AND quantity_remaining > 0 ORDER BY purchase_date ASC"
        );
        purchasesStmt.bind({ ":productId": replacementProductId });
        const purchases = [];
        while (purchasesStmt.step())
          purchases.push(purchasesStmt.getAsObject());
        purchasesStmt.free();
        for (const p of purchases) {
          if (qtyToDeduct <= 0) break;
          const deduction = Math.min(qtyToDeduct, p.quantity_remaining);
          db.run(
            "UPDATE inventory_purchases SET quantity_remaining = ? WHERE id = ?",
            [p.quantity_remaining - deduction, p.id]
          );
          qtyToDeduct -= deduction;
        }
        if (qtyToDeduct > 0)
          throw new Error(
            `Insufficient stock for replacement product: ${product.name}`
          );

        logActivity(
          db,
          `created replacement invoice ${invoice_number} for repair ${repair.repair_number}.`,
          { user_id: adminId, performer_id: creatorId }
        );

        const updatedSettings = {
          ...settings,
          nextInvoiceNumber: newNextInvoiceNumber,
        };
        db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
          JSON.stringify(updatedSettings),
          adminId,
        ]);

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "invoices" });
        io.emit("data_changed", { table: "inventory_purchases" });
        io.emit("data_changed", { table: "products" });
        io.emit("data_changed", { table: "activities" });

        res.status(201).json({ invoiceId: newInvoiceId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/repairs/:id/issue-credit",
    authMiddleware,
    permissionMiddleware("repairs:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const repairId = req.params.id;
        const { amount, notes } = req.body;
        const settings = getSettings(db, adminId);
        const currency = settings.currency || "$";

        db.exec("BEGIN");

        const repairStmt = db.prepare(
          "SELECT * FROM repairs WHERE id = :id AND user_id = :adminId"
        );
        repairStmt.bind({ ":id": repairId, ":adminId": adminId });
        const repair = repairStmt.step() ? repairStmt.getAsObject() : null;
        repairStmt.free();
        if (!repair) throw new Error("Repair order not found.");

        db.run("UPDATE customers SET balance = balance + ? WHERE id = ?", [
          amount,
          repair.customer_id,
        ]);

        const description = notes
          ? `Store Credit: ${notes}`
          : `Store Credit for Repair ${repair.repair_number}`;
        db.run(
          "INSERT INTO transactions (id, user_id, customer_id, date, description, type, amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            adminId,
            repair.customer_id,
            new Date().toISOString(),
            description,
            "credit",
            amount,
          ]
        );

        db.run(
          "UPDATE repairs SET status = 'Completed (Credit)' WHERE id = ?",
          [repairId]
        );

        logActivity(
          db,
          `issued ${currency}${amount.toFixed(2)} store credit for repair ${
            repair.repair_number
          }.`,
          { user_id: adminId, performer_id: creatorId }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        io.emit("data_changed", { table: "repairs" });
        io.emit("data_changed", { table: "customers" });
        io.emit("data_changed", { table: "transactions" });
        io.emit("data_changed", { table: "activities" });

        res.status(201).json({ message: "Credit issued successfully." });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- QUOTATIONS API ---
  const normalizeLineItems = (lineItems) => {
    return lineItems.map((item) => {
      const newItem = { ...item };
      if (newItem.unit_price !== undefined) {
        newItem.unitPrice = newItem.unit_price;
        delete newItem.unit_price;
      }
      if (newItem.product_type) {
        newItem.isBundle = newItem.product_type === "bundle";
      }
      return newItem;
    });
  };

  app.get(
    "/api/quotations",
    authMiddleware,
    permissionMiddleware("quotations:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const {
          searchTerm = "",
          page = 1,
          pageSize = 10,
          sortBy = "created_at",
          sortOrder = "DESC",
          status,
          startDate,
          endDate,
        } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const allowedSortBy = [
          "quotation_number",
          "customer_name",
          "issue_date",
          "total",
          "status",
          "created_at",
        ];
        const safeSortBy = allowedSortBy.includes(sortBy)
          ? sortBy
          : "created_at";
        const safeSortOrder =
          sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

        let whereClause = `WHERE q.user_id = :adminId AND (q.quotation_number LIKE :searchTerm OR q.customer_name LIKE :searchTerm)`;
        const params = {
          ":adminId": adminId,
          ":searchTerm": `%${searchTerm}%`,
        };

        if (status && status !== "all") {
          whereClause += ` AND q.status = :status`;
          params[":status"] = status;
        }
        if (startDate) {
          whereClause += ` AND q.issue_date >= :startDate`;
          params[":startDate"] = new Date(startDate).toISOString();
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause += ` AND q.issue_date <= :endDate`;
          params[":endDate"] = end.toISOString();
        }

        const totalCountStmt = db.prepare(
          `SELECT COUNT(*) as count FROM quotations q ${whereClause}`
        );
        totalCountStmt.bind(params);
        const totalCount = totalCountStmt.step()
          ? totalCountStmt.getAsObject().count
          : 0;
        totalCountStmt.free();

        const quotationsStmt = db.prepare(`
                SELECT q.*, p.first_name || ' ' || p.last_name as creator_name 
                FROM quotations q 
                LEFT JOIN profiles p ON q.created_by = p.id 
                ${whereClause}
                ORDER BY ${safeSortBy} ${safeSortOrder}
                LIMIT :pageSize OFFSET :offset
            `);
        quotationsStmt.bind({
          ...params,
          ":pageSize": parseInt(pageSize),
          ":offset": offset,
        });
        const quotationsRaw = [];
        while (quotationsStmt.step())
          quotationsRaw.push(quotationsStmt.getAsObject());
        quotationsStmt.free();
        const quotations = quotationsRaw.map((q) => ({
          ...q,
          line_items: JSON.parse(q.line_items),
        }));
        res.json({ quotations, count: totalCount });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/quotations/:id",
    authMiddleware,
    permissionMiddleware("quotations:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(`
                SELECT q.*, c.address as customerAddress, c.phone as customerPhone, c.secondary_phone as customerSecondaryPhone 
                FROM quotations q
                JOIN customers c ON q.customer_id = c.id
                WHERE q.id = :id AND q.user_id = :adminId
            `);
        stmt.bind({ ":id": req.params.id, ":adminId": adminId });
        const quotation = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        if (quotation) {
          res.json({
            ...quotation,
            line_items: JSON.parse(quotation.line_items),
          });
        } else {
          res.status(404).json({ error: "Quotation not found" });
        }
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/quotations",
    authMiddleware,
    permissionMiddleware("quotations:create"),
    (req, res) => {
      const adminId = getAdminId(db, req.user.id);
      const creatorId = req.user.id;
      const {
        customer_id,
        line_items,
        total,
        notes,
        terms_and_conditions,
        expiry_date,
        issue_date,
        show_notes,
        show_warranty,
        delivery_charge,
        show_product_descriptions,
        show_warranty_end_date,
      } = req.body;

      try {
        db.exec("BEGIN");

        const customerStmt = db.prepare(
          "SELECT name FROM customers WHERE id = :id AND user_id = :adminId"
        );
        customerStmt.bind({ ":id": customer_id, ":adminId": adminId });
        const customer = customerStmt.step()
          ? customerStmt.getAsObject()
          : null;
        customerStmt.free();
        if (!customer) throw new Error("Customer not found");

        const settings = getSettings(db, adminId);
        const currency = settings.currency || "$";

        const quotation_number = `${settings.quotationPrefix || "QUO-"}${String(
          settings.nextQuotationNumber || 1
        ).padStart(4, "0")}`;
        const newNextQuotationNumber = (settings.nextQuotationNumber || 1) + 1;
        const newQuotationId = crypto.randomUUID();

        const normalized_line_items = normalizeLineItems(line_items);

        db.run(
          "INSERT INTO quotations (id, user_id, customer_id, customer_name, quotation_number, issue_date, expiry_date, line_items, total, status, created_at, created_by, notes, terms_and_conditions, show_notes, show_warranty, delivery_charge, show_product_descriptions, show_warranty_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newQuotationId,
            adminId,
            customer_id,
            customer.name,
            quotation_number,
            new Date(issue_date).toISOString(),
            new Date(expiry_date).toISOString(),
            JSON.stringify(normalized_line_items),
            total,
            "Draft",
            new Date().toISOString(),
            creatorId,
            notes,
            terms_and_conditions,
            show_notes ? 1 : 0,
            show_warranty ? 1 : 0,
            delivery_charge || 0,
            show_product_descriptions ? 1 : 0,
            show_warranty_end_date ? 1 : 0,
          ]
        );

        logActivity(
          db,
          `created quotation ${quotation_number} for ${
            customer.name
          } with a total of ${currency}${total.toFixed(2)}.`,
          {
            user_id: adminId,
            customer_id,
            performer_id: creatorId,
            quotation_id: newQuotationId,
          }
        );

        const updatedSettings = {
          ...settings,
          nextQuotationNumber: newNextQuotationNumber,
        };
        db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
          JSON.stringify(updatedSettings),
          adminId,
        ]);

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "quotations" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ quotationId: newQuotationId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/quotations/:id",
    authMiddleware,
    permissionMiddleware("quotations:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const quotationId = req.params.id;
        const {
          customer_id,
          line_items,
          total,
          notes,
          terms_and_conditions,
          expiry_date,
          show_notes,
          show_warranty,
          delivery_charge,
          show_product_descriptions,
          show_warranty_end_date,
        } = req.body;

        db.exec("BEGIN");

        const quotationStmt = db.prepare(
          "SELECT * FROM quotations WHERE id = :id AND user_id = :adminId"
        );
        quotationStmt.bind({ ":id": quotationId, ":adminId": adminId });
        const existingQuotation = quotationStmt.step()
          ? quotationStmt.getAsObject()
          : null;
        quotationStmt.free();
        if (!existingQuotation) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Quotation not found" });
        }

        if (existingQuotation.status !== "Draft") {
          db.exec("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Only draft quotations can be edited." });
        }

        const customerStmt = db.prepare(
          "SELECT name FROM customers WHERE id = :id AND user_id = :adminId"
        );
        customerStmt.bind({ ":id": customer_id, ":adminId": adminId });
        const customer = customerStmt.step()
          ? customerStmt.getAsObject()
          : null;
        customerStmt.free();

        const normalized_line_items = normalizeLineItems(line_items);

        db.run(
          "UPDATE quotations SET customer_id = ?, customer_name = ?, line_items = ?, total = ?, notes = ?, terms_and_conditions = ?, expiry_date = ?, show_notes = ?, show_warranty = ?, delivery_charge = ?, show_product_descriptions = ?, show_warranty_end_date = ? WHERE id = ?",
          [
            customer_id,
            customer.name,
            JSON.stringify(normalized_line_items),
            total,
            notes,
            terms_and_conditions,
            new Date(expiry_date).toISOString(),
            show_notes ? 1 : 0,
            show_warranty ? 1 : 0,
            delivery_charge || 0,
            show_product_descriptions ? 1 : 0,
            show_warranty_end_date ? 1 : 0,
            quotationId,
          ]
        );

        logActivity(
          db,
          `updated draft quotation ${existingQuotation.quotation_number} for ${customer.name}.`,
          {
            user_id: adminId,
            customer_id: customer_id,
            performer_id: req.user.id,
            quotation_id: quotationId,
          }
        );

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "quotations" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Quotation updated successfully" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/quotations/:id",
    authMiddleware,
    permissionMiddleware("quotations:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const quotationId = req.params.id;
        db.exec("BEGIN");
        const stmt = db.prepare(
          "SELECT quotation_number, customer_name, customer_id FROM quotations WHERE id = :id AND user_id = :adminId"
        );
        stmt.bind({ ":id": quotationId, ":adminId": adminId });
        const quotation = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        db.run("DELETE FROM quotations WHERE id = ? AND user_id = ?", [
          quotationId,
          adminId,
        ]);
        logActivity(
          db,
          `deleted quotation ${quotation.quotation_number} for ${quotation.customer_name}.`,
          {
            user_id: adminId,
            customer_id: quotation.customer_id,
            performer_id: req.user.id,
            quotation_id: quotationId,
          }
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "quotations" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "deleted" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/quotations/:id/convert",
    authMiddleware,
    permissionMiddleware("quotations:convert"),
    (req, res) => {
      const adminId = getAdminId(db, req.user.id);
      const creatorId = req.user.id;
      const quotationId = req.params.id;

      try {
        db.exec("BEGIN");

        const quotationStmt = db.prepare(
          "SELECT * FROM quotations WHERE id = :id AND user_id = :adminId"
        );
        quotationStmt.bind({ ":id": quotationId, ":adminId": adminId });
        const quotation = quotationStmt.step()
          ? quotationStmt.getAsObject()
          : null;
        quotationStmt.free();
        if (!quotation) throw new Error("Quotation not found.");
        if (quotation.status === "Converted")
          throw new Error("Quotation has already been converted.");

        const line_items = JSON.parse(quotation.line_items);
        const sale_items = [];

        for (const item of line_items) {
          const productStmt = db.prepare(
            "SELECT id, name, product_type FROM products WHERE id = :id AND user_id = :adminId"
          );
          productStmt.bind({ ":id": item.product_id, ":adminId": adminId });
          const product = productStmt.step() ? productStmt.getAsObject() : null;
          productStmt.free();
          if (!product)
            throw new Error(`Product "${item.description}" not found.`);
          const productId = product.id;

          if (product.product_type === "bundle") {
            const componentsStmt = db.prepare(
              "SELECT sub_product_id, quantity FROM bundle_components WHERE bundle_product_id = :bundleId"
            );
            componentsStmt.bind({ ":bundleId": productId });
            const components = [];
            while (componentsStmt.step())
              components.push(componentsStmt.getAsObject());
            componentsStmt.free();
            if (components.length === 0)
              throw new Error(
                `Bundle "${product.name}" has no components defined.`
              );

            let possibleBundles = Infinity;
            for (const comp of components) {
              const stockStmt = db.prepare(
                "SELECT COALESCE(SUM(quantity_remaining), 0) as stock FROM inventory_purchases WHERE product_id = :productId AND user_id = :adminId"
              );
              stockStmt.bind({
                ":productId": comp.sub_product_id,
                ":adminId": adminId,
              });
              const componentStock = stockStmt.step()
                ? stockStmt.getAsObject().stock
                : 0;
              stockStmt.free();
              const bundlesFromComponent = Math.floor(
                componentStock / comp.quantity
              );
              if (bundlesFromComponent < possibleBundles) {
                possibleBundles = bundlesFromComponent;
              }
            }
            const availableStock =
              possibleBundles === Infinity ? 0 : possibleBundles;
            if (availableStock < item.quantity) {
              throw new Error(
                `Insufficient stock for "${product.name}". Required: ${item.quantity}, Available: ${availableStock}.`
              );
            }
          } else {
            const stockStmt = db.prepare(
              "SELECT COALESCE(SUM(quantity_remaining), 0) as stock FROM inventory_purchases WHERE product_id = :productId AND user_id = :adminId"
            );
            stockStmt.bind({ ":productId": productId, ":adminId": adminId });
            const stock = stockStmt.step() ? stockStmt.getAsObject().stock : 0;
            stockStmt.free();
            if (stock < item.quantity) {
              throw new Error(
                `Insufficient stock for "${product.name}". Required: ${item.quantity}, Available: ${stock}.`
              );
            }
          }

          sale_items.push({
            product_id: productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount: item.discount || 0,
            product_type: product.product_type,
          });
        }

        const newInvoiceId = crypto.randomUUID();
        const sale_id = crypto.randomUUID();
        db.run(
          "INSERT INTO sales (id, user_id, customer_id, total_amount, sale_date, created_by, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            sale_id,
            adminId,
            quotation.customer_id,
            quotation.total,
            new Date().toISOString(),
            creatorId,
            newInvoiceId,
          ]
        );

        for (const item of sale_items) {
          db.run(
            "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)",
            [
              crypto.randomUUID(),
              sale_id,
              item.product_id,
              item.quantity,
              item.unit_price,
              item.quantity * item.unit_price,
            ]
          );

          if (item.product_type === "bundle") {
            const components = formatSqlJsResult(
              db.exec(
                `SELECT * FROM bundle_components WHERE bundle_product_id = '${item.product_id}'`
              )
            );
            for (const comp of components) {
              let qtyToDeduct = item.quantity * comp.quantity;
              const purchasesStmt = db.prepare(
                "SELECT * FROM inventory_purchases WHERE product_id = :productId AND user_id = :adminId AND quantity_remaining > 0 ORDER BY purchase_date ASC"
              );
              purchasesStmt.bind({
                ":productId": comp.sub_product_id,
                ":adminId": adminId,
              });
              const purchasesForComponent = [];
              while (purchasesStmt.step())
                purchasesForComponent.push(purchasesStmt.getAsObject());
              purchasesStmt.free();
              for (const purchase of purchasesForComponent) {
                if (qtyToDeduct <= 0) break;
                const deduction = Math.min(
                  qtyToDeduct,
                  purchase.quantity_remaining
                );
                db.run(
                  "UPDATE inventory_purchases SET quantity_remaining = ? WHERE id = ?",
                  [purchase.quantity_remaining - deduction, purchase.id]
                );
                qtyToDeduct -= deduction;
              }
            }
          } else {
            let qtyToDeduct = item.quantity;
            const purchasesStmt = db.prepare(
              "SELECT * FROM inventory_purchases WHERE product_id = :productId AND user_id = :adminId AND quantity_remaining > 0 ORDER BY purchase_date ASC"
            );
            purchasesStmt.bind({
              ":productId": item.product_id,
              ":adminId": adminId,
            });
            const purchasesForProduct = [];
            while (purchasesStmt.step())
              purchasesForProduct.push(purchasesStmt.getAsObject());
            purchasesStmt.free();
            for (const purchase of purchasesForProduct) {
              if (qtyToDeduct <= 0) break;
              const deduction = Math.min(
                qtyToDeduct,
                purchase.quantity_remaining
              );
              db.run(
                "UPDATE inventory_purchases SET quantity_remaining = ? WHERE id = ?",
                [purchase.quantity_remaining - deduction, purchase.id]
              );
              qtyToDeduct -= deduction;
            }
          }
        }

        const settings = getSettings(db, adminId);
        const currency = settings.currency || "$";
        const invoice_number = `${settings.invoicePrefix || "INV-"}${String(
          settings.nextInvoiceNumber || 1
        ).padStart(4, "0")}`;
        const newNextInvoiceNumber = (settings.nextInvoiceNumber || 1) + 1;

        const issue_date = new Date();
        const due_date = new Date();
        due_date.setDate(
          issue_date.getDate() + (settings.defaultDueDateDays || 30)
        );

        db.run("UPDATE customers SET balance = balance - ? WHERE id = ?", [
          quotation.total,
          quotation.customer_id,
        ]);
        db.run(
          "INSERT INTO transactions (id, user_id, customer_id, date, description, type, amount, invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            adminId,
            quotation.customer_id,
            new Date().toISOString(),
            `Invoice ${invoice_number} from Quotation ${quotation.quotation_number}`,
            "debit",
            quotation.total,
            newInvoiceId,
          ]
        );
        db.run(
          "INSERT INTO invoices (id, user_id, customer_id, customer_name, invoice_number, issue_date, due_date, line_items, total, status, created_at, created_by, notes, terms_and_conditions, show_warranty, show_warranty_end_date, delivery_charge, show_product_descriptions, discount, show_previous_balance, show_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newInvoiceId,
            adminId,
            quotation.customer_id,
            quotation.customer_name,
            invoice_number,
            issue_date.toISOString(),
            due_date.toISOString(),
            JSON.stringify(line_items),
            quotation.total,
            "Sent",
            new Date().toISOString(),
            creatorId,
            quotation.notes,
            quotation.terms_and_conditions,
            quotation.show_warranty,
            quotation.show_warranty_end_date,
            quotation.delivery_charge,
            quotation.show_product_descriptions,
            0,
            0,
            quotation.show_notes,
          ]
        );

        db.run(
          "UPDATE quotations SET status = 'Converted', converted_invoice_id = ? WHERE id = ?",
          [newInvoiceId, quotationId]
        );

        const updatedSettings = {
          ...settings,
          nextInvoiceNumber: newNextInvoiceNumber,
        };
        db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
          JSON.stringify(updatedSettings),
          adminId,
        ]);

        logActivity(
          db,
          `converted quotation ${quotation.quotation_number} to invoice ${invoice_number}.`,
          {
            user_id: adminId,
            customer_id: quotation.customer_id,
            performer_id: creatorId,
            quotation_id: quotationId,
            invoice_id: newInvoiceId,
          }
        );

        db.exec("COMMIT");
        saveDatabase(db);

        [
          "sales",
          "inventory_purchases",
          "products",
          "transactions",
          "invoices",
          "customers",
          "quotations",
          "activities",
        ].forEach((table) => io.emit("data_changed", { table }));

        res.status(201).json({ invoiceId: newInvoiceId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- ACTIVITIES API ---
  app.get(
    "/api/activities",
    authMiddleware,
    permissionMiddleware("activity:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const {
          searchTerm,
          performerId,
          startDate,
          endDate,
          sortBy = "timestamp",
          sortOrder = "DESC",
          page = 1,
          pageSize = 20,
        } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const performersStmt = db.prepare(
          "SELECT id, first_name, last_name FROM profiles WHERE admin_id = :adminId"
        );
        performersStmt.bind({ ":adminId": adminId });
        const performers = [];
        while (performersStmt.step())
          performers.push(performersStmt.getAsObject());
        performersStmt.free();

        let whereClause = `WHERE a.user_id = :adminId`;
        const params = { ":adminId": adminId };

        if (searchTerm) {
          whereClause += ` AND a.message LIKE :searchTerm`;
          params[":searchTerm"] = `%${searchTerm}%`;
        }
        if (performerId && performerId !== "all-performers") {
          whereClause += ` AND a.performer_id = :performerId`;
          params[":performerId"] = performerId;
        }
        if (startDate) {
          whereClause += ` AND a.timestamp >= :startDate`;
          params[":startDate"] = new Date(startDate).toISOString();
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause += ` AND a.timestamp <= :endDate`;
          params[":endDate"] = end.toISOString();
        }

        const countQuery = `SELECT COUNT(*) as count FROM activities a ${whereClause}`;
        const countStmt = db.prepare(countQuery);
        countStmt.bind(params);
        const totalCount = countStmt.step() ? countStmt.getAsObject().count : 0;
        countStmt.free();

        const allowedSortBy = ["timestamp", "performer_name"];
        const safeSortBy = allowedSortBy.includes(sortBy)
          ? sortBy
          : "timestamp";
        const safeSortOrder =
          sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

        let query = `
                SELECT a.*, TRIM(p.first_name || ' ' || p.last_name) as performer_name 
                FROM activities a 
                LEFT JOIN profiles p ON a.performer_id = p.id 
                ${whereClause}
                ORDER BY ${safeSortBy} ${safeSortOrder}
                LIMIT :pageSize OFFSET :offset
            `;
        params[":pageSize"] = parseInt(pageSize);
        params[":offset"] = offset;

        const stmt = db.prepare(query);
        stmt.bind(params);

        const activities = [];
        while (stmt.step()) {
          activities.push(stmt.getAsObject());
        }
        stmt.free();

        res.json({ activities, performers, count: totalCount });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/documents/:type/:id/timeline",
    authMiddleware,
    permissionMiddleware("activity:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { type, id } = req.params;
        let field;
        if (type === "invoice") {
          field = "invoice_id";
        } else if (type === "quotation") {
          field = "quotation_id";
        } else {
          return res.status(400).json({ error: "Invalid document type" });
        }

        const stmt = db.prepare(`
                SELECT a.*, TRIM(p.first_name || ' ' || p.last_name) as performer_name 
                FROM activities a 
                LEFT JOIN profiles p ON a.performer_id = p.id 
                WHERE a.user_id = :adminId AND a.${field} = :id
                ORDER BY a.timestamp DESC
            `);
        stmt.bind({ ":adminId": adminId, ":id": id });
        const activities = [];
        while (stmt.step()) activities.push(stmt.getAsObject());
        stmt.free();
        res.json(activities);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- ROLES & EMPLOYEES ---
  app.get(
    "/api/roles",
    authMiddleware,
    permissionMiddleware("roles:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const r = db.exec(`SELECT * FROM roles WHERE user_id = '${adminId}'`);
        res.json(
          formatSqlJsResult(r).map((i) => ({
            ...i,
            permissions: JSON.parse(i.permissions),
          }))
        );
      } catch (e) {
        res.status(500).json({ e: e.message });
      }
    }
  );
  app.post(
    "/api/roles",
    authMiddleware,
    permissionMiddleware("roles:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name, description, permissions } = req.body;
        const id = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO roles (id, user_id, name, description, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [
            id,
            adminId,
            name,
            description,
            JSON.stringify(permissions),
            new Date().toISOString(),
          ]
        );
        logActivity(db, `created a new user role: '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "roles" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id });
      } catch (e) {
        db.exec("ROLLBACK");
        res.status(500).json({ e: e.message });
      }
    }
  );
  app.put(
    "/api/roles/:id",
    authMiddleware,
    permissionMiddleware("roles:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name, description, permissions } = req.body;
        const roleId = req.params.id;

        db.exec("BEGIN");

        const oldRoleStmt = db.prepare(
          "SELECT * FROM roles WHERE id = :id AND user_id = :adminId"
        );
        oldRoleStmt.bind({ ":id": roleId, ":adminId": adminId });
        const oldRole = oldRoleStmt.step() ? oldRoleStmt.getAsObject() : null;
        oldRoleStmt.free();
        if (!oldRole) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Role not found" });
        }
        oldRole.permissions = JSON.parse(oldRole.permissions);

        db.run(
          "UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ? AND user_id = ?",
          [name, description, JSON.stringify(permissions), roleId, adminId]
        );

        const changes = [];
        if (oldRole.name !== name) changes.push(`name to "${name}"`);
        if (oldRole.description !== description) changes.push(`description`);

        const oldPerms = new Set(oldRole.permissions);
        const newPerms = new Set(permissions);
        const addedPerms = permissions.filter((p) => !oldPerms.has(p));
        const removedPerms = oldRole.permissions.filter(
          (p) => !newPerms.has(p)
        );

        if (addedPerms.length > 0)
          changes.push(`added ${addedPerms.length} permission(s)`);
        if (removedPerms.length > 0)
          changes.push(`removed ${removedPerms.length} permission(s)`);

        if (changes.length > 0) {
          logActivity(
            db,
            `updated role '${oldRole.name}': changed ${changes.join(", ")}.`,
            {
              user_id: adminId,
              performer_id: req.user.id,
              details: { old: oldRole, new: req.body },
            }
          );
        }

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "roles" });
        io.emit("data_changed", { table: "activities" });
        res.json({ m: "success" });
      } catch (e) {
        db.exec("ROLLBACK");
        res.status(500).json({ e: e.message });
      }
    }
  );
  app.put(
    "/api/roles/:id/reset",
    authMiddleware,
    permissionMiddleware("roles:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const roleId = req.params.id;

        db.exec("BEGIN");

        const roleStmt = db.prepare(
          "SELECT name FROM roles WHERE id = :id AND user_id = :adminId"
        );
        roleStmt.bind({ ":id": roleId, ":adminId": adminId });
        const role = roleStmt.step() ? roleStmt.getAsObject() : null;
        roleStmt.free();
        if (!role) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Role not found" });
        }

        if (role.name !== "Admin") {
          db.exec("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Only the Admin role can be reset to default." });
        }

        const ALL_PERMISSIONS = [
          "dashboard:view",
          "dashboard:view:financials",
          "customers:view",
          "customers:view:financials",
          "customers:create",
          "customers:edit:details",
          "customers:edit:status",
          "customers:manage:links",
          "customers:delete",
          "customers:import",
          "invoices:view",
          "invoices:create",
          "invoices:edit",
          "invoices:send",
          "invoices:delete",
          "receipts:view",
          "returns:view",
          "returns:create",
          "returns:delete",
          "repairs:view",
          "repairs:create",
          "repairs:edit",
          "repairs:delete",
          "quotations:view",
          "quotations:create",
          "quotations:edit",
          "quotations:delete",
          "quotations:convert",
          "sales:view",
          "sales:process",
          "sales:apply:discounts",
          "sales:process:refunds",
          "inventory:view",
          "inventory:create",
          "inventory:edit:details",
          "inventory:edit:price",
          "inventory:delete",
          "damages:view",
          "damages:create",
          "damages:edit",
          "damages:delete",
          "purchases:view",
          "purchases:create",
          "purchases:edit",
          "purchases:delete",
          "expenses:view",
          "expenses:create",
          "expenses:edit",
          "expenses:delete",
          "tasks:view",
          "tasks:create",
          "tasks:edit",
          "tasks:delete",
          "tasks:assign",
          "tasks:send:urgent-notification",
          "messages:view",
          "messages:send",
          "activity:view",
          "analytics:view",
          "accounting:view",
          "settings:view",
          "employees:view",
          "employees:create",
          "employees:edit",
          "employees:delete",
          "settings:manage:payment-methods",
          "settings:manage:couriers",
          "settings:manage:expense-categories",
          "settings:manage:clear",
          "settings:manage:stress-test",
          "settings:manage:system-status",
          "settings:manage:api-keys",
        ];

        db.run(
          "UPDATE roles SET permissions = ? WHERE id = ? AND user_id = ?",
          [JSON.stringify(ALL_PERMISSIONS), roleId, adminId]
        );

        logActivity(
          db,
          `reset the permissions for the 'Admin' role to default.`,
          { user_id: adminId, performer_id: req.user.id }
        );

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "roles" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Admin role permissions have been reset." });
      } catch (e) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: e.message });
      }
    }
  );
  app.delete(
    "/api/roles/:id",
    authMiddleware,
    permissionMiddleware("roles:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        db.exec("BEGIN");
        const r = formatSqlJsResult(
          db.exec(
            `SELECT name FROM roles WHERE id = '${req.params.id}' AND user_id = '${adminId}'`
          )
        )[0];
        db.run("DELETE FROM roles WHERE id = ? AND user_id = ?", [
          req.params.id,
          adminId,
        ]);
        logActivity(db, `deleted the user role: '${r.name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "roles" });
        io.emit("data_changed", { table: "activities" });
        res.json({ m: "deleted" });
      } catch (e) {
        db.exec("ROLLBACK");
        res.status(500).json({ e: e.message });
      }
    }
  );
  app.get(
    "/api/employees",
    authMiddleware,
    permissionMiddleware("employees:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const e = db.exec(
          `SELECT p.*, r.name as role_name FROM profiles p LEFT JOIN roles r ON p.role_id = r.id WHERE p.admin_id = '${adminId}'`
        );
        res.json(
          formatSqlJsResult(e).map((p) => {
            delete p.password;
            return p;
          })
        );
      } catch (e) {
        res.status(500).json({ e: e.message });
      }
    }
  );
  app.post(
    "/api/employees",
    authMiddleware,
    permissionMiddleware("employees:create"),
    async (req, res) => {
      try {
        const admin_id = req.user.id;
        const { first_name, last_name, email, password, role_id } = req.body;
        const existingUserStmt = db.prepare(
          "SELECT id FROM profiles WHERE email = :email"
        );
        existingUserStmt.bind({ ":email": email });
        const existingUser = existingUserStmt.step()
          ? existingUserStmt.getAsObject()
          : null;
        existingUserStmt.free();
        if (existingUser) {
          return res
            .status(409)
            .json({ error: "User with this email already exists." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO profiles (id, first_name, last_name, email, password, admin_id, role_id, requires_password_change, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newUserId,
            first_name,
            last_name,
            email,
            hashedPassword,
            admin_id,
            role_id,
            1,
            new Date().toISOString(),
          ]
        );
        logActivity(
          db,
          `created a new employee account for ${first_name} ${last_name}.`,
          { user_id: admin_id, performer_id: admin_id }
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "profiles" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ message: "Employee created successfully" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );
  app.put(
    "/api/employees/:id",
    authMiddleware,
    permissionMiddleware("employees:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { role_id } = req.body;
        db.exec("BEGIN");
        const e = formatSqlJsResult(
          db.exec(
            `SELECT first_name, last_name FROM profiles WHERE id = '${req.params.id}' AND admin_id = '${adminId}'`
          )
        )[0];
        const r = formatSqlJsResult(
          db.exec(
            `SELECT name FROM roles WHERE id = '${role_id}' AND user_id = '${adminId}'`
          )
        )[0];
        db.run(
          "UPDATE profiles SET role_id = ? WHERE id = ? AND admin_id = ?",
          [role_id, req.params.id, adminId]
        );
        logActivity(
          db,
          `updated the role for ${e.first_name} ${e.last_name} to '${r.name}'.`,
          { user_id: adminId, performer_id: req.user.id }
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "profiles" });
        io.emit("data_changed", { table: "activities" });
        res.json({ m: "success" });
      } catch (e) {
        db.exec("ROLLBACK");
        res.status(500).json({ e: e.message });
      }
    }
  );
  app.delete(
    "/api/employees/:id",
    authMiddleware,
    permissionMiddleware("employees:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        db.exec("BEGIN");
        const e = formatSqlJsResult(
          db.exec(
            `SELECT first_name, last_name FROM profiles WHERE id = '${req.params.id}' AND admin_id = '${adminId}'`
          )
        )[0];
        db.run("DELETE FROM profiles WHERE id = ? AND admin_id = ?", [
          req.params.id,
          adminId,
        ]);
        logActivity(
          db,
          `deleted the employee account for ${e.first_name} ${e.last_name}.`,
          { user_id: adminId, performer_id: req.user.id }
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "profiles" });
        io.emit("data_changed", { table: "activities" });
        res.json({ m: "deleted" });
      } catch (e) {
        db.exec("ROLLBACK");
        res.status(500).json({ e: e.message });
      }
    }
  );

  // --- TASKS API ---
  app.get(
    "/api/tasks",
    authMiddleware,
    permissionMiddleware("tasks:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(`
                SELECT t.*, a.first_name || ' ' || a.last_name as assignee_name, c.first_name || ' ' || c.last_name as creator_name
                FROM tasks t
                LEFT JOIN profiles a ON t.assignee_id = a.id
                LEFT JOIN profiles c ON t.created_by = c.id
                WHERE t.user_id = :adminId
                ORDER BY t.created_at DESC
            `);
        stmt.bind({ ":adminId": adminId });
        const tasks = [];
        while (stmt.step()) tasks.push(stmt.getAsObject());
        stmt.free();
        res.json(tasks);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/tasks/:id",
    authMiddleware,
    permissionMiddleware("tasks:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const taskId = req.params.id;
        const stmt = db.prepare(`
                SELECT t.*, a.first_name || ' ' || a.last_name as assignee_name, c.first_name || ' ' || c.last_name as creator_name
                FROM tasks t
                LEFT JOIN profiles a ON t.assignee_id = a.id
                LEFT JOIN profiles c ON t.created_by = c.id
                WHERE t.id = :id AND t.user_id = :adminId
            `);
        stmt.bind({ ":id": taskId, ":adminId": adminId });
        const task = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        if (!task) {
          return res.status(404).json({ error: "Task not found" });
        }
        res.json(task);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/tasks",
    authMiddleware,
    permissionMiddleware("tasks:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const { title, description, assignee_id, due_date, priority, status } =
          req.body;
        const newTaskId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO tasks (id, user_id, title, description, assignee_id, due_date, priority, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newTaskId,
            adminId,
            title,
            description,
            assignee_id,
            due_date ? new Date(due_date).toISOString() : null,
            priority,
            status,
            creatorId,
            new Date().toISOString(),
          ]
        );
        logActivity(db, `created a new task: "${title}".`, {
          user_id: adminId,
          performer_id: creatorId,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "tasks" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newTaskId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/tasks/:id",
    authMiddleware,
    permissionMiddleware("tasks:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const taskId = req.params.id;
        const { title, description, assignee_id, due_date, priority, status } =
          req.body;
        db.exec("BEGIN");
        db.run(
          "UPDATE tasks SET title = ?, description = ?, assignee_id = ?, due_date = ?, priority = ?, status = ? WHERE id = ? AND user_id = ?",
          [
            title,
            description,
            assignee_id,
            due_date ? new Date(due_date).toISOString() : null,
            priority,
            status,
            taskId,
            adminId,
          ]
        );
        logActivity(db, `updated task: "${title}".`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "tasks" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "success" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/tasks/:id",
    authMiddleware,
    permissionMiddleware("tasks:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const taskId = req.params.id;
        db.exec("BEGIN");
        const stmt = db.prepare(
          "SELECT title FROM tasks WHERE id = :id AND user_id = :adminId"
        );
        stmt.bind({ ":id": taskId, ":adminId": adminId });
        const task = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [
          taskId,
          adminId,
        ]);
        logActivity(db, `deleted task: "${task.title}".`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "tasks" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "deleted" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/tasks/:id/comments",
    authMiddleware,
    permissionMiddleware("tasks:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const taskId = req.params.id;
        const stmt = db.prepare(`
                SELECT tc.*, p.first_name || ' ' || p.last_name as creator_name
                FROM task_comments tc
                JOIN profiles p ON tc.created_by = p.id
                WHERE tc.task_id = :taskId AND tc.user_id = :adminId
                ORDER BY tc.created_at ASC
            `);
        stmt.bind({ ":taskId": taskId, ":adminId": adminId });
        const comments = [];
        while (stmt.step()) comments.push(stmt.getAsObject());
        stmt.free();
        res.json(comments);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/tasks/:id/comments",
    authMiddleware,
    permissionMiddleware("tasks:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const taskId = req.params.id;
        const { content, parent_id } = req.body;
        const newCommentId = crypto.randomUUID();

        db.exec("BEGIN");
        db.run(
          "INSERT INTO task_comments (id, user_id, task_id, parent_id, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            newCommentId,
            adminId,
            taskId,
            parent_id || null,
            content,
            creatorId,
            new Date().toISOString(),
          ]
        );

        const taskStmt = db.prepare("SELECT title FROM tasks WHERE id = :id");
        taskStmt.bind({ ":id": taskId });
        const task = taskStmt.step() ? taskStmt.getAsObject() : null;
        taskStmt.free();

        const commenterStmt = db.prepare(
          "SELECT first_name, last_name FROM profiles WHERE id = :id"
        );
        commenterStmt.bind({ ":id": creatorId });
        const commenter = commenterStmt.step()
          ? commenterStmt.getAsObject()
          : null;
        commenterStmt.free();
        const commenterName = `${commenter.first_name} ${commenter.last_name}`;

        const mentionRegex = /@([\w\s]+)/g;
        const mentions = content.match(mentionRegex);
        if (mentions) {
          const mentionedNames = mentions.map((m) => m.substring(1).trim());
          const uniqueNames = [...new Set(mentionedNames)];

          for (const name of uniqueNames) {
            const userStmt = db.prepare(
              "SELECT id FROM profiles WHERE (first_name || ' ' || last_name) = :name AND admin_id = :adminId"
            );
            userStmt.bind({ ":name": name, ":adminId": adminId });
            const user = userStmt.step() ? userStmt.getAsObject() : null;
            userStmt.free();
            if (user) {
              const recipientId = user.id;
              if (recipientId !== creatorId) {
                const notificationId = crypto.randomUUID();
                const message = `${commenterName} mentioned you in a comment on task "${task.title}"`;
                const link = `/tasks/${taskId}`;
                db.run(
                  "INSERT INTO notifications (id, user_id, recipient_id, actor_id, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [
                    notificationId,
                    adminId,
                    recipientId,
                    creatorId,
                    message,
                    link,
                    new Date().toISOString(),
                  ]
                );
                io.to(recipientId).emit("new_notification", { recipientId });
              }
            }
          }
        }

        logActivity(db, `commented on task: "${task.title}".`, {
          user_id: adminId,
          performer_id: creatorId,
        });

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "task_comments", taskId: taskId });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newCommentId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/tasks/:taskId/comments/:commentId",
    authMiddleware,
    permissionMiddleware("tasks:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const userId = req.user.id;
        const { taskId, commentId } = req.params;
        const { content } = req.body;

        db.exec("BEGIN");

        const commentStmt = db.prepare(
          "SELECT created_by FROM task_comments WHERE id = :id AND task_id = :taskId AND user_id = :adminId"
        );
        commentStmt.bind({
          ":id": commentId,
          ":taskId": taskId,
          ":adminId": adminId,
        });
        const comment = commentStmt.step() ? commentStmt.getAsObject() : null;
        commentStmt.free();
        if (!comment) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Comment not found" });
        }

        if (comment.created_by !== userId) {
          db.exec("ROLLBACK");
          return res
            .status(403)
            .json({ error: "You are not authorized to edit this comment" });
        }

        db.run("UPDATE task_comments SET content = ? WHERE id = ?", [
          content,
          commentId,
        ]);

        const taskStmt = db.prepare("SELECT title FROM tasks WHERE id = :id");
        taskStmt.bind({ ":id": taskId });
        const task = taskStmt.step() ? taskStmt.getAsObject() : null;
        taskStmt.free();
        logActivity(db, `edited a comment on task: "${task.title}".`, {
          user_id: adminId,
          performer_id: userId,
        });

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "task_comments", taskId: taskId });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Comment updated successfully" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/tasks/:taskId/comments/:commentId",
    authMiddleware,
    permissionMiddleware("tasks:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const userId = req.user.id;
        const { taskId, commentId } = req.params;

        db.exec("BEGIN");

        const commentStmt = db.prepare(
          "SELECT created_by FROM task_comments WHERE id = :id AND task_id = :taskId AND user_id = :adminId"
        );
        commentStmt.bind({
          ":id": commentId,
          ":taskId": taskId,
          ":adminId": adminId,
        });
        const comment = commentStmt.step() ? commentStmt.getAsObject() : null;
        commentStmt.free();
        if (!comment) {
          db.exec("ROLLBACK");
          return res.status(404).json({ error: "Comment not found" });
        }

        if (comment.created_by !== userId) {
          db.exec("ROLLBACK");
          return res
            .status(403)
            .json({ error: "You are not authorized to delete this comment" });
        }

        db.run("DELETE FROM task_comments WHERE id = ? OR parent_id = ?", [
          commentId,
          commentId,
        ]);

        const taskStmt = db.prepare("SELECT title FROM tasks WHERE id = :id");
        taskStmt.bind({ ":id": taskId });
        const task = taskStmt.step() ? taskStmt.getAsObject() : null;
        taskStmt.free();
        logActivity(db, `deleted a comment on task: "${task.title}".`, {
          user_id: adminId,
          performer_id: userId,
        });

        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "task_comments", taskId: taskId });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Comment deleted successfully" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/tasks/:id/status",
    authMiddleware,
    permissionMiddleware("tasks:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const taskId = req.params.id;
        const { status } = req.body;
        const validStatuses = ["To Do", "In Progress", "Done", "Cancelled"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }

        db.exec("BEGIN");
        const stmt = db.prepare(
          "SELECT title FROM tasks WHERE id = :id AND user_id = :adminId"
        );
        stmt.bind({ ":id": taskId, ":adminId": adminId });
        const task = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        db.run("UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?", [
          status,
          taskId,
          adminId,
        ]);
        logActivity(
          db,
          `updated status of task "${task.title}" to ${status}.`,
          { user_id: adminId, performer_id: req.user.id }
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "tasks" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Status updated" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/tasks/:id/urgent-notification",
    authMiddleware,
    permissionMiddleware("tasks:send:urgent-notification"),
    (req, res) => {
      try {
        const senderProfile = fetchProfile(db, req.user.id);
        if (
          !senderProfile.permissions.includes("tasks:send:urgent-notification")
        ) {
          return res.status(403).json({
            error: "You do not have permission to send urgent notifications.",
          });
        }

        const adminId = getAdminId(db, req.user.id);
        const taskId = req.params.id;
        const { recipientIds } = req.body;

        if (
          !recipientIds ||
          !Array.isArray(recipientIds) ||
          recipientIds.length === 0
        ) {
          return res.status(400).json({ error: "Recipient IDs are required." });
        }

        const taskStmt = db.prepare(
          "SELECT title FROM tasks WHERE id = :id AND user_id = :adminId"
        );
        taskStmt.bind({ ":id": taskId, ":adminId": adminId });
        const task = taskStmt.step() ? taskStmt.getAsObject() : null;
        taskStmt.free();
        if (!task) {
          return res.status(404).json({ error: "Task not found." });
        }
        const taskTitle = task.title;
        const senderName = `${senderProfile.first_name} ${senderProfile.last_name}`;

        io.emit("urgent_notification", {
          taskId,
          taskTitle,
          senderName,
          recipientIds,
        });

        db.exec("BEGIN");
        logActivity(
          db,
          `sent an urgent notification for task "${taskTitle}" to ${recipientIds.length} user(s).`,
          { user_id: adminId, performer_id: req.user.id }
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "activities" });

        res.status(200).json({ message: "Urgent notification sent." });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- PROFILE API ---
  app.put("/api/profile", authMiddleware, (req, res) => {
    try {
      const { first_name, last_name } = req.body;
      const userId = req.user.id;
      db.exec("BEGIN");
      db.run("UPDATE profiles SET first_name = ?, last_name = ? WHERE id = ?", [
        first_name,
        last_name,
        userId,
      ]);
      logActivity(db, `updated their profile information.`, {
        user_id: getAdminId(db, userId),
        performer_id: userId,
      });
      db.exec("COMMIT");
      saveDatabase(db);
      io.emit("data_changed", { table: "profiles" });
      io.emit("data_changed", { table: "activities" });
      res.json({ message: "Profile updated successfully" });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/profile/password", authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const userStmt = db.prepare(
        "SELECT password FROM profiles WHERE id = :id"
      );
      userStmt.bind({ ":id": userId });
      const user = userStmt.step() ? userStmt.getAsObject() : null;
      userStmt.free();
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Incorrect current password" });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      db.exec("BEGIN");
      db.run(
        "UPDATE profiles SET password = ?, requires_password_change = 0 WHERE id = ?",
        [hashedNewPassword, userId]
      );
      logActivity(db, `updated their password.`, {
        user_id: getAdminId(db, userId),
        performer_id: userId,
      });
      db.exec("COMMIT");
      saveDatabase(db);
      io.emit("data_changed", { table: "activities" });
      res.json({ message: "Password updated successfully" });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  // --- NOTIFICATIONS API ---
  app.get("/api/notifications", authMiddleware, (req, res) => {
    try {
      const recipientId = req.user.id;
      const stmt = db.prepare(`
                SELECT n.*, p.first_name || ' ' || p.last_name as actor_name
                FROM notifications n
                JOIN profiles p ON n.actor_id = p.id
                WHERE n.recipient_id = :recipientId
                ORDER BY n.created_at DESC
                LIMIT 10
            `);
      stmt.bind({ ":recipientId": recipientId });
      const notifications = [];
      while (stmt.step()) notifications.push(stmt.getAsObject());
      stmt.free();
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/mark-read", authMiddleware, (req, res) => {
    try {
      const recipientId = req.user.id;
      db.exec("BEGIN");
      db.run(
        "UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0",
        [recipientId]
      );
      db.exec("COMMIT");
      saveDatabase(db);
      io.to(recipientId).emit("data_changed", {
        table: "notifications",
        recipientId,
      });
      res.json({ message: "Notifications marked as read" });
    } catch (err) {
      db.exec("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  // --- SETTINGS API ---
  app.get(
    "/api/settings",
    authMiddleware,
    permissionMiddleware("settings:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const settings = getSettings(db, adminId);
        res.json(settings);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/settings",
    authMiddleware,
    permissionMiddleware("settings:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const newSettings = req.body;
        const { force } = req.query;

        if (newSettings.isSystemSleeping && !force) {
          const onlineUsers = Array.from(activeUsers.values()).filter(
            (user) => !user.isAdmin && user.userId !== req.user.id
          );

          if (onlineUsers.length > 0) {
            return res.status(409).json({
              error: "There are active users online.",
              activeUsers: onlineUsers.map((u) => u.name),
            });
          }
        }

        const numericFields = [
          "nextInvoiceNumber",
          "nextQuotationNumber",
          "nextReturnNumber",
          "companyLogoSize",
          "defaultDueDateDays",
        ];
        for (const field of numericFields) {
          if (
            newSettings[field] !== undefined &&
            (typeof newSettings[field] !== "number" || newSettings[field] < 0)
          ) {
            return res.status(400).json({
              error: `Invalid value for ${field}. Must be a non-negative number.`,
            });
          }
        }

        db.exec("BEGIN");
        db.run(
          "INSERT OR REPLACE INTO app_settings (user_id,settings) VALUES (?, ?)",
          [adminId, JSON.stringify(newSettings)]
        );
        logActivity(db, `updated application settings.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "settings" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "Settings updated successfully" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- PAYMENT METHODS API ---
  app.get(
    "/api/payment-methods",
    authMiddleware,
    permissionMiddleware("settings:manage:payment-methods"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(
          "SELECT id, name FROM payment_methods WHERE user_id = :adminId AND is_active = 1 ORDER BY name"
        );
        stmt.bind({ ":adminId": adminId });
        const methods = [];
        while (stmt.step()) methods.push(stmt.getAsObject());
        stmt.free();
        res.json(methods);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/payment-methods",
    authMiddleware,
    permissionMiddleware("settings:manage:payment-methods"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const newId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO payment_methods (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
          [newId, adminId, name, new Date().toISOString()]
        );
        logActivity(db, `added a new payment method: '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "payment_methods" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/payment-methods/:id",
    authMiddleware,
    permissionMiddleware("settings:manage:payment-methods"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const methodId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE payment_methods SET name = ? WHERE id = ? AND user_id = ?",
          [name, methodId, adminId]
        );
        logActivity(db, `updated a payment method to '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "payment_methods" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "success" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/payment-methods/:id",
    authMiddleware,
    permissionMiddleware("settings:manage:payment-methods"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const methodId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE payment_methods SET is_active = 0 WHERE id = ? AND user_id = ?",
          [methodId, adminId]
        );
        logActivity(db, `deactivated a payment method.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "payment_methods" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "deleted" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- PRODUCT CATEGORIES API ---
  app.get("/api/product-categories", authMiddleware, (req, res) => {
    try {
      const adminId = getAdminId(db, req.user.id);
      const stmt = db.prepare(
        "SELECT id, name FROM product_categories WHERE user_id = :adminId AND is_active = 1 ORDER BY name"
      );
      stmt.bind({ ":adminId": adminId });
      const categories = [];
      while (stmt.step()) categories.push(stmt.getAsObject());
      stmt.free();
      res.json(categories);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(
    "/api/product-categories",
    authMiddleware,
    permissionMiddleware("inventory:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const newId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO product_categories (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
          [newId, adminId, name, new Date().toISOString()]
        );
        logActivity(db, `added a new product category: '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "product_categories" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/product-categories/:id",
    authMiddleware,
    permissionMiddleware("inventory:edit:details"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const categoryId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE product_categories SET name = ? WHERE id = ? AND user_id = ?",
          [name, categoryId, adminId]
        );
        logActivity(db, `updated a product category to '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "product_categories" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "success" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/product-categories/:id",
    authMiddleware,
    permissionMiddleware("inventory:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const categoryId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE product_categories SET is_active = 0 WHERE id = ? AND user_id = ?",
          [categoryId, adminId]
        );
        logActivity(db, `deactivated a product category.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "product_categories" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "deleted" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- PRODUCT UNITS API ---
  app.get("/api/product-units", authMiddleware, (req, res) => {
    try {
      const adminId = getAdminId(db, req.user.id);
      const stmt = db.prepare(
        "SELECT id, name FROM product_units WHERE user_id = :adminId AND is_active = 1 ORDER BY name"
      );
      stmt.bind({ ":adminId": adminId });
      const units = [];
      while (stmt.step()) units.push(stmt.getAsObject());
      stmt.free();
      res.json(units);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(
    "/api/product-units",
    authMiddleware,
    permissionMiddleware("inventory:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const newId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO product_units (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
          [newId, adminId, name, new Date().toISOString()]
        );
        logActivity(db, `added a new product unit: '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "product_units" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/product-units/:id",
    authMiddleware,
    permissionMiddleware("inventory:edit:details"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const unitId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE product_units SET name = ? WHERE id = ? AND user_id = ?",
          [name, unitId, adminId]
        );
        logActivity(db, `updated a product unit to '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "product_units" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "success" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/product-units/:id",
    authMiddleware,
    permissionMiddleware("inventory:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const unitId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE product_units SET is_active = 0 WHERE id = ? AND user_id = ?",
          [unitId, adminId]
        );
        logActivity(db, `deactivated a product unit.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "product_units" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "deleted" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- COURIERS API ---
  app.get(
    "/api/couriers",
    authMiddleware,
    permissionMiddleware("settings:manage:couriers"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(
          "SELECT * FROM couriers WHERE user_id = :adminId AND is_active = 1 ORDER BY name"
        );
        stmt.bind({ ":adminId": adminId });
        const couriers = [];
        while (stmt.step()) couriers.push(stmt.getAsObject());
        stmt.free();
        res.json(couriers);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/couriers",
    authMiddleware,
    permissionMiddleware("settings:manage:couriers"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name, first_kg_price, additional_kg_price } = req.body;
        const newId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO couriers (id, user_id, name, first_kg_price, additional_kg_price, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [
            newId,
            adminId,
            name,
            first_kg_price,
            additional_kg_price,
            new Date().toISOString(),
          ]
        );
        logActivity(db, `added a new courier: '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "couriers" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/couriers/:id",
    authMiddleware,
    permissionMiddleware("settings:manage:couriers"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name, first_kg_price, additional_kg_price } = req.body;
        const courierId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE couriers SET name = ?, first_kg_price = ?, additional_kg_price = ? WHERE id = ? AND user_id = ?",
          [name, first_kg_price, additional_kg_price, courierId, adminId]
        );
        logActivity(db, `updated courier '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "couriers" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "success" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/couriers/:id",
    authMiddleware,
    permissionMiddleware("settings:manage:couriers"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const courierId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE couriers SET is_active = 0 WHERE id = ? AND user_id = ?",
          [courierId, adminId]
        );
        logActivity(db, `deactivated a courier.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "couriers" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "deleted" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- EXPENSE CATEGORIES API ---
  app.get(
    "/api/expense-categories",
    authMiddleware,
    permissionMiddleware("settings:manage:expense-categories"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const stmt = db.prepare(
          "SELECT id, name FROM expense_categories WHERE user_id = :adminId AND is_active = 1 ORDER BY name"
        );
        stmt.bind({ ":adminId": adminId });
        const categories = [];
        while (stmt.step()) categories.push(stmt.getAsObject());
        stmt.free();
        res.json(categories);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/expense-categories",
    authMiddleware,
    permissionMiddleware("settings:manage:expense-categories"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const newId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO expense_categories (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
          [newId, adminId, name, new Date().toISOString()]
        );
        logActivity(db, `added a new expense category: '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "expense_categories" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/expense-categories/:id",
    authMiddleware,
    permissionMiddleware("settings:manage:expense-categories"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { name } = req.body;
        const categoryId = req.params.id;
        db.exec("BEGIN");
        db.run(
          "UPDATE expense_categories SET name = ? WHERE id = ? AND user_id = ?",
          [name, categoryId, adminId]
        );
        logActivity(db, `updated an expense category to '${name}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "expense_categories" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "success" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- EXPENSES API ---
  app.get(
    "/api/expenses",
    authMiddleware,
    permissionMiddleware("expenses:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const {
          searchTerm = "",
          page = 1,
          pageSize = 10,
          sortBy = "date",
          sortOrder = "DESC",
          category,
          startDate,
          endDate,
        } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        const allowedSortBy = [
          "date",
          "description",
          "amount",
          "category_name",
          "vendor",
          "creator_name",
        ];
        const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : "date";
        const safeSortOrder =
          sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

        let whereClause = `WHERE e.user_id = :adminId AND (e.description LIKE :searchTerm OR e.vendor LIKE :searchTerm)`;
        const params = {
          ":adminId": adminId,
          ":searchTerm": `%${searchTerm}%`,
        };
        if (category && category !== "all") {
          whereClause += ` AND e.category_id = :category`;
          params[":category"] = category;
        }
        if (startDate) {
          whereClause += ` AND e.date >= :startDate`;
          params[":startDate"] = new Date(startDate).toISOString();
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause += ` AND e.date <= :endDate`;
          params[":endDate"] = end.toISOString();
        }

        const totalCountStmt = db.prepare(
          `SELECT COUNT(*) as count FROM expenses e ${whereClause}`
        );
        totalCountStmt.bind(params);
        const totalCount = totalCountStmt.step()
          ? totalCountStmt.getAsObject().count
          : 0;
        totalCountStmt.free();

        const expensesStmt = db.prepare(`
                SELECT e.*, ec.name as category_name, p.first_name || ' ' || p.last_name as creator_name
                FROM expenses e
                LEFT JOIN expense_categories ec ON e.category_id = ec.id
                LEFT JOIN profiles p ON e.created_by = p.id
                ${whereClause}
                ORDER BY ${safeSortBy} ${safeSortOrder}
                LIMIT :pageSize OFFSET :offset
            `);
        expensesStmt.bind({
          ...params,
          ":pageSize": parseInt(pageSize),
          ":offset": offset,
        });
        const expenses = [];
        while (expensesStmt.step()) expenses.push(expensesStmt.getAsObject());
        expensesStmt.free();
        res.json({ expenses, count: totalCount });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/expenses",
    authMiddleware,
    permissionMiddleware("expenses:create"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const creatorId = req.user.id;
        const { date, description, amount, category_id, vendor } = req.body;
        const newId = crypto.randomUUID();
        db.exec("BEGIN");
        db.run(
          "INSERT INTO expenses (id, user_id, date, description, amount, category_id, vendor, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newId,
            adminId,
            new Date(date).toISOString(),
            description,
            amount,
            category_id,
            vendor,
            new Date().toISOString(),
            creatorId,
          ]
        );
        logActivity(db, `logged a new expense: '${description}'.`, {
          user_id: adminId,
          performer_id: creatorId,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "expenses" });
        io.emit("data_changed", { table: "activities" });
        res.status(201).json({ id: newId });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.put(
    "/api/expenses/:id",
    authMiddleware,
    permissionMiddleware("expenses:edit"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const expenseId = req.params.id;
        const { date, description, amount, category_id, vendor } = req.body;
        db.exec("BEGIN");
        db.run(
          "UPDATE expenses SET date = ?, description = ?, amount = ?, category_id = ?, vendor = ? WHERE id = ? AND user_id = ?",
          [
            new Date(date).toISOString(),
            description,
            amount,
            category_id,
            vendor,
            expenseId,
            adminId,
          ]
        );
        logActivity(db, `updated an expense: '${description}'.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "expenses" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "success" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete(
    "/api/expenses/:id",
    authMiddleware,
    permissionMiddleware("expenses:delete"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const expenseId = req.params.id;
        db.exec("BEGIN");
        db.run("DELETE FROM expenses WHERE id = ? AND user_id = ?", [
          expenseId,
          adminId,
        ]);
        logActivity(db, `deleted an expense.`, {
          user_id: adminId,
          performer_id: req.user.id,
        });
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "expenses" });
        io.emit("data_changed", { table: "activities" });
        res.json({ message: "deleted" });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.post(
    "/api/expenses/:id/receipt",
    authMiddleware,
    permissionMiddleware("expenses:edit"),
    upload.single("receipt"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const expenseId = req.params.id;
        if (!req.file) {
          return res.status(400).json({ error: "No receipt file uploaded." });
        }
        const receiptUrl = `/uploads/${req.file.filename}`;
        db.exec("BEGIN");
        db.run(
          "UPDATE expenses SET receipt_url = ? WHERE id = ? AND user_id = ?",
          [receiptUrl, expenseId, adminId]
        );
        db.exec("COMMIT");
        saveDatabase(db);
        io.emit("data_changed", { table: "expenses" });
        res.status(200).json({ receiptUrl });
      } catch (err) {
        db.exec("ROLLBACK");
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- BINGO ACCOUNTING REPORTS ---

  // Helper function to apply date filters
  const getDateFilter = (dateRange, field) => {
    let filter = "";
    const params = {};
    const fromDate = dateRange?.from || dateRange?.startDate;
    const toDate = dateRange?.to || dateRange?.endDate;

    if (fromDate) {
      filter += ` AND ${field} >= :startDate`;
      params[":startDate"] = new Date(fromDate).toISOString();
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter += ` AND ${field} <= :endDate`;
      params[":endDate"] = end.toISOString();
    }
    return { filter, params };
  };

  app.get(
    "/api/reports/profit-loss",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const dateRange = req.query;
        const { filter: salesFilter, params: salesParams } = getDateFilter(
          dateRange,
          "s.sale_date"
        );
        const { filter: purchaseFilter, params: purchaseParams } =
          getDateFilter(dateRange, "ip.purchase_date");

        // 1. Total Revenue and Number of Sales
        const revenueQuery = `
                SELECT 
                    COALESCE(SUM(total_amount), 0) as totalRevenue,
                    COUNT(id) as numSales
                FROM sales s
                WHERE s.user_id = :adminId ${salesFilter}
            `;
        const revenueStmt = db.prepare(revenueQuery);
        revenueStmt.bind({ ":adminId": adminId, ...salesParams });
        const { totalRevenue, numSales } = revenueStmt.step()
          ? revenueStmt.getAsObject()
          : { totalRevenue: 0, numSales: 0 };
        revenueStmt.free();

        // 2. Total COGS (Cost of Goods Sold)
        const cogsQuery = `
                SELECT 
                    SUM(si.quantity * (
                        SELECT COALESCE(AVG(ip.unit_cost), 0)
                        FROM inventory_purchases ip
                        WHERE ip.product_id = si.product_id AND ip.user_id = :adminId
                    )) as totalCogs
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                WHERE s.user_id = :adminId ${salesFilter}
            `;
        const cogsStmt = db.prepare(cogsQuery);
        cogsStmt.bind({ ":adminId": adminId, ...salesParams });
        const totalCogs = cogsStmt.step()
          ? cogsStmt.getAsObject().totalCogs || 0
          : 0;
        cogsStmt.free();

        // 3. Total Purchases (Operating Expense)
        const purchasesQuery = `
                SELECT 
                    COALESCE(SUM(ip.quantity_purchased * ip.unit_cost), 0) as totalPurchases
                FROM inventory_purchases ip
                WHERE ip.user_id = :adminId ${purchaseFilter}
            `;
        const purchasesStmt = db.prepare(purchasesQuery);
        purchasesStmt.bind({ ":adminId": adminId, ...purchaseParams });
        const totalPurchases = purchasesStmt.step()
          ? purchasesStmt.getAsObject().totalPurchases || 0
          : 0;
        purchasesStmt.free();

        res.json({
          totalRevenue: totalRevenue || 0,
          numSales: numSales || 0,
          totalCogs: totalCogs,
          totalPurchases: totalPurchases,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/reports/sales-performance",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const dateRange = req.query;
        const { filter: salesFilter, params: salesParams } = getDateFilter(
          dateRange,
          "s.sale_date"
        );

        // 1. Daily Sales for Chart
        const dailySalesQuery = `
                SELECT 
                    strftime('%Y-%m-%d', sale_date) as date, 
                    SUM(total_amount) as total
                FROM sales s
                WHERE s.user_id = :adminId ${salesFilter}
                GROUP BY date
                ORDER BY date ASC
            `;
        const dailySalesStmt = db.prepare(dailySalesQuery);
        dailySalesStmt.bind({ ":adminId": adminId, ...salesParams });
        const dailySales = [];
        while (dailySalesStmt.step()) {
          dailySales.push(dailySalesStmt.getAsObject());
        }
        dailySalesStmt.free();

        // 2. Top 5 Products by Revenue
        const topProductsQuery = `
                SELECT 
                    p.id as product_id,
                    p.name as product_name,
                    SUM(si.quantity * si.unit_price) as total_revenue
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                JOIN products p ON si.product_id = p.id
                WHERE s.user_id = :adminId ${salesFilter}
                GROUP BY p.id
                ORDER BY total_revenue DESC
                LIMIT 5
            `;
        const topProductsStmt = db.prepare(topProductsQuery);
        topProductsStmt.bind({ ":adminId": adminId, ...salesParams });
        const topProducts = [];
        while (topProductsStmt.step()) {
          topProducts.push(topProductsStmt.getAsObject());
        }
        topProductsStmt.free();

        // 3. Top 5 Customers by Spending
        const topCustomersQuery = `
                SELECT 
                    c.id as customer_id,
                    c.name as customer_name,
                    SUM(s.total_amount) as total_spent
                FROM sales s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.user_id = :adminId ${salesFilter}
                GROUP BY c.id
                ORDER BY total_spent DESC
                LIMIT 5
            `;
        const topCustomersStmt = db.prepare(topCustomersQuery);
        topCustomersStmt.bind({ ":adminId": adminId, ...salesParams });
        const topCustomers = [];
        while (topCustomersStmt.step()) {
          topCustomers.push(topCustomersStmt.getAsObject());
        }
        topCustomersStmt.free();

        res.json({
          dailySales: dailySales,
          topProducts: topProducts,
          topCustomers: topCustomers,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/reports/transaction-journal",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const dateRange = req.query;
        const { filter, params } = getDateFilter(dateRange, "t.date");

        const journalQuery = `
                SELECT 
                    t.id,
                    t.date,
                    t.description,
                    t.type,
                    t.amount,
                    c.name as customer_name
                FROM transactions t
                LEFT JOIN customers c ON t.customer_id = c.id
                WHERE t.user_id = :adminId ${filter}
                ORDER BY t.date DESC
            `;
        const journalStmt = db.prepare(journalQuery);
        journalStmt.bind({ ":adminId": adminId, ...params });

        const transactions = [];
        while (journalStmt.step()) {
          transactions.push(journalStmt.getAsObject());
        }
        journalStmt.free();

        res.json({ transactions });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/reports/inventory-valuation",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);

        // Calculate average cost and total value for all products currently in stock
        const valuationStmt = db.prepare(`
                SELECT 
                    p.id,
                    p.name,
                    p.sku,
                    p.price,
                    COALESCE(SUM(ip.quantity_remaining), 0) as quantity,
                    CASE 
                        WHEN COALESCE(SUM(ip.quantity_remaining), 0) > 0 THEN 
                            SUM(ip.quantity_remaining * ip.unit_cost) / SUM(ip.quantity_remaining)
                        ELSE 0
                    END as avg_cost,
                    SUM(ip.quantity_remaining * ip.unit_cost) as total_value
                FROM products p
                LEFT JOIN inventory_purchases ip ON p.id = ip.product_id AND ip.user_id = :adminId
                WHERE p.user_id = :adminId
                GROUP BY p.id
                HAVING quantity > 0
                ORDER BY p.name ASC
            `);
        valuationStmt.bind({ ":adminId": adminId });
        const products = [];
        while (valuationStmt.step()) products.push(valuationStmt.getAsObject());
        valuationStmt.free();

        res.json({
          products,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/reports/customer-receivables",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);

        // Find all customers with a negative balance (money owed to the business)
        const receivablesStmt = db.prepare(`
                SELECT id, name, phone, balance
                FROM customers
                WHERE user_id = :adminId AND balance < 0
                ORDER BY balance ASC
            `);
        receivablesStmt.bind({ ":adminId": adminId });
        const receivables = [];
        while (receivablesStmt.step())
          receivables.push(receivablesStmt.getAsObject());
        receivablesStmt.free();

        res.json({
          receivables,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/reports/purchases-summary",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { startDate, endDate } = req.query;

        let purchasesWhere = `ip.user_id = :adminId`;
        const params = { ":adminId": adminId };
        if (startDate) {
          purchasesWhere += ` AND ip.purchase_date >= :startDate`;
          params[":startDate"] = new Date(startDate).toISOString();
        }
        if (endDate) {
          purchasesWhere += ` AND ip.purchase_date <= :endDate`;
          params[":endDate"] = new Date(endDate).toISOString();
        }

        // 1. Total Purchases and Number of Purchases
        const totalPurchasesStmt = db.prepare(`
                SELECT 
                    COALESCE(SUM(ip.quantity_purchased * ip.unit_cost), 0) as totalPurchases,
                    COUNT(ip.id) as numPurchases
                FROM inventory_purchases ip
                WHERE ${purchasesWhere}
            `);
        totalPurchasesStmt.bind(params);
        const { totalPurchases, numPurchases } = totalPurchasesStmt.step()
          ? totalPurchasesStmt.getAsObject()
          : { totalPurchases: 0, numPurchases: 0 };
        totalPurchasesStmt.free();

        // 2. Daily Purchases for Chart
        const dailyPurchasesStmt = db.prepare(`
                SELECT 
                    strftime('%Y-%m-%d', purchase_date) as date, 
                    SUM(quantity_purchased * unit_cost) as total
                FROM inventory_purchases ip
                WHERE ${purchasesWhere}
                GROUP BY date
                ORDER BY date ASC
            `);
        dailyPurchasesStmt.bind(params);
        const dailyPurchases = [];
        while (dailyPurchasesStmt.step())
          dailyPurchases.push(dailyPurchasesStmt.getAsObject());
        dailyPurchasesStmt.free();

        // 3. Top Purchased Products
        const topProductsStmt = db.prepare(`
                SELECT 
                    p.id as product_id,
                    p.name as product_name,
                    p.sku as product_sku,
                    SUM(ip.quantity_purchased * ip.unit_cost) as total_cost,
                    SUM(ip.quantity_purchased) as total_quantity
                FROM inventory_purchases ip
                JOIN products p ON ip.product_id = p.id
                WHERE ${purchasesWhere}
                GROUP BY p.id
                ORDER BY total_cost DESC
                LIMIT 5
            `);
        topProductsStmt.bind(params);
        const topProducts = [];
        while (topProductsStmt.step())
          topProducts.push(topProductsStmt.getAsObject());
        topProductsStmt.free();

        res.json({
          totalPurchases: totalPurchases || 0,
          numPurchases: numPurchases || 0,
          dailyPurchases: dailyPurchases,
          topProducts: topProducts,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/reports/balance-sheet",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);

        // 1. Inventory Asset (Cost Basis)
        const inventoryStmt = db.prepare(`
                SELECT 
                    COALESCE(SUM(ip.quantity_remaining * ip.unit_cost), 0) as total_inventory_value
                FROM products p
                LEFT JOIN inventory_purchases ip ON p.id = ip.product_id AND ip.user_id = :adminId
                WHERE p.user_id = :adminId
            `);
        inventoryStmt.bind({ ":adminId": adminId });
        const totalInventoryValue =
          (inventoryStmt.step()
            ? inventoryStmt.getAsObject().total_inventory_value
            : 0) || 0;
        inventoryStmt.free();

        // 2. Accounts Receivable (Asset: money owed to us, negative balance)
        const receivablesStmt = db.prepare(`
                SELECT COALESCE(SUM(ABS(balance)), 0) as total_receivables
                FROM customers
                WHERE user_id = :adminId AND balance < 0
            `);
        receivablesStmt.bind({ ":adminId": adminId });
        const totalReceivables =
          (receivablesStmt.step()
            ? receivablesStmt.getAsObject().total_receivables
            : 0) || 0;
        receivablesStmt.free();

        // 3. Customer Credit (Liability: money we owe them, positive balance)
        const creditStmt = db.prepare(`
                SELECT COALESCE(SUM(balance), 0) as total_credit
                FROM customers
                WHERE user_id = :adminId AND balance > 0
            `);
        creditStmt.bind({ ":adminId": adminId });
        const totalCredit =
          (creditStmt.step() ? creditStmt.getAsObject().total_credit : 0) || 0;
        creditStmt.free();

        // 4. Owner's Equity (Simplified: Net Assets)
        const totalAssets = totalInventoryValue + totalReceivables;
        const ownersEquity = totalAssets - totalCredit;

        res.json({
          totalInventoryValue,
          totalReceivables,
          totalCredit,
          ownersEquity,
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.get(
    "/api/reports/account-ledger",
    authMiddleware,
    permissionMiddleware("accounting:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);
        const { account, startDate, endDate } = req.query;

        if (!account) {
          return res.status(400).json({ error: "Account name is required." });
        }

        let whereClause = `WHERE t.user_id = :adminId AND t.payment_method = :account`;
        const params = { ":adminId": adminId, ":account": account };

        if (startDate) {
          whereClause += ` AND t.date >= :startDate`;
          params[":startDate"] = new Date(startDate).toISOString();
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause += ` AND t.date <= :endDate`;
          params[":endDate"] = end.toISOString();
        }

        const query = `
                SELECT 
                    t.id,
                    t.date,
                    t.description,
                    t.type,
                    t.amount,
                    c.name as customer_name
                FROM transactions t
                LEFT JOIN customers c ON t.customer_id = c.id
                ${whereClause}
                ORDER BY t.date DESC
            `;

        const stmt = db.prepare(query);
        stmt.bind(params);

        const transactions = [];
        while (stmt.step()) {
          transactions.push(stmt.getAsObject());
        }
        stmt.free();

        res.json(transactions);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  // --- OTHER APIS ---
  app.get(
    "/api/dashboard-summary",
    authMiddleware,
    permissionMiddleware("dashboard:view"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);

        const totalReceivablesStmt = db.prepare(
          "SELECT SUM(balance) as totalReceivables FROM customers WHERE balance < 0 AND user_id = :adminId"
        );
        totalReceivablesStmt.bind({ ":adminId": adminId });
        const totalReceivables =
          (totalReceivablesStmt.step()
            ? totalReceivablesStmt.getAsObject().totalReceivables
            : 0) || 0;
        totalReceivablesStmt.free();

        const customerStatusStmt = db.prepare(
          "SELECT status, COUNT(*) as count FROM customers WHERE user_id = :adminId GROUP BY status"
        );
        customerStatusStmt.bind({ ":adminId": adminId });
        const customerStatus = [];
        while (customerStatusStmt.step())
          customerStatus.push(customerStatusStmt.getAsObject());
        customerStatusStmt.free();

        const totalCustomersStmt = db.prepare(
          "SELECT COUNT(*) as totalCustomers FROM customers WHERE user_id = :adminId"
        );
        totalCustomersStmt.bind({ ":adminId": adminId });
        const totalCustomers = totalCustomersStmt.step()
          ? totalCustomersStmt.getAsObject().totalCustomers
          : 0;
        totalCustomersStmt.free();

        const salesByDayStmt = db.prepare(
          "SELECT strftime('%Y-%m-%d', sale_date) as date, SUM(total_amount) as total FROM sales WHERE user_id = :adminId AND sale_date >= date('now', '-30 days') GROUP BY date ORDER BY date ASC"
        );
        salesByDayStmt.bind({ ":adminId": adminId });
        const salesByDay = [];
        while (salesByDayStmt.step())
          salesByDay.push(salesByDayStmt.getAsObject());
        salesByDayStmt.free();

        const recentSalesStmt = db.prepare(
          "SELECT s.sale_date, s.total_amount, c.name as customer_name FROM sales s JOIN customers c ON s.customer_id = c.id WHERE s.user_id = :adminId ORDER BY s.sale_date DESC LIMIT 5"
        );
        recentSalesStmt.bind({ ":adminId": adminId });
        const recentSales = [];
        while (recentSalesStmt.step())
          recentSales.push(recentSalesStmt.getAsObject());
        recentSalesStmt.free();

        res.json({
          totalReceivables: Math.abs(totalReceivables),
          customerStatus,
          totalCustomers,
          salesByDay,
          recentSales,
        });
      } catch (e) {
        res.status(500).json({ e: e.message });
      }
    }
  );

  app.delete(
    "/api/clear-data",
    authMiddleware,
    permissionMiddleware("settings:manage:clear"),
    (req, res) => {
      try {
        const adminId = getAdminId(db, req.user.id);

        db.exec("BEGIN");

        // Grandchild tables first
        db.run(
          `DELETE FROM damaged_stock_log WHERE purchase_receipt_id IN (SELECT id FROM purchase_receipts WHERE purchase_id IN (SELECT id FROM inventory_purchases WHERE user_id = ?))`,
          [adminId]
        );

        // Child tables that link to parent transactional tables
        const childTableLinks = [
          { table: "sale_items", parent: "sales", parentKey: "sale_id" },
          {
            table: "purchase_receipts",
            parent: "inventory_purchases",
            parentKey: "purchase_id",
          },
          { table: "return_items", parent: "returns", parentKey: "return_id" },
          {
            table: "return_expenses",
            parent: "returns",
            parentKey: "return_id",
          },
          { table: "repair_items", parent: "repairs", parentKey: "repair_id" },
          { table: "repair_images", parent: "repairs", parentKey: "repair_id" },
          {
            table: "messages",
            parent: "conversations",
            parentKey: "conversation_id",
          },
          {
            table: "conversation_participants",
            parent: "conversations",
            parentKey: "conversation_id",
          },
          { table: "task_comments", parent: "tasks", parentKey: "task_id" },
        ];

        for (const { table, parent, parentKey } of childTableLinks) {
          db.run(
            `DELETE FROM ${table} WHERE ${parentKey} IN (SELECT id FROM ${parent} WHERE user_id = ?)`,
            [adminId]
          );
        }

        // Parent transactional tables
        const transactionalTables = [
          "transactions",
          "activities",
          "sales",
          "returns",
          "repairs",
          "invoices",
          "quotations",
          "inventory_purchases",
          "damaged_stock_log", // Clear any remaining logs not tied to a receipt
          "tasks",
          "conversations",
          "notifications",
          "products",
        ];

        transactionalTables.forEach((t) =>
          db.run(`DELETE FROM ${t} WHERE user_id = ?`, [adminId])
        );

        // Clear customers, preserving special ones
        db.run(
          `DELETE FROM customers WHERE user_id = ? AND name NOT IN ('Walk-in Customer', 'Internal')`,
          [adminId]
        );

        logActivity(
          db,
          "cleared all transactional data from the application.",
          { user_id: adminId, performer_id: req.user.id }
        );
        db.exec("COMMIT");
        saveDatabase(db);

        // Notify clients about all cleared tables
        const clearedTables = [
          ...childTableLinks.map((c) => c.table),
          ...transactionalTables,
          "customers",
        ];
        clearedTables.forEach((t) => io.emit("data_changed", { table: t }));

        res.json({ m: "All application data has been cleared." });
      } catch (e) {
        db.exec("ROLLBACK");
        console.error("Error clearing data:", e);
        res.status(500).json({ error: e.message });
      }
    }
  );

  // --- EXPORT API ---
  app.get("/api/export/:type", authMiddleware, async (req, res) => {
    try {
      const adminId = getAdminId(db, req.user.id);
      const { type } = req.params;
      let data = [];
      let columns = [];

      if (type === "customers") {
        const stmt = db.prepare(
          "SELECT name, customer_number, email, phone, address, status, balance, created_at FROM customers WHERE user_id = :adminId"
        );
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = [
          "name",
          "customer_number",
          "email",
          "phone",
          "address",
          "status",
          "balance",
          "created_at",
        ];
      } else if (type === "inventory") {
        const stmt = db.prepare(
          "SELECT name, sku, price, category, created_at FROM products WHERE user_id = :adminId"
        );
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) {
          const p = stmt.getAsObject();
          // Get current stock
          const stockStmt = db.prepare(
            "SELECT COALESCE(SUM(quantity_remaining), 0) as stock FROM inventory_purchases WHERE product_id = :productId"
          );
          stockStmt.bind({
            ":productId": db.exec(
              `SELECT id FROM products WHERE sku = '${p.sku}'`
            )[0].values[0][0],
          }); // Simplified for brevity, ideally use ID
          p.stock = stockStmt.step() ? stockStmt.getAsObject().stock : 0;
          stockStmt.free();
          data.push(p);
        }
        stmt.free();
        columns = ["name", "sku", "price", "stock", "category", "created_at"];
      } else if (type === "purchases") {
        const stmt = db.prepare(`
                    SELECT p.name as product_name, ip.purchase_date, ip.quantity_purchased, ip.unit_cost, ip.supplier, ip.status
                    FROM inventory_purchases ip
                    JOIN products p ON ip.product_id = p.id
                    WHERE ip.user_id = :adminId
                `);
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = [
          "product_name",
          "purchase_date",
          "quantity_purchased",
          "unit_cost",
          "supplier",
          "status",
        ];
      } else if (type === "expenses") {
        const stmt = db.prepare(`
                    SELECT e.date, e.description, e.amount, ec.name as category_name, e.vendor
                    FROM expenses e
                    LEFT JOIN expense_categories ec ON e.category_id = ec.id
                    WHERE e.user_id = :adminId
                `);
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = ["date", "description", "amount", "category_name", "vendor"];
      } else if (type === "invoices" || type === "receipts") {
        let statusClause =
          type === "invoices"
            ? "status IN ('Draft', 'Sent', 'Overdue')"
            : "status IN ('Paid', 'Partially Paid')";
        const stmt = db.prepare(`
                    SELECT invoice_number, customer_name, issue_date, due_date, total, status
                    FROM invoices
                    WHERE user_id = :adminId AND ${statusClause}
                `);
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = [
          "invoice_number",
          "customer_name",
          "issue_date",
          "due_date",
          "total",
          "status",
        ];
      } else if (type === "quotations") {
        const stmt = db.prepare(`
                    SELECT quotation_number, customer_name, issue_date, expiry_date, total, status
                    FROM quotations
                    WHERE user_id = :adminId
                `);
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = [
          "quotation_number",
          "customer_name",
          "issue_date",
          "expiry_date",
          "total",
          "status",
        ];
      } else if (type === "repairs") {
        const stmt = db.prepare(`
                    SELECT r.repair_number, c.name as customer_name, r.product_name, r.received_date, r.status, r.repair_fee
                    FROM repairs r
                    LEFT JOIN customers c ON r.customer_id = c.id
                    WHERE r.user_id = :adminId
                `);
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = [
          "repair_number",
          "customer_name",
          "product_name",
          "received_date",
          "status",
          "repair_fee",
        ];
      } else if (type === "returns") {
        const stmt = db.prepare(`
                    SELECT r.return_receipt_number, c.name as customer_name, r.return_date, r.total_refund_amount
                    FROM returns r
                    JOIN customers c ON r.customer_id = c.id
                    WHERE r.user_id = :adminId
                `);
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = [
          "return_receipt_number",
          "customer_name",
          "return_date",
          "total_refund_amount",
        ];
      } else if (type === "damages") {
        const stmt = db.prepare(`
                    SELECT p.name as product_name, d.quantity, d.notes, d.status, d.logged_at
                    FROM damaged_stock_log d
                    JOIN products p ON d.product_id = p.id
                    WHERE d.user_id = :adminId
                `);
        stmt.bind({ ":adminId": adminId });
        while (stmt.step()) data.push(stmt.getAsObject());
        stmt.free();
        columns = ["product_name", "quantity", "notes", "status", "logged_at"];
      } else {
        return res.status(400).json({ error: "Invalid export type" });
      }

      const csv = Papa.unparse({
        fields: columns,
        data: data,
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}_export_${
          new Date().toISOString().split("T")[0]
        }.csv"`
      );
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    const token =
      socket.handshake.auth.token || socket.handshake.headers["authorization"];
    if (token) {
      try {
        const decoded = jwt.verify(token.replace("Bearer ", ""), JWT_SECRET);
        socket.join(decoded.id);
        const profile = fetchProfile(db, decoded.id);
        if (profile) {
          const isAdmin = profile.permissions.includes(
            "settings:manage:system-status"
          );
          activeUsers.set(socket.id, {
            userId: decoded.id,
            name: `${profile.first_name} ${profile.last_name}`,
            isAdmin: isAdmin,
          });
          console.log(
            `User ${decoded.id} (${profile.first_name}) joined their room. Active users: ${activeUsers.size}`
          );
        }
      } catch (err) {
        console.log("Socket connection from unauthenticated user.");
      }
    }

    socket.on("start_typing", (data) => {
      const profile = fetchProfile(db, data.userId);
      socket.to(data.recipientId).emit("typing_status", {
        ...data,
        isTyping: true,
        userName: `${profile.first_name} ${profile.last_name}`,
      });
    });

    socket.on("stop_typing", (data) => {
      socket
        .to(data.recipientId)
        .emit("typing_status", { ...data, isTyping: false });
    });

    socket.on("disconnect", () => {
      activeUsers.delete(socket.id);
      console.log(
        "User disconnected:",
        socket.id,
        `. Active users: ${activeUsers.size}`
      );
    });
  });

  setInterval(() => {
    try {
      const allSettingsRes = db.exec(
        "SELECT user_id, settings FROM app_settings"
      );
      if (allSettingsRes.length === 0) return;

      const allSettings = formatSqlJsResult(allSettingsRes);

      for (const userSettings of allSettings) {
        const adminId = userSettings.user_id;
        const settings = {
          ...defaultSettings,
          ...JSON.parse(userSettings.settings),
        };

        if (settings.isSystemSleeping && settings.autoWakeUpTime) {
          const [wakeUpHour, wakeUpMinute] = settings.autoWakeUpTime
            .split(":")
            .map(Number);
          const now = new Date();
          const currentHour = now.getUTCHours();
          const currentMinute = now.getUTCMinutes();

          // Convert wake up time to UTC for comparison
          // This is a simplified approach and assumes server and user times are in the same timezone context for now.
          // A more robust solution would involve storing timezone info.
          const wakeUpTimeInMinutes = wakeUpHour * 60 + wakeUpMinute;
          const currentTimeInMinutes = currentHour * 60 + currentMinute;

          console.log(
            `[Auto-Wake Check for ${adminId}] Current Time (UTC): ${currentHour}:${currentMinute}. Wake Time: ${settings.autoWakeUpTime}. System Sleeping: ${settings.isSystemSleeping}`
          );

          if (currentTimeInMinutes >= wakeUpTimeInMinutes) {
            db.exec("BEGIN");
            const updatedSettings = { ...settings, isSystemSleeping: false };
            db.run("UPDATE app_settings SET settings = ? WHERE user_id = ?", [
              JSON.stringify(updatedSettings),
              adminId,
            ]);
            logActivity(
              db,
              "System automatically woke up based on the scheduled time.",
              { user_id: adminId, performer_id: adminId }
            );
            db.exec("COMMIT");
            saveDatabase(db);
            io.emit("data_changed", { table: "settings" });
            io.emit("data_changed", { table: "activities" });
            console.log(
              `System for user ${adminId} has been automatically woken up.`
            );
          }
        }
      }
    } catch (err) {
      console.error("Error in auto-wakeup scheduler:", err);
    }
  }, 60000); // Run every minute

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
