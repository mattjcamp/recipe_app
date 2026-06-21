-- =============================================================================
-- Recipe App — invite functions
-- A person accepting an invite is NOT yet a family member, so RLS on
-- family_invites would hide the row from them. These SECURITY DEFINER functions
-- let an invitee preview and accept an invite by its secret token without
-- weakening the table policies.
--
-- Apply after schema.sql.
-- =============================================================================

-- Preview an invite by token (used to show "You've been invited to <family>").
-- Callable by anon/authenticated; the token is the secret.
create or replace function public.get_invite_preview(invite_token text)
returns table (
  family_id   uuid,
  family_name text,
  email       text,
  expired     boolean,
  accepted    boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select f.id,
         f.name,
         i.email,
         (i.expires_at < now())      as expired,
         (i.accepted_at is not null) as accepted
  from family_invites i
  join families f on f.id = i.family_id
  where i.token = invite_token;
$$;

-- Accept an invite: adds the current user to the family and marks the invite
-- used. Returns the family_id on success; raises on invalid/expired/used token.
create or replace function public.accept_family_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv family_invites;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  select * into inv from family_invites where token = invite_token;

  if inv.id is null then
    raise exception 'Invalid invite link';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invite has already been used';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invite has expired';
  end if;

  -- Already a member? Don't burn the invite; just report it. (Prevents the
  -- owner from silently consuming an invite by opening their own link.)
  if exists (
    select 1 from family_members
    where family_id = inv.family_id and user_id = auth.uid()
  ) then
    raise exception 'You are already a member of this family';
  end if;

  insert into family_members (family_id, user_id, role)
  values (inv.family_id, auth.uid(), 'member');

  update family_invites set accepted_at = now() where id = inv.id;

  return inv.family_id;
end;
$$;

-- Lock down who may call these (defaults grant EXECUTE to PUBLIC otherwise).
revoke execute on function public.accept_family_invite(text) from public, anon;
grant  execute on function public.accept_family_invite(text) to authenticated;

revoke execute on function public.get_invite_preview(text) from public;
grant  execute on function public.get_invite_preview(text) to anon, authenticated;

-- Pending invites addressed to the current user's email. RLS hides invite rows
-- from non-members, so this SECURITY DEFINER lookup lets a freshly signed-up
-- invitee discover and accept their invite from the onboarding screen (covers
-- the case where the email-confirmation redirect drops the join-link context).
create or replace function public.list_my_pending_invites()
returns table (token text, family_id uuid, family_name text)
language sql
security definer
stable
set search_path = public
as $$
  select i.token, f.id, f.name
  from family_invites i
  join families f on f.id = i.family_id
  join auth.users u on lower(u.email) = lower(i.email)
  where u.id = auth.uid()
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc;
$$;

revoke execute on function public.list_my_pending_invites() from public, anon;
grant  execute on function public.list_my_pending_invites() to authenticated;
