# ---------- stage 1: build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Envs do Vite sao injetadas em BUILD-TIME: precisam existir como ARG/ENV
# neste stage, senao o `npm run build` nao as enxerga (EasyPanel passa como
# build args). Toda VITE_* nova usada pelo app precisa ganhar uma linha aqui
# tambem, senao o valor configurado no EasyPanel e descartado em silencio.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GROWTH_AJUSTE_ALUNO_RA
ARG VITE_GROWTH_AJUSTE_DATA
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GROWTH_AJUSTE_ALUNO_RA=$VITE_GROWTH_AJUSTE_ALUNO_RA
ENV VITE_GROWTH_AJUSTE_DATA=$VITE_GROWTH_AJUSTE_DATA

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- stage 2: serve ----------
FROM nginx:alpine
# Copia do STAGE de build (nao do contexto local): garante build limpo no
# EasyPanel/CI sem depender de dist/ pre-existente.
COPY --from=build /app/dist/ /usr/share/nginx/html/

# SPA fallback + politica de cache (index.html e config.js nunca cacheados).
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Gera /config.js a partir das env vars do container a cada boot. O entrypoint
# oficial do nginx executa tudo que esta em /docker-entrypoint.d/*.sh antes de
# subir o servidor -- por isso NAO ha ENTRYPOINT/CMD customizado aqui.
#
# Consequencia pratica: as credenciais funcionam mesmo que a plataforma de
# deploy passe as variaveis apenas como env de RUNTIME (sem build arg), e trocar
# a senha passa a exigir so um restart do container, nao um rebuild.
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
