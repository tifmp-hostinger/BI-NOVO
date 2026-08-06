#!/bin/sh
# Gera /usr/share/nginx/html/config.js a partir das variaveis de ambiente do
# container, toda vez que ele sobe.
#
# Por que existe: o app e um SPA estatico. `import.meta.env` do Vite so enxerga
# uma variavel se ela existir no momento do `npm run build` (build arg). Se a
# plataforma de deploy define a variavel apenas como env de RUNTIME do
# container, o valor nunca chega ao JS compilado e a configuracao some sem erro
# visivel. Este script cobre esse caso -- e permite trocar a configuracao
# reiniciando o container, sem rebuild da imagem.
#
# O que NAO vai aqui: credencial de usuario. O login da plataforma e feito
# contra o banco (tabela public.perfis + Supabase Auth), nao por variavel de
# ambiente.
#
# O nginx oficial executa automaticamente todo /docker-entrypoint.d/*.sh antes
# de iniciar o servidor, entao nao ha ENTRYPOINT customizado aqui.
set -eu

CONFIG_FILE="/usr/share/nginx/html/config.js"

# Escapa o valor para nao quebrar a string JS gerada: remove quebras de linha e
# protege barra invertida e aspas.
escapa_js() {
  printf '%s' "${1:-}" | tr -d '\r\n' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

{
  printf 'window.__APP_CONFIG__ = {\n'
  printf '  "VITE_SUPABASE_URL": "%s",\n' "$(escapa_js "${VITE_SUPABASE_URL:-}")"
  printf '  "VITE_SUPABASE_ANON_KEY": "%s"\n' "$(escapa_js "${VITE_SUPABASE_ANON_KEY:-}")"
  printf '};\n'
} > "$CONFIG_FILE"

# Log sem expor valor: so diz se chegou, e com quantos caracteres.
printf '[app-config] VITE_SUPABASE_URL: %s caractere(s) | VITE_SUPABASE_ANON_KEY: %s caractere(s)\n' \
  "$(printf '%s' "$(escapa_js "${VITE_SUPABASE_URL:-}")" | wc -c | tr -d ' ')" \
  "$(printf '%s' "$(escapa_js "${VITE_SUPABASE_ANON_KEY:-}")" | wc -c | tr -d ' ')"
