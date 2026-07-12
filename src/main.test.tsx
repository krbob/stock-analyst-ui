import { afterEach, describe, expect, it, vi } from 'vitest';

const root = vi.hoisted(() => ({
  render: vi.fn(),
  createRoot: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: root.createRoot,
}));

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.resetModules();
});

describe('application bootstrap', () => {
  it('mounts the guarded query application into the root element', async () => {
    const container = document.createElement('div');
    container.id = 'root';
    document.body.append(container);
    root.createRoot.mockReturnValue({ render: root.render });

    await import('./main');

    expect(root.createRoot).toHaveBeenCalledWith(container);
    expect(root.render).toHaveBeenCalledTimes(1);
  });
});
