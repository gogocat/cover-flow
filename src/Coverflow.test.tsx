import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Coverflow from './Coverflow';

// Mock requestAnimationFrame to execute asynchronously to avoid recursion stack overflow
(window as any).requestAnimationFrame = (cb: any) => {
  return setTimeout(() => cb(performance.now()), 0) as any;
};
window.cancelAnimationFrame = (id: any) => clearTimeout(id);

// Mock Scroll functionality since jsdom layout is limited
Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
  configurable: true,
  value: 0,
  writable: true,
});

// Mock Pointer Capture methods (missing in JSDOM)
HTMLElement.prototype.setPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();
HTMLElement.prototype.hasPointerCapture = vi.fn(() => false); // Optional but good to have

const mockItems = [
  { title: 'Album 1', artists: 'Artist 1', image_url: 'url1' },
  { title: 'Album 2', artists: 'Artist 2', image_url: 'url2' },
  { title: 'Album 3', artists: 'Artist 3', image_url: 'url3' },
];

describe('Coverflow', () => {
  it('renders without crashing', () => {
    render(<Coverflow items={mockItems} />);
    const wrapper = screen.getByTestId('coverflow');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders correct number of items', () => {
    render(<Coverflow items={mockItems} />);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(mockItems.length);
  });

  it('calls onItemClick when an item is clicked', () => {
    const handleClick = vi.fn();
    render(<Coverflow items={mockItems} onItemClick={handleClick} />);
    
    // We need to simulate the click. 
    // In our component, click is handled via onPointerUp + elementFromPoint.
    // However, for simple unit testing without a full browser layout engine, 
    // it's hard to trigger elementFromPoint correctly in jsdom.
    // 
    // The user asked for "loose typing" and "easy to maintain". 
    // The most robust way to test the logic strictly would be complex E2E.
    // For unit tests, we'll verify the component mounts generic listeners.
    // 
    // Since our strict "click" logic is inside onPointerUp and relies on layout,
    // we might skip the detailed interaction test here or mock it heavily.
    // 
    // Let's try to simulate the pointer events sequence.
    
    // NOTE: elementFromPoint returns null in JSDOM usually. We need to mock it.
    const images = screen.getAllByRole('img');
    const targetImage = images[1];
    const targetCard = targetImage.closest('li');

    document.elementFromPoint = vi.fn(() => targetCard as Element);

    const wrapper = screen.getByTestId('coverflow').querySelector('.cards-wrapper') as Element;
    
    // Sequence: PointerDown -> PointerUp (no move)
    fireEvent.pointerDown(wrapper, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(wrapper, { clientX: 100, clientY: 100 });

    expect(handleClick).toHaveBeenCalledTimes(1);
    // loose check on arguments
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({ title: 'Album 2' }));
  });
});
