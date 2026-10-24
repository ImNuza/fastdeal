import Friendship from '../models/friendship-model.js'
import Notification from '../models/notification-model.js'
import { toProductKey } from '../models/product-key.js'
import User from '../models/user-model.js'
import WishlistItem from '../models/wishlist-item-model.js'

// Accepted friends of myUid who saved the same product. Read live, so a friend who
// removed the item or the friendship drops out. Empty unless myUid saved it too.
export async function findBuyTogetherFriends(myUid, productKey) {
  const mine = await WishlistItem.exists({ firebaseUid: myUid, productKey })
  if (!mine) return []

  const rows = await Friendship.find({
    $or: [{ requesterUid: myUid }, { addresseeUid: myUid }],
    status: 'accepted'
  })
  const friendUids = rows.map(function (row) {
    return row.requesterUid === myUid ? row.addresseeUid : row.requesterUid
  })
  if (!friendUids.length) return []

  const saved = await WishlistItem.find({ firebaseUid: { $in: friendUids }, productKey }).select('firebaseUid')
  if (!saved.length) return []

  const users = await User.find({ firebaseUid: { $in: saved.map(function (item) { return item.firebaseUid }) } })
    .select('-_id firebaseUid username telegramUsername')
  return users.map(function (user) {
    return { firebaseUid: user.firebaseUid, username: user.username, telegramUsername: user.telegramUsername || null }
  })
}

// One "group-order" alert for the user whose timer ended. The friends get nothing.
// fromUid stays null, which tells it apart from a group order invite sent by a friend.
export async function notifyBuyTogether(myUid, productName) {
  const productKey = toProductKey(productName)
  const friends = await findBuyTogetherFriends(myUid, productKey)
  if (!friends.length) return

  const names = friends.map(function (friend) { return friend.username }).join(', ')
  await Notification.create({
    firebaseUid: myUid,
    type: 'group-order',
    title: 'Buy together?',
    body: `${names} also saved ${productName}. Order together to split the shipping.`,
    link: '/notifications',
    productKey
  })
}
