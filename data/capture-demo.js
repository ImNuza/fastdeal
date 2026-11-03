// Saves the demo searches and their product pages to data/demo-searches.json. Run once:
//   node data/capture-demo.js
// Uses SerpApi: about 1 to 2 searches per demo search, plus 1 per product page (about 90 in all).
// A search or product page still in the cache uses no credit. After this, npm run seed writes the file
// into searchCache and productCache, so the demo never calls SerpApi again.
// Needs MONGODB_URI, SERPAPI_API_KEY and GEMINI_API_KEY in .env.
import 'dotenv/config'
import { writeFileSync } from 'fs'
import mongoose from 'mongoose'
import ProductCache from '../models/product-cache-model.js'
import SearchCache from '../models/search-cache-model.js'
import { toProductKey } from '../models/product-key.js'
import { search } from '../models/shoppingapimodel.js'
import { getProduct } from '../services/productService.js'
import { sgDay } from '../services/priceHistory.js'

// Type these exactly in the search bar to get a demo search (case and extra spaces do not matter)
const DEMO_SEARCHES = [
  'Apple iPhone 16 Pro',
  'Sony WH-1000XM5 wireless headphones',
  'Owala bottle',
  'Dyson V15 Detect',
  'Nespresso Capsules 50 Pack',
  'Kindle Paperwhite',
  'Samsung Galaxy S25 Ultra'
]

// Fields that belong to the cache row, not to the data
function clean(row) {
  const copy = Object.assign({}, row)
  delete copy._id
  delete copy.expiresAt
  delete copy.demo
  return copy
}

async function capture() {
  const searches = []
  const pages = []
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    for (const q of DEMO_SEARCHES) {
      const result = await search(q)
      let saved = 0
      for (const listing of result.listings) {
        if (!listing.productId) continue
        try {
          await getProduct(listing.productId, q)
          const page = await ProductCache.findOne({ productId: listing.productId }).lean()
          if (page) {
            pages.push(clean(page))
            saved++
          }
        } catch (error) {
          console.error('No product page for "' + listing.name + '": ' + error.message)
        }
      }
      const row = await SearchCache.findOne({ queryKey: toProductKey(q) }).lean()
      searches.push(clean(row))
      console.log(q + ': ' + row.listings.length + ' listings, ' + saved + ' product pages')
    }
    const file = { capturedOn: sgDay(Date.now()), searches: searches, pages: pages }
    writeFileSync(new URL('./demo-searches.json', import.meta.url), JSON.stringify(file, null, 1) + '\n')
    console.log('Saved ' + searches.length + ' searches and ' + pages.length + ' product pages to data/demo-searches.json')
  } catch (error) {
    console.error('Capture failed:', error.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

capture()
