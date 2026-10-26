-- Owners may delete their own shared plan; membership alone is insufficient.
create or replace function public.relay_delete_plan(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid();
  plan_owner uuid;
begin
  if u is null then
    return jsonb_build_object('error','Please sign in.','status',401);
  end if;
  select owner into plan_owner from relay.rooms where id=p_id for update;
  if not found then
    return jsonb_build_object('error','Plan unavailable.','status',404);
  end if;
  if plan_owner<>u then
    return jsonb_build_object('error','Only the plan owner can delete this plan.','status',403);
  end if;
  -- Memberships cascade; the room's invite and state are removed with it.
  delete from relay.rooms where id=p_id;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.relay_delete_plan(uuid) from public,anon;
grant execute on function public.relay_delete_plan(uuid) to authenticated;
