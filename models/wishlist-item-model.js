import mongoose from 'mongoose'

// A product one user saved. targetPrice null means the 10% drop rule applies.
// productName is the product title (not the search), so two products from one search are two rows.
const wishlistItemSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true
    },

    productName: {
      type: String,
      required: true,
      trim: true
    },

    // toProductKey(productName), from models/product-key.js
    productKey: {
      type: String,
      required: true
    },

    // Google Shopping product id, for /product/:productId. null for items saved before 21 Oct 2026.
    productId: {
      type: String,
      default: null
    },

    // The search it was saved from, so the product page works after a reload
    q: {
      type: String,
      default: null
    },

    image: {
      type: String,
      default: null
    },

    savedPrice: {
      type: Number,
      required: true
    },

    savedStore: {
      type: String,
      default: null
    },

    targetPrice: {
      type: Number,
      default: null
    },

    // 'ai' on rows saved when the AI set the target itself. No longer set: the AI now only
    // suggests (targetSuggestion). Kept so old rows still read.
    targetSource: {
      type: String,
      default: null
    },

    // The AI's suggested target from the price history and the listings, with its one-line
    // reason. Only the grey hint in the Wishlist's target box: it never sets an alert.
    targetSuggestion: {
      type: Number,
      default: null
    },

    targetReason: {
      type: String,
      default: null
    },

    // 1 = most important. null = not a priority.
    priority: {
      type: Number,
      default: null,
      min: 1
    },

    latestPrice: {
      type: Number,
      default: null
    },

    latestStore: {
      type: String,
      default: null
    },

    latestLink: {
      type: String,
      default: null
    },

    flag: {
      type: String,
      enum: ['none', 'drop', 'target'],
      default: 'none'
    },

    lastCheckedAt: {
      type: Date,
      default: null
    },

    // Target threshold for which an email has already been sent.
    targetEmailFor: {
      type: Number,
      default: null
    },

    lastEmailAt: {
      type: Date,
      default: null
    },

    // Target threshold that already has a target-hit notification.
    targetNotifiedFor: {
      type: Number,
      default: null
    },

    // Lowest price that already has a price-drop notification. A new one needs a lower price.
    dropNotifiedPrice: {
      type: Number,
      default: null
    },

    // Sleep on it. sleepUntil null = not on hold. The price when the hold started
    // and whether the user has seen the verdict after it ended.
    sleepUntil: {
      type: Date,
      default: null
    },

    sleepPriceAtStart: {
      type: Number,
      default: null
    },

    sleepVerdictSeen: {
      type: Boolean,
      default: false
    },

    savedAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    versionKey: false
  }
)

// Same user cannot save one product twice.
wishlistItemSchema.index({ firebaseUid: 1, productKey: 1 }, { unique: true })

// Sale alerts: every user who saved this product.
wishlistItemSchema.index({ productKey: 1 })

const WishlistItem = mongoose.model('WishlistItem', wishlistItemSchema, 'wishlistItems')

export default WishlistItem
