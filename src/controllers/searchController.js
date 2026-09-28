const { query } = require('../config/db');

// Built-in searchable site content (services, articles, core pages)
const SITE_INDEX = [
  // Services
  {
    title: 'Truck Freight Services',
    category: 'Service',
    url: '/service/truck-freight',
    icon: 'fa-truck',
    keywords: ['truck', 'freight', 'road', 'ground', 'highway', 'trailer', 'cargo'],
    excerpt: 'Comprehensive overland road freight solutions with modern fleet, GPS tracking, and temperature-controlled options.',
  },
  {
    title: 'Air Freight Services',
    category: 'Service',
    url: '/service/air-freight',
    icon: 'fa-plane',
    keywords: ['air', 'flight', 'plane', 'cargo', 'express', 'international', 'fast', 'speed'],
    excerpt: 'Rapid global air cargo shipping with expedited customs clearance and charter options for urgent cargo.',
  },
  {
    title: 'Ship Freight & Ocean Shipping',
    category: 'Service',
    url: '/service/ship-freight',
    icon: 'fa-ship',
    keywords: ['ship', 'sea', 'ocean', 'vessel', 'container', 'fcl', 'lcl', 'maritime', 'port'],
    excerpt: 'Cost-effective sea freight forwarding for full container loads (FCL) and less than container loads (LCL).',
  },
  {
    title: 'Train & Rail Freight',
    category: 'Service',
    url: '/service/train-freight',
    icon: 'fa-train',
    keywords: ['train', 'rail', 'railway', 'cargo', 'intermodal', 'heavy', 'bulk'],
    excerpt: 'Eco-friendly and dependable rail freight transport across major continental corridors and industrial centers.',
  },
  {
    title: 'Van Freight & Urban Delivery',
    category: 'Service',
    url: '/service/van-freight',
    icon: 'fa-shuttle-van',
    keywords: ['van', 'courier', 'local', 'city', 'last-mile', 'distribution', 'package'],
    excerpt: 'Agile last-mile delivery and localized van courier services tailored for fast e-commerce and retail fulfillment.',
  },
  {
    title: 'Wagon Freight Logistics',
    category: 'Service',
    url: '/service/wagon-freight',
    icon: 'fa-truck-moving',
    keywords: ['wagon', 'heavy haul', 'freight', 'oversized', 'machinery'],
    excerpt: 'Heavy-duty wagon and specialized bulk freight transport designed for oversized machinery and construction gear.',
  },
  {
    title: 'Drone Freight Solutions',
    category: 'Service',
    url: '/service/drone-freight',
    icon: 'fa-helicopter',
    keywords: ['drone', 'autonomous', 'uav', 'aerial', 'futuristic', 'medical', 'express'],
    excerpt: 'Next-generation unmanned autonomous drone logistics for rapid delivery to remote and time-critical locations.',
  },
  {
    title: 'Transportation Services in Los Angeles',
    category: 'Service',
    url: '/service/transportation-services-in-los-angeles',
    icon: 'fa-map-marker-alt',
    keywords: ['los angeles', 'california', 'west coast', 'port of la', 'hub', 'warehouse'],
    excerpt: 'Specialized regional freight handling and port-to-door distribution covering the greater Los Angeles metropolitan area.',
  },
  // Core Pages
  {
    title: 'Track Shipment Consignment',
    category: 'Page',
    url: '/track-shipment',
    icon: 'fa-search-location',
    keywords: ['track', 'trace', 'consignment', 'status', 'where is my package', 'number', 'location'],
    excerpt: 'Enter your tracking consignment number to see real-time transit status, milestones, and delivery timeline.',
  },
  {
    title: 'Contact Us & Customer Support',
    category: 'Page',
    url: '/contacts',
    icon: 'fa-envelope',
    keywords: ['contact', 'support', 'help', 'email', 'phone', 'call center', 'whatsapp', 'address'],
    excerpt: 'Reach out to our 24/7 customer care team for instant freight quotes, booking assistance, and support.',
  },
  {
    title: 'About Nexivan Logistics',
    category: 'Page',
    url: '/about-us',
    icon: 'fa-info-circle',
    keywords: ['about', 'company', 'mission', 'history', 'team', 'values', 'network'],
    excerpt: 'Learn about Nexivan Logistics, our worldwide transportation network, decades of experience, and dedication to excellence.',
  },
  // Insights & Blog
  {
    title: '5 Key Reasons Why Reliable Logistics Can Make or Break Your Business',
    category: 'Insight',
    url: '/5-key-reasons-why-reliable-logistics-can-make-or-break-your-business',
    icon: 'fa-newspaper',
    keywords: ['reliable', 'business', 'supply chain', 'strategy', 'success', 'growth'],
    excerpt: 'Discover why reliable supply chains are essential for business resilience, brand reputation, and profit.',
  },
  {
    title: 'Local vs Global Shipping: Which One Suits Your Business?',
    category: 'Insight',
    url: '/local-vs-global-shipping-which-one-suits-your-business',
    icon: 'fa-globe-americas',
    keywords: ['local', 'global', 'international', 'cross-border', 'customs', 'shipping comparison'],
    excerpt: 'A comprehensive comparative analysis of localized freight versus international multi-modal shipping options.',
  },
  {
    title: 'How Nexivan Ensures On-Time Delivery Every Time',
    category: 'Insight',
    url: '/how-logisku-ensures-on-time-delivery-every-time',
    icon: 'fa-clock',
    keywords: ['on-time', 'punctual', 'delivery', 'guarantee', 'automation', 'efficiency'],
    excerpt: 'An inside look at our route optimization technology, predictive dispatching, and contingency management.',
  },
];

