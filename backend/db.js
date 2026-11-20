'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { hashPassword } = require('./security');

function buildSeedState() {
  const now = new Date().toISOString();
  return {
    counters: { users: 3, products: 6, orders: 0, reviews: 0, blogs: 2, agentKeys: 0, media: 0, addresses: 1 },
    shopProfile: {
      name: 'Hitayu Organic Wellness',
      tagline: 'Rooted in Nature. Crafted for Daily Vitality.',
      gstin: '10AABCH1234F1Z5',
      supportEmail: 'care@hitayu.in',
      supportPhone: '+91-9835428278',
      warehouseAddress: 'Hitayu Botanicals Hub, Boring Road, Patna, Bihar 800001',
      gstRatePercent: 12,
      freeShippingThreshold: 999,
      standardShippingFee: 79,
      codFee: 29,
      returnPolicy: '7-day easy replacement for damaged or unopened organic products.',
      updatedAt: now,
    },
    users: [
      {
        id: 1,
        name: 'Amit Kumar Jha',
        email: 'admin@hitayu.in',
        passwordHash: hashPassword('Admin@Hitayu2026'),
        role: 'admin',
        phone: '+91-9835428278',
        bio: 'Founder & Holistic Wellness Curator at Hitayu.',
        isActive: true,
        wishlist: [],
        addresses: [
          {
            id: 1,
            label: 'Home / HQ',
            recipient: 'Amit Kumar Jha',
            phone: '+91-9835428278',
            line1: '42 Boring Road, Patna',
            city: 'Patna',
            state: 'Bihar',
            pincode: '800001',
            isDefault: true,
          },
        ],
        createdAt: now,
      },
      {
        id: 2,
        name: 'Ananya Sharma',
        email: 'writer@hitayu.in',
        passwordHash: hashPassword('Writer@Hitayu2026'),
        role: 'author',
        phone: '+91-9811002233',
        bio: 'Ayurveda educator & yoga practitioner sharing daily Dinacharya rituals.',
        isActive: true,
        wishlist: [],
        addresses: [],
        createdAt: now,
      },
      {
        id: 3,
        name: 'Rohan Verma',
        email: 'customer@hitayu.in',
        passwordHash: hashPassword('Customer@2026'),
        role: 'customer',
        phone: '+91-9876543210',
        bio: 'Organic lifestyle customer.',
        isActive: true,
        wishlist: [1],
        addresses: [
          {
            id: 1,
            label: 'Home',
            recipient: 'Rohan Verma',
            phone: '+91-9876543210',
            line1: '18 Kankarbagh Main Road',
            city: 'Patna',
            state: 'Bihar',
            pincode: '800020',
            isDefault: true,
          },
        ],
        createdAt: now,
      },
    ],
    products: [
      {
        id: 1,
        sku: 'HT-IMM-001',
        name: 'Tulsi & Giloy Immunity Drops',
        slug: 'tulsi-giloy-immunity-drops',
        category: 'Immunity',
        price: 449,
        mrp: 549,
        size: '50 ml · Amber Dropper',
        stock: 42,
        imageUrl: '/images/tulsi-giloy.jpg',
        tagline: 'Concentrated five-tulsi & organic giloy extract formulated for seasonal resilience.',
        ingredients: 'Rama Tulsi, Krishna Tulsi, Vana Tulsi, Organic Giloy Stem, Black Pepper Extract.',
        ritual: 'Add 5 drops to warm water or herbal tea every morning.',
        isActive: true,
        createdAt: now,
      },
      {
        id: 2,
        sku: 'HT-DIG-002',
        name: 'Saffron & Ginger Digestive Infusion',
        slug: 'saffron-ginger-digestive-infusion',
        category: 'Digestion',
        price: 549,
        mrp: 649,
        size: '100 g · Loose Leaf Tin',
        stock: 35,
        imageUrl: '/images/saffron-ginger.jpg',
        tagline: 'Warming Himalayan ginger, green cardamom, rose petals, and saffron threads.',
        ingredients: 'Sun-dried Ginger Root, Green Cardamom, Kashmiri Saffron, Mint Leaf, Damascus Rose.',
        ritual: 'Steep 1 tsp in 200 ml hot water for 4 minutes after meals.',
        isActive: true,
        createdAt: now,
      },
      {
        id: 3,
        sku: 'HT-VIT-003',
        name: 'Organic Moringa Leaf Superfood',
        slug: 'organic-moringa-leaf-superfood',
        category: 'Daily Vitality',
        price: 399,
        mrp: 499,
        size: '150 g · Sealed Pouch',
        stock: 60,
        imageUrl: '/images/moringa.jpg',
        tagline: 'Shade-dried vibrant moringa leaf powder rich in plant micronutrients and iron.',
        ingredients: '100% Shade-Dried Organic Moringa Oleifera Leaves (Zero Fillers).',
        ritual: 'Whisk 1/2 tsp into warm lemon water, smoothies, or soups.',
        isActive: true,
        createdAt: now,
      },
      {
        id: 4,
        sku: 'HT-CLM-004',
        name: 'Ashwagandha & Brahmi Calm Elixir',
        slug: 'ashwagandha-brahmi-calm-elixir',
        category: 'Calm & Sleep',
        price: 599,
        mrp: 699,
        size: '60 ml · Botanical Tincture',
        stock: 28,
        imageUrl: '/images/ashwagandha-brahmi.jpg',
        tagline: 'Adaptogenic root & leaf tonic formulated to ease mental fatigue and evening stress.',
        ingredients: 'Organic Ashwagandha Root, Brahmi Leaf, Ceylon Cinnamon Bark, Green Cardamom.',
        ritual: 'Mix 1/2 dropper into warm oat/almond milk or herbal tea in the evening.',
        isActive: true,
        createdAt: now,
      },
      {
        id: 5,
        sku: 'HT-CLM-005',
        name: 'Chamomile & Rose Night Tisane',
        slug: 'chamomile-rose-night-tisane',
        category: 'Calm & Sleep',
        price: 429,
        mrp: 499,
        size: '75 g · Ribbed Glass Jar',
        stock: 48,
        imageUrl: '/images/chamomile-rose.jpg',
        tagline: 'Whole golden chamomile blossoms blended with fragrant dried rose petals.',
        ingredients: 'Whole Chamomile Flowers, Organic Rose Petals, Lemon Balm.',
        ritual: 'Steep 1 tbsp in hot water 30 minutes before bedtime.',
        isActive: true,
        createdAt: now,
      },
      {
        id: 6,
        sku: 'HT-IMM-006',
        name: 'Golden Turmeric & Cinnamon Latte',
        slug: 'golden-turmeric-cinnamon-latte',
        category: 'Immunity',
        price: 479,
        mrp: 579,
        size: '120 g · Small-Batch Jar',
        stock: 50,
        imageUrl: '/images/turmeric-latte.jpg',
        tagline: 'High-curcumin heirloom Lakadong turmeric with Ceylon cinnamon and crushed pepper.',
        ingredients: 'Heirloom Lakadong Turmeric, Ceylon Cinnamon, Dry Ginger, Tellicherry Black Pepper.',
        ritual: 'Simmer 1 tsp in warm milk or plant milk with a touch of raw honey.',
        isActive: true,
        createdAt: now,
      },
    ],
    reviews: [],
    coupons: [
      { code: 'HITAYU10', discountPercent: 10, minOrderAmount: 400, isActive: true },
      { code: 'WELLNESS15', discountPercent: 15, minOrderAmount: 999, isActive: true },
    ],
    orders: [],
    blogs: [
      {
        id: 1,
        slug: 'morning-dinacharya-tulsi-turmeric-ritual',
        title: 'Morning Dinacharya: Why Warm Herbal Infusions Beat Caffeine',
        excerpt: 'Discover how a 10-minute sunrise ritual of warm tulsi, ginger, and Lakadong turmeric supports steady energy without afternoon crashes.',
        body: 'Ayurveda teaches that the first 30 minutes after waking set the digestive and nervous rhythm for your entire day.\n\nStart with warm water infused with fresh tulsi leaves and a pinch of heirloom Lakadong turmeric, followed by five rounds of Anulom Vilom breathwork.',
        category: 'Herbal Habits',
        tags: ['Dinacharya', 'Tulsi', 'Morning Ritual'],
        coverImageUrl: '/images/hero.jpg',
        media: [{ type: 'image', url: '/images/turmeric-latte.jpg', caption: 'Heirloom Lakadong turmeric & Ceylon cinnamon blend' }],
        status: 'published',
        authorId: 1,
        authoredByAgent: false,
        agentName: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        slug: 'sunrise-pranayama-guide-for-busy-minds',
        title: '5-Minute Sunrise Pranayama to Reset Stress & Deepen Focus',
        excerpt: 'A practical, beginner-friendly guide to Anulom Vilom and 4-7-8 breathwork you can practice right on your veranda or desk.',
        body: 'Conscious nasal breathing is one of the fastest ways to signal calm to your nervous system.\n\nSit tall, inhale smoothly for 4 counts, pause for 4 counts, and exhale gently for 4 counts.',
        category: 'Yoga & Breathwork',
        tags: ['Pranayama', 'Yoga', 'Mindfulness'],
        coverImageUrl: '/images/yoga.jpg',
        media: [{ type: 'image', url: '/images/chamomile-rose.jpg', caption: 'Evening chamomile & rose petals for post-practice calm' }],
        status: 'published',
        authorId: 2,
        authoredByAgent: false,
        agentName: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    agentKeys: [],
    mediaAssets: [],
  };
}

let dbState = null;

function ensureLoaded() {
  if (dbState) return dbState;
  fs.mkdirSync(path.dirname(config.DATA_FILE), { recursive: true });
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(config.DATA_FILE)) {
    dbState = JSON.parse(fs.readFileSync(config.DATA_FILE, 'utf8'));
  } else {
    dbState = buildSeedState();
    persist();
  }
  return dbState;
}

function persist() {
  const tmp = `${config.DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(dbState, null, 2), 'utf8');
  fs.renameSync(tmp, config.DATA_FILE);
}

function nextId(collection) {
  const s = ensureLoaded();
  s.counters[collection] = (s.counters[collection] || 0) + 1;
  return s.counters[collection];
}

module.exports = {
  getDb: ensureLoaded,
  persist,
  nextId,
};
