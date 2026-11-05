// @vitest-environment jsdom
// FdPriceChart.spec.js
// Used by vitest to test src/components/FdPriceChart.vue: the label under the newest price.
// The demo history ends on the capture day, so on a later day the label names that date.

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FdPriceChart from '../FdPriceChart.vue'

// The Singapore date of a time, "YYYY-MM-DD"
function sgDay(time) {
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10)
}

function chart(lastDay) {
  return mount(FdPriceChart, {
    props: { points: [{ day: '2026-11-02', price: 110 }, { day: lastDay, price: 100 }] }
  })
}

describe('TestSuite1: FdPriceChart', () => {
  it('Test1: the newest price is today, so the label says today', () => {
    expect(chart(sgDay(Date.now())).find('.fd-chart-what').text()).toBe('Lowest price today')
  })

  it('Test2: the newest price is from an earlier day, so the label names that day', () => {
    expect(chart('2026-11-03').find('.fd-chart-what').text()).toBe('Lowest price on 3 Nov')
  })
})
