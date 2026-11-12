/**
 * En développement (ng serve / http-server sur le port 4200), l'API tourne sur le port 8080 de la même
 * machine : en utilisant le nom d'hôte courant, l'app fonctionne aussi depuis un téléphone sur le réseau
 * local (ex. http://192.168.1.20:4200).
 * En production (conteneur nginx, ex. Railway), nginx relaie /api vers l'API : même origine, pas de CORS.
 */
export const API_URL =
  location.port === '4200' ? `${location.protocol}//${location.hostname}:8080/api` : '/api';
