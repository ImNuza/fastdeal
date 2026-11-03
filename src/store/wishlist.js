import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { toProductKey } from '../../models/product-key.js'
import { user, firebaseUser, findSaved } from './auth.js'
import { fetchCheapestLiveListing } from '../services/livePriceService.js'
import { planBudget } from '../services/budgetPlanner.js'
import { createBudget, updateBudget, deleteBudget } from '../services/userApi.js'

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------
// A price drop worth flagging: some store now sells it for at least 10% less than the saved price.
// Smaller drops are left out so the tag only shows for real savings.
const DROP_PERCENT = 10

// ---------------------------------------------------------------
// Helpers (they do not use the store's own state)
// ---------------------------------------------------------------
// user.value.wishlist is the in-memory copy. Every change updates it at once, then is written
// to MongoDB through /api/wishlist. Writes run one after another.
// waiting holds the saves not sent yet, oldest first. sending is true while the loop in write()
// is sending them. So Sleep on it never reaches the server before the save that creates the item.
const waiting = []
let sending = false

// Restore the actual server data after a write fails.
async function reloadWishlist() {
  const res = await axios.get('/api/wishlist', { quiet: true })
  if (user.value) user.value.wishlist = res.data
}

// request is a function that makes the axios call. Every save goes into the array, and one loop
// sends them one by one. A failed save is logged and the wishlist reloads, so the next save still goes.
async function write(request) {
  waiting.push(request)
  // A loop is already sending: it sends this save after the ones before it.
  if (sending) return
  sending = true
  while (waiting.length > 0) {
    const next = waiting.shift()
    try {
      await next()
    } catch (err) {
      console.error('[Wishlist] Could not save the change:', err)
      // Not awaited, so the next save does not wait for this reload.
      if (user.value) {
        reloadWishlist()
      }
    }
  }
  sending = false
}

function keyPath(item) {
  return '/api/wishlist/' + encodeURIComponent(toProductKey(item.name))
}

// Sleep on it: when a countdown ends, tell the server once so it can notify the user.
const pendingSleepNotifications = new Set()
const completedSleepNotifications = new Set()

async function checkExpiredSleepTimers() {
  const currentUser = user.value
  const uid = firebaseUser.value?.uid

  if (!currentUser || !uid) return

  const currentTime = Date.now()

  for (const item of currentUser.wishlist || []) {
    const expiry = Number(item.sleepUntil)
    const startingPrice = Number(item.sleepPriceAtStart)

    // Only check completed countdowns with a valid starting price.
    if (
      !Number.isFinite(expiry) ||
      expiry <= 0 ||
      expiry > currentTime ||
      !Number.isFinite(startingPrice) ||
      startingPrice <= 0
    ) {
      continue
    }

    const key = `${uid}:${item.name}:${expiry}`

    if (
      pendingSleepNotifications.has(key) ||
      completedSleepNotifications.has(key)
    ) {
      continue
    }
    pendingSleepNotifications.add(key)
    try {
      // axios sends the login token (src/services/http.js). The server takes the uid from it.
      await axios.post('/api/notifications/sleep-ended', {
        productName: item.name,
        sleepUntil: expiry
      })
      completedSleepNotifications.add(key)
    } catch (error) {
      console.error('[Sleep On It] Notification failed:', error)
    } finally {
      pendingSleepNotifications.delete(key)
    }
  }
}

// Calculate the percentage change and purchase verdict
function verdictData(item, latest) {
  const start = Number(item.sleepPriceAtStart)

  if (
    !Number.isFinite(start) ||
    start <= 0 ||
    !Number.isFinite(latest) ||
    latest <= 0
  ) {
    return null
  }

  // Percentage change formula
  const percent = ((latest - start) / start) * 100

  // Absolute price difference
  const difference = latest - start

  let title = ''
  let message = ''

  if (percent <= -10) {
    title = 'A better deal is available!'
    message =
      'The cheapest matching listing found is at least 10% below your saved price. ' +
      'You may be able to save money by choosing this offer.'

  } else if (percent < 0) {
    title = 'A small saving is available'
    message =
      'The cheapest matching listing found is slightly cheaper than your saved price. ' +
      'Consider whether the savings are worthwhile.'

  } else if (percent === 0) {
    title = 'No better deal found yet'
    message =
      'The cheapest matching listing found is the same as your saved price.'

  } else {
    title = 'No cheaper deal found'
    message =
      'The cheapest matching listing found costs more than your saved price. ' +
      'Your original saved offer may still be better, if it remains available.'
  }

  return {
    start,
    latest,
    percent,
    difference,
    title,
    message
  }
}

