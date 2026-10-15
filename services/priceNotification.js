import User from '../models/user-model.js'
import WishlistItem from '../models/wishlist-item-model.js'
import { sendPriceAlertEmail } from './emailServices.js'

// Send an alert for a specific wishlist record.
// Call only after a price-check job detects a new alert.
export async function notifyWishlistOwner(itemId) {
  // 1. Retrieve the saved product from MongoDB
  const item = await WishlistItem.findById(itemId)

  if (!item) {
    return { sent: false, reason: 'Wishlist item not found' }
  }

  // 2. Find the user who saved this product
  const user = await User.findOne({
    firebaseUid: item.firebaseUid
  })

  if (!user) {
    return { sent: false, reason: 'User not found' }
  }

  // 3. Check user email preferences
  if (!user.emailAlertsOn || !user.email) {
    return { sent: false, reason: 'Emails disabled' }
  }

  // 4. Check if the item currently has an alert
  if (!['drop', 'target'].includes(item.flag)) {
    return { sent: false, reason: 'No active alert' }
  }

  // 5. Ensure updated price information is available
  if (
    !Number.isFinite(item.latestPrice) ||
    item.latestPrice < 0
  ) {
    return { sent: false, reason: 'Invalid latest price' }
  }

  // 6. Send email to the actual user
  const result = await sendPriceAlertEmail({
    email: user.email,
    productName: item.productName,
    savedPrice: item.savedPrice,
    currentPrice: item.latestPrice,
    store: item.latestStore || 'Unknown store',
    productLink: item.latestLink || '',
    alertType: item.flag
  })

  // 7. Record the successful SMTP submission
  item.lastEmailAt = new Date()
  await item.save()

  return {
    sent: true,
    messageId: result.messageId
  }
}
