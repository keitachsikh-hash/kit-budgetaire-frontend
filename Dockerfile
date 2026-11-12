FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
# PORT est fourni par Railway ; API_UPSTREAM pointe vers le service API (sans /api final).
ENV PORT=80 \
    API_UPSTREAM=https://kit-budgetaire-backend-production.up.railway.app
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/budget-web/browser /usr/share/nginx/html
