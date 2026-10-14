import mongoose from 'mongoose'

// A product one user saved. targetPrice null means the 10% drop rule applies.
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

    productKey: {
      type: String,
      required: true
    },

    savedPrice: {
      type: Number,
      required: true
    },

    targetPrice: {
      type: Number,
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

    lastEmailAt: {
      type: Date,
      default: null
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
