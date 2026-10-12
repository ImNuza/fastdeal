import mongoose from 'mongoose'

// A 24-hour "Sleep on it" hold. status becomes "done" after the user answers "Still want it?".
const sleepHoldSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      index: true
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

    priceAtStart: {
      type: Number,
      required: true
    },

    latestPrice: {
      type: Number,
      default: null
    },

    startedAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },

    endsAt: {
      type: Date,
      required: true
    },

    status: {
      type: String,
      enum: ['waiting', 'done'],
      default: 'waiting'
    }
  },
  {
    versionKey: false
  }
)

const SleepHold = mongoose.model('SleepHold', sleepHoldSchema, 'sleepHolds')

export default SleepHold
