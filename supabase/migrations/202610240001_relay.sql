-- Plan data is private. The only client entry point is relay_api, which derives
-- identity from the verified Supabase JWT, never from request JSON.
create schema if not exists relay;
revoke all on schema relay from public, anon, authenticated;
create table relay.rooms(id uuid primary key default gen_random_uuid(), owner uuid not null, name text not null, state jsonb not null, revision integer not null default 1, invite_hash text unique, invite_expires bigint, updated_at bigint not null, updated_by text not null);
create table relay.members(room_id uuid references relay.rooms(id) on delete cascade,user_id uuid not null,name text not null,joined_at bigint not null,primary key(room_id,user_id));
create index on relay.members(user_id);
create table relay.join_limits(user_id uuid primary key,attempt_window bigint not null,attempts integer not null);
alter table relay.rooms enable row level security;
alter table relay.members enable row level security;
alter table relay.join_limits enable row level security;
revoke all on all tables in schema relay from public,anon,authenticated;

create function relay.valid_state(s jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(s)='object' and s->>'version'='1'
 and jsonb_typeof(s->'recipient')='string' and length(trim(s->>'recipient')) between 1 and 100
 and jsonb_typeof(s->'caregivers')='array' and jsonb_typeof(s->'tasks')='array'
 and jsonb_typeof(s->'templates')='array' and jsonb_typeof(s->'activity')='array'
 and jsonb_typeof(s->'needs')='array' and jsonb_typeof(s->'preferences')='string'
 and jsonb_typeof(s->'recurring')='boolean' and octet_length(s::text)<1000000,false)
$$;

create function public.relay_api(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); a text:=p->>'action'; rid uuid; r relay.rooms%rowtype;
 display text:=trim(p->>'displayName'); title text:=trim(p->>'name');
 now_ms bigint:=(extract(epoch from clock_timestamp())*1000)::bigint;
 state_data jsonb; code text; hash text; n integer; member_name text; result jsonb;
