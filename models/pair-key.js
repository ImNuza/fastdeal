// One key per pair of users, the same whoever sent the request.
// Example: toPairKey('zoe', 'marvel') and toPairKey('marvel', 'zoe') both give 'marvel|zoe'.
export function toPairKey(uidA, uidB) {
  return [uidA, uidB].sort().join('|')
}
