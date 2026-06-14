# Card Prototype Notes

The original `cards-code.md` prototype was a static HTML/Tailwind page called "Aether Battles - Card Tiers". It should be treated as visual reference, not production structure.

The production direction is an original hybrid: sports-card readability, a hint of familiar football-card information hierarchy, and premium material treatments inspired by phase gradients, ruby, emerald, sapphire/cobalt, and black pearl.

## Useful Code Ideas

Prototype tier variables:

```css
.tier-1 { --border-glow: #1a1a2e; --flow-color: #3b3b58; }
.tier-2 { --border-glow: #2d3748; --flow-color: #4a5568; }
.tier-3 { --border-glow: #2b6cb0; --flow-color: #4299e1; }
.tier-4 { --border-glow: #b83280; --flow-color: #ed64a6; }
.tier-5 { --border-glow: #e53e3e; --flow-color: #fc8181; }
.tier-6 { --border-glow: #38a169; --flow-color: #68d391; }
.tier-7 { --border-glow: #d69e2e; --flow-color: #f6e05e; }
```

Prototype layout concepts:

```css
.card-container {
  aspect-ratio: 2.5 / 3.5;
  perspective: 1000px;
}

.card-inner {
  transform-style: preserve-3d;
  transition: transform 0.3s ease;
  box-shadow: 0 0 15px var(--border-glow);
  border: 1px solid var(--border-glow);
}

.card-container:hover .card-inner {
  transform: translateY(-10px) rotateX(5deg);
}
```

Prototype flow effect:

```css
.flow-effect {
  background: linear-gradient(135deg, transparent 40%, var(--flow-color) 50%, transparent 60%);
  background-size: 300% 300%;
  animation: flowAnim 4s infinite linear;
  opacity: 0.3;
}

@keyframes flowAnim {
  0% { background-position: 100% 100%; }
  100% { background-position: 0% 0%; }
}
```

## Changes For Production

- Rename CSS variables to component-specific names such as `--card-border-glow`.
- Replace real player names with fictional seed names.
- Replace hard-coded external image URLs with nation flag data or local assets.
- Replace prototype tier colors with the final tier material mapping.
- Avoid exact FUT frame shapes, branded terminology, or copied trade dress.
- Avoid official Counter-Strike or CS:GO skin names in public-facing UI.
- Avoid production-facing labels like `Doppler`, `Crimson Web`, `Obsidian Pearl`, `Lore Master`, `FUT`, or `FIFA`.
- Add reduced-motion handling.
- Prefer hover-triggered animation for large grids.
- Keep the card name readable at all sizes.
- Avoid decorative center icons that reduce name space.
