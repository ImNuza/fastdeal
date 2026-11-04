// @vitest-environment jsdom
// FdPager.spec.js
// Used by vitest to test src/components/FdPager.vue: the Prev, page number and Next buttons under
// a list, with the "Showing 1 to 8 of 20" line. A page holds 8 rows (PAGE_SIZE).

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FdPager from '../FdPager.vue'

function pager(page, pageCount, total) {
  return mount(FdPager, {
    props: { modelValue: page, pageCount: pageCount, total: total, noun: 'products', label: 'Saved products' }
  })
}

// The page numbers on the buttons, in order
function numbers(wrapper) {
  return wrapper.findAll('.fd-pager-num').map(function (button) { return button.text() })
}

describe('TestSuite1: FdPager', () => {
  it('Test1: shows which rows the page holds', () => {
    expect(pager(1, 3, 20).find('.fd-pager-showing').text()).toBe('Showing 1 to 8 of 20 products')
    expect(pager(3, 3, 20).find('.fd-pager-showing').text()).toBe('Showing 17 to 20 of 20 products')
  })

  it('Test2: one row uses the singular noun', () => {
    expect(pager(1, 1, 1).find('.fd-pager-showing').text()).toBe('Showing 1 of 1 product')
  })

  it('Test3: Prev is disabled on the first page and Next on the last', () => {
    const first = pager(1, 3, 20)
    expect(first.find('[aria-label="Previous page"]').attributes('disabled')).toBeDefined()
    expect(first.find('[aria-label="Next page"]').attributes('disabled')).toBeUndefined()

    const last = pager(3, 3, 20)
    expect(last.find('[aria-label="Next page"]').attributes('disabled')).toBeDefined()
  })

  it('Test4: a click on Next asks the parent for the next page', async () => {
    const wrapper = pager(1, 3, 20)
    await wrapper.find('[aria-label="Next page"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([2])
  })

  it('Test5: a click on a page number asks for that page', async () => {
    const wrapper = pager(1, 3, 20)
    await wrapper.find('[aria-label="Page 3"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([3])
  })

  it('Test6: long lists show the first, last and nearby pages with gaps between', () => {
    const wrapper = pager(5, 10, 80)
    expect(numbers(wrapper)).toEqual(['1', '4', '5', '6', '10'])
    expect(wrapper.findAll('.fd-pager-gap')).toHaveLength(2)
    expect(wrapper.find('[aria-current="page"]').text()).toBe('5')
  })

  it('Test7: an empty list shows no pager', () => {
    expect(pager(1, 1, 0).find('nav').exists()).toBe(false)
  })
})
