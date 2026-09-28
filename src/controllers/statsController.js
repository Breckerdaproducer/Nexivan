const { query } = require('../config/db');

async function getDashboardStats(req, res) {
  try {
    const [
      totalShipmentsRes,
      inTransitRes,
      deliveredRes,
      outForDeliveryRes,
      totalMessagesRes,
      unreadMessagesRes,
      recentShipmentsRes,
      recentMessagesRes,
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM shipments'),
      query("SELECT COUNT(*) FROM shipments WHERE status = 'In Transit'"),
      query("SELECT COUNT(*) FROM shipments WHERE status = 'Delivered'"),
      query("SELECT COUNT(*) FROM shipments WHERE status = 'Out for Delivery'"),
      query('SELECT COUNT(*) FROM contact_messages'),
      query("SELECT COUNT(*) FROM contact_messages WHERE status = 'unread'"),
      query(`
        SELECT id, tracking_number, origin, destination, status, service_type, created_at,
          (SELECT COUNT(*) FROM shipment_checkpoints WHERE shipment_id = shipments.id) as checkpoint_count
        FROM shipments 
        ORDER BY created_at DESC 
        LIMIT 5
      `),
      query(`
        SELECT id, first_name, last_name, email, phone, message, status, created_at 
        FROM contact_messages 
        ORDER BY created_at DESC 
        LIMIT 5
      `),
    ]);

    return res.json({
      success: true,
      metrics: {
        totalShipments: parseInt(totalShipmentsRes.rows[0].count, 10),
        inTransitShipments: parseInt(inTransitRes.rows[0].count, 10),
        deliveredShipments: parseInt(deliveredRes.rows[0].count, 10),
        outForDeliveryShipments: parseInt(outForDeliveryRes.rows[0].count, 10),
        totalMessages: parseInt(totalMessagesRes.rows[0].count, 10),
        unreadMessages: parseInt(unreadMessagesRes.rows[0].count, 10),
      },
      recentShipments: recentShipmentsRes.rows,
      recentMessages: recentMessagesRes.rows,
    });
  } catch (error) {
    console.error('[Stats Error] Dashboard stats failure:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats.' });
  }
}

module.exports = {
  getDashboardStats,
};
