const { query } = require('../config/db');
const { sendShipmentCreationEmail, sendShipmentStatusUpdate } = require('../services/emailService');

/**
 * Compute progress percentage from status
 */
function getProgressPercent(status) {
  const map = {
    'pending': 15,
    'order created': 15,
    'picked up': 35,
    'received at hub': 45,
    'in transit': 65,
    'departed facility': 70,
    'customs cleared': 75,
    'out for delivery': 85,
    'delivered': 100,
    'on hold': 50,
    'cancelled': 0,
  };
  const normalized = (status || '').toLowerCase().trim();
  return map[normalized] !== undefined ? map[normalized] : 50;
}

/**
 * PUBLIC: Track a shipment by Consignment / Tracking Number
 * GET /api/track/:trackingNumber
 */
async function trackShipment(req, res) {
  try {
    const rawNumber = req.params.trackingNumber || req.query.number;
    if (!rawNumber || !rawNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tracking number is required.',
      });
    }

    const trackingNumber = rawNumber.trim().toUpperCase();

    // 1. Fetch Shipment
    const shipRes = await query(
      'SELECT * FROM shipments WHERE UPPER(tracking_number) = $1 LIMIT 1',
      [trackingNumber]
    );

    if (shipRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No consignment record found matching tracking number "${trackingNumber}".`,
      });
    }

    const shipment = shipRes.rows[0];

    // 2. Fetch Checkpoints
    const checkpointRes = await query(
      'SELECT * FROM shipment_checkpoints WHERE shipment_id = $1 ORDER BY checkpoint_time ASC, id ASC',
      [shipment.id]
    );

    const checkpoints = checkpointRes.rows;
    const progressPercent = getProgressPercent(shipment.status);

    // 3. Fetch Shipment Products (Cargo Itemizer)
    const prodRes = await query(
      'SELECT * FROM shipment_products WHERE shipment_id = $1 ORDER BY id ASC',
      [shipment.id]
    );
    const products = prodRes.rows;

    return res.json({
      success: true,
      shipment: {
        id: shipment.id,
        trackingNumber: shipment.tracking_number,
        status: shipment.status,
        progressPercent,
        serviceType: shipment.service_type,
        packageType: shipment.package_type,
        product: shipment.product || shipment.package_type || 'Commercial Goods',
        transportMode: shipment.transport_mode || shipment.service_type || 'Road Freight',
        paymentMode: shipment.payment_mode || 'Prepaid',
        totalFreight: shipment.total_freight || 'N/A',
        pickupDate: shipment.pickup_date,
        pickupTime: shipment.pickup_time,
        comment: shipment.comment || shipment.notes || '',
        weight: shipment.weight,
        quantity: shipment.quantity,
        origin: shipment.origin,
        destination: shipment.destination,
        currentLocation: shipment.current_location,
        shipmentDate: shipment.shipment_date,
        estimatedDeliveryDate: shipment.estimated_delivery_date,
        expectedDeliveryDate: shipment.estimated_delivery_date,
        products,
        shipper: {
          name: shipment.shipper_name,
          phone: shipment.shipper_phone,
          address: shipment.shipper_address,
        },
        receiver: {
          name: shipment.receiver_name,
          phone: shipment.receiver_phone,
          address: shipment.receiver_address,
        },
        notes: shipment.notes,
        createdAt: shipment.created_at,
        updatedAt: shipment.updated_at,
      },
      products,
      checkpoints: checkpoints.map((cp) => ({
        id: cp.id,
        location: cp.location,
        status: cp.status,
        description: cp.description,
        time: cp.checkpoint_time,
      })),
    });
  } catch (error) {
    console.error('[Tracking Error] Track shipment failure:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve tracking details at this moment. Please try again later.',
    });
  }
}

/**
 * ADMIN: Get all shipments with filtering and pagination
 * GET /api/admin/shipments
 */
async function getAllShipments(req, res) {
  try {
    const { q, status, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

    const conditions = [];
    const values = [];

    if (q && q.trim()) {
      values.push(`%${q.trim()}%`);
      const pIdx = values.length;
      conditions.push(
        `(tracking_number ILIKE $${pIdx} OR shipper_name ILIKE $${pIdx} OR receiver_name ILIKE $${pIdx} OR origin ILIKE $${pIdx} OR destination ILIKE $${pIdx})`
      );
    }

    if (status && status !== 'all') {
      values.push(status.trim());
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countRes = await query(`SELECT COUNT(*) FROM shipments ${whereClause}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    // Shipments
    const queryStr = `
      SELECT s.*, 
        (SELECT COUNT(*) FROM shipment_checkpoints WHERE shipment_id = s.id) as checkpoint_count,
        (SELECT COUNT(*) FROM shipment_products WHERE shipment_id = s.id) as product_count,
        (SELECT location FROM shipment_checkpoints WHERE shipment_id = s.id ORDER BY checkpoint_time DESC, id DESC LIMIT 1) as latest_checkpoint_location
      FROM shipments s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(parseInt(limit, 10), offset);
    const dataRes = await query(queryStr, values);

    return res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      shipments: dataRes.rows,
    });
  } catch (error) {
    console.error('[Admin Shipment Error] Get all shipments:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve shipments.' });
  }
}

/**
 * ADMIN: Get single shipment by ID with all checkpoints and products
 * GET /api/admin/shipments/:id
 */
async function getShipmentById(req, res) {
  try {
    const { id } = req.params;
    const shipRes = await query('SELECT * FROM shipments WHERE id = $1', [id]);

    if (shipRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    const shipment = shipRes.rows[0];
    const cpRes = await query(
      'SELECT * FROM shipment_checkpoints WHERE shipment_id = $1 ORDER BY checkpoint_time ASC, id ASC',
      [id]
    );
    const prodRes = await query(
      'SELECT * FROM shipment_products WHERE shipment_id = $1 ORDER BY id ASC',
      [id]
    );

    return res.json({
      success: true,
      shipment: {
        ...shipment,
        products: prodRes.rows,
      },
      products: prodRes.rows,
      checkpoints: cpRes.rows,
    });
  } catch (error) {
    console.error('[Admin Shipment Error] Get shipment by ID:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve shipment.' });
  }
}

/**
 * Helper to generate random tracking number
 */
function generateTrackingNumber() {
  const prefix = 'NX';
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${randomNum}`;
}

