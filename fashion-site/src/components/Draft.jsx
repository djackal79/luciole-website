import { isPlaceholder, placeholderLabel } from '../lib/placeholder.js';

/**
 * Renders a catalogue value. If it is a `{{ }}` placeholder it comes out in the
 * draft treatment — off-palette colour, monospace, dashed edge — so it cannot be
 * read as approved copy. Confirmed values render plainly.
 */
export default function Value({ value, block = false, compact = false, className = '' }) {
  if (!isPlaceholder(value)) {
    return <span className={className}>{value}</span>;
  }
  const cls = [
    'draft',
    block ? 'draft--block' : '',
    compact ? 'draft--compact' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={cls} data-placeholder="true">
      {placeholderLabel(value)}
    </span>
  );
}

/** Standalone draft marker for copy that lives in the layout rather than the catalogue. */
export function Draft({ children, block = false, compact = false }) {
  const cls = ['draft', block ? 'draft--block' : '', compact ? 'draft--compact' : ''].filter(Boolean).join(' ');
  return <span className={cls} data-placeholder="true">{children}</span>;
}
