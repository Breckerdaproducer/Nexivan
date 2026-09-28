const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'nexivan_logistics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Maah2000',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB Error] Unexpected error on idle client:', err.message);
});

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('[DB] Connecting to PostgreSQL database...');

    // 1. Admins Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) DEFAULT 'System Administrator',
        role VARCHAR(30) DEFAULT 'superadmin',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Shipments Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipments (
        id SERIAL PRIMARY KEY,
        tracking_number VARCHAR(50) UNIQUE NOT NULL,
        shipper_name VARCHAR(100) NOT NULL,
        shipper_phone VARCHAR(50),
        shipper_email VARCHAR(150),
        shipper_address TEXT,
        receiver_name VARCHAR(100) NOT NULL,
        receiver_phone VARCHAR(50),
        receiver_email VARCHAR(150),
        receiver_address TEXT NOT NULL,
        origin VARCHAR(100) NOT NULL,
        destination VARCHAR(100) NOT NULL,
        current_location VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'In Transit',
        service_type VARCHAR(50) DEFAULT 'Road Freight',
        package_type VARCHAR(50) DEFAULT 'Standard Parcel',
        product VARCHAR(200) DEFAULT 'Commercial Goods',
        transport_mode VARCHAR(100) DEFAULT 'Road Freight',
        payment_mode VARCHAR(100) DEFAULT 'Prepaid',
        total_freight VARCHAR(100) DEFAULT '$0.00',
        pickup_date VARCHAR(100),
        pickup_time VARCHAR(50),
        weight VARCHAR(50) DEFAULT '15 kg',
        quantity INT DEFAULT 1,
        shipment_date TIMESTAMPTZ DEFAULT NOW(),
        estimated_delivery_date TIMESTAMPTZ,
        notes TEXT,
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure all modern logistics columns exist in shipments table
    await client.query(`
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS product VARCHAR(200) DEFAULT 'Commercial Goods';
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(100) DEFAULT 'Road Freight';
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(100) DEFAULT 'Prepaid';
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS total_freight VARCHAR(100) DEFAULT '$0.00';
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_date VARCHAR(100);
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_time VARCHAR(50);
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS comment TEXT;
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS dimensions VARCHAR(100);
      ALTER TABLE shipments ADD COLUMN IF NOT EXISTS packages JSONB DEFAULT '[]'::jsonb;
    `);

    // 3. Shipment Checkpoints Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipment_checkpoints (
        id SERIAL PRIMARY KEY,
        shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
        location VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        description TEXT,
        checkpoint_time TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3b. Shipment Products Table (Multi-item parcel / cargo itemizer)
    await client.query(`
      CREATE TABLE IF NOT EXISTS shipment_products (
        id SERIAL PRIMARY KEY,
        shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
        product_name VARCHAR(255) NOT NULL,
        package_type VARCHAR(100) NOT NULL,
        dimensions VARCHAR(100),
        weight VARCHAR(100),
        quantity INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Contact Messages Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(30) DEFAULT 'unread',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        replied_at TIMESTAMPTZ
      );
    `);

    // 5. Company Settings Table (Dynamic Contact Info)
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL DEFAULT 'info@nexivanlogistics.com',
        phone VARCHAR(100) NOT NULL DEFAULT '+1 (915) 217-3598',
        whatsapp VARCHAR(100) NOT NULL DEFAULT '+1 (915) 217-3598',
        whatsapp_raw VARCHAR(100) NOT NULL DEFAULT '19152173598',
        address TEXT NOT NULL DEFAULT '1204 Sunset Ave, Los Angeles, CA',
        working_hours VARCHAR(255) NOT NULL DEFAULT 'Mon - Sat: 8:00 AM - 7:00 PM',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_shipment ON shipment_checkpoints(shipment_id);
      CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);
    `);

    // Seed default company settings if none exist
    const settingsCheck = await client.query('SELECT id FROM company_settings LIMIT 1');
    if (settingsCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO company_settings (id, email, phone, whatsapp, whatsapp_raw, address, working_hours)
        VALUES (1, 'info@nexivanlogistics.com', '+1 (915) 217-3598', '+1 (915) 217-3598', '19152173598', '1204 Sunset Ave, Los Angeles, CA', 'Mon - Sat: 8:00 AM - 7:00 PM')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('[DB Seed] Default company contact settings seeded.');
    }

    // Seed default admin if none exists
    const adminCheck = await client.query('SELECT id FROM admins LIMIT 1');
    if (adminCheck.rows.length === 0) {
      const defaultUsername = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPassword123!';
      const defaultEmail = process.env.ADMIN_EMAIL || 'info@nexivanlogistics.com';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await client.query(
        `INSERT INTO admins (username, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [defaultUsername, defaultEmail, hashedPassword, 'Nexivan Administrator', 'superadmin']
      );
      console.log(`[DB Seed] Default admin created: ${defaultUsername} (Password: ${defaultPassword})`);
    }

    // Seed sample shipments if none exist
    const shipmentCheck = await client.query('SELECT id FROM shipments LIMIT 1');
    if (shipmentCheck.rows.length === 0) {
      const now = new Date();
      const past2Days = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const past1Day = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const eta3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Shipment 1: TRK-89201
      const res1 = await client.query(
        `INSERT INTO shipments (
          tracking_number, shipper_name, shipper_phone, shipper_email, shipper_address,
          receiver_name, receiver_phone, receiver_email, receiver_address,
          origin, destination, current_location, status, service_type, package_type,
          product, transport_mode, payment_mode, total_freight, pickup_date, pickup_time,
          weight, quantity, shipment_date, estimated_delivery_date, notes, comment
        ) VALUES (
          'TRK-89201', 'Atlas Precision Tools Ltd', '+1 (555) 234-5678', 'shipping@atlasprecision.com', '742 Evergreen Blvd, Chicago, IL',
          'Pacific Crest Distribution', '+1 (915) 217-3598', 'receiving@pacificcrest.com', '1204 Sunset Ave, Los Angeles, CA',
          'Chicago, IL, USA', 'Los Angeles, CA, USA', 'Denver Sorting Facility, CO', 'In Transit', 'Air Freight', 'Commercial Electronics',
          'Precision Optical & Electronic Sensors', 'Air Freight', 'Prepaid', '$1,850.00 USD', '2026-09-10', '09:30 AM',
          '42.5 kg', 3, $1, $2, 'Fragile - Temperature controlled air transit', 'Fragile electronic instruments. Handle with extreme care. Keep dry and secured.'
        ) RETURNING id`,
        [past2Days, eta3Days]
      );

      const ship1Id = res1.rows[0].id;
      await client.query(
        `INSERT INTO shipment_checkpoints (shipment_id, location, status, description, checkpoint_time)
         VALUES 
         ($1, 'Chicago Origin Terminal, IL', 'Picked Up', 'Consignment received and weighed at Chicago freight hub.', $2),
         ($1, 'Chicago O Hare Cargo Hub', 'Departed Facility', 'Loaded onto air cargo flight NX-4412 heading West.', $3),
         ($1, 'Denver Sorting Facility, CO', 'In Transit', 'Arrived at Denver transfer station for scheduled inspection.', $4)`,
        [ship1Id, past2Days, past1Day, now]
      );

      // Shipment 2: 12345 (simple number shown on track-shipment page example)
      const past4Days = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const res2 = await client.query(
        `INSERT INTO shipments (
          tracking_number, shipper_name, shipper_phone, shipper_email, shipper_address,
          receiver_name, receiver_phone, receiver_email, receiver_address,
          origin, destination, current_location, status, service_type, package_type,
          product, transport_mode, payment_mode, total_freight, pickup_date, pickup_time,
          weight, quantity, shipment_date, estimated_delivery_date, notes, comment
        ) VALUES (
          '12345', 'Nexivan International Depot', '+1 (915) 217-3598', 'dispatch@nexivanlogistics.com', 'Logistics Way 10, Houston, TX',
          'Elena Rostova', '+1 (438) 668-1202', 'elena.rostova@example.com', '88 Maple Grove Terrace, Seattle, WA',
          'Houston, TX, USA', 'Seattle, WA, USA', 'Seattle Delivery Hub, WA', 'Out for Delivery', 'Truck Freight', 'Palletised Cargo',
          'Heavy Industrial Machinery & Spare Parts', 'Road Freight', 'Cash on Delivery (COD)', '$620.00 USD', '2026-09-08', '02:15 PM',
          '18.2 kg', 1, $1, $2, 'Signature required upon delivery.', 'Recipient requested delivery call 30 minutes prior to arrival. Forklift ramp required.'
        ) RETURNING id`,
        [past4Days, now]
      );

      const ship2Id = res2.rows[0].id;
      await client.query(
        `INSERT INTO shipment_checkpoints (shipment_id, location, status, description, checkpoint_time)
         VALUES 
         ($1, 'Houston Hub, TX', 'Picked Up', 'Shipment processed and dispatched from main warehouse.', $2),
         ($1, 'Salt Lake City Hub, UT', 'In Transit', 'Cleared transit weigh station on Interstate route.', $3),
         ($1, 'Seattle Delivery Hub, WA', 'Out for Delivery', 'Package assigned to courier delivery vehicle.', $4)`,
        [ship2Id, past4Days, past1Day, now]
      );

      console.log('[DB Seed] Sample shipments TRK-89201 and 12345 created successfully.');
    }

    // Backfill existing rows with modern professional defaults if newly added columns are null
    await client.query(`
      UPDATE shipments 
      SET 
        product = COALESCE(product, 'Precision Optical & Electronic Sensors'),
        transport_mode = COALESCE(transport_mode, service_type, 'Air Freight'),
        payment_mode = COALESCE(payment_mode, 'Prepaid'),
        total_freight = COALESCE(NULLIF(total_freight, '$0.00'), '$1,850.00 USD'),
        pickup_date = COALESCE(pickup_date, '2026-09-10'),
        pickup_time = COALESCE(pickup_time, '09:30 AM'),
        comment = COALESCE(comment, notes, 'Fragile electronic instruments. Handle with extreme care. Keep dry and secured.')
      WHERE UPPER(tracking_number) = 'TRK-89201';

      UPDATE shipments 
      SET 
        product = COALESCE(product, 'Heavy Industrial Machinery & Spare Parts'),
        transport_mode = COALESCE(transport_mode, service_type, 'Road Freight'),
        payment_mode = COALESCE(payment_mode, 'Cash on Delivery (COD)'),
        total_freight = COALESCE(NULLIF(total_freight, '$0.00'), '$620.00 USD'),
        pickup_date = COALESCE(pickup_date, '2026-09-08'),
        pickup_time = COALESCE(pickup_time, '02:15 PM'),
        comment = COALESCE(comment, notes, 'Recipient requested delivery call 30 minutes prior to arrival. Forklift ramp required.')
      WHERE UPPER(tracking_number) = '12345';

      UPDATE shipments
      SET
        product = COALESCE(product, package_type, 'Commercial Goods'),
        transport_mode = COALESCE(transport_mode, service_type, 'Road Freight'),
        payment_mode = COALESCE(payment_mode, 'Prepaid'),
        total_freight = COALESCE(NULLIF(total_freight, ''), '$450.00 USD'),
        pickup_date = COALESCE(pickup_date, TO_CHAR(shipment_date, 'YYYY-MM-DD')),
        pickup_time = COALESCE(pickup_time, '10:00 AM'),
        comment = COALESCE(comment, notes, 'Standard freight handling protocols apply.')
      WHERE product IS NULL OR transport_mode IS NULL OR payment_mode IS NULL OR total_freight IS NULL OR pickup_date IS NULL;
    `);

    console.log('[DB] Database schema and tables verified successfully.');
  } catch (error) {
    console.error('[DB Init Error] Failed to initialize database:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDB,
};
