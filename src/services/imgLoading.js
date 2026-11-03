// v-img-loading on a product photo: a soft shimmer in its box (fd-img-loading in app.css) until the
// photo has loaded or failed. Registered app-wide in main.js. A new src starts the shimmer again.
function watchImage(el) {
  if (el.complete && el.naturalWidth > 0) {
    el.classList.remove('fd-img-loading')
    return
  }
  el.classList.add('fd-img-loading')
}

function done(event) {
  event.currentTarget.classList.remove('fd-img-loading')
}

export const imgLoading = {
  mounted(el) {
    el.addEventListener('load', done)
    el.addEventListener('error', done)
    watchImage(el)
  },
  updated(el, binding, vnode, oldVnode) {
    if (vnode.props && oldVnode.props && vnode.props.src !== oldVnode.props.src) {
      watchImage(el)
    }
  },
  beforeUnmount(el) {
    el.removeEventListener('load', done)
    el.removeEventListener('error', done)
  }
}
