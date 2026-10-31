import mongoose from 'mongoose'

// Saved AI "Worth it?" verdicts, one per product, cheapest price and Singapore day.
// A reload, and the "How this verdict was made" page, read the same verdict without a new Gemini call.
const worthItCacheSchema = new mongoose.Schema(
  {
    // productId|cheapest total|YYYY-MM-DD
    key: {
      type: String,
      required: true,
      unique: true
    },

    // { decision, headline, reason, source, madeAt, inputs, summary, prompt, product }
    verdict: {
      type: Object,
      required: true
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
worthItCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const WorthItCache = mongoose.model('WorthItCache', worthItCacheSchema, 'worthItCache')

export default WorthItCache
