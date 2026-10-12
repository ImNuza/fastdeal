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

    emailAlertsOn: {
      type: Boolean,
      default: true
    },

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

const User = mongoose.model('User', userSchema, 'users')

export default User
