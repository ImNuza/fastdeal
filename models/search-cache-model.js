import mongoose from 'mongoose'

// Saved SerpApi results for one query, so a repeat search does not use the API.
const searchCacheSchema = new mongoose.Schema(
  {
    queryKey: {
      type: String,
      required: true,
      unique: true
    },

    listings: {
      type: Array,
      default: []
    },

    fetchedAt: {
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
searchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const SearchCache = mongoose.model('SearchCache', searchCacheSchema, 'searchCache')

export default SearchCache
