import mongoose from 'mongoose'

// A "Sleep on it" hold. The user picks endsAt and a reason.
// status: waiting -> ended (timer is over and the notification went out) -> done (the user answered).
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

    reason: {
      type: String,
      enum: ['better-price', 'wait-for-sale', 'not-sure-i-need-it', 'other'],
      default: null
    },

    reasonNote: {
      type: String,
      trim: true,
      default: null
    },

    status: {
      type: String,
      enum: ['waiting', 'ended', 'done'],
      default: 'waiting'
    },

    decision: {
      type: String,
      enum: ['buy', 'skip'],
      default: null
    }
  },
  {
    versionKey: false
  }
)

// The timer job finds waiting holds whose time is up.
sleepHoldSchema.index({ status: 1, endsAt: 1 })

const SleepHold = mongoose.model('SleepHold', sleepHoldSchema, 'sleepHolds')

export default SleepHold
