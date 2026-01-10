# Cover Flow

A premium, interactive Coverflow component built with React, TypeScript, and SCSS. This component provides a smooth, momentum-based dragging experience and a visually appealing stacked layout for album covers or items.

## Features

- **Momentum-based Dragging**: Smooth mouse and touch interactions with physics-based snapping.
- **Stacked Layout**: Efficient use of space with overlapping items.
- **Accessible Navigation**: Support for keyboard (Left/Right Arrows), buttons, and direct clicks.
- **Highly Configurable**: Custom sizes, initial centering, and click callbacks.
- **Fully Typed**: Built with TypeScript for excellent developer experience.

## Installation

```bash
npm install cover-flow
```

## Usage

```tsx
import Coverflow from 'cover-flow';
import 'cover-flow/style.css'; // Don't forget to import the styles!

const albums = [
    { 
        title: 'Album 1', 
        artists: 'Artist 1', 
        image_url: 'https://example.com/image1.jpg' 
    },
    // ...
];

function App() {
    return (
        <Coverflow 
            items={albums}
            imgWidth={250}
            imgHeight={250}
            initCenter={true}
            onItemClick={(item) => console.log('Selected:', item)}
        />
    );
}
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `items` | `AlbumItem[]` | `[]` | Array of items to display. |
| `imgWidth` | `number` | `200` | Width of each child cover item. |
| `imgHeight` | `number` | `200` | Height of each child cover item. |
| `initCenter` | `boolean` | `false` | If true, scrolls to the middle item on mount. |
| `onItemClick` | `(item) => void`| `() => {}`| Called when an item is selected (via click, drag snap, or button). |
| `className` | `string` | `''` | Additional CSS class for the wrapper. |
| `leftIcon` | `ReactNode` | `'←'` | Custom icon for the "Previous" button. |
| `rightIcon` | `ReactNode` | `'→'` | Custom icon for the "Next" button. |
| `overlapFactor`| `number` | `0.8` | Determines item spacing/overlap (0 to 1). |

### AlbumItem Interface

```typescript
interface AlbumItem {
    image_url: string;
    title: string;
    artists: string;
    position?: number;
}
```

## How It Works

### 1. Layout & Styling (`styles.scss`)
The component achieves its characteristic "stacked" look using **negative margins**. 
- Each item has a negative right margin (controlled via the `overlapFactor` prop, default `0.8`), which pulls the next item on top of the current one.
- Side padding is dynamically calculated in a `useEffect` to ensure that when an item is selected, it appears centered in the container.

### 2. Custom Smooth Scrolling
Instead of native CSS scroll-snap, this component uses a custom JavaScript-driven smooth scroll implementation:
- **`smoothScrollTo`**: Uses `requestAnimationFrame` for high-performance sub-pixel scrolling.
- **Easing**: Implements `easeOutCubic` for natural-feeling decelerations.

### 3. Momentum-based Dragging
The component handles dragging via Pointer Events for unified Mouse and Touch support:
- **Velocity Tracking**: During the move, it tracks the speed of the drag.
- **Projected Snap**: When released, it calculates a "projected" scroll position based on current velocity and snaps to the nearest item index.
- **Selection Snap**: Even small drags snap to the nearest item to ensure alignment is always perfect.

### 4. Logic Centralization
The component's navigation logic is centralized in two helper functions:
- **`getCurrentIndex()`**: Calculates which item is currently at the center based on `scrollLeft` and the defined `scrollStep`.
- **`selectCard(index)`**: Performs the actual scroll animation and triggers the `onItemClick` callback.

## Development

- **Linting**: `npm run lint` (uses ESLint with TypeScript support).
- **Testing**: `npm test` (uses Vitest with DOM testing library).
- **Building**: `npm run build` (runs lint, tests with coverage, and builds for production).

## Acknowledgements

This project was inspired by [Addy Osmani's blog post on Coverflow](https://addyosmani.com/blog/coverflow/).

