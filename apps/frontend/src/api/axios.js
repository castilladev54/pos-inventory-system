import { api } from "./axiosClient";

/**
 * Puente de compatibilidad para código heredado (JS).
 * Enruta las peticiones anteponiendo el prefijo `/api` para alinearse con
 * la nueva base URL de `axiosClient`.
 */
const API = {
  get(url, config) {
    return api.get(`/api${url}`, config);
  },
  post(url, data, config) {
    return api.post(`/api${url}`, data, config);
  },
  put(url, data, config) {
    return api.put(`/api${url}`, data, config);
  },
  delete(url, config) {
    return api.delete(`/api${url}`, config);
  },
  patch(url, data, config) {
    return api.patch(`/api${url}`, data, config);
  },
  defaults: api.defaults,
  interceptors: api.interceptors,
};

export default API;
