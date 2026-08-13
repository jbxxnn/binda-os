# Auth Design Principles

This document captures the current direction for auth pages so future work does not drift.

Scope:

- `/auth/login`
- `/auth/sign-up`
- `/auth/forgot-password`
- `/auth/update-password`
- `/auth/sign-up-success`
- `/auth/error`

## Core Rule

Auth pages should be direct.

They are not marketing pages and they are not storytelling pages.

## Layout

- use a single centered form card
- do not use split-screen auth layouts
- do not add left-side filler panels or promotional copy blocks
- keep the screen visually calm and mobile-first

## Background

- use a solid light background
- do not use gradients for auth page backgrounds
- keep contrast clean with the card surface and form fields

Current approved auth background:

- `#f5eee6`

## Copy

- keep copy short and functional
- title should explain the action
- description should be one short sentence at most
- remove any text that does not help the user complete the task

## Surface Style

- auth cards should feel clean, soft, and controlled
- border radius should be moderate, not oversized
- current auth card radius direction is roughly half of the previous large rounded treatment
- maintain restrained borders and light shadow, not heavy visual effects

## Brand Cues To Keep

- use the established lilac accent `#E89BFF`
- keep `Inter` and `JetBrains Mono`
- keep strong, clean heading weight
- keep compact mono labels and pills where useful

## What To Avoid

- gradient-heavy backgrounds
- oversized corner radius on auth cards
- filler feature lists
- long explanatory side content
- trying to make auth screens behave like the landing page hero

## Implementation Reference

Current shared auth shell:

- [components/auth/auth-shell.tsx](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/components/auth/auth-shell.tsx)
