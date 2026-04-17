<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }
  let { size = 'md', class: className = '' }: Props = $props();

  const sizeClass = $derived({
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  }[size]);
</script>

<span class={`font-serif tracking-tight ${sizeClass} ${className}`} aria-label="Cryptex">
  <span class="font-medium">Crypt</span><span class="text-primary italic font-semibold">ex</span>
</span>
