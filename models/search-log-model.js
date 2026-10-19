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

const SearchLog = mongoose.model('SearchLog', searchLogSchema, 'searchLogs')

export default SearchLog
