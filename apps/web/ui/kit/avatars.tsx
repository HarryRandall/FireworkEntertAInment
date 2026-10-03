/** Shadcn avatar fallback and overlapping team composition. */
import { Avatar } from 'radix-ui';

/** Displays initials while a supplied image loads or fails. */
export function AvatarStack({
  people,
}: {
  people: readonly { name: string; initials: string; image?: string }[];
}) {
  return (
    <div className="flex -space-x-2" aria-label="Team">
      {people.map((person) => (
        <Avatar.Root
          key={person.name}
          className="bg-muted ring-card grid size-8 place-items-center overflow-hidden rounded-full text-xs ring-2"
        >
          <Avatar.Image src={person.image} alt={person.name} />
          <Avatar.Fallback aria-label={person.name}>{person.initials}</Avatar.Fallback>
        </Avatar.Root>
      ))}
    </div>
  );
}
