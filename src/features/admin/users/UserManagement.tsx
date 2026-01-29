import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Power,
  PowerOff,
  Filter,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Save,
  X,
  ArrowLeft,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Badge } from '@/shared/components/base/Badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/shared/components/base/Dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/base/AlertDialog';
import { Label } from '@/shared/components/base/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/base/Select';
import { User, City } from '@/shared/types';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { toast } from '@/shared/components/base/Toast';

interface UserManagementProps {
  onBack: () => void;
}

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'user';
  cityId: string;
  password: string;
  isActive: boolean;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'user',
    cityId: '',
    password: '',
    isActive: true
  });

  useEffect(() => {
    loadUsers();
    loadCities();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      const userData = getFromLocalStorage('app-users') || [];
      setUsers(userData);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      toast.error('Error al cargar los usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCities = async () => {
    try {
      const cityData = getFromLocalStorage('app-cities') || [];
      setCities(cityData);
    } catch (error) {
      console.error('Error cargando ciudades:', error);
      toast.error('Error al cargar las ciudades');
    }
  };

  const applyFilters = () => {
    let filtered = users;

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por rol
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => 
        statusFilter === 'active' ? user.isActive : !user.isActive
      );
    }

    setFilteredUsers(filtered);
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      role: 'user',
      cityId: '',
      password: '',
      isActive: true
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const generateUserId = (): string => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      toast.error('El nombre es requerido');
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error('El apellido es requerido');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('El email es requerido');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('El email no es válido');
      return false;
    }
    if (!editingUser && !formData.password.trim()) {
      toast.error('La contraseña es requerida para nuevos usuarios');
      return false;
    }
    if (formData.password && formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    // Verificar email único
    const existingUser = users.find(user => 
      user.email === formData.email && (!editingUser || user.id !== editingUser.id)
    );
    if (existingUser) {
      toast.error('Ya existe un usuario con ese email');
      return false;
    }

    return true;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) return;

    try {
      const currentUsers = [...users];
      const now = new Date();

      if (editingUser) {
        // Editar usuario existente
        const userIndex = currentUsers.findIndex(u => u.id === editingUser.id);
        if (userIndex !== -1) {
          const updatedUser = {
            ...editingUser,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.toLowerCase().trim(),
            role: formData.role,
            cityId: formData.role === 'user' && formData.cityId ? formData.cityId : undefined,
            isActive: formData.isActive,
            updatedAt: now
          };
          
          // Solo actualizar contraseña si se proporcionó una nueva
          if (formData.password.trim()) {
            updatedUser.password = formData.password.trim();
          }
          
          currentUsers[userIndex] = updatedUser;
        }
        toast.success('Usuario actualizado correctamente');
      } else {
        // Crear nuevo usuario
        const newUser: User = {
          id: generateUserId(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.toLowerCase().trim(),
          password: formData.password.trim(),
          role: formData.role,
          cityId: formData.role === 'user' && formData.cityId ? formData.cityId : undefined,
          isActive: formData.isActive,
          createdAt: now,
          updatedAt: now
        };
        currentUsers.push(newUser);
        toast.success('Usuario creado correctamente');
      }

      // Guardar usuarios actualizados
      setToLocalStorage('app-users', currentUsers);
      setUsers(currentUsers);

      // Limpiar formulario y cerrar diálogo
      resetForm();
      setShowAddDialog(false);
      
    } catch (error) {
      console.error('Error guardando usuario:', error);
      toast.error('Error al guardar el usuario');
    }
  };

  const handleEditUser = (user: User) => {
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      cityId: user.cityId || '',
      password: '',
      isActive: user.isActive
    });
    setEditingUser(user);
    setShowAddDialog(true);
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const updatedUsers = users.map(u =>
        u.id === user.id
          ? { ...u, isActive: !u.isActive, updatedAt: new Date() }
          : u
      );
      
      setToLocalStorage('app-users', updatedUsers);
      setUsers(updatedUsers);
      
      toast.success(`Usuario ${!user.isActive ? 'activado' : 'desactivado'} correctamente`);
    } catch (error) {
      console.error('Error cambiando estado del usuario:', error);
      toast.error('Error al cambiar el estado del usuario');
    }
  };

  const getRoleText = (role: string) => {
    return role === 'admin' ? 'Administrador' : 'Vendedor';
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getCityName = (cityId?: string) => {
    if (!cityId) return 'Sin asignar';
    const city = cities.find(c => c.id === cityId);
    return city ? city.name : 'Ciudad eliminada';
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-indigo-100 rounded-lg">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
            <p className="text-gray-500">Administra los usuarios del sistema</p>
          </div>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => {
                resetForm();
                setShowAddDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? 'Modifica la información del usuario.' 
                  : 'Completa la información para crear un nuevo usuario.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5 px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Apellido"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                />
              </div>
              
              <div>
                <Label htmlFor="role">Rol</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value: 'admin' | 'user') => 
                    setFormData(prev => ({ ...prev, role: value, cityId: value === 'admin' ? '' : prev.cityId }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Vendedor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Selector de ciudad solo para vendedores */}
              {formData.role === 'user' && (
                <div>
                  <Label htmlFor="cityId">Ciudad *</Label>
                  <Select 
                    value={formData.cityId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, cityId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar ciudad" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.length > 0 ? (
                        cities.map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name} - {city.country}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No hay ciudades disponibles
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {cities.length === 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      Es necesario crear ciudades antes de asignar vendedores
                    </p>
                  )}
                </div>
              )}
              
              {(!editingUser || showPassword) && (
                <div>
                  <Label htmlFor="password">
                    {editingUser ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Contraseña"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              
              {editingUser && !showPassword && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword(true)}
                  className="text-sm"
                >
                  Cambiar contraseña
                </Button>
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <Label htmlFor="isActive">Usuario activo</Label>
              </div>
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </DialogClose>
              <Button onClick={handleSaveUser} className="bg-indigo-600 hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-2" />
                {editingUser ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Total Usuarios</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Usuarios Activos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {users.filter(u => u.isActive).length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-50">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Administradores</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50">
                <UserX className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  <SelectItem value="admin">Administradores</SelectItem>
                  <SelectItem value="user">Vendedores</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>
            Gestiona todos los usuarios del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Registro
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-medium">
                              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          {user.role === 'user' && user.cityId && (
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {getCityName(user.cityId)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleText(user.role)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(user.isActive)}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className={user.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                            >
                              {user.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.isActive ? 'Desactivar' : 'Activar'} Usuario
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro que deseas {user.isActive ? 'desactivar' : 'activar'} al usuario{' '}
                                <strong>{user.firstName} {user.lastName}</strong>?
                                {user.isActive && ' El usuario no podrá acceder al sistema.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleToggleStatus(user)}
                                className={user.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                              >
                                {user.isActive ? 'Desactivar' : 'Activar'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron usuarios
              </h3>
              <p className="text-gray-600">
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda.'
                  : 'Comienza agregando usuarios al sistema.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {filteredUsers.length > itemsPerPage && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-gray-600">
            Página {currentPage} de {Math.ceil(filteredUsers.length / itemsPerPage)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredUsers.length / itemsPerPage)))}
            disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
};