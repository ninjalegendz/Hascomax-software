import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/CodeBlock";

const ApiDocs = () => {
  const baseUrl = `${window.location.protocol}//${window.location.host}`;

  const authExample = `curl "${baseUrl}/api/v1/customers" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const customersListResponse = `{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "customer_number": "CUS-0001",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "secondary_phone": null,
      "address": "123 Main St",
      "status": "Active",
      "balance": -50.0,
      "created_at": "2023-10-27T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 1,
    "total_pages": 1
  }
}`;

  const customerCreateExample = `curl -X POST "${baseUrl}/api/v1/customers" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "0987654321",
    "address": "456 Oak Ave",
    "status": "Active"
  }'`;

  const productsListResponse = `{
  "data": [
    {
      "id": "p1a2b3c4-...",
      "name": "Super Widget",
      "sku": "SW-001",
      "barcode": "123456789012",
      "description": "A very super widget.",
      "price": 99.99,
      "category": "Widgets",
      "created_at": "2023-10-27T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 1,
    "total_pages": 1
  }
}`;

  const productCreateExample = `curl -X POST "${baseUrl}/api/v1/products" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Mega Gadget",
    "sku": "MG-002",
    "price": 149.50,
    "description": "A gadget of mega proportions."
  }'`;

  const invoicesListResponse = `{
  "data": [
    {
      "id": "inv_123...",
      "invoice_number": "INV-0001",
      "customer_name": "John Doe",
      "issue_date": "2023-10-27T12:00:00.000Z",
      "due_date": "2023-11-26T12:00:00.000Z",
      "total": 199.98,
      "status": "Sent",
      "line_items": [
        {
          "product_id": "p1a2b3c4-...",
          "description": "Super Widget",
          "quantity": 2,
          "unitPrice": 99.99
        }
      ]
    }
  ],
  "pagination": { ... }
}`;

  const invoiceCreateExample = `curl -X POST "${baseUrl}/api/v1/invoices" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_id": "a1b2c3d4-...",
    "line_items": [
      { "product_id": "p1a2b3c4-...", "quantity": 2 },
      { "product_id": "p5e6f7g8-...", "quantity": 1 }
    ]
  }'`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>
            Use our API to integrate your business data with other applications.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            Authenticate your API requests by providing your secret API key in the Authorization header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-2">All API requests must include an `Authorization` header with your API key:</p>
          <CodeBlock language="bash" code={`Authorization: Bearer YOUR_API_KEY`} />
          <p className="mt-4 mb-2">Here's an example using cURL:</p>
          <CodeBlock language="bash" code={authExample} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="customers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>
            <TabsContent value="customers" className="mt-4 space-y-6">
              <div>
                <h3 className="text-lg font-semibold">List Customers</h3>
                <div className="mb-4 flex items-center gap-2">
                  <Badge>GET</Badge>
                  <code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/customers</code>
                </div>
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><code className="font-mono bg-muted p-1 rounded-md">page</code> (optional): Page number. Defaults to <code className="font-mono bg-muted p-1 rounded-md">1</code>.</li>
                  <li><code className="font-mono bg-muted p-1 rounded-md">limit</code> (optional): Items per page. Defaults to <code className="font-mono bg-muted p-1 rounded-md">20</code>.</li>
                </ul>
                <h4 className="font-semibold mt-4 mb-2">Example Response</h4>
                <CodeBlock language="json" code={customersListResponse} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Create Customer</h3>
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="secondary">POST</Badge>
                  <code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/customers</code>
                </div>
                <h4 className="font-semibold mb-2">Request Body</h4>
                <p className="text-sm text-muted-foreground">JSON object with customer details. `name`, `phone`, and `address` are required.</p>
                <h4 className="font-semibold mt-4 mb-2">Example Request</h4>
                <CodeBlock language="bash" code={customerCreateExample} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Retrieve, Update, and Delete a Customer</h3>
                <div className="mb-2 flex items-center gap-2"><Badge>GET</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/customers/:id</code></div>
                <div className="mb-2 flex items-center gap-2"><Badge variant="outline">PUT</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/customers/:id</code></div>
                <div className="mb-4 flex items-center gap-2"><Badge variant="destructive">DELETE</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/customers/:id</code></div>
                <p className="text-sm text-muted-foreground">Use the customer's unique ID to interact with a specific record.</p>
              </div>
            </TabsContent>
            <TabsContent value="products" className="mt-4 space-y-6">
              <div>
                <h3 className="text-lg font-semibold">List Products</h3>
                <div className="mb-4 flex items-center gap-2">
                  <Badge>GET</Badge>
                  <code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/products</code>
                </div>
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><code className="font-mono bg-muted p-1 rounded-md">page</code> (optional): Page number. Defaults to <code className="font-mono bg-muted p-1 rounded-md">1</code>.</li>
                  <li><code className="font-mono bg-muted p-1 rounded-md">limit</code> (optional): Items per page. Defaults to <code className="font-mono bg-muted p-1 rounded-md">20</code>.</li>
                </ul>
                <h4 className="font-semibold mt-4 mb-2">Example Response</h4>
                <CodeBlock language="json" code={productsListResponse} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Create Product</h3>
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="secondary">POST</Badge>
                  <code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/products</code>
                </div>
                <h4 className="font-semibold mb-2">Request Body</h4>
                <p className="text-sm text-muted-foreground">JSON object with product details. `name`, `sku`, and `price` are required.</p>
                <h4 className="font-semibold mt-4 mb-2">Example Request</h4>
                <CodeBlock language="bash" code={productCreateExample} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Retrieve, Update, and Delete a Product</h3>
                <div className="mb-2 flex items-center gap-2"><Badge>GET</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/products/:id</code></div>
                <div className="mb-2 flex items-center gap-2"><Badge variant="outline">PUT</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/products/:id</code></div>
                <div className="mb-4 flex items-center gap-2"><Badge variant="destructive">DELETE</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/products/:id</code></div>
                <p className="text-sm text-muted-foreground">Use the product's unique ID to interact with a specific record.</p>
              </div>
            </TabsContent>
            <TabsContent value="invoices" className="mt-4 space-y-6">
              <div>
                <h3 className="text-lg font-semibold">List Invoices</h3>
                <div className="mb-4 flex items-center gap-2">
                  <Badge>GET</Badge>
                  <code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/invoices</code>
                </div>
                <h4 className="font-semibold mt-4 mb-2">Example Response</h4>
                <CodeBlock language="json" code={invoicesListResponse} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Create Invoice</h3>
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="secondary">POST</Badge>
                  <code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/invoices</code>
                </div>
                <h4 className="font-semibold mb-2">Request Body</h4>
                <p className="text-sm text-muted-foreground">JSON object with `customer_id` and an array of `line_items`. Each line item needs a `product_id` and `quantity`.</p>
                <h4 className="font-semibold mt-4 mb-2">Example Request</h4>
                <CodeBlock language="bash" code={invoiceCreateExample} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Retrieve and Delete an Invoice</h3>
                <div className="mb-2 flex items-center gap-2"><Badge>GET</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/invoices/:id</code></div>
                <div className="mb-4 flex items-center gap-2"><Badge variant="destructive">DELETE</Badge><code className="font-mono text-sm bg-muted p-1 rounded-md">/api/v1/invoices/:id</code></div>
                <p className="text-sm text-muted-foreground">Use the invoice's unique ID to interact with a specific record. Note: Updating invoices via the API is not yet supported.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiDocs;