-- O webhook v2 consulta apenas eventos recentes para evitar processar em
-- paralelo a mesma venda que também chegou no formato legado.
create index if not exists webhook_debug_log_provider_created_at_idx
  on public.webhook_debug_log (provider, created_at desc);
