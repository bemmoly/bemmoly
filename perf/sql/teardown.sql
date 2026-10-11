-- Ends every load-test person's access: revokes their API tokens, deletes their sessions
-- and deactivates them. Covers the people provision.sql made and the placeholder people a
-- load-test Jira import adds (the fake site's addresses are rewritten to the same domain).
-- Rows stay, deactivated, so the audit trail and anything they authored keep their names.
--
--   sudo bemmoly shell db < perf/sql/teardown.sql

\set ON_ERROR_STOP on
begin;

update api_tokens
set revoked_at = now(), updated_at = now()
where revoked_at is null
  and user_id in (select id from users where email like 'load-%@load.bemmoly.test');

delete from sessions
where user_id in (select id from users where email like 'load-%@load.bemmoly.test');

update users
set status = 'deactivated',
    deactivated_at = coalesce(deactivated_at, now()),
    privilege_version = privilege_version + 1,
    updated_at = now()
where email like 'load-%@load.bemmoly.test' and status <> 'deactivated';

select status, count(*) as people
from users
where email like 'load-%@load.bemmoly.test'
group by status
order by status;

select count(*) as live_tokens
from api_tokens
where revoked_at is null
  and user_id in (select id from users where email like 'load-%@load.bemmoly.test');

commit;
