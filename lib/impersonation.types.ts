export type ImpersonationIdentity = {
  id: string;
  email: string | null;
  fullName: string | null;
};

export type ActiveImpersonation = {
  id: string;
  admin: ImpersonationIdentity;
  target: ImpersonationIdentity;
  startedAt: string;
  expiresAt: string;
};
