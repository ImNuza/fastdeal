// @vitest-environment jsdom
// FdListSearch.spec.js
// Used by vitest to test src/components/FdListSearch.vue: the search box above the friends,
// notifications, wishlist and admin user lists.

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FdListSearch from '../FdListSearch.vue'

describe('TestSuite1: FdListSearch', () => {
  it('Test1: uses the label for screen readers and the placeholder', () => {
    const wrapper = mount(FdListSearch, {
      props: { modelValue: '', label: 'Search your wishlist', placeholder: 'Search saved products' }
    })
    const input = wrapper.find('input')
    expect(input.attributes('aria-label')).toBe('Search your wishlist')
    expect(input.attributes('placeholder')).toBe('Search saved products')
  })

  it('Test2: typing sends the words to the parent', async () => {
    const wrapper = mount(FdListSearch, { props: { modelValue: '', label: 'Search friends' } })
    await wrapper.find('input').setValue('zoe')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['zoe'])
  })

  it('Test3: shows the search icon when not busy', () => {
    const wrapper = mount(FdListSearch, { props: { modelValue: '', label: 'Search friends' } })
    expect(wrapper.find('.fd-list-search-icon').exists()).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('Test4: while busy, shows the loading message in place of the icon', () => {
    const wrapper = mount(FdListSearch, {
      props: { modelValue: 'zoe', label: 'Search users', busy: true, busyMessage: 'Finding users' }
    })
    expect(wrapper.find('.fd-list-search-icon').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toBe('Finding users')
  })
})
