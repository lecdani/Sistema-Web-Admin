import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFromLocalStorage, setToLocalStorage } from '../services/database';
import { User, Store, Product, City, Planogram, Distribution } from '../types';

interface DataState {
  users: User[];
  stores: Store[];
  products: Product[];
  cities: City[];
  planograms: Planogram[];
  distributions: Distribution[];
  isLoading: boolean;
  error: string | null;
}

export const useData = () => {
  const [state, setState] = useState<DataState>({
    users: [],
    stores: [],
    products: [],
    cities: [],
    planograms: [],
    distributions: [],
    isLoading: true,
    error: null
  });

  // Cargar todos los datos de una vez
  const loadData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const [users, stores, products, cities, planograms, distributions] = await Promise.all([
        Promise.resolve(getFromLocalStorage('app-users') || []),
        Promise.resolve(getFromLocalStorage('app-stores') || []),
        Promise.resolve(getFromLocalStorage('app-products') || []),
        Promise.resolve(getFromLocalStorage('app-cities') || []),
        Promise.resolve(getFromLocalStorage('app-planograms') || []),
        Promise.resolve(getFromLocalStorage('app-distributions') || [])
      ]);

      setState({
        users,
        stores,
        products,
        cities,
        planograms,
        distributions,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Error cargando datos:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al cargar los datos'
      }));
    }
  }, []);

  // Cargar datos al montar el hook
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Funciones optimizadas para obtener datos específicos
  const getStoreById = useCallback((id: string) => {
    return state.stores.find(store => store.id === id) || null;
  }, [state.stores]);

  const getProductById = useCallback((id: string) => {
    return state.products.find(product => product.id === id) || null;
  }, [state.products]);

  const getCityById = useCallback((id: string) => {
    return state.cities.find(city => city.id === id) || null;
  }, [state.cities]);

  const getUserById = useCallback((id: string) => {
    return state.users.find(user => user.id === id) || null;
  }, [state.users]);

  // Obtener tiendas activas con información de ciudad
  const activeStoresWithCity = useMemo(() => {
    return state.stores
      .filter(store => store.isActive)
      .map(store => ({
        ...store,
        cityName: getCityById(store.cityId)?.name || 'Sin ciudad'
      }));
  }, [state.stores, getCityById]);

  // Obtener productos activos
  const activeProducts = useMemo(() => {
    return state.products.filter(product => product.isActive);
  }, [state.products]);

  // Obtener vendedores
  const salespeople = useMemo(() => {
    return state.users.filter(user => user.role === 'user' && user.isActive);
  }, [state.users]);

  // Funciones para actualizar datos
  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    const updatedUsers = state.users.map(user =>
      user.id === id ? { ...user, ...updates, updatedAt: new Date() } : user
    );
    setState(prev => ({ ...prev, users: updatedUsers }));
    setToLocalStorage('app-users', updatedUsers);
  }, [state.users]);

  const updateStore = useCallback((id: string, updates: Partial<Store>) => {
    const updatedStores = state.stores.map(store =>
      store.id === id ? { ...store, ...updates, updatedAt: new Date() } : store
    );
    setState(prev => ({ ...prev, stores: updatedStores }));
    setToLocalStorage('app-stores', updatedStores);
  }, [state.stores]);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const updatedProducts = state.products.map(product =>
      product.id === id ? { ...product, ...updates, updatedAt: new Date() } : product
    );
    setState(prev => ({ ...prev, products: updatedProducts }));
    setToLocalStorage('app-products', updatedProducts);
  }, [state.products]);

  // Funciones para crear nuevos elementos
  const createUser = useCallback((userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newUser: User = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const updatedUsers = [...state.users, newUser];
    setState(prev => ({ ...prev, users: updatedUsers }));
    setToLocalStorage('app-users', updatedUsers);
    return newUser;
  }, [state.users]);

  const createStore = useCallback((storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newStore: Store = {
      ...storeData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const updatedStores = [...state.stores, newStore];
    setState(prev => ({ ...prev, stores: updatedStores }));
    setToLocalStorage('app-stores', updatedStores);
    return newStore;
  }, [state.stores]);

  const createProduct = useCallback((productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Product = {
      ...productData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const updatedProducts = [...state.products, newProduct];
    setState(prev => ({ ...prev, products: updatedProducts }));
    setToLocalStorage('app-products', updatedProducts);
    return newProduct;
  }, [state.products]);

  // Funciones para eliminar elementos (soft delete)
  const deleteUser = useCallback((id: string) => {
    updateUser(id, { isActive: false });
  }, [updateUser]);

  const deleteStore = useCallback((id: string) => {
    updateStore(id, { isActive: false });
  }, [updateStore]);

  const deleteProduct = useCallback((id: string) => {
    updateProduct(id, { isActive: false });
  }, [updateProduct]);

  return {
    // Estado
    ...state,
    
    // Datos procesados
    activeStoresWithCity,
    activeProducts,
    salespeople,
    
    // Funciones de búsqueda
    getStoreById,
    getProductById,
    getCityById,
    getUserById,
    
    // Funciones de actualización
    updateUser,
    updateStore,
    updateProduct,
    
    // Funciones de creación
    createUser,
    createStore,
    createProduct,
    
    // Funciones de eliminación
    deleteUser,
    deleteStore,
    deleteProduct,
    
    // Función para recargar datos
    refreshData: loadData
  };
};