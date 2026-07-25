-- Prompt del agente editable desde Rewards, sin salir a la plataforma.
-- SECURITY INVOKER: la RLS de public.assistants decide quien puede editar.
-- El bloque de contexto que arma Rewards (<!-- rewards:contexto --> con lo que
-- se extrae de sitios, documentos, imagenes y ofertas) se conserva intacto:
-- el usuario edita SU prompt, y el contexto se re-inyecta al final.

create or replace function rewards.leer_prompt_agente(p_assistant_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'prompt_base', regexp_replace(coalesce(a.prompt, ''),
      '\s*<!-- rewards:contexto:inicio -->.*<!-- rewards:contexto:fin -->', '', 'g'),
    'contexto', (regexp_match(coalesce(a.prompt, ''),
      '<!-- rewards:contexto:inicio -->(.*)<!-- rewards:contexto:fin -->'))[1]
  )
  from public.assistants a
  where a.id = p_assistant_id and a.archived_at is null;
$$;

revoke execute on function rewards.leer_prompt_agente(uuid) from public, anon;
grant execute on function rewards.leer_prompt_agente(uuid) to authenticated, service_role;

create or replace function rewards.guardar_prompt_agente(p_assistant_id uuid, p_prompt text)
returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $$
declare
  v_actual text;
  v_ctx text;
  v_tocadas int;
begin
  select a.prompt into v_actual from public.assistants a
  where a.id = p_assistant_id and a.archived_at is null;
  if not found then
    raise exception 'Agente no encontrado o no es de tu cuenta';
  end if;

  -- se preserva el bloque de contexto que gestiona Rewards
  v_ctx := (regexp_match(coalesce(v_actual, ''),
    '(<!-- rewards:contexto:inicio -->.*<!-- rewards:contexto:fin -->)'))[1];

  update public.assistants
  set prompt = btrim(coalesce(p_prompt, '')) ||
               case when v_ctx is null then '' else E'\n\n' || v_ctx end
  where id = p_assistant_id;
  get diagnostics v_tocadas = row_count;

  if v_tocadas = 0 then
    raise exception 'No tienes permiso para editar este agente';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function rewards.guardar_prompt_agente(uuid, text) from public, anon;
grant execute on function rewards.guardar_prompt_agente(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
