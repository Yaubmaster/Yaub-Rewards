-- gen_random_bytes es de pgcrypto (schema `extensions`) y con search_path=''
-- no resuelve. gen_random_uuid vive en pg_catalog, que siempre resuelve.
create or replace function rewards.asegurar_chat_web(p_assistant_id uuid)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_key   text;
  v_cfg   jsonb;
  v_doms  jsonb;
  v_n     int;
begin
  select a.widget_public_key, coalesce(a.widget_config, '{}'::jsonb)
    into v_key, v_cfg
  from public.assistants a
  where a.id = p_assistant_id and a.archived_at is null;

  if not found then
    raise exception 'No tienes permiso para editar este agente';
  end if;

  if v_key is null then
    v_key := 'wk_' || substr(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      1, 24
    );
  end if;

  v_doms := coalesce(v_cfg->'allowed_domains', '[]'::jsonb);
  if not (v_doms @> '["rewards.yaub.ai"]'::jsonb) then
    v_doms := v_doms || '["rewards.yaub.ai"]'::jsonb;
  end if;

  update public.assistants
     set widget_public_key = v_key,
         widget_config = v_cfg || jsonb_build_object('enabled', true, 'allowed_domains', v_doms)
   where id = p_assistant_id;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'No tienes permiso para editar este agente';
  end if;

  return jsonb_build_object('ok', true, 'widget_key', v_key);
end;
$$;

revoke execute on function rewards.asegurar_chat_web(uuid) from public, anon;
grant execute on function rewards.asegurar_chat_web(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
