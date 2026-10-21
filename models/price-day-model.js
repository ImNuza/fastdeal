import mongoose from 'mongoose'

// Lowest price of one product at one store on one Singapore calendar day. Shared by all users.
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
    },

    // The crossed-out "was" price the store showed that day (SerpApi extracted_old_price). null if none.
    oldPrice: {
      type: Number,
      default: null
    },

    // SerpApi product_id of the listing, for reference only. Not part of the key:
    // the same listing can get a different id in another search.
    productId: {
      type: String,
      default: null
    }
  },
  {
    versionKey: false
  }
)

// One row per product, per store, per day.
priceDaySchema.index({ productKey: 1, store: 1, day: 1 }, { unique: true })

const PriceDay = mongoose.model('PriceDay', priceDaySchema, 'priceDays')

export default PriceDay
