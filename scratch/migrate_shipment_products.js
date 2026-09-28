const { query } = require('../src/config/db');

async function migrate() {
  try {
    await query(`
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
    console.log('shipment_products table created successfully!');

    // Seed existing shipments with sample shipment_products if table is empty
    const check = await query('SELECT count(*) FROM shipment_products');
    if (parseInt(check.rows[0].count, 10) === 0) {
      const ships = await query('SELECT id, product, package_type, weight, quantity FROM shipments');
      for (const s of ships.rows) {
        await query(`
          INSERT INTO shipment_products (shipment_id, product_name, package_type, dimensions, weight, quantity)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          s.id,
          s.product || 'Commercial Goods',
          s.package_type || 'Carton Box',
          '40 x 30 x 20 cm',
          s.weight || '15 kg',
          s.quantity || 1
        ]);
      }
      console.log('Seeded initial products for existing shipments!');
    }

    const verify = await query('SELECT * FROM shipment_products');
    console.table(verify.rows);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
