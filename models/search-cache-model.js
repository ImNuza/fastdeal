import mongoose from 'mongoose'

// Saved SerpApi results for one query, so a repeat search does not use the API.
const searchCacheSchema = new mongoose.Schema(
  {
    queryKey: {
      type: String,
      required: true,
      unique: true
    },

    // The cleaned search term Gemini made, for example "Hydro Flask water bottle"
    searchTerm: {
      type: String,
      default: null
    },

    listings: {
      type: Array,
      default: []
    },

    fetchedAt: {
      type: Date,
      default: Date.now
    },

    // true for the demo searches and product pages the seed writes (data/demo-searches.json).
    // They are never fetched again, so the demo uses no SerpApi credit and keeps its history.
    demo: {
      type: Boolean,
      default: false
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
