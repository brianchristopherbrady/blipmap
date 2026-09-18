/// <reference types="vite/client" />

// Vite ?inline import type for CSS-in-JS usage (e.g. MapLibre CSS in shadow DOM)
declare module "*?inline" {
  const content: string;
  export default content;
}
