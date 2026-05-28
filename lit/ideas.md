# Ideas

- use arktype for type validation (post, put) - zod or arktype could be used in the IValidatable class, or not 
- Could there be a way setup ~~storybook~~ for component development? Not storybook - maybe something homebrewed? Serve the components individually with a storybook-style presentation?
- serve styles from a controller?
- To keep scroll position between redirects (after post) have hidden divs descending down the page with unique (probably incrementing) ids. When a form is submitted, add the id of the current position and redirect with that as a tag.
  - or keep a "SPA-like" app that always renders to a root html div
- Create a TSX helper that builds dynamic CSS (:not, :has) selectors for no-JS interactivity
  - Similar to the existing "Action" helper

- Atomic Design
  - Extended (neutrino, quarks, hadrons)
  - testing on all levels
  - Pages are not implemented - they're created at runtime
  - Separate design server for tokens, components, partials

| | |
| --- | --- | --- |
| Primitive Token | CSS Variable | Neutrino |
| Semantic Token | CSS Variable | Hadrons |
| Variant Token | CSS Variable | Quarks |
| HTML Elements | Atoms | Styled by global CSS |
| Components | Molecules |
| Partials | Organisms |
| Templates | Cultures |
