// All routes are prerendered as static HTML for GitHub Pages deployment.
export const prerender = true;
export const trailingSlash = 'always';
// Client-only rendering for tool logic (transformers must run in the browser).
export const ssr = false;