/**
 * ADMIN: Create new shipment
 * POST /api/admin/shipments
 */
async function createShipment(req, res) {
  try {
    let {
      tracking_number,
      shipper_name,
      shipper_phone,
      shipper_email,
      shipper_address,
      receiver_name,
      receiver_phone,
      receiver_email,
      receiver_address,
      origin,
      destination,
      current_location,
      status = 'In Transit',
      service_type,
      package_type,
      product,
      transport_mode,
      payment_mode,
      total_freight,
      pickup_date,
      pickup_time,
      weight,
      quantity,
      shipment_date = new Date(),
      estimated_delivery_date,
      expected_delivery_date,
      notes,
      comment,
      initial_checkpoint_location,
      initial_checkpoint_description,
    } = req.body;

    if (!shipper_name || !receiver_name || !origin || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Shipper name, receiver name, origin, and destination are required.',
      });
    }

    // Process & Validate Products (At least 1 required)
    let products = req.body.products;
    if (typeof products === 'string') {
      try { products = JSON.parse(products); } catch (e) { products = []; }
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
      if (product || req.body.product_name) {
        products = [{
          product_name: product || req.body.product_name,
          package_type: package_type || 'Standard Parcel',
          dimensions: req.body.dimensions || '',
          weight: weight || '',
          quantity: parseInt(quantity, 10) || 1,
        }];
      } else {
        return res.status(400).json({
          success: false,
          message: 'At least 1 product must be added to the consignment before registration.',
        });
      }
    }

    // Compute composite summaries for shipments table
    const totalItemQty = products.reduce((acc, p) => acc + (parseInt(p.quantity, 10) || 1), 0);
    const summaryProductNames = products.map(p => (p.product_name || p.product || '').trim()).filter(Boolean).join(', ').substring(0, 195) || 'Commercial Goods';
    const primaryPackageType = (products[0]?.package_type || package_type || 'Standard Parcel').trim();
    const primaryDimensions = (products[0]?.dimensions || req.body.dimensions || '').trim();
    const primaryWeight = (weight || products.map(p => p.weight).filter(Boolean).join(', ') || '').trim();

    const finalProduct = (product || summaryProductNames).trim();
    const finalTransportMode = (transport_mode || service_type || 'Road Freight').trim();
    const finalPaymentMode = (payment_mode || 'Prepaid').trim();
    const finalTotalFreight = (total_freight || '$0.00').trim();
    const finalPickupDate = pickup_date || (shipment_date ? new Date(shipment_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const finalPickupTime = (pickup_time || '').trim();
    const finalEta = expected_delivery_date || estimated_delivery_date || null;
    const finalComment = (comment || notes || '').trim();
    const finalQuantity = parseInt(quantity || totalItemQty, 10) || 1;

    if (!tracking_number || !tracking_number.trim()) {
      tracking_number = generateTrackingNumber();
    } else {
      tracking_number = tracking_number.trim().toUpperCase();
    }

    // Check collision
    const existing = await query('SELECT id FROM shipments WHERE UPPER(tracking_number) = $1', [
      tracking_number,
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Tracking number ${tracking_number} already exists. Please provide a unique code.`,
      });
    }

    const insertShipmentQuery = `
      INSERT INTO shipments (
        tracking_number, shipper_name, shipper_phone, shipper_email, shipper_address,
        receiver_name, receiver_phone, receiver_email, receiver_address,
        origin, destination, current_location, status, service_type, package_type,
        product, transport_mode, payment_mode, total_freight, pickup_date, pickup_time,
        weight, quantity, shipment_date, estimated_delivery_date, notes, comment, dimensions, packages
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28, $29
      ) RETURNING *
    `;

    const shipValues = [
      tracking_number,
      shipper_name,
      shipper_phone || '',
      shipper_email || '',
      shipper_address || '',
      receiver_name,
      receiver_phone || '',
      receiver_email || '',
      receiver_address || destination,
      origin,
      destination,
      current_location || origin,
      status || 'In Transit',
      finalTransportMode,
      primaryPackageType,
      finalProduct,
      finalTransportMode,
      finalPaymentMode,
      finalTotalFreight,
      finalPickupDate,
      finalPickupTime,
      primaryWeight,
      finalQuantity,
      shipment_date || new Date(),
      finalEta,
      finalComment,
      finalComment,
      primaryDimensions,
      JSON.stringify(products),
    ];

    const result = await query(insertShipmentQuery, shipValues);
    const newShipment = result.rows[0];

    // Insert each product into shipment_products table
    for (const p of products) {
      await query(
        `INSERT INTO shipment_products (shipment_id, product_name, package_type, dimensions, weight, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newShipment.id,
          (p.product_name || p.product || 'Commercial Goods').trim(),
          (p.package_type || 'Standard Parcel').trim(),
          (p.dimensions || '').trim(),
          (p.weight || '').trim(),
          parseInt(p.quantity, 10) || 1,
        ]
      );
    }

    // Create Initial Checkpoint
    const cpLocation = initial_checkpoint_location || origin;
    const cpStatus = status === 'Delivered' ? 'Delivered' : 'Picked Up';
    const cpDesc =
      initial_checkpoint_description ||
      `Consignment registered and accepted at ${cpLocation}. Ready for transit.`;

    await query(
      `INSERT INTO shipment_checkpoints (shipment_id, location, status, description, checkpoint_time)
       VALUES ($1, $2, $3, $4, NOW())`,
      [newShipment.id, cpLocation, cpStatus, cpDesc]
    );

    const prodRes = await query(
      'SELECT * FROM shipment_products WHERE shipment_id = $1 ORDER BY id ASC',
      [newShipment.id]
    );

    // Automatically send registration advice with 2 PDF attachments (Waybill + Commercial Invoice or POD)
    sendShipmentCreationEmail(newShipment, prodRes.rows).catch((err) =>
      console.error('[Consignment Creation Email Error]', err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Shipment registered successfully.',
      shipment: {
        ...newShipment,
        products: prodRes.rows,
      },
      products: prodRes.rows,
    });
  } catch (error) {
    console.error('[Admin Shipment Error] Create shipment failure:', error);
    return res.status(500).json({ success: false, message: 'Failed to create shipment.' });
  }
}

