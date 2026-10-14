import mongoose from 'mongoose'

// One row per pair of users. Both users read the same row, so nothing needs to stay in sync.
// Request = insert. Accept = status "accepted". Remove = delete the row.
// Block = status "blocked" and blockedByUid. Only that user can unblock.
const friendshipSchema = new mongoose.Schema(
  {
    requesterUid: {
      type: String,
      required: true
    },

    addresseeUid: {
      type: String,
      required: true
    },

    // Both uids sorted and joined with "|". Use toPairKey in models/pair-key.js.
    pairKey: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending'
    },

    blockedByUid: {
      type: String,
      default: null
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },

    respondedAt: {
      type: Date,
      default: null
    }
  },
  {
    versionKey: false
  }
)

// One row per pair. Stops a second request when the other user already asked.
friendshipSchema.index({ pairKey: 1 }, { unique: true })

// "Requests I sent" and "requests sent to me", and the friends list.
friendshipSchema.index({ requesterUid: 1, status: 1 })
friendshipSchema.index({ addresseeUid: 1, status: 1 })

const Friendship = mongoose.model('Friendship', friendshipSchema, 'friendships')

export default Friendship
