import {
    render, screen, fireEvent 
} from '@testing-library/react';
import {
    describe, it, expect, vi 
} from 'vitest';
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
    
        const images = screen.getAllByRole('img');
        const targetImage = images[1];
        const targetCard = targetImage.closest('li');

        document.elementFromPoint = vi.fn(() => targetCard as Element);

        const wrapper = screen.getByTestId('coverflow').querySelector('.cards-wrapper') as Element;
    
        // Sequence: PointerDown -> PointerUp (no move)
        fireEvent.pointerDown(wrapper, { clientX: 100, clientY: 100 });
        fireEvent.pointerUp(wrapper, { clientX: 100, clientY: 100 });

        // Expected 2 calls:
        // 1. Initial call on mount (index 0 by default)
        // 2. Call from click (index 1 / Album 2)
        expect(handleClick).toHaveBeenCalledTimes(2);
        
        // Check first call (initial)
        expect(handleClick).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: 'Album 1' }));

        // Check second call (click)
        expect(handleClick).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Album 2' }));
    });
    it('initializes with center item when initCenter is true', () => {
        const handleClick = vi.fn();
        render(<Coverflow items={mockItems} onItemClick={handleClick} initCenter={true} />);

        // Middle of 3 items is index 1 (Album 2)
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({ title: 'Album 2' }));
    });

    it('navigates to next item when Next button is clicked', () => {
        const handleClick = vi.fn();
        render(<Coverflow items={mockItems} onItemClick={handleClick} />); // initCenter=false (index 0)

        const nextBtn = screen.getByLabelText('Next');
        fireEvent.click(nextBtn);

        // Call 1: Mount (Album 1)
        // Call 2: Next Click (Album 2)
        expect(handleClick).toHaveBeenCalledTimes(2);
        expect(handleClick).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Album 2' }));
    });

    it('navigates to previous item when Previous button is clicked', () => {
        const handleClick = vi.fn();
        // Start at middle (Album 2) so we can go previous to Album 1
        render(<Coverflow items={mockItems} onItemClick={handleClick} initCenter={true} />);

        const prevBtn = screen.getByLabelText('Previous');
        fireEvent.click(prevBtn);

        // Call 1: Mount (Album 2)
        // Call 2: Prev Click (Album 1)
        expect(handleClick).toHaveBeenCalledTimes(2);
        expect(handleClick).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Album 1' }));
    });

    it('navigates using arrow keys', () => {
        const handleClick = vi.fn();
        render(<Coverflow items={mockItems} onItemClick={handleClick} />); // index 0 (Album 1)

        const wrapper = screen.getByTestId('coverflow').querySelector('.cards-wrapper') as Element;
        
        // Focus the wrapper div to receive key events
        fireEvent.keyDown(wrapper, { key: 'ArrowRight' });

        expect(handleClick).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Album 2' }));

        // Simulate scroll completion (currentIndex logic depends on scrollLeft)
        // Default imgWidth=200 * 0.8 = 160
        (wrapper as HTMLElement).scrollLeft = 160;

        fireEvent.keyDown(wrapper, { key: 'ArrowLeft' });
        expect(handleClick).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Album 1' }));
    });
});
