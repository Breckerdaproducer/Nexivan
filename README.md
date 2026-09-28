# Nexivan Logistics - Node.js & PostgreSQL Backend

Robust, high-performance Node.js & PostgreSQL backend service and Admin Management Portal for Nexivan Logistics.

## 🚀 Key Features

1. **Live Consignment Tracking (`/api/track/:number`)**:
   - Real-time tracking of consignments with progress calculation (15% to 100%).
   - Multi-checkpoint timeline with timestamps, locations, and status events.
   - Shipper, consignee, package type, weight, and ETA data.
   - Seamlessly integrated with `track-shipment.html`.

2. **Site-Wide Header Search (`/api/search?q=...`)**:
   - Multi-model search engine covering:
     - Active consignments & shipments (with direct tracking links).
     - Freight services (Air, Ocean, Truck, Train, Van, Drone, Wagon Freight).
     - Informational pages and blog insights.
   - Live suggestions dropdown connected to the header search input.

3. **Contact Form Inquiries (`/api/contact`)**:
   - Validates and stores incoming website inquiries into PostgreSQL.
   - Supports both JSON and WPForms payload formats from `contacts.html`.
   - Sends real-time admin alert emails and customer auto-reply confirmations.
   - Displays sleek inline alert banners (success or validation errors).

4. **Email Handling (Nodemailer)**:
   - Configurable SMTP via `.env` (Gmail, Outlook, Amazon SES, SendGrid, etc.).
   - Built-in safe mock logger if SMTP credentials are omitted, ensuring the API remains 100% operational during development.
   - Branded HTML templates for admin notifications, customer acknowledgments, and shipment status alerts.

5. **Nexivan Admin Portal (`http://localhost:5000/admin`)**:
   - **Authentication**: JWT token and secure HTTP-only cookies (`admin` / `AdminPassword123!`).
   - **Dashboard**: Live operational stats (Total Shipments, In Transit, Delivered, Inquiries, Unread count).
   - **Shipments Manager**: Register new shipments with auto-generated tracking numbers (`NX-XXXXXX`), edit routes, delete shipments, and print waybills.
   - **Milestone & Checkpoint Manager**: Add checkpoints to any shipment (updates current location and status automatically, with optional email alerts to customers).
   - **Contact Messages**: Read, mark as read/replied, reply via pre-filled email, and delete inquiries.

---

## 🛠️ Tech Stack & Directory

- **Location**: `C:\Users\Brecker-da-Producer\Desktop\Node js\nexivan-backend`
- **Runtime**: Node.js (v24.16.0+)
- **Database**: PostgreSQL 18 (Database: `nexivan_logistics`)
- **Web Framework**: Express.js
- **Auth**: JSON Web Tokens (JWT) + bcryptjs
- **Mailing**: Nodemailer
- **Frontend Admin**: Tailwind CSS, FontAwesome 6, Vanilla JS SPA

---

## ⚙️ Environment Variables (`.env`)

```env
PORT=5000
NODE_ENV=development

# Database Configuration (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nexivan_logistics
DB_USER=postgres
DB_PASSWORD=Maah2000

# Authentication
JWT_SECRET=nexivan_logistics_secret_key_9824_production_grade
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=AdminPassword123!
ADMIN_EMAIL=info@nexivanlogistics.com

# Email / SMTP Settings (Optional - runs in safe logging mode if empty)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Nexivan Logistics Support" <info@nexivanlogistics.com>
ADMIN_NOTIFY_EMAIL=info@nexivanlogistics.com

# CORS
CORS_ORIGIN=*
```

---

## 🏃 Quick Start

To run the backend server:

```bash
cd "C:\Users\Brecker-da-Producer\Desktop\Node js\nexivan-backend"
npm start
# or for live auto-reload:
npm run dev
```

The server will automatically:
- Connect to PostgreSQL `nexivan_logistics`.
- Run migrations for `admins`, `shipments`, `shipment_checkpoints`, and `contact_messages`.
- Seed the default administrator (`admin` / `AdminPassword123!`).
- Seed demo shipments (`TRK-89201` and `12345`).
- Start listening on `http://localhost:5000`.

---

## 📡 API Endpoints

### Public Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/track/:number` | Query shipment details and checkpoints |
| `POST` | `/api/contact` | Submit contact inquiry & trigger email dispatch |
| `GET` | `/api/search?q=query` | Site-wide search across services & consignments |
| `GET` | `/api/health` | Service health status |

### Admin Endpoints (Require Bearer Token or Cookie)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin login |
| `POST` | `/api/auth/logout` | Admin logout |
| `GET` | `/api/auth/me` | Current admin profile |
| `GET` | `/api/admin/stats` | Operational dashboard metrics |
| `GET` | `/api/admin/shipments` | List all shipments with search & pagination |
| `POST` | `/api/admin/shipments` | Register a new consignment |
| `GET` | `/api/admin/shipments/:id` | Get single shipment with milestone history |
| `PUT` | `/api/admin/shipments/:id` | Update shipment information or status |
| `DELETE` | `/api/admin/shipments/:id` | Delete a shipment |
| `POST` | `/api/admin/shipments/:id/checkpoints` | Add transit checkpoint / milestone |
| `DELETE` | `/api/admin/shipments/:id/checkpoints/:cpId` | Delete a milestone |
| `GET` | `/api/admin/messages` | List website contact messages |
| `PUT` | `/api/admin/messages/:id/status` | Mark message as read/replied |
| `DELETE` | `/api/admin/messages/:id` | Delete an inquiry |

---

## 🌐 Unified Fullstack & Page Routing

The frontend website is fully integrated and hosted directly by this backend Express server under `src/public/`:

### Page Routes & Clean URL Mapping
| Route | Legacy / Direct URL | Description |
|---|---|---|
| `/` or `/home` | `/index.html` | Nexivan Logistics Home & Interactive Freight Hero |
| `/track-shipment` or `/track` | `/track-shipment.html` | Live Consignment Telemetry & Milestone Tracking |
| `/contacts` or `/contact` | `/contacts.html` | Contact Form & Support Dispatcher |
| `/services` or `/service` | `/services.html` | Freight & Logistics Solutions Overview |
| `/about-us` or `/about` | `/about-us.html` | Company History & Mission |
| `/service/:slug` | `/service/:slug.html` | Dedicated Freight Mode (Air, Ocean, Truck, Train, Van, Drone, Wagon) |
| `/category/:slug` | `/category/:slug.html` | Insight & Article Categories |
| `/:blogSlug` | `/:blogSlug.html` | Logistics Knowledgebase & Strategic Articles |
| `/admin` or `/admin/*` | `/admin/index.html` | Secure Admin Command & Management Portal |

### Frontend Integration Scripts
- **Dynamic API Client**: `/assets/js/nexivan-api.js` (automatically connects to same-origin `/api` with zero CORS hurdles).
- **Theme & Component Styles**: `/assets/css/sky-sea-theme.css` (Sea & Sky Blue branded timeline, search popup, form alerts).
- **Search Engine**: Site-wide header search integrated with instant live suggestions across consignments and freight options.
