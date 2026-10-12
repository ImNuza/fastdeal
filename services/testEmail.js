import 'dotenv/config'
import { sendPriceAlertEmail } from './emailServices.js'

try {
  await sendPriceAlertEmail({
    email: process.env.TEST_EMAIL,
    productName: 'Sony WH-1000XM5',
    savedPrice: 498,
    currentPrice: 429,
    store: 'Demo Store',
    productLink: 'https://example.com',
    alertType: 'drop'
  })

  console.log('Test email submitted successfully!')
} catch (error) {
  console.error('Error sending email:', error.message)
}