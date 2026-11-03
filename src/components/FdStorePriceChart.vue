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
      scales: {
        x: { beginAtZero: true, ticks: { maxTicksLimit: 6, callback: function (value) { return 'S$' + value } } },
        y: { grid: { display: false } }
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
