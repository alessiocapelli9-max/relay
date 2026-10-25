# Relay design constraints
- Use semantic CSS and custom styles. Do not add Tailwind.
- No gradients, decorative shadows, glass effects, faux tape, or floating cards.
- Keep introduction layouts asymmetric and left-aligned. Avoid generic three-card feature grids.
- Prefer purposeful SVG imagery, readable labels, ruled lists, and restrained color.
- Mobile content must flow naturally without fixed viewport heights.
- Preserve keyboard controls, visible focus, reduced-motion support, and textual statuses.
- Creator: Alessio Capelli. Do not invent an origin story or claim unassisted authorship.
- Preserve scheduling behavior and explicit backup import. This checkout targets GitHub, Vercel and Supabase; do not reintroduce Sites or ChatGPT authentication.
- Never expose a service-role key. Keep membership checks in the database function and authenticated identity derived from auth.uid().
