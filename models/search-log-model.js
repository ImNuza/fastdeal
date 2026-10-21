import mongoose from 'mongoose'

// One anonymous search. No firebaseUid on purpose.
// Same sessionId with different productKey = searched together.
const searchLogSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true
    },
  
    query: {
      type: String,
      required: true,
      trim: true
    },

    productName: {
      type: String,
      default: null
    },

    productKey: {
      type: String,
      default: null,
      index: true
    },

    searchedAt: {
      type: Date,
      default: Date.now
    },

    count:{
      type:Number,
      default:1
    },

    image: {
      type: String,
      default: ''
    },
  },
  {
    versionKey: false
  }
)

// One row per browser session per search. Only real browser sessions ("s-...") must be
// unique: seed rows ("seed-...") and the old rows with sessionId "1" may repeat.
searchLogSchema.index(
  { sessionId: 1, productKey: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $gte: 's-', $lt: 's.' } } }
)

const SearchLog = mongoose.model('SearchLog', searchLogSchema, 'searchLogs')

export default SearchLog
