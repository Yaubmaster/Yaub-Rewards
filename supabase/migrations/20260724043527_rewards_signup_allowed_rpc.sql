-- Rate-limit de signup como RPC atómica (check + insert) en public. La edge fn
-- crear-cuenta-rewards no puede leer rewards.signup_attempts por REST (.from) porque
-- el schema rewards se accede por RPC, no por tabla directa. Esta DEFINER toca la
-- tabla en SQL directo y se llama vía .rpc() (patrón que sí funciona). Devuelve
-- false si el IP ya superó el límite (10/hora); si no, registra el intento y da true.
create or replace function public.rewards_signup_allowed(p_ip text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from rewards.signup_attempts
  where ip = coalesce(nullif(trim(p_ip), ''), 'desconocida')
    and created_at >= now() - interval '1 hour';

  if v_count >= 10 then
    return false;
  end if;

  insert into rewards.signup_attempts (ip)
  values (coalesce(nullif(trim(p_ip), ''), 'desconocida'));
  return true;
end $$;

revoke execute on function public.rewards_signup_allowed(text) from public, anon;
grant execute on function public.rewards_signup_allowed(text) to service_role;
