<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js'

// Only the parts a horizontal bar chart with tooltips needs, not all of Chart.js
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

// rows: { store, total }, cheapest first. pick: the index of the shopper's pick in rows, or -1.
// tone: the AI verdict, 'buy' or 'wait', which colours the pick's bar like the verdict card.
const props = defineProps({
  rows: Array,
  pick: { type: Number, default: -1 },
  tone: { type: String, default: '' }
})
const canvas = ref(null)
let chart = null
let colours = null

const height = computed(function () {
  return props.rows.length * 36 + 60 + 'px'
})

// The app's own colours from tokens.css, read once the page has its styles
function readColours() {
  const css = getComputedStyle(document.documentElement)
  function token(name, fallback) {
    return css.getPropertyValue(name).trim() || fallback
  }
  return {
    blue: token('--fd-blue', '#27508a'),
    green: token('--fd-green', '#b3c77a'),
    vanilla: token('--fd-vanilla', '#fae8a4'),
    muted: token('--fd-text-muted', '#585f3e'),
    ink: token('--fd-ink', '#343b1b'),
    line: token('--fd-grey-line', '#d4d1cb'),
    font: token('--fd-font-body', 'sans-serif')
  }
}

// The pick's bar takes the verdict's colour: tea green for buy, vanilla for wait, and the muted
// olive while the AI is still deciding. Every other bar is brand blue.
function pickColour() {
  if (props.tone === 'buy') return colours.green
  if (props.tone === 'wait') return colours.vanilla
  return colours.muted
}

// Fewer price labels on a narrow chart, so "S$100" and "S$200" do not run together on phones
function tickLimit(width) {
  return width < 400 ? 4 : 6
}

function barColours() {
  return props.rows.map(function (row, i) {
    return i === props.pick ? pickColour() : colours.blue
  })
}

onMounted(function () {
  colours = readColours()
  const font = { family: colours.font, size: 14 }
  // Long store names are cut short so they fit beside the bars on phones; the tooltip shows the full one
  const labels = props.rows.map(function (row) {
    return row.store.length > 16 ? row.store.slice(0, 15) + '…' : row.store
  })
  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: props.rows.map(function (row) { return row.total }),
        backgroundColor: barColours(),
        // No outline or hover change on any bar: the pick stands out by its colour alone
        hoverBackgroundColor: barColours(),
        borderRadius: 4,
        maxBarThickness: 24
      }]
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      onResize: function (chart, size) {
        chart.options.scales.x.ticks.maxTicksLimit = tickLimit(size.width)
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (items) {
              const i = items[0].dataIndex
              return props.rows[i].store + (i === props.pick ? ' (your pick)' : '')
            },
            label: function (item) { return 'S$' + Number(item.raw).toFixed(2) }
          }
        }
      },
      // The app's body font and muted text colour, like the Price history chart
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: colours.line },
          ticks: {
            maxTicksLimit: tickLimit(canvas.value.parentNode.clientWidth), maxRotation: 0, color: colours.muted, font: font,
            callback: function (value) { return 'S$' + value }
          }
        },
        y: {
          grid: { display: false },
          // The pick's store name in bold ink, the rest muted
          ticks: {
            color: function (ctx) { return ctx.index === props.pick ? colours.ink : colours.muted },
            font: function (ctx) { return { family: colours.font, size: 14, weight: ctx.index === props.pick ? 700 : 400 } }
          }
        }
      }
    }
  })
})

// The verdict arrives after the chart is drawn, so recolour the pick's bar when it does
watch(function () { return [props.tone, props.pick] }, function () {
  if (!chart) return
  chart.data.datasets[0].backgroundColor = barColours()
  chart.data.datasets[0].hoverBackgroundColor = barColours()
  chart.update()
})

onBeforeUnmount(function () {
  if (chart) {
    chart.destroy()
  }
})
</script>

<template>
  <!-- Positioned, so Chart.js can shrink the chart when the window gets narrower -->
  <div :style="{ position: 'relative', height: height }">
    <canvas ref="canvas"></canvas>
  </div>
</template>
