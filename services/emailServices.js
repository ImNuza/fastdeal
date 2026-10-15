
import nodemailer from 'nodemailer'

// Create the email connection
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
})

// Send a price alert email
export async function sendPriceAlertEmail({
    email,
    productName,
    savedPrice,
    currentPrice,
    store,
    productLink,
    alertType
}) {
    const subject = alertType === 'target'
        ? `FastDeal: Target price reached for ${productName}`
        : `FastDeal: Price drop alert for ${productName}`

    const message = `
Hello!

A product on your FastDeal wishlist has triggered a price alert.

Product: ${productName}
Saved price: S$${Number(savedPrice).toFixed(2)}
Current price: S$${Number(currentPrice).toFixed(2)}
Store: ${store}

View product:
${productLink}

FastDeal Team
`

    const result = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject,
        text: message
    })

    console.log('Email accepted by SMTP server:', result.messageId)

    return result
}
