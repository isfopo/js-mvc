# Ideas

- htmx for frontend reactivity?
  - create helper functions for htmx to make things easier
  - have a nested component structure for loading html with htmx. Only allow htmx targets at the top level of components/pages. Maybe have some middleware wrapper around components to add this automatically
- Put local state in cookies?
- use arktype for type validation (post, put)
- Could there be a way setup ~~storybook~~ for component development? Not storybook - maybe something homebrewed? Serve the components individually with a storybook-style presentation?
- serve styles from a controller?
- To keep scroll position between redirects (after post) have hidden divs descending down the page with unique (probably incrementing) ids. When a form is submitted, add the id of the current position and redirect with that as a tag.
