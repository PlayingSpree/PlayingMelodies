// Join truthy class-name parts, ported from PlayingChord: composes Tailwind
// classes without a dependency.
export function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ')
}