begin
 if u is null then return jsonb_build_object('error','Please sign in.','status',401); end if;
 if octet_length(p::text)>1100000 then return jsonb_build_object('error','Plan too large.','status',413);end if;
 if a='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'owner',x.owner,'updated_at',x.updated_at) order by x.updated_at desc),'[]') into result from relay.rooms x join relay.members m on m.room_id=x.id where m.user_id=u;
  return jsonb_build_object('rooms',result);
 end if;
 if a in ('create','join') and (display is null or length(display) not between 1 and 100) then return jsonb_build_object('error','Enter your name.','status',400);end if;
 if a='create' then
  if title is null or length(title) not between 1 and 100 then return jsonb_build_object('error','Enter the name of the person receiving care.','status',400);end if;
  select count(*) into n from relay.members where user_id=u;if n>=20 then return jsonb_build_object('error','You can belong to up to 20 plans.','status',400);end if;
  state_data:=coalesce(p->'importState',jsonb_build_object('version',1,'onboarded',true,'recipient',title,'needs','[]'::jsonb,'preferences','','recurring',false,'caregivers','[]'::jsonb,'tasks','[]'::jsonb,'templates','[]'::jsonb,'activity','[]'::jsonb));
  if not relay.valid_state(state_data) then return jsonb_build_object('error','Invalid plan backup.','status',400);end if;
  state_data:=state_data||jsonb_build_object('recipient',title,'onboarded',true);
  insert into relay.rooms(owner,name,state,updated_at,updated_by) values(u,title,state_data,now_ms,display) returning id into rid;
  insert into relay.members values(rid,u,display,now_ms);
  return jsonb_build_object('id',rid);
 end if;
 if a='join' then
  insert into relay.join_limits values(u,now_ms/900000,1) on conflict(user_id) do update set attempts=case when relay.join_limits.attempt_window=excluded.attempt_window then relay.join_limits.attempts+1 else 1 end,attempt_window=excluded.attempt_window returning attempts into n;
  if n>10 then return jsonb_build_object('error','Too many attempts. Try again in 15 minutes.','status',429);end if;
  code:=upper(regexp_replace(p->>'code','[[:space:]-]','','g'));
  if code is null or code !~ '^[A-F0-9]{16}$' then return jsonb_build_object('error','That code is invalid or expired.','status',404);end if;
  hash:=encode(sha256(convert_to(code,'UTF8')),'hex');
  select * into r from relay.rooms where invite_hash=hash and invite_expires>now_ms for update;
  if not found then return jsonb_build_object('error','That code is invalid or expired.','status',404);end if;
  if exists(select 1 from relay.members where room_id=r.id and user_id=u) then return jsonb_build_object('id',r.id);end if;
  select count(*) into n from relay.members where room_id=r.id;if n>=30 then return jsonb_build_object('error','This plan has reached its member limit.','status',400);end if;
  select count(*) into n from relay.members where user_id=u;if n>=20 then return jsonb_build_object('error','You can belong to up to 20 plans.','status',400);end if;
  insert into relay.members values(r.id,u,display,now_ms);return jsonb_build_object('id',r.id);
 end if;
 rid:=(p->>'id')::uuid;
 if a='get' then select * into r from relay.rooms where id=rid;else select * into r from relay.rooms where id=rid for update;end if;
 if not found then return jsonb_build_object('error','Plan unavailable.','status',404);end if;
 select name into member_name from relay.members where room_id=rid and user_id=u;
 if not found then return jsonb_build_object('error','Plan unavailable or membership removed.','status',404);end if;
 if a='get' then
  select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'name',name) order by joined_at),'[]') into result from relay.members where room_id=rid;
  return jsonb_build_object('id',r.id,'name',r.name,'owner',r.owner,'revision',r.revision,'state',r.state,'members',result,'updatedBy',r.updated_by,'updatedAt',r.updated_at,'inviteActive',r.invite_hash is not null and r.invite_expires>now_ms);
 end if;
 if a='save' then
  state_data:=p->'state';if not relay.valid_state(state_data) then return jsonb_build_object('error','Invalid plan details.','status',400);end if;
  if coalesce(p->>'revision','') !~ '^[0-9]{1,9}$' then return jsonb_build_object('error','Invalid revision.','status',400);end if;
  if (p->>'revision')::integer<>r.revision then return jsonb_build_object('error','Someone else updated this plan. Download your unsaved changes, then load the latest plan.','status',409);end if;
  update relay.rooms set state=state_data||jsonb_build_object('onboarded',true),name=state_data->>'recipient',revision=revision+1,updated_at=now_ms,updated_by=member_name where id=rid;
  return jsonb_build_object('revision',r.revision+1,'updatedAt',now_ms);
 end if;
 if a='leave' then
  if r.owner=u then return jsonb_build_object('error','The owner cannot leave their plan.','status',400);end if;
  delete from relay.members where room_id=rid and user_id=u;return jsonb_build_object('ok',true);
 end if;
 if r.owner<>u then return jsonb_build_object('error','Only the owner can manage invitations and members.','status',403);end if;
 if a='invite' then
  code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  update relay.rooms set invite_hash=encode(sha256(convert_to(code,'UTF8')),'hex'),invite_expires=now_ms+604800000 where id=rid;
  return jsonb_build_object('code',code,'expires',now_ms+604800000);
 elsif a='revoke' then
  update relay.rooms set invite_hash=null,invite_expires=null where id=rid;return jsonb_build_object('ok',true);
 elsif a='remove' then
  if (p->>'userId')::uuid=u then return jsonb_build_object('error','You cannot remove the owner.','status',400);end if;
  delete from relay.members where room_id=rid and user_id=(p->>'userId')::uuid;
  update relay.rooms set invite_hash=null,invite_expires=null where id=rid;return jsonb_build_object('ok',true);
 end if;
 return jsonb_build_object('error','Unknown action.','status',400);
exception when invalid_text_representation then return jsonb_build_object('error','Invalid request.','status',400);
end;
$$;
revoke all on function public.relay_api(jsonb) from public,anon;
grant execute on function public.relay_api(jsonb) to authenticated;

