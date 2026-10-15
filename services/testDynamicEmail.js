
import 'dotenv/config'
import dns from 'node:dns'
import mongoose from 'mongoose'
import User from '../models/user-model.js'
import { sendPriceAlertEmail } from './emailServices.js'

// Temporary DNS workaround
dns.setServers(['8.8.8.8', '1.1.1.1'])

try {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB connected successfully!')

  // Find the FastDeal account using TEST_EMAIL
  const testEmail = process.env.TEST_EMAIL?.toLowerCase().trim()

  if (!testEmail) {
    throw new Error('TEST_EMAIL is missing in .env')
  }

  const user = await User.findOne({
    email: testEmail
  })

  if (!user) {
    throw new Error('FastDeal account not found in MongoDB')
  }

  // Check email notification preference
  if (!user.emailAlertsOn) {
    console.log('Email notifications are disabled')
  } else {
    console.log('FastDeal account found!')
    console.log('Sending to registered account:', user.email)

    // Mock product information for testing
    await sendPriceAlertEmail({
      email: user.email,
      productName: 'Sony WH-1000XM5',
      savedPrice: 489,
      currentPrice: 429,
      store: 'Demo Store',
      productLink: 'https://example.com',
      alertType: 'drop'
    })

    console.log('Test email submitted successfully!')
  }

} catch (error) {
  console.error('Dynamic email test failed:', error.message)
} finally {
  await mongoose.disconnect()
}
