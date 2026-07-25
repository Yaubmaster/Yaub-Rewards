-- Endurecimiento post-advisor: el bucket público rewards-agentes sirve archivos
-- por URL pública sin necesitar SELECT en storage.objects; la policy amplia solo
-- permitía LISTAR todos los archivos. Se restringe el listado al dueño de la carpeta.
drop policy if exists rewards_agentes_select on storage.objects;

create policy rewards_agentes_select on storage.objects
for select to authenticated
using (
  bucket_id = 'rewards-agentes'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
