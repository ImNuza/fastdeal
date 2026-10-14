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
