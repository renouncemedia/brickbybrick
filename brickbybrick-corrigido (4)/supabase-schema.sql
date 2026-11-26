create table if not exists public.orcamento_partilhado (
  id integer primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- A tabela não deve ser acessível diretamente pela chave pública.
-- O acesso é feito pela função /api/data do Vercel, que usa a chave de servidor
-- guardada em variáveis de ambiente e nunca incluída no HTML.
alter table public.orcamento_partilhado enable row level security;

-- Histórico: cópia do estado anterior (no máximo uma de 5 em 5 minutos), para recuperar se algo for sobrescrito.
create table if not exists public.orcamento_historico (
  id bigint generated always as identity primary key,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public.orcamento_historico enable row level security;
