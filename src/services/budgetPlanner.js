// Budget planner: finds the best mix of wishlist items that fits a budget.
//
// items: [{ name, price, store, rank }]. rank 1, 2, 3... marks a must have, 1 the highest priority;
// rank 0 means not a must have.
// 1. Every mix of items that fits the budget is tried. A mix is a set, so the same items in a
//    different order never count twice.
// 2. Options are ranked by must haves kept, highest priority first (keeping #1 beats keeping
//    #2 and #3 together), then by how many items they hold, then by how much of the budget they use.
// 3. So the first option is the best one, and the rest are the next best mixes to shuffle through,
//    such as dropping the lowest priority item.

// 2^16 mixes is about 65,000, which is instant. Past that, only the 16 cheapest items are mixed,
// with must haves always among them.
const MAX_MIXED = 16

function total(list) {
  return list.reduce(function (sum, item) { return sum + item.price }, 0)
}

// Compares the must haves two mixes keep, highest priority first: the first rank one keeps
// and the other does not decides it. Negative means a is better.
function compareMust(a, b, mustLength) {
  for (let rank = 1; rank <= mustLength; rank++) {
    const inA = a.some(function (item) { return item.rank === rank })
    const inB = b.some(function (item) { return item.rank === rank })
    if (inA !== inB) {
      return inA ? -1 : 1
    }
  }
  return 0
}

export function planBudget(items, budget, limit) {
  const must = items.filter(function (item) { return item.rank > 0 })
  const mustTotal = total(must)
  const mustFits = mustTotal <= budget

  const pool = items
    .slice()
    .sort(function (a, b) { return (b.rank > 0 ? 1 : 0) - (a.rank > 0 ? 1 : 0) || a.price - b.price })
    .slice(0, MAX_MIXED)

  const options = []
  for (let mask = 1; mask < 1 << pool.length; mask++) {
    const picked = pool.filter(function (item, i) { return mask & (1 << i) })
    const spent = total(picked)
    if (spent <= budget) {
      options.push({ items: picked, total: spent, left: budget - spent })
    }
  }

  options.sort(function (a, b) {
    return compareMust(a.items, b.items, must.length) || b.items.length - a.items.length || b.total - a.total
  })

  return {
    mustFits: mustFits,
    mustTotal: mustTotal,
    options: options.slice(0, limit)
  }
}
