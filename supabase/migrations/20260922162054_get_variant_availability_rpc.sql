-- Extraída de supabase_migrations.schema_migrations del proyecto
-- remoto (marketplace-iguazu-db) el 2026-09-25, con su mismo
-- version/nombre. SQL idéntico al que ya está aplicado en el remoto.

create or replace function public.get_variant_availability(p_product_id integer)
returns table(variant_id integer, available integer)
language sql
security definer
stable
set search_path = public
as $$
  select
    pv.id as variant_id,
    coalesce(i.quantity - i.reserved, 0) as available
  from public.product_variants pv
  left join public.inventory i
    on i.product_id = pv.product_id
    and i.variant_id = pv.id
  where pv.product_id = p_product_id
    and pv.activo = true;
$$;

revoke all on function public.get_variant_availability(integer) from public;
revoke all on function public.get_variant_availability(integer) from anon;
revoke all on function public.get_variant_availability(integer) from authenticated;
grant execute on function public.get_variant_availability(integer) to anon;
grant execute on function public.get_variant_availability(integer) to authenticated;