/**
 * ADMIN: Update shipment
 * PUT /api/admin/shipments/:id
 */
async function updateShipment(req, res) {
  try {
    const { id } = req.params;
    const {
      tracking_number,
      shipper_name,
      shipper_phone,
      shipper_email,
      shipper_address,
      receiver_name,
      receiver_phone,
      receiver_email,
      receiver_address,
      origin,
      destination,
      current_location,
      status,
      service_type,
      package_type,
      product,
      transport_mode,
      payment_mode,
      total_freight,
      pickup_date,
      pickup_time,
      weight,
      quantity,
      shipment_date,
      estimated_delivery_date,
      expected_delivery_date,
      notes,
      comment,
      dimensions,
    } = req.body;

    const shipCheck = await query('SELECT * FROM shipments WHERE id = $1', [id]);
    if (shipCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    // Process & Replace Products if provided
    let products = req.body.products;
    if (typeof products === 'string') {
      try { products = JSON.parse(products); } catch (e) { products = null; }
    }
    if (products !== undefined && Array.isArray(products)) {
      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least 1 product must be included in the consignment.',
        });
      }
      await query('DELETE FROM shipment_products WHERE shipment_id = $1', [id]);
      for (const p of products) {
        await query(
          `INSERT INTO shipment_products (shipment_id, product_name, package_type, dimensions, weight, quantity)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            (p.product_name || p.product || 'Commercial Goods').trim(),
            (p.package_type || 'Standard Parcel').trim(),
            (p.dimensions || '').trim(),
            (p.weight || '').trim(),
            parseInt(p.quantity, 10) || 1,
          ]
        );
      }
    }

    const finalEta = expected_delivery_date !== undefined ? expected_delivery_date : (estimated_delivery_date !== undefined ? estimated_delivery_date : shipCheck.rows[0].estimated_delivery_date);
    const finalComment = comment !== undefined ? comment : notes;

    const updateQuery = `
      UPDATE shipments SET
        tracking_number = COALESCE($1, tracking_number),
        shipper_name = COALESCE($2, shipper_name),
        shipper_phone = COALESCE($3, shipper_phone),
        shipper_email = COALESCE($4, shipper_email),
        shipper_address = COALESCE($5, shipper_address),
        receiver_name = COALESCE($6, receiver_name),
        receiver_phone = COALESCE($7, receiver_phone),
        receiver_email = COALESCE($8, receiver_email),
        receiver_address = COALESCE($9, receiver_address),
        origin = COALESCE($10, origin),
        destination = COALESCE($11, destination),
        current_location = COALESCE($12, current_location),
        status = COALESCE($13, status),
        service_type = COALESCE($14, service_type),
        package_type = COALESCE($15, package_type),
        product = COALESCE($16, product),
        transport_mode = COALESCE($17, transport_mode),
        payment_mode = COALESCE($18, payment_mode),
        total_freight = COALESCE($19, total_freight),
        pickup_date = COALESCE($20, pickup_date),
        pickup_time = COALESCE($21, pickup_time),
        weight = COALESCE($22, weight),
        quantity = COALESCE($23, quantity),
        shipment_date = COALESCE($24, shipment_date),
        estimated_delivery_date = $25,
        notes = COALESCE($26, notes),
        comment = COALESCE($27, comment),
        dimensions = COALESCE($28, dimensions),
        packages = COALESCE($29, packages),
        updated_at = NOW()
      WHERE id = $30
      RETURNING *
    `;

    const values = [
      tracking_number ? tracking_number.trim().toUpperCase() : null,
      shipper_name,
      shipper_phone,
      shipper_email,
      shipper_address,
      receiver_name,
      receiver_phone,
      receiver_email,
      receiver_address,
      origin,
      destination,
      current_location,
      status,
      transport_mode || service_type,
      package_type || product,
      product,
      transport_mode || service_type,
      payment_mode,
      total_freight,
      pickup_date,
      pickup_time,
      weight,
      quantity ? parseInt(quantity, 10) : null,
      shipment_date,
      finalEta || null,
      finalComment,
      finalComment,
      dimensions || null,
      products ? JSON.stringify(products) : null,
      id,
    ];

    const result = await query(updateQuery, values);
    const prodRes = await query(
      'SELECT * FROM shipment_products WHERE shipment_id = $1 ORDER BY id ASC',
      [id]
    );

    const oldShipment = shipCheck.rows[0];
    const updatedShipment = result.rows[0];
    const oldStatus = (oldShipment.status || '').trim();
    const newStatus = (updatedShipment.status || '').trim();
    const statusChanged = oldStatus && newStatus && oldStatus.toLowerCase() !== newStatus.toLowerCase();

    // Automatically trigger email update if status changed or customer notification is requested
    if (statusChanged || req.body.notify_customer) {
      const milestoneLocation = updatedShipment.current_location || updatedShipment.destination || oldShipment.origin;
      const milestoneDesc = req.body.comment || req.body.notes || `Consignment status updated to ${newStatus}.`;

      query(
        `INSERT INTO shipment_checkpoints (shipment_id, location, status, description, checkpoint_time)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [id, milestoneLocation, newStatus, milestoneDesc]
      ).then((cpRes) => {
        const latestCheckpoint = cpRes.rows[0];
        sendShipmentStatusUpdate(updatedShipment, latestCheckpoint, { oldStatus, products: prodRes.rows }).catch((err) =>
          console.error('[Consignment Status Update Email Error]', err.message)
        );
      }).catch((err) => {
        sendShipmentStatusUpdate(
          updatedShipment,
          { location: milestoneLocation, status: newStatus, description: milestoneDesc, checkpoint_time: new Date() },
          { oldStatus, products: prodRes.rows }
        ).catch((e) => console.error('[Consignment Status Update Email Error]', e.message));
      });
    }

    return res.json({
      success: true,
      message: 'Shipment updated successfully.',
      shipment: {
        ...result.rows[0],
        products: prodRes.rows,
      },
      products: prodRes.rows,
    });
  } catch (error) {
    console.error('[Admin Shipment Error] Update shipment failure:', error);
    return res.status(500).json({ success: false, message: 'Failed to update shipment.' });
  }
}

