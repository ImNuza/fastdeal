import mongoose from 'mongoose'

// One row per Firebase account. The password stays in Firebase.
const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    // Friends find each other by username. Empty until the user picks one.
    username: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_.]{3,20}$/
    },

    emailAlertsOn: {
      type: Boolean,
      default: true
    },

    // Shown only to accepted friends who saved the same product (Buy Together).
    // Stored without "@". null = not set.
    telegramUsername: {
      type: String,
      trim: true,
      default: null,
      match: /^[A-Za-z0-9_]{5,32}$/
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },

    // Plan a budget drafts on the Wishlist page, newest first: each has a name, the budget, and the
    // ticked items in priority order (item names, 1 first), so plans are still there next time.
    // pick is the combination on screen when it was saved, with the prices and stores it had then,
    // shown again as it was on reopen.
    budgetDrafts: [
      {
        name: { type: String, trim: true, maxlength: 60 },
        amount: { type: Number, default: null },
        items: { type: [String], default: [] },
        pick: [
          {
            _id: false,
            name: String,
            price: Number,
            store: String,
            rank: Number
          }
        ],
        savedAt: { type: Date, default: Date.now }
      }
    ],

    // The user's own last 10 searches, newest first. Keep it at 10 with $push, $position 0 and $slice 10.
    recentSearches: [
      {
        _id: false,
        query: String,
        productKey: String,
        searchedAt: Date
      }
    ],

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    versionKey: false
  }
)

// No two users with one username. Users with no username are not checked.
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
)

const User = mongoose.model('User', userSchema, 'users')

export default User
