import mongoose from 'mongoose'

// Saved SerpApi Immersive Product result for one product. The row lives 30 days,
// so a product link keeps working. Store prices refresh after 24 hours with the
// saved token (see services/productService.js).
const productCacheSchema = new mongoose.Schema(
  {
    // SerpApi product_id of the listing the user clicked
    productId: {
      type: String,
      required: true,
      unique: true
    },

    // The search it came from, as a productKey
    productKey: {
      type: String,
      required: true
    },

    // The search as typed, and Gemini's search term
    q: {
      type: String,
      default: ''
    },

    searchTerm: {
      type: String,
      default: ''
    },

    // SerpApi page token, so prices can be refreshed without a new search
    immersiveToken: {
      type: String,
      default: ''
    },

    title: {
      type: String,
      default: ''
    },

    brand: {
      type: String,
      default: null
    },

    image: {
      type: String,
      default: null
    },

    rating: {
      type: Number,
      default: null
    },

    reviews: {
      type: Number,
      default: null
    },

    description: {
      type: String,
      default: ''
    },

    // [{ title, value }], for example { title: 'Skin Type', value: 'For All Skin Types' }
    features: {
      type: Array,
      default: []
    },

    // [{ stars, amount }], 5 stars first
    ratings: {
      type: Array,
      default: []
    },

    // Up to 3: [{ text, rating, date, source, user }]
    userReviews: {
      type: Array,
      default: []
    },

    // One entry per store, the cheapest offer:
    // { store, price, oldPrice, shipping, total, link, tag, note, moreOffers, moreFrom }
    stores: {
      type: Array,
      default: []
    },

    // When the store prices were last loaded from SerpApi
    storesFetchedAt: {
      type: Date,
      default: Date.now
    },

    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    versionKey: false
  }
)

// Atlas deletes the row once expiresAt has passed (checked about once a minute).
productCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const ProductCache = mongoose.model('ProductCache', productCacheSchema, 'productCache')

export default ProductCache