/**
 * ADMIN: Delete shipment
 * DELETE /api/admin/shipments/:id
 */
async function deleteShipment(req, res) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM shipments WHERE id = $1 RETURNING id, tracking_number', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    return res.json({
      success: true,
      message: `Shipment ${result.rows[0].tracking_number} deleted successfully.`,
    });
  } catch (error) {
    console.error('[Admin Shipment Error] Delete shipment failure:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete shipment.' });
  }
}

/**
 * ADMIN: Add checkpoint / milestone to shipment
 * POST /api/admin/shipments/:id/checkpoints
 */
async function addCheckpoint(req, res) {
  try {
    const { id } = req.params;
    const { location, status, description, checkpoint_time, notify_customer } = req.body;

    if (!location || !status) {
      return res.status(400).json({
        success: false,
        message: 'Checkpoint location and status are required.',
      });
    }

    const shipRes = await query('SELECT * FROM shipments WHERE id = $1', [id]);
    if (shipRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    const shipment = shipRes.rows[0];

    // 1. Insert checkpoint
    const cpRes = await query(
      `INSERT INTO shipment_checkpoints (shipment_id, location, status, description, checkpoint_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, location, status, description || '', checkpoint_time || new Date()]
    );

    const newCheckpoint = cpRes.rows[0];

    // 2. Automatically update current_location and status of parent shipment
    await query(
      `UPDATE shipments 
       SET current_location = $1, status = $2, updated_at = NOW() 
       WHERE id = $3`,
      [location, status, id]
    );

    // 3. Trigger email notification with PDF attachments if requested
    if (notify_customer !== false) {
      query('SELECT * FROM shipment_products WHERE shipment_id = $1 ORDER BY id ASC', [id])
        .then((prodRes) => {
          const updatedShipmentData = {
            ...shipment,
            current_location: location,
            status: status,
          };
          sendShipmentStatusUpdate(updatedShipmentData, newCheckpoint, { products: prodRes.rows }).catch((err) =>
            console.error('[Email Notification Error]', err.message)
          );
        })
        .catch(() => {
          sendShipmentStatusUpdate({ ...shipment, current_location: location, status }, newCheckpoint).catch((err) =>
            console.error('[Email Notification Error]', err.message)
          );
        });
    }

    return res.status(201).json({
      success: true,
      message: 'Checkpoint added successfully.',
      checkpoint: newCheckpoint,
    });
  } catch (error) {
    console.error('[Admin Checkpoint Error] Add checkpoint failure:', error);
    return res.status(500).json({ success: false, message: 'Failed to add checkpoint.' });
  }
}

/**
 * ADMIN: Delete checkpoint
 * DELETE /api/admin/shipments/:id/checkpoints/:checkpointId
 */
async function deleteCheckpoint(req, res) {
  try {
    const { id, checkpointId } = req.params;
    const result = await query(
      'DELETE FROM shipment_checkpoints WHERE id = $1 AND shipment_id = $2 RETURNING id',
      [checkpointId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Checkpoint not found.' });
    }

    return res.json({
      success: true,
      message: 'Checkpoint deleted successfully.',
    });
  } catch (error) {
    console.error('[Admin Checkpoint Error] Delete checkpoint failure:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete checkpoint.' });
  }
}

module.exports = {
  trackShipment,
  getAllShipments,
  getShipmentById,
  createShipment,
  updateShipment,
  deleteShipment,
  addCheckpoint,
  deleteCheckpoint,
};
