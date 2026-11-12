/**
 * L'API tourne sur le port 8080 de la même machine que l'interface : en utilisant le nom d'hôte
 * courant, l'app fonctionne aussi depuis un téléphone sur le réseau local (ex. http://192.168.1.20:4200).
 */
export const API_URL = `${location.protocol}//${location.hostname}:8080/api`;
