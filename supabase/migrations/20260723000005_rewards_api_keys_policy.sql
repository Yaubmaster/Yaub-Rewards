-- Yaub Rewards · migración 5: fix del advisor de seguridad (rls_enabled_no_policy).
-- rewards.api_keys es de uso exclusivo de service_role (las edge functions);
-- se agrega una policy explícita de solo-lectura para admins (solo hashes).

create policy api_keys_select_admin on rewards.api_keys
for select to authenticated
using (rewards.is_admin());