/**
 * Site-wide Header Search
 * GET /api/search?q=query
 */
async function searchSite(req, res) {
  try {
    const rawQ = req.query.q || req.query.s || '';
    const q = rawQ.trim().toLowerCase();

    if (!q) {
      return res.json({
        success: true,
        query: '',
        total: 0,
        results: [],
        shipments: [],
        services: [],
      });
    }

    // 1. Search Database for matching Shipments / Consignments
    const shipRes = await query(
      `SELECT tracking_number, origin, destination, current_location, status, service_type
       FROM shipments
       WHERE UPPER(tracking_number) ILIKE $1 
          OR shipper_name ILIKE $1 
          OR receiver_name ILIKE $1 
          OR origin ILIKE $1 
          OR destination ILIKE $1
       LIMIT 5`,
      [`%${q}%`]
    );

    const shipmentResults = shipRes.rows.map((ship) => ({
      title: `Consignment #${ship.tracking_number} (${ship.status})`,
      category: 'Shipment',
      url: `/track-shipment?tracking=${encodeURIComponent(ship.tracking_number)}`,
      icon: 'fa-box-check',
      excerpt: `${ship.service_type || 'Freight'} from ${ship.origin} to ${ship.destination} • Current: ${ship.current_location || ship.origin}`,
      trackingNumber: ship.tracking_number,
      status: ship.status,
    }));

    // 2. Search Static Site Pages & Services
    const siteMatches = SITE_INDEX.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchExcerpt = item.excerpt.toLowerCase().includes(q);
      const matchKeywords = item.keywords.some((kw) => kw.includes(q) || q.includes(kw));
      return matchTitle || matchExcerpt || matchKeywords;
    });

    const combinedResults = [...shipmentResults, ...siteMatches];

    return res.json({
      success: true,
      query: rawQ,
      total: combinedResults.length,
      hasExactTrackingMatch: shipmentResults.some(
        (s) => s.trackingNumber.toLowerCase() === q.toLowerCase()
      ),
      results: combinedResults,
      shipments: shipmentResults,
      services: siteMatches.filter((item) => item.category === 'Service'),
      pages: siteMatches.filter((item) => item.category !== 'Service'),
    });
  } catch (error) {
    console.error('[Search Error] Site search failure:', error);
    return res.status(500).json({ success: false, message: 'Search execution failed.' });
  }
}

module.exports = {
  searchSite,
};
