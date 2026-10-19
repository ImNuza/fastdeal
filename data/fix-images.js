// this file is created to generate dummy data for the trending page, not connected to the application

import 'dotenv/config'
import mongoose from 'mongoose'
import { getJson } from 'serpapi'
import SearchLog from '../models/search-log-model.js'
import { toProductKey } from '../models/product-key.js'

await mongoose.connect(process.env.MONGODB_URI)

const rows = await SearchLog.find()
for (const row of rows) {
  row.productName = row.query
  row.productKey = toProductKey(row.query)
  try {
    const json = await getJson({
      engine: 'google_shopping',
      q: row.query,
      hl: 'en',
      gl: 'sg',
      api_key: process.env.SERPAPI_API_KEY
    })
    const image = json.shopping_results?.find((r) => r.thumbnail)?.thumbnail
    if (image) {
      row.image = image
      console.log('Fixed ' + row.query)
    } else {
      console.log('No image found for ' + row.query)
    }
    await row.save()
  } catch (e) {
    console.log('Failed ' + row.query + ': ' + e.message)
    await row.save()
  }
}

await mongoose.disconnect()
console.log('Done')