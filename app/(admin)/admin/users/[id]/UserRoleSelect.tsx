'use client';

/** RBAC role picker on the admin user detail page. */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setUserRoleAction } from '@/app/actions/admin-users';
import { toast } from '@/components/design-system/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Role = { id: string; key: string; name: string };

type Props = {
  userId: string;
  roles: Role[];
  initialRoleId: string;
};

export function UserRoleSelect({ userId, roles, initialRoleId }: Props) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(initialRoleId);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRoleId(initialRoleId);
  }, [initialRoleId]);

  const onChange = (next: string) => {
    if (next === roleId) return;
    const previous = roleId;
    const role = roles.find((item) => item.id === next);
    const toastId = toast.loading(`Saving ${role?.name ?? 'role'}...`);
    setRoleId(next);
    startTransition(async () => {
      const result = await setUserRoleAction({ userId, roleId: next });
      if (result.ok) {
        toast.success(`${role?.name ?? 'Role'} saved.`, { id: toastId });
        router.refresh();
      } else {
        setRoleId(previous);
        toast.error(result.error, { id: toastId });
      }
    });
  };

  return (
    <Select value={roleId} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Choose role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
