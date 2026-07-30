import { create } from "zustand";
import API from "../api/axios";

const API_URL = "/staff";

export const useStaffStore = create((set, get) => ({
  staff: [],
  total: 0,
  isLoading: false,
  error: null,

  fetchStaff: async (dateFilter = 'all') => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (dateFilter && dateFilter !== 'all') params.append('dateFilter', dateFilter);
      const url = params.toString() ? `${API_URL}?${params}` : API_URL;
      const response = await API.get(url);
      set({
        staff: response.data.employees || [],
        total: response.data.total || 0,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error.response?.data?.message || "Error al cargar los empleados",
        isLoading: false,
      });
      throw error;
    }
  },

  createEmployee: async (employeeData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.post(API_URL, employeeData);
      set((state) => ({
        staff: [...state.staff, response.data.employee],
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || "Error al crear empleado",
        isLoading: false,
      });
      throw error;
    }
  },

  updateEmployeePermissions: async (id, permissions) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.put(`${API_URL}/${id}`, { permissions });
      set((state) => ({
        staff: state.staff.map((emp) =>
          emp._id === id ? { ...emp, permissions: response.data.employee.permissions } : emp
        ),
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || "Error al actualizar permisos",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteEmployee: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.delete(`${API_URL}/${id}`);
      set((state) => ({
        staff: state.staff.filter((emp) => emp._id !== id),
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || "Error al eliminar empleado",
        isLoading: false,
      });
      throw error;
    }
  },
}));
