import mongoose from 'mongoose'

// Lowest price of one product on one Singapore calendar day. Shared by all users.
const priceDaySchema = new mongoose.Schema(
  {
    productKey: {
      type: String,
      required: true
    },

    // "YYYY-MM-DD" in Singapore time
    day: {
      type: String,
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    store: {
      type: String,
      default: null
    }
  },
  {
    versionKey: false
  }
)

// One row per product per day.
priceDaySchema.index({ productKey: 1, day: 1 }, { unique: true })

const PriceDay = mongoose.model('PriceDay', priceDaySchema, 'priceDays')

export default PriceDay
