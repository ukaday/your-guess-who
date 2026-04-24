import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App.vue';

describe('App', () => {
    it('renders health status', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                json: () => Promise.resolve({ status: 'ok' }),
            }),
        );

        const wrapper = mount(App);
        await flushPromises();

        expect(wrapper.text()).toContain('ok');
    });
});
