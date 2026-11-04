// @vitest-environment jsdom
// FdConfirmDialog.spec.js
// Used by vitest to test src/components/FdConfirmDialog.vue: the "are you sure" pop-up before a
// friend, a wishlist item or a budget is removed.

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FdConfirmDialog from '../FdConfirmDialog.vue'

describe('TestSuite1: FdConfirmDialog', () => {
  it('Test1: shows the title, the slot text and the confirm label', () => {
    const wrapper = mount(FdConfirmDialog, {
      props: { title: 'Remove friend?', confirmLabel: 'Remove' },
      slots: { default: 'Zoe will no longer see your wishlist.' }
    })
    expect(wrapper.find('h2').text()).toBe('Remove friend?')
    expect(wrapper.text()).toContain('Zoe will no longer see your wishlist.')
    expect(wrapper.findAll('button')[0].text()).toBe('Remove')
  })

  it('Test2: a click on the confirm button emits confirm', async () => {
    const wrapper = mount(FdConfirmDialog, { props: { title: 'Remove?' } })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeFalsy()
  })

  it('Test3: Cancel and a click on the dark backdrop both emit cancel', async () => {
    const wrapper = mount(FdConfirmDialog, { props: { title: 'Remove?' } })
    await wrapper.findAll('button')[1].trigger('click')
    await wrapper.find('.fd-entry-backdrop').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(2)
    expect(wrapper.emitted('confirm')).toBeFalsy()
  })

  it('Test4: a danger pop-up uses the red button', () => {
    const wrapper = mount(FdConfirmDialog, { props: { title: 'Remove?', danger: true } })
    expect(wrapper.findAll('button')[0].classes()).toContain('btn-danger')
  })

  it('Test5: while busy, both buttons are disabled and the confirm button says Working', () => {
    const wrapper = mount(FdConfirmDialog, { props: { title: 'Remove?', busy: true } })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].text()).toBe('Working…')
    expect(buttons[0].attributes('disabled')).toBeDefined()
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })

  it('Test6: shows an error message only when there is one', () => {
    const quiet = mount(FdConfirmDialog, { props: { title: 'Remove?' } })
    expect(quiet.find('[role="alert"]').exists()).toBe(false)
    const failed = mount(FdConfirmDialog, { props: { title: 'Remove?', error: 'Could not remove. Try again.' } })
    expect(failed.find('[role="alert"]').text()).toBe('Could not remove. Try again.')
  })
})
