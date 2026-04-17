<script lang="ts">
  interface Props { size?: number; class?: string }
  let { size = 28, class: className = '' }: Props = $props();
</script>

<!--
  Cryptex mark — a stylized key/glyph hybrid.
  Diamond keyhead referencing a cipher disc; shaft notched with a 4-bit pattern (1-0-1-1, a nod to binary/cipher origins).
-->
<svg
  width={size}
  height={size}
  viewBox="0 0 32 32"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
  class={className}
>
  <defs>
    <linearGradient id="cx-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="hsl(var(--primary))" />
      <stop offset="1" stop-color="hsl(var(--accent))" />
    </linearGradient>
  </defs>
  <path
    d="M11 4 L22 4 L27 9 L27 15 L22 20 L18 20 L18 24 L21 24 L21 27 L18 27 L18 30 L15 30 L15 20 L11 20 L6 15 L6 9 Z"
    fill="url(#cx-grad)"
  />
  <circle cx="16.5" cy="12" r="2.6" fill="hsl(var(--background))" />
</svg>
