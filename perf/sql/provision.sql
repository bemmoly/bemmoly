-- Load-test people, their API tokens and their session cookies, created server side.
--
-- `node perf/src/provision.ts` prints `\set people '<json>'` followed by this file; pipe the
-- whole output into psql on the install (`sudo bemmoly shell db` on a Compose install).
-- The JSON holds names, emails, the org role key and the sha256 of each token and cookie;
-- the secrets themselves stay in the credentials file on the machine that ran the tool.
--
-- Everything matches `load-%@load.bemmoly.test`, which teardown.sql deactivates. Running it
-- again for the same emails reactivates those rows and adds fresh tokens and sessions.

\set ON_ERROR_STOP on
begin;

create temporary table load_people on commit drop as
select *
from json_to_recordset(:'people'::json) as p(
  email text, name text, role text, token_hash text, token_prefix text, session_hash text
);

do $$
begin
  if exists (select 1 from load_people where email not like 'load-%@load.bemmoly.test') then
    raise exception 'provision.sql only creates load-test people (load-*@load.bemmoly.test)';
  end if;
end $$;

insert into users (email, name, role_id, status)
select p.email, p.name, r.id, 'active'
from load_people p
join roles r on r.key = p.role
on conflict (lower(email)) do update
  set name = excluded.name,
      role_id = excluded.role_id,
      status = 'active',
      deactivated_at = null,
      privilege_version = users.privilege_version + 1,
      updated_at = now();

insert into api_tokens (user_id, name, token_hash, token_prefix, scopes)
select u.id, 'LOAD harness', p.token_hash, p.token_prefix, array['read', 'write']
from load_people p
join users u on lower(u.email) = lower(p.email);

insert into sessions (user_id, token_hash, expires_at, privilege_version, user_agent)
select u.id, p.session_hash, now() + interval '3 days', u.privilege_version, 'bemmoly-perf'
from load_people p
join users u on lower(u.email) = lower(p.email);

select count(*) as load_people_active
from users
where email like 'load-%@load.bemmoly.test' and status = 'active';

commit;
