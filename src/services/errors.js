// Every error page the app can show. Add a new one here: its code, a short title, and what the
// person should know. retry adds a Try again button, for errors a reload might fix.
const ERRORS = {
  404: { title: 'Page not found', message: 'The page you are looking for does not exist or has moved.' },
  403: { title: 'Access denied', message: 'You do not have permission to view this page.' },
  405: { title: 'Action not allowed', message: 'That action is not supported here.' },
  500: { title: 'Server error', message: 'Something broke on our side. Please try again in a moment.', retry: true },
  502: { title: 'Server error', message: 'Something broke on our side. Please try again in a moment.', retry: true },
  503: { title: 'Service unavailable', message: 'FastDeal is temporarily down. Please try again shortly.', retry: true },
  504: { title: 'Server took too long', message: 'FastDeal did not answer in time. Please try again.', retry: true },
  offline: { title: 'No connection', message: 'Check your internet connection and try again.', retry: true }
}

const FALLBACK = { title: 'Something went wrong', message: 'Please try again in a moment.' }

// The big text at the top: the code itself, except offline, which has no number.
export function errorInfo(code) {
  const info = ERRORS[code] || FALLBACK
  return { label: code === 'offline' ? 'Oops' : String(code), ...info }
}
