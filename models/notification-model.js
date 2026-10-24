//import { type } from 'firebase/firestore/pipelines'
import mongoose from 'mongoose'

// One alert for one user. The Notifications page lists these, newest first.
// readAt null = unread. emailedAt is set when an email also went out, so it is not sent twice.
const notificationSchema = new mongoose.Schema(
  {
    // The user who receives it
    firebaseUid: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ['price-drop', 'target-hit', 'sleep-ended', 'group-order', 'group-invite', 'friend-request', 'friend-accepted', 'sale-soon'],
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    body: {
      type: String,
      default: ''
    },

    // The page to open, for example "/sleep"
    link: {
      type: String,
      default: null
    },

    productKey: {
      type: String,
      default: null
    },

    // The user who caused it, for example the friend who sent a request. null for system alerts.
    fromUid: {
      type: String,
      default: null
    },

    readAt: {
      type: Date,
      default: null
    },

    emailedAt: {
      type: Date,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },
    
    read:{
      type:Boolean,
      default:false
    }
  },
  {
    versionKey: false
  }
)

// The Notifications page and the unread count.
notificationSchema.index({ firebaseUid: 1, createdAt: -1 })

notificationSchema.index(
  { firebaseUid: 1, type: 1, productKey: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'sleep-ended' }
  }
)

const Notification = mongoose.model('Notification', notificationSchema, 'notifications')

export default Notification
