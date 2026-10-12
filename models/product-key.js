// One rule for productKey, used by every collection that stores a product.
// "  Sony  WH-1000XM5 " -> "sony wh-1000xm5"
export function toProductKey(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ')
}
