# Landing Design System

This document preserves the imported landing-page visual language so future work can stay consistent.

Source reference:

- local source repo copied from `/Users/apple/Downloads/modern`
- active implementation in [app/page.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/app/page.tsx)
- landing components in [components/landing](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing)
- reusable tokens in [lib/landing/design-system.ts](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/lib/landing/design-system.ts)

## Purpose

The landing page now has a defined visual identity.
Do not treat it as one-off styling.

When building future public-facing marketing sections or landing-page additions, reuse this system instead of inventing a parallel style.

## Core Visual Direction

The visual language is:

- high-contrast
- energetic
- editorial
- youth-forward
- motion-led
- black, white, and orchid-lilac dominant

This is not a soft SaaS dashboard aesthetic.
It should feel bold, sharp, and kinetic.

## Color System

Primary colors:

- `lime`: `#E89BFF`
- `charcoal`: `#121212`
- `white`: `#FFFFFF`

Usage rules:

- use `lime` for emphasis, CTA surfaces, highlights, animated accents, and active states
- use `charcoal` as the dominant dark base for high-energy sections
- use `white` or near-white as the clean contrast field for hero and product sections
- do not introduce unrelated brand colors unless the section specifically needs a flavor accent

Secondary accent colors currently used in the imported design:

- blush pink
- powder blue

These are acceptable for product/flavor storytelling, but they should stay soft and adjacent to the lilac core rather than pulling the page back toward citrus or high-neon cyan.

## Typography

Primary type:

- `Inter` for display, UI, and body

Secondary type:

- `JetBrains Mono` for labels, eyebrows, metadata, supporting microcopy, and tech-style accents

Usage rules:

- display headlines should be bold, compressed-feeling, and tight-tracked
- mono text should be used sparingly for labels and support copy
- avoid mixing in additional fonts unless there is a strong reason

Current font wiring lives in:

- [app/layout.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/app/layout.tsx)
- [tailwind.config.ts](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/tailwind.config.ts)

## Motion Language

Motion is part of the brand, not decoration.

Use:

- spring-based hover interactions
- upward reveal transitions
- soft parallax where appropriate
- animated glows, marquees, grain, and micro-shifted surfaces
- scroll-aware movement for hero scenes

Avoid:

- generic fade-only motion everywhere
- sluggish enterprise-style easing
- overusing large looping motion in dense UI screens

Shared motion tokens live in:

- [lib/landing/design-system.ts](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/lib/landing/design-system.ts)

Preferred easing:

- `[0.25, 0.4, 0.25, 1]`

Preferred interaction spring:

- `type: "spring"`
- `stiffness: 400`
- `damping: 17`

Preferred content spring:

- `type: "spring"`
- `stiffness: 100`
- `damping: 20`

## Layout Rules

Marketing sections should usually follow:

- `max-w-7xl mx-auto px-6`
- strong vertical spacing
- large headline blocks
- clear rhythm between dark and light sections
- oversized cards with rounded corners

Preferred section rhythm:

- light hero / product storytelling
- dark technical or social proof blocks
- strong CTA moments

## Reusable Styling Patterns

Patterns already established and safe to reuse:

- rounded pill CTA buttons
- oversized editorial headings
- mono eyebrow labels
- black cards with lilac hover states
- white cards with strong shadow and border restraint
- subtle grain overlays on high-value hero sections
- animated shine sweeps on CTAs

## Where To Reuse This System

Use this design system for:

- homepage additions
- public marketing sections
- campaign pages
- waitlist pages
- launch pages

Do not blindly force this same style into:

- the authenticated `/app` product workspace
- dense operational forms
- transaction logging screens

The product workspace can borrow selected brand cues, but it should optimize for utility first.

## Implementation Rule

Before building a new landing or marketing component:

1. check [lib/landing/design-system.ts](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/lib/landing/design-system.ts)
2. follow the typography and color rules here
3. borrow motion patterns from existing landing components
4. only add a new visual pattern if the existing system clearly cannot support the need

## Current Canonical Files

These files define the current landing style:

- [app/page.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/app/page.tsx)
- [app/globals.css](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/app/globals.css)
- [app/layout.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/app/layout.tsx)
- [components/landing/navigation.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing/navigation.tsx)
- [components/landing/hero-section.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing/hero-section.tsx)
- [components/landing/flavor-carousel.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing/flavor-carousel.tsx)
- [components/landing/bento-grid.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing/bento-grid.tsx)
- [components/landing/activations-section.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing/activations-section.tsx)
- [components/landing/social-section.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing/social-section.tsx)
- [components/landing/footer.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/landing/footer.tsx)

## Constraint

Future landing work should feel like it belongs to the same world.

If a new component looks calmer, flatter, softer, more generic, or more dashboard-like than the current landing page, it is probably drifting.
