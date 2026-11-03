<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Chart from 'chart.js/auto'
import { dayText } from '../services/format.js'

const props = defineProps({ points: Array })
const canvas = ref(null)
let chart = null

onMounted(function () {
  const labels = []
  const prices = []
  for (let i = 0; i < props.points.length; i++) {
    labels.push(dayText(props.points[i].day))
    prices.push(props.points[i].price)
  }
  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{ data: prices, borderColor: '#25508c', backgroundColor: '#25508c', borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0, cubicInterpolationMode: 'default' }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } },
        y: { border: { display: false }, ticks: { maxTicksLimit: 6, callback: function (value) { return 'S$' + value } } }
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
  <div class="fd-chart">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<style scoped>
.fd-chart {
  height: 300px;
}
</style>
