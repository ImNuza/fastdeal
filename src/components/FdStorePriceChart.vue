<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({ rows: Array })
const canvas = ref(null)
let chart = null


const height = computed(function () {
  return props.rows.length * 36 + 60 + 'px'
})

onMounted(function () {
  const css = getComputedStyle(document.documentElement)
  const muted = css.getPropertyValue('--fd-text-muted').trim() || '#585f3e'
  const line = css.getPropertyValue('--fd-grey-line').trim() || '#d4d1cb'
  const font = { family: css.getPropertyValue('--fd-font-body').trim() || 'sans-serif', size: 14 }
  const labels = []
  const prices = []
  const colors = []
  let cheapest = props.rows[0].total
  for (let i = 1; i < props.rows.length; i++) {
    if (props.rows[i].total < cheapest) {
      cheapest = props.rows[i].total
    }
  }
  for (let i = 0; i < props.rows.length; i++) {
    labels.push(props.rows[i].store)
    prices.push(props.rows[i].total)
    colors.push(props.rows[i].total === cheapest ? '#2f8f5b' : '#25508c')
  }
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: { labels: labels, datasets: [{ data: prices, backgroundColor: colors, borderRadius: 4 }] },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      // The app's body font and muted text colour, like the Price history chart
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: line },
          ticks: { maxTicksLimit: 6, color: muted, font: font, callback: function (value) { return 'S$' + value } }
        },
        y: { grid: { display: false }, ticks: { color: muted, font: font } }
      }
    }
  })
})

onBeforeUnmount(function () {
  if (chart) {
    chart.destroy()
  }
})
</script>

<template>
  <div :style="{ height: height }">
    <canvas ref="canvas"></canvas>
  </div>
</template>