function pickKey(list) {
  return (list || []).map(function (item) { return item.name }).sort().join('|')
}

// ---------------------------------------------------------------
// Wishlist store
// ---------------------------------------------------------------
export const useWishlistStore = defineStore('wishlist', () => {
  // ---------------------------------------------------------------
  // Clock: the view ticks this every 30 seconds so "left" timers stay current
  // ---------------------------------------------------------------
  const now = ref(Date.now())

  // ---------------------------------------------------------------
  // Wishlist
  // ---------------------------------------------------------------

  function saveProduct(name, listing, product) {
    if (!user.value || !listing || !(listing.price > 0)) {
      return
    }
    const info = product || {}
    const body = {
      name: name,
      store: listing.store,
      price: listing.price,
      productId: info.productId || null,
      q: info.q || null,
      image: info.image || null
    }
    const saved = findSaved(name, info.productId)
    if (saved) {
      if (saved.savedStore === listing.store) {
        return
      }
      saved.savedStore = listing.store
      saved.savedPrice = listing.price
      body.name = saved.name
    } else {
      user.value.wishlist.push({
        name: name,
        productKey: toProductKey(name),
        productId: body.productId,
        q: body.q,
        image: body.image,
        savedPrice: listing.price,
        savedStore: listing.store,
        targetPrice: null,
        targetSuggestion: null,
        savedAt: Date.now(),
        sleepUntil: 0,
        sleepPriceAtStart: null,
        sleepVerdictSeen: false
      })
    }
    // A new item's AI suggested target comes back from the server, as the target box's hint.
    write(async function () {
      const res = await axios.post('/api/wishlist', body)
      const item = findSaved(body.name, body.productId)
      if (item && res.data && !saved) {
        item.targetPrice = res.data.targetPrice
        item.targetSuggestion = res.data.targetSuggestion
        item.targetReason = res.data.targetReason
      }
    })
  }

  // The store a saved product was saved from, or '' if it is not saved or the store was not recorded.
  function savedFrom(name, productId) {
    const saved = findSaved(name, productId)
    return saved && saved.savedStore ? saved.savedStore : ''
  }

  function isSaved(name, productId) {
    return Boolean(findSaved(name, productId))
  }

  // The shopper's own target, or null. Every item also has a built-in alarm 10% under the price it
  // was saved at (DROP_PERCENT); an older target saved at exactly that line is that alarm, not the
  // shopper's own, so it does not show in the target box.
  // Same sum the old automatic target used, so those saved targets match it to the cent
  function dropLine(item) {
    return Math.round(Number(item.savedPrice) * (1 - DROP_PERCENT / 100) * 100) / 100
  }

  function ownTarget(item) {
    const target = Number(item.targetPrice)
    if (!(target > 0)) return null
    if (item.targetSource === 'user') return target
    return target === dropLine(item) ? null : target
  }

  async function setTarget(name, price) {
    const item = findSaved(name)

    if (!item) {
      throw new Error('Wishlist product not found')
    }

    const newTarget = Number(price)

    if (!Number.isFinite(newTarget) || newTarget < 0) {
      throw new Error('Invalid target price')
    }

    // An emptied box clears the target; the AI's suggestion stays as its hint.
    item.targetPrice = newTarget > 0 ? newTarget : null
    item.targetSource = newTarget > 0 ? 'user' : null

    return write(function () {
      return axios.patch(keyPath(item), {
        targetPrice: newTarget
      })
    })
  }

  // Ask the server to fill in AI suggested targets for saved items that have none yet, then show
  // them as the target boxes' hints. Quiet: a failure just leaves the boxes plain.
  async function fillSuggestions() {
    if (!user.value) return
    try {
      const res = await axios.post('/api/wishlist/suggest-targets', {}, { quiet: true })
      for (const row of res.data || []) {
        const item = (user.value.wishlist || []).find(function (w) { return w.productKey === row.productKey })
        if (item) {
          item.targetSuggestion = row.targetSuggestion
          item.targetReason = row.targetReason
        }
      }
    } catch (error) {
      // No suggestions this visit; the next visit asks again
    }
  }

  function removeSaved(name, productId) {
    const item = findSaved(name, productId)
    if (!item) {
      return
    }
    user.value.wishlist = user.value.wishlist.filter(function (other) { return other !== item })
    write(function () { return axios.delete(keyPath(item)) })
  }

  // Sleep on it: save the starting price and expiry time. The product must be saved first:
  // the caller saves it from a real store, so this never falls back to a made-up price.
  function sleepOn(name, hours, priceAtStart, productId) {
    const item = findSaved(name, productId)
    if (!item) {
      return
    }
    item.sleepUntil = Date.now() + hours * 3600000
    // The price when the user starts sleeping on it, for the verdict later
    item.sleepPriceAtStart = Number.isFinite(priceAtStart) && priceAtStart > 0 ? priceAtStart : null
    // Reset whether the user has viewed the verdict
    item.sleepVerdictSeen = false
    write(function () {
      return axios.patch(keyPath(item), {
        sleepUntil: item.sleepUntil,
        sleepPriceAtStart: item.sleepPriceAtStart,
        sleepVerdictSeen: false
      })
    })
  }

  // Remember when a user closes the verdict
  function markSleepVerdictSeen(name) {
    const item = findSaved(name)
    if (!item) {
      return
    }
    item.sleepVerdictSeen = true
    write(function () { return axios.patch(keyPath(item), { sleepVerdictSeen: true }) })
  }

  // Check whether a product is still sleeping
  function isAsleep(name, at = Date.now(), productId) {
    const item = findSaved(name, productId)
    if (!item) {
      return false
    }
    return Boolean(item.sleepUntil && item.sleepUntil > at)
  }

  // When the hold on this product ends, as a timestamp. 0 when it is not on hold.
  function sleepEndsAt(name, productId) {
    const item = findSaved(name, productId)
    return item && item.sleepUntil ? item.sleepUntil : 0
  }

  // Asleep as of the store clock
  function asleep(item) {
    return isAsleep(item.name, now.value)
  }

  // ---------------------------------------------------------------
  // Sleep on it: check for ended countdowns after login, when the wishlist changes, and every 30 seconds
  // ---------------------------------------------------------------

  // Check after login or when the wishlist changes.
  watch(
    [user, firebaseUser],
    () => {
      checkExpiredSleepTimers()
    },
    { immediate: true, deep: true }
  )

  // Also check while the user has FastDeal open.
  if (typeof window !== 'undefined') {
    window.setInterval(() => {
      checkExpiredSleepTimers()
    }, 30000)
  }

  // ---------------------------------------------------------------
  // Live prices (from WishlistView)
  // ---------------------------------------------------------------
  const livePrices = ref({})
  const liveLoading = ref({})
  const liveErrors = ref({})

  function best(item) {
    return livePrices.value[item.name] ?? null
  }

  // Asks the server to email the user when the target price is reached. A failed check is only logged.
  async function checkTarget(productKey) {
    try {
      await axios.post('/api/wishlist/' + encodeURIComponent(productKey) + '/check-target')
    } catch (error) {
      console.warn(
        '[Target email] Check failed:',
        error.response?.data?.error || error.message
      )
    }
  }

  async function loadLivePrice(name) {
    if (liveLoading.value[name]) return

    liveLoading.value[name] = true
    liveErrors.value[name] = ''

    try {
      // Find the saved product in MongoDB-backed wishlist state.
      const saved = user.value?.wishlist?.find(
        item => item.name === name
      )

      const listing = await fetchCheapestLiveListing(name, saved)

      // Display the best price in Wishlist.
      livePrices.value[name] = listing

      // Ask the backend to check (and alert) when the price reaches the shopper's own target or the
      // built-in alarm 10% under the saved price.
      const own = saved ? ownTarget(saved) : null
      if (
        saved &&
        saved.productKey &&
        ((own && listing.price <= own) || listing.price <= dropLine(saved))
      ) {
        // Not awaited, so the next price does not wait for the email check.
        checkTarget(saved.productKey)
      }
    } catch (error) {
      delete livePrices.value[name]
      liveErrors.value[name] = error.message || 'Price unavailable'
    } finally {
      liveLoading.value[name] = false
    }
  }


  function saving(item) {
    const listing = best(item)
    return listing ? Number(item.savedPrice) - listing.price : null
  }

  function cheaper(item) {
    const amount = saving(item)

    return amount !== null &&
      Number(item.savedPrice) > 0 &&
      (amount / Number(item.savedPrice)) * 100 >= DROP_PERCENT
  }

  function savingPercent(item) {
    const amount = saving(item)

    return amount === null || Number(item.savedPrice) <= 0
      ? 0
      : Math.round((amount / Number(item.savedPrice)) * 100)
  }

  function reached(item) {
    const listing = best(item)

    const own = ownTarget(item)
    return Boolean(listing && own && listing.price <= own)
  }

  // ---------------------------------------------------------------
  // Sleep on it - purchase verdict (from WishlistView)
  // ---------------------------------------------------------------
  const verdictItem = ref(null)
  const verdictLatestPrice = ref(null)
  const verdictLoading = ref(false)
  const verdictError = ref('')

  // Prevent an older API response from changing a newer verdict.
  let verdictRequestId = 0

  // Check whether the Sleep On It timer has expired
  function hasFinishedSleep(item) {
    return Boolean(
      item.sleepUntil &&
      item.sleepUntil <= now.value &&
      Number.isFinite(item.sleepPriceAtStart) &&
      item.sleepPriceAtStart > 0
    )
  }


  // Automatically calculate the currently displayed verdict
  const activeVerdict = computed(() => {
    return verdictItem.value
      ? verdictData(verdictItem.value, verdictLatestPrice.value)
      : null
  })

  // Open the Purchase Verdict pop-up
  async function openVerdict(item) {
    const requestId = ++verdictRequestId

    verdictItem.value = item
    verdictLatestPrice.value = null
    verdictLoading.value = true
    verdictError.value = ''

    try {
      // Get the cheapest comparable price from SerpApi
      const listing = await fetchCheapestLiveListing(item.name, item)

      // Ignore outdated responses if the dialog has changed
      if (requestId !== verdictRequestId) return

      verdictLatestPrice.value = listing.price
    } catch (error) {
      if (requestId !== verdictRequestId) return

      verdictError.value =
        error.message || 'Unable to retrieve the latest product price'

      console.error('[Sleep On It] Verdict price lookup failed:', error)
    } finally {
      if (requestId === verdictRequestId) {
        verdictLoading.value = false
      }
    }
  }

  // Close the pop-up and mark the verdict as viewed
  function closeVerdict() {
    // Invalidate any pending API response
    verdictRequestId++

    if (verdictItem.value) {
      markSleepVerdictSeen(verdictItem.value.name)
    }

    verdictItem.value = null
    verdictLatestPrice.value = null
    verdictLoading.value = false
    verdictError.value = ''
  }

  // ---------------------------------------------------------------
  // Plan a budget (from WishlistView)
  // Items on hold are left out, since they are still being slept on.
  // ---------------------------------------------------------------
  const budget = ref('')
  const included = ref([])
  const plan = ref(null)
  const planIndex = ref(0)
  const budgetError = ref('')

  const plannable = computed(function () {
    return user.value ? user.value.wishlist.filter(function (item) { return !asleep(item) }) : []
  })

  const heldCount = computed(function () {
    return user.value ? user.value.wishlist.length - plannable.value.length : 0
  })

  // Any change to the budget or the ticked items clears the old answer, so it never shows a stale mix.
  function clearPlan() {
    plan.value = null
    budgetError.value = ''
  }

  function findPlan() {
    const amount = Number(budget.value)
    if (!amount || amount <= 0) {
      budgetError.value = 'Enter a budget above S$0.'
      plan.value = null
      return
    }
    if (!included.value.length) {
      budgetError.value = 'Tick at least one item you want.'
      plan.value = null
      return
    }
    // Only the ticked items go into the search; nothing else from the wishlist is added.
    const selectedItems = plannable.value.filter(item =>
      rankOf(item.name) > 0
    )

    if (selectedItems.some(item => !best(item))) {
      budgetError.value =
        'Some selected products do not have live prices yet. Please retry their price lookup.'
      plan.value = null
      return
    }

    const items = selectedItems.map(item => {
      const listing = best(item)

      return {
        name: item.name,
        price: listing.price,
        store: listing.store,
        rank: included.value.indexOf(item.name) + 1
      }
    })
    plan.value = planBudget(items, amount, 5)
    planIndex.value = 0
    budgetError.value = ''
  }

  // On a reopened draft the saved combination is the only one on screen, so the first tap works
  // the plan out at today's prices and moves on to the one after it. If prices are not in yet,
  // the saved one stays with the error under it.
  function nextOption() {
    if (plan.value.saved) {
      const saved = plan.value
      const key = pickKey(saved.options[0].items)
      findPlan()
      if (!plan.value) {
        plan.value = saved
        return
      }
      if (!plan.value.options.length) return
      const index = plan.value.options.findIndex(function (opt) { return pickKey(opt.items) === key })
      planIndex.value = (index + 1) % plan.value.options.length
      return
    }
    planIndex.value = (planIndex.value + 1) % plan.value.options.length
  }

  const option = computed(function () {
    return plan.value && plan.value.options.length ? plan.value.options[planIndex.value] : null
  })

  // Ticked items are ranked by their place in included: ticking one adds it at the bottom,
  // and picking a number moves it to that place, so no two share a rank.
  function rankOf(name) {
    return included.value.indexOf(name) + 1
  }

  function setRank(name, event) {
    const list = included.value.filter(function (other) { return other !== name })
    list.splice(Number(event.target.value) - 1, 0, name)
    included.value = list
    clearPlan()
  }

  // The picked items in priority order. Only ticked items are planned, so every one has a rank.
  const pickedItems = computed(function () {
    if (!option.value) {
      return []
    }
    return option.value.items.slice().sort(function (a, b) {
      return a.rank - b.rank
    })
  })

  // Ticked items that did not make it into this option, when they could not all fit together.
  const missedItems = computed(function () {
    if (!option.value) {
      return []
    }
    return included.value.filter(function (name) {
      return !option.value.items.some(function (item) { return item.name === name })
    })
  })

  // Budget drafts: named plans saved on the account, newest first. editingId is the draft open in
  // the planner: null for a new budget not saved yet. Opening a draft keeps only items still on
  // the wishlist and not on hold.
  const drafts = computed(function () { return user.value?.budgetDrafts || [] })
  const editing = ref(false)
  const editingId = ref(null)
  const draftName = ref('')
  const draftSaving = ref(false)
  const draftError = ref('')

  const editingDraft = computed(function () {
    return drafts.value.find(function (d) { return d._id === editingId.value }) || null
  })

  function startDraft(draft) {
    editing.value = true
    editingId.value = draft ? draft._id : null
    draftName.value = draft ? draft.name : ''
    budget.value = draft && draft.amount !== null && draft.amount !== undefined ? String(draft.amount) : ''
    included.value = draft
      ? (draft.items || []).filter(function (name) {
          return plannable.value.some(function (item) { return item.name === name })
        })
      : []
    draftError.value = ''
    clearPlan()
    if (draft && draft.pick && draft.pick.length) showSavedPick(draft)
  }

  // Reopening a draft shows the combination as it was saved, with the prices and stores it had
  // then, without working it out again. Find best combination works it out at today's prices.
  function showSavedPick(draft) {
    const items = draft.pick.filter(function (item) { return item && typeof item.name === 'string' })
    if (!items.length) return
    const spent = items.reduce(function (sum, item) { return sum + item.price }, 0)
    plan.value = {
      saved: true,
      mustFits: true,
      mustTotal: spent,
      options: [{ items: items, total: spent, left: (draft.amount || 0) - spent }]
    }
    planIndex.value = 0
  }

  // The combination on screen, saved with the draft
  const pickItems = computed(function () {
    return option.value
      ? option.value.items.map(function (item) {
          return { name: item.name, price: item.price, store: item.store, rank: item.rank }
        })
      : []
  })


  function closeDraft() {
    editing.value = false
    editingId.value = null
    draftError.value = ''
    clearPlan()
  }

  // True when what is on screen differs from the saved draft (always true for a new one),
  // including trying another combination
  const draftChanged = computed(function () {
    const d = editingDraft.value
    if (!d) return true
    const amount = budget.value === '' ? null : Number(budget.value)
    return draftName.value.trim() !== d.name || amount !== d.amount ||
      included.value.join('|') !== (d.items || []).join('|') ||
      (plan.value !== null && pickKey(pickItems.value) !== pickKey(d.pick))
  })

  async function saveDraft() {
    if (!draftName.value.trim()) {
      draftError.value = 'Give the budget a name.'
      return
    }
    draftSaving.value = true
    draftError.value = ''
    const body = {
      name: draftName.value.trim(),
      amount: budget.value === '' ? null : Number(budget.value),
      items: included.value,
      pick: pickItems.value
    }
    try {
      const data = editingId.value ? await updateBudget(editingId.value, body) : await createBudget(body)
      if (user.value) user.value.budgetDrafts = data.drafts
      editingId.value = data.id
    } catch (err) {
      draftError.value = err.response?.data?.error || 'Could not save the budget. Try again.'
    } finally {
      draftSaving.value = false
    }
  }

  // Once a budget is saved, every combination it shows after that (Find best combination or Try
  // another combination) is saved to it straight away, so the draft always holds the last one seen.
  // A change made while a save is running is saved right after it.
  let saveAgain = false

  async function autoSaveDraft() {
    if (draftSaving.value) {
      saveAgain = true
      return
    }
    await saveDraft()
    if (saveAgain) {
      saveAgain = false
      if (editingId.value && plan.value && !plan.value.saved && draftChanged.value) await autoSaveDraft()
    }
  }

  watch(option, function () {
    if (editingId.value && plan.value && !plan.value.saved && draftChanged.value) autoSaveDraft()
  })

  async function removeDraft(id) {
    try {
      const data = await deleteBudget(id)
      if (user.value) user.value.budgetDrafts = data.drafts
      if (editingId.value === id) closeDraft()
    } catch (err) {
      draftError.value = err.response?.data?.error || 'Could not delete the budget. Try again.'
    }
  }

  // The cheapest ticked item, for the "Nothing fits" message.
  function cheapestPlannable() {
    return plannable.value
      .filter(item => rankOf(item.name) > 0 && best(item))
      .reduce((low, item) => {
        return !low || best(item).price < best(low).price
          ? item
          : low
      }, null)
  }

  // ---------------------------------------------------------------
  // Friends who saved the same product + Buy Together pop-up
  // ---------------------------------------------------------------
  const friendOverlap = ref({})
  const buyItem = ref(null)
  const selected = ref([])
  const inviting = ref(false)
  const inviteSent = ref(false)
  const error = ref('')

  async function fetchFriendOverlap() {
    try {
      const res = await axios.get('/api/wishlist/friends')
      friendOverlap.value = res.data
    } catch (err) {
      friendOverlap.value = {}
    }
  }

  function friendsFor(productKey) {
    return friendOverlap.value[productKey] || []
  }

  function allInvited(productKey) {
    const friends = friendsFor(productKey)
    return friends.length > 0 && friends.every(function (f) { return f.invited })
  }

  function openBuyTogether(item) {
    buyItem.value = item
    // Nobody ticked to start, so inviting one friend now and others later is the normal path
    selected.value = []
    inviteSent.value = false
    error.value = ''
  }

  function closeBuyTogether() {
    buyItem.value = null
  }

  async function sendInvites() {
    if (!buyItem.value || !selected.value.length) return
    inviting.value = true
    error.value = ''
    try {
      await axios.post('/api/buy-together/invite', {
        friendUids: selected.value,
        productKey: buyItem.value.productKey
      })
      inviteSent.value = true
      selected.value = []
      await fetchFriendOverlap()
    } catch (err) {
      error.value = err.response?.data?.error || 'Could not send invites. Try again.'
    } finally {
      inviting.value = false
    }
  }

  return {
    now,
    saveProduct, savedFrom, isSaved, setTarget, ownTarget, removeSaved, fillSuggestions,
    sleepOn, isAsleep, sleepEndsAt, asleep,
    liveLoading, liveErrors, best, loadLivePrice, saving, cheaper, savingPercent, reached,
    verdictItem, verdictLoading, verdictError, hasFinishedSleep, activeVerdict,
    openVerdict, closeVerdict,
    budget, included, plan, planIndex, budgetError, plannable, heldCount, clearPlan, findPlan,
    nextOption, option, rankOf, setRank, pickedItems, missedItems, cheapestPlannable,
    drafts, editing, editingDraft, draftName, draftSaving, draftError, draftChanged,
    startDraft, closeDraft, saveDraft, removeDraft,
    buyItem, selected, inviting, inviteSent, error,
    fetchFriendOverlap, friendsFor, allInvited, openBuyTogether, closeBuyTogether, sendInvites
  }
})
