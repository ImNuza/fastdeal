
import WishlistItem from '../models/wishlist-item-model.js'
import User from '../models/user-model.js'
import { search } from '../models/shoppingapimodel.js'
import { sendPriceAlertEmail } from './emailServices.js'

// Exclude accessories that should not be compared with full products.
const excluded =
  /\b(case only|phone case|cover only|ear pads?|earpads|replacement|spare parts?|screen protector|charging cable|cable only|accessory)\b/i

function normalise(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Match products using the same basic rules as Best Now.
function comparable(productName, listing) {
  if (!listing || typeof listing !== 'object') {
    return false
  }

  const price = Number(listing.price)

  if (!Number.isFinite(price) || price <= 0) {
    return false
  }

  if (excluded.test(listing.name)) {
    return false
  }

  const requestedWords = normalise(productName)
    .split(' ')
    .filter(Boolean)

  const listingWords = normalise(listing.name)
    .split(' ')
    .filter(Boolean)

  return (
    requestedWords.length > 0 &&
    requestedWords.every(word => listingWords.includes(word))
  )
}

// Limit repeated server-side price searches to once per 30 minutes.
const RECHECK_MS = 30 * 60 * 1000

export async function checkTargetPrice(uid, productKey) {
  // 1. Retrieve the saved product belonging to this user.
  const existing = await WishlistItem.findOne({
    firebaseUid: uid,
    productKey
  })

  if (!existing) {
    return {
      checked: false,
      reason: 'not-found'
    }
  }

  const target = Number(existing.targetPrice)

  if (!Number.isFinite(target) || target <= 0) {
    return {
      checked: false,
      reason: 'no-target'
    }
  }

  // Do not email twice for the same target threshold.
  if (existing.targetEmailFor === target) {
    return {
      checked: false,
      reason: 'already-alerted'
    }
  }

  // 2. Reserve a price check to prevent simultaneous requests.
  const checkedBefore = new Date(Date.now() - RECHECK_MS)

  const claimed = await WishlistItem.findOneAndUpdate(
    {
      _id: existing._id,
      firebaseUid: uid,
      targetPrice: target,
      targetEmailFor: { $ne: target },
      $or: [
        { lastCheckedAt: null },
        { lastCheckedAt: { $exists: false } },
        { lastCheckedAt: { $lte: checkedBefore } }
      ]
    },
    {
      $set: {
        lastCheckedAt: new Date()
      }
    },
    {
      new: true
    }
  )

  if (!claimed) {
    return {
      checked: false,
      reason: 'recently-checked'
    }
  }

  // 3. Retrieve and verify prices using the backend search service.
  let listing

  try {
    const data = await search(claimed.productName)

    const matches = (data?.listings || []).filter(row =>
      comparable(claimed.productName, row)
    )

    if (!matches.length) {
      return {
        checked: true,
        reached: false,
        reason: 'no-comparable-listings'
      }
    }

    // Choose the cheapest comparable listing.
    listing = matches.reduce((lowest, item) =>
      Number(item.price) < Number(lowest.price)
        ? item
        : lowest
    )
  } catch (error) {
    // Allow retry if retrieving the price fails.
    // Only clear this check if its target has not changed.
    await WishlistItem.updateOne(
      {
        _id: claimed._id,
        targetPrice: target
      },
      {
        $set: {
          lastCheckedAt: null
        }
      }
    )

    throw error
  }

  const currentPrice = Number(listing.price)

  // 4. Update MongoDB only if the target has not changed
  // while the price search was running.
  const priceUpdate = await WishlistItem.updateOne(
    {
      _id: claimed._id,
      firebaseUid: uid,
      targetPrice: target
    },
    {
      $set: {
        latestPrice: currentPrice,
        latestStore: listing.store || '',
        latestLink: listing.link || '',
        flag: currentPrice <= target ? 'target' : 'none'
      }
    }
  )

  if (priceUpdate.matchedCount === 0) {
    return {
      checked: false,
      reason: 'target-changed'
    }
  }

  // 5. Stop if the current price is still above the target.
  if (currentPrice > target) {
    return {
      checked: true,
      reached: false,
      price: currentPrice
    }
  }

  // 6. Retrieve the actual email address from MongoDB.
  const owner = await User.findOne({
    firebaseUid: uid
  })

  if (!owner?.emailAlertsOn || !owner?.email) {
    return {
      checked: true,
      reached: true,
      sent: false,
      reason: 'email-disabled'
    }
  }

  // Make sure Gmail SMTP is configured.
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD ||
    !process.env.SMTP_FROM
  ) {
    return {
      checked: true,
      reached: true,
      sent: false,
      reason: 'smtp-not-configured'
    }
  }

  // 7. Atomically claim this target before sending the email.
  // Only one request can claim the same target threshold.
  const emailClaim = await WishlistItem.findOneAndUpdate(
    {
      _id: claimed._id,
      firebaseUid: uid,
      targetPrice: target,
      targetEmailFor: { $ne: target }
    },
    {
      $set: {
        targetEmailFor: target
      }
    },
    {
      new: true
    }
  )

  if (!emailClaim) {
    return {
      checked: false,
      sent: false,
      reason: 'target-changed-or-already-alerted'
    }
  }

  // 8. Send the price alert email.
  try {
    await sendPriceAlertEmail({
      email: owner.email,
      productName: claimed.productName,
      savedPrice: claimed.savedPrice,
      currentPrice,
      store: listing.store || 'Unknown store',
      productLink: listing.link || '',
      alertType: 'target',
      targetPrice: target
    })
  } catch (error) {
    // Gmail rejected the send or the SMTP operation failed.
    // Release the claim so a future attempt can retry.
    try {
      await WishlistItem.updateOne(
        {
          _id: claimed._id,
          firebaseUid: uid,
          targetPrice: target,
          targetEmailFor: target
        },
        {
          $set: {
            targetEmailFor: null,
            lastCheckedAt: null
          }
        }
      )
    } catch (dbError) {
      console.error(
        '[Target email] Could not reset failed email claim:',
        dbError
      )
    }

    throw error
  }

  // 9. Email was accepted by the SMTP server.
  // Keep targetEmailFor even if recording lastEmailAt fails.
  try {
    await WishlistItem.updateOne(
      {
        _id: claimed._id,
        firebaseUid: uid,
        targetPrice: target,
        targetEmailFor: target
      },
      {
        $set: {
          lastEmailAt: new Date()
        }
      }
    )
  } catch (error) {
    console.error(
      '[Target email] Email accepted, but timestamp update failed:',
      error
    )
  }

  console.log(
    '[Target email] Sent:',
    claimed.productName,
    'to',
    owner.email
  )

  return {
    checked: true,
    reached: true,
    sent: true,
    price: currentPrice,
    targetPrice: target
  }
}
