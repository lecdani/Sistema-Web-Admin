import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Phone,
  Waypoints,
  Store as StoreIcon,
  ChevronDown,
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
import { User } from '@/shared/types';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { usersApi } from '@/shared/services/users-api';
import { citiesApi } from '@/shared/services/cities-api';
import { salesRoutesApi } from '@/shared/services/sales-routes-api';
import { assignmentsApi } from '@/shared/services/assignments-api';
import { storesApi } from '@/shared/services/stores-api';
import { toast } from '@/shared/components/base/Toast';
import type { City, SalesRoute } from '@/shared/types';

const ASSIGN_ROUTE_LIST_MAX = 100;

function applyAssignedRouteToUser(u: User, routeId: string | null): User {
  const rid = routeId && String(routeId).trim() ? String(routeId).trim() : null;
  return { ...u, salesRouteId: rid ?? undefined, salesRouteName: undefined };
}

function sameUserId(a: string | undefined | null, b: string | undefined | null): boolean {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

interface UserManagementProps {
  onBack?: () => void;
}

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'admin' | 'user';
  password: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBack }) => {
  const router = useRouter();
  const { translate } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);

  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAssignRouteDialog, setShowAssignRouteDialog] = useState(false);
  const [assignRouteUser, setAssignRouteUser] = useState<User | null>(null);
  const [assignRouteSelection, setAssignRouteSelection] = useState<string>('_none');
  const [assignRouteSaving, setAssignRouteSaving] = useState(false);
  const [assignModalStores, setAssignModalStores] = useState<{ id: string; name: string }[]>([]);
  const [assignModalStoresLoading, setAssignModalStoresLoading] = useState(false);
  const [assignRoutePickerOpen, setAssignRoutePickerOpen] = useState(false);
  const [assignRouteSearchQuery, setAssignRouteSearchQuery] = useState('');
  const assignRouteFieldRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [cities, setCities] = useState<City[]>([]);
  const [salesRoutes, setSalesRoutes] = useState<SalesRoute[]>([]);

  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'user',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  useEffect(() => {
    loadUsers();
    loadCities();
    loadSalesRoutesCatalog();
  }, []);

  useEffect(() => {
    if (!showAssignRouteDialog) return;
    if (!assignRouteSelection || assignRouteSelection === '_none') {
      setAssignModalStores([]);
      setAssignModalStoresLoading(false);
      return;
    }
    const rid = String(assignRouteSelection).trim();
    let cancelled = false;
    setAssignModalStoresLoading(true);
    void (async () => {
      try {
        const [assignments, stores] = await Promise.all([
          assignmentsApi.fetchAll(),
          storesApi.fetchAll(),
        ]);
        if (cancelled) return;
        const rnorm = rid.toLowerCase();
        const forRoute = assignments.filter(
          (a) => String(a.salesRouteId || '').trim().toLowerCase() === rnorm
        );
        const smap = new Map(stores.map((s) => [String(s.id).trim().toLowerCase(), s] as const));
        const rows = forRoute
          .map((a) => {
            const s = smap.get(String(a.storeId).trim().toLowerCase());
            return {
              id: String(a.storeId),
              name: String(s?.name || a.storeId).trim() || String(a.storeId),
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        setAssignModalStores(rows);
      } catch {
        if (!cancelled) setAssignModalStores([]);
      } finally {
        if (!cancelled) setAssignModalStoresLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAssignRouteDialog, assignRouteSelection]);

  const loadSalesRoutesCatalog = async () => {
    try {
      const data = await salesRoutesApi.fetchAll();
      setSalesRoutes(data);
    } catch (e) {
      console.error('Error cargando rutas:', e);
      setSalesRoutes([]);
    }
  };

  const salesRouteNameById = (id: string | undefined) => {
    const sid = String(id ?? '').trim();
    if (!sid) return '';
    const key = sid.toLowerCase();
    const r = salesRoutes.find((x) => String(x.id).trim().toLowerCase() === key);
    return r?.name || sid;
  };

  const routeFromCatalog = (routeId: string | undefined) => {
    const sid = String(routeId ?? '').trim().toLowerCase();
    if (!sid) return null;
    return salesRoutes.find((x) => String(x.id).trim().toLowerCase() === sid) ?? null;
  };

  const routeLabelForUser = (u: User) => {
    if (u.role !== 'user') return '—';
    const sid = String(u.salesRouteId || '').trim();
    if (!sid) return '—';
    const r = routeFromCatalog(sid);
    const code = r?.code?.trim();
    const name = String(r?.name || u.salesRouteName || '').trim() || salesRouteNameById(sid);
    if (code && name) return `${code} · ${name}`;
    if (code) return code;
    return name || sid;
  };

  const loadCities = async () => {
    try {
      const data = await citiesApi.fetchAll();
      setCities(data);
    } catch (e) {
      console.error('Error cargando ciudades:', e);
      setCities([]);
    }
  };

  const cityNameById = (id: string | undefined) => {
    const key = String(id ?? '').trim();
    if (!key) return '';
    const c = cities.find((x) => String(x.id) === key);
    return c?.name || '';
  };

  const formatRouteSelectLabel = (r: SalesRoute) => {
    const code = r.code?.trim();
    const city = cityNameById(r.cityId);
    const tail = city ? ` (${city})` : '';
    if (code) return `${code} · ${r.name}${tail}`;
    return `${r.name}${tail}`;
  };

  const assignRoutePickerOptions = useMemo(() => {
    if (!assignRouteUser) return [] as SalesRoute[];
    const currentId = String(assignRouteUser.salesRouteId || '').trim().toLowerCase();
    const base = salesRoutes
      .filter(
        (r) =>
          r.isActive ||
          (!!currentId && String(r.id).trim().toLowerCase() === currentId)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    const sel = String(assignRouteSelection).trim().toLowerCase();
    const orphan =
      sel && sel !== '_none' && !base.some((r) => String(r.id).trim().toLowerCase() === sel)
        ? salesRoutes.find((r) => String(r.id).trim().toLowerCase() === sel)
        : null;
    return orphan ? [orphan, ...base.filter((x) => String(x.id) !== String(orphan.id))] : base;
  }, [assignRouteUser, salesRoutes, assignRouteSelection]);

  const assignRoutePickerFiltered = useMemo(() => {
    const q = assignRouteSearchQuery.trim().toLowerCase();
    if (!q) return assignRoutePickerOptions;
    return assignRoutePickerOptions.filter((r) => {
      const code = (r.code || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const city = cityNameById(r.cityId).toLowerCase();
      return code.includes(q) || name.includes(q) || city.includes(q);
    });
  }, [assignRoutePickerOptions, assignRouteSearchQuery, cities]);

  const assignRoutePickerShown = useMemo(
    () => assignRoutePickerFiltered.slice(0, ASSIGN_ROUTE_LIST_MAX),
    [assignRoutePickerFiltered]
  );
  const assignRoutePickerTruncated = assignRoutePickerFiltered.length > ASSIGN_ROUTE_LIST_MAX;

  const assignRouteInputClosedValue = useMemo(() => {
    if (assignRouteSelection === '_none') return '';
    const sid = String(assignRouteSelection).trim().toLowerCase();
    const r = salesRoutes.find((x) => String(x.id).trim().toLowerCase() === sid);
    return r ? formatRouteSelectLabel(r) : salesRouteNameById(assignRouteSelection);
  }, [assignRouteSelection, salesRoutes]);

  useEffect(() => {
    if (!assignRoutePickerOpen) return;
    let remove: (() => void) | undefined;
    const t = window.setTimeout(() => {
      const onDocDown = (e: MouseEvent) => {
        const node = e.target as Node;
        if (assignRouteFieldRef.current?.contains(node)) return;
        setAssignRoutePickerOpen(false);
      };
      document.addEventListener('mousedown', onDocDown);
      remove = () => document.removeEventListener('mousedown', onDocDown);
    }, 0);
    return () => {
      clearTimeout(t);
      remove?.();
    };
  }, [assignRoutePickerOpen]);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadUsers = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setIsLoading(true);
      const data = await usersApi.fetchAll();
      setUsers(data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      toast.error(translate('errorLoadUsers'));
      setUsers([]);
    } finally {
      if (!opts?.silent) setIsLoading(false);
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
      phone: '',
      role: 'user',
      password: '',
    });
    setFormErrors({});
    setPasswordErrors([]);
    setEditingUser(null);
    setShowPassword(false);
  };

  const getPasswordErrors = (password: string): string[] => {
    const err: string[] = [];
    if (!password) return err;
    if (password.length < 8) err.push(translate('passwordMin8'));
    if (!/[A-Z]/.test(password)) err.push(translate('passwordMinUpper'));
    if (!/[^A-Za-z0-9]/.test(password)) err.push(translate('passwordMinSpecial'));
    return err;
  };

  const validateForm = (): boolean => {
    const err: Partial<Record<keyof UserFormData, string>> = {};
    if (!formData.firstName.trim()) err.firstName = translate('firstNameRequired');
    if (!formData.lastName.trim()) err.lastName = translate('lastNameRequired');
    if (!formData.email.trim()) err.email = translate('emailRequiredShort');
    else if (!/\S+@\S+\.\S+/.test(formData.email)) err.email = translate('emailInvalid');
    if (!formData.phone.trim()) err.phone = translate('phoneRequired');

    const emailNorm = formData.email.trim().toLowerCase();
    const existingEmail = users.find(
      u => u.email.toLowerCase() === emailNorm && (!editingUser || u.id !== editingUser.id)
    );
    if (existingEmail) err.email = translate('duplicateEmail');

    const phoneNorm = formData.phone.trim();
    const existingPhone = users.find(
      u => (u.phone || '').trim() === phoneNorm && (!editingUser || u.id !== editingUser.id)
    );
    if (existingPhone) err.phone = translate('duplicatePhone');

    const isNewUser = !editingUser;
    const hasPassword = formData.password.trim().length > 0;
    if (isNewUser && !hasPassword) err.password = translate('passwordRequiredNew');
    const pwdErrs = getPasswordErrors(formData.password.trim());
    if (hasPassword && pwdErrs.length) {
      setPasswordErrors(pwdErrs);
      err.password = translate('passwordRequirements');
    } else setPasswordErrors([]);

    setFormErrors(err);
    return Object.keys(err).length === 0 && (isNewUser ? pwdErrs.length === 0 : (hasPassword ? pwdErrs.length === 0 : true));
  };

  const handleSaveUser = async () => {
    if (!validateForm()) return;

    try {
      const userData: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone.trim(),
        role: formData.role,
      };

      if (editingUser) {
        if (formData.password.trim()) {
          userData.password = formData.password.trim();
        }
        await usersApi.update(editingUser.id, userData);
        toast.success(translate('userSaved'));
      } else {
        if (formData.password.trim()) userData.password = formData.password.trim();
        await usersApi.create(userData);
        toast.success(translate('userCreated'));
        setSearchTerm(formData.firstName.trim() || formData.email.trim());
        setCurrentPage(1);
      }

      loadUsers();
      loadSalesRoutesCatalog();

      // Limpiar formulario y cerrar diálogo
      resetForm();
      setShowAddDialog(false);

    } catch (error: any) {
      console.error('Error guardando usuario:', error);
      const msg =
        error?.data?.message ??
        error?.data?.title ??
        (typeof error?.message === 'string' && error.message.includes('duplicate key')
          ? translate('duplicateEmailLong')
          : error?.message) ??
        translate('errorSaveUser');
      toast.error(msg);
    }
  };

  const handleEditUser = (user: User) => {
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      password: '',
    });
    setFormErrors({});
    setPasswordErrors([]);
    setEditingUser(user);
    setShowAddDialog(true);
  };

  const handleToggleStatus = async (user: User) => {
    try {
      // Activar y desactivar usan el mismo endpoint (toggle en el backend)
      await usersApi.deactivate(user.id);

      await loadUsers();
      toast.success(!user.isActive ? translate('userActivatedSuccess') : translate('userDeactivatedSuccess'));
    } catch (error) {
      console.error('Error cambiando estado del usuario:', error);
      toast.error(translate('errorToggleUser'));
    }
  };

  const handleViewDetail = (user: User) => {
    setSelectedUser(user);
    setShowDetailDialog(true);
  };

  const openAssignRouteModal = (user: User) => {
    setAssignRouteUser(user);
    setAssignRoutePickerOpen(false);
    setAssignRouteSearchQuery('');
    const raw = user.salesRouteId ? String(user.salesRouteId).trim() : '';
    if (!raw) {
      setAssignRouteSelection('_none');
    } else {
      const match = salesRoutes.find((x) => String(x.id).trim().toLowerCase() === raw.toLowerCase());
      setAssignRouteSelection(match ? String(match.id) : raw);
    }
    void loadSalesRoutesCatalog();
    setShowAssignRouteDialog(true);
  };

  const assignRoutePick = (id: string) => {
    setAssignRouteSelection(id);
    setAssignRoutePickerOpen(false);
    setAssignRouteSearchQuery('');
  };

  const handleSaveAssignRoute = async () => {
    if (!assignRouteUser || assignRouteUser.role !== 'user') return;
    const uid = assignRouteUser.id;
    const routeId =
      assignRouteSelection && assignRouteSelection !== '_none'
        ? String(assignRouteSelection).trim()
        : null;
    setAssignRouteSaving(true);
    try {
      const updatedUser = await usersApi.assignRoute(uid, routeId);
      const mergedFromAssign = applyAssignedRouteToUser(
        { ...assignRouteUser, ...updatedUser },
        routeId
      );
      toast.success(translate('assignUserSalesRouteSuccess'));
      setShowAssignRouteDialog(false);
      setAssignRouteUser(null);

      try {
        const data = await usersApi.fetchAll();
        setUsers(
          data.map((u) =>
            sameUserId(u.id, uid)
              ? applyAssignedRouteToUser({ ...u, ...mergedFromAssign }, routeId)
              : u
          )
        );
      } catch {
        setUsers((prev) =>
          prev.map((u) => (sameUserId(u.id, uid) ? mergedFromAssign : u))
        );
      }

      await loadSalesRoutesCatalog();

      if (selectedUser && sameUserId(selectedUser.id, uid)) {
        try {
          const refreshed = await usersApi.getById(uid);
          setSelectedUser(
            refreshed
              ? applyAssignedRouteToUser({ ...selectedUser, ...refreshed }, routeId)
              : mergedFromAssign
          );
        } catch {
          setSelectedUser(mergedFromAssign);
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.data?.message ?? e?.message ?? translate('errorAssignUserSalesRoute'));
    } finally {
      setAssignRouteSaving(false);
    }
  };

  const getRoleText = (role: string) => {
    return role === 'admin' ? translate('admin') : translate('roleSeller');
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-indigo-100 rounded-lg">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('usersTitle')}</h1>
            <p className="text-gray-500">{translate('usersSubtitle')}</p>
          </div>
        </div>

        <Button
          className="bg-indigo-600 hover:bg-indigo-700"
          onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          {translate('addUser')}
        </Button>
      </div>

      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? translate('editUser') : translate('addNewUser')}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? translate('editUserDesc') : translate('newUserDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">{translate('firstName')} *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, firstName: e.target.value }));
                    if (formErrors.firstName) setFormErrors(prev => ({ ...prev, firstName: undefined }));
                  }}
                  placeholder={translate('firstName')}
                  className={formErrors.firstName ? 'border-red-500' : ''}
                />
                {formErrors.firstName && <p className="text-sm text-red-600 mt-1">{formErrors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="lastName">{translate('lastName')} *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, lastName: e.target.value }));
                    if (formErrors.lastName) setFormErrors(prev => ({ ...prev, lastName: undefined }));
                  }}
                  placeholder={translate('lastName')}
                  className={formErrors.lastName ? 'border-red-500' : ''}
                />
                {formErrors.lastName && <p className="text-sm text-red-600 mt-1">{formErrors.lastName}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="email">{translate('email')} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                  if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined }));
                }}
                placeholder={translate('emailPlaceholder')}
                className={formErrors.email ? 'border-red-500' : ''}
              />
              {formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}
            </div>

            <div>
              <Label htmlFor="role">{translate('rolePlaceholder')} *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    role: value as 'admin' | 'user',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={translate('rolePlaceholder')}>
                    {formData.role === 'admin' && translate('admin')}
                    {formData.role === 'user' && translate('roleSeller')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{translate('roleSeller')}</SelectItem>
                  <SelectItem value="admin">{translate('admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="phone">{translate('phone')} *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, phone: e.target.value }));
                    if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: undefined }));
                  }}
                  placeholder={translate('phonePlaceholder')}
                  className={`pl-10 ${formErrors.phone ? 'border-red-500' : ''}`}
                />
              </div>
              {formErrors.phone && <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>}
            </div>

            <div>
              <Label htmlFor="password">
                {editingUser ? translate('editUserPasswordOptional') : `${translate('password')} *`}
              </Label>
              {editingUser && (
                <p className="text-xs text-gray-500 mt-0.5 mb-1.5">{translate('editUserPasswordHint')}</p>
              )}
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, password: e.target.value }));
                    const pwd = e.target.value.trim();
                    setPasswordErrors(pwd ? getPasswordErrors(pwd) : []);
                    if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder={translate('passwordPlaceholderLong')}
                  autoComplete="new-password"
                  className={formErrors.password || passwordErrors.length ? 'border-red-500' : ''}
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
              {(formErrors.password || passwordErrors.length > 0) && (
                <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                  {formErrors.password && !passwordErrors.length ? (
                    <li>{formErrors.password}</li>
                  ) : (
                    passwordErrors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))
                  )}
                </ul>
              )}
            </div>

          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">
                <X className="h-4 w-4 mr-2" />
                {translate('cancel')}
              </Button>
            </DialogClose>
            <Button onClick={handleSaveUser} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="h-4 w-4 mr-2" />
              {editingUser ? translate('update') : translate('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-all duration-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{translate('totalUsers')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('activeUsersLabel')}</p>
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
                <p className="text-xs font-medium text-gray-500">{translate('administrators')}</p>
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
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <Input
                  placeholder={translate('searchUsersPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={translate('filterByRole')}>
                    {roleFilter === 'all' && translate('allRoles')}
                    {roleFilter === 'admin' && translate('roleAdmins')}
                    {roleFilter === 'user' && translate('roleSellers')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allRoles')}</SelectItem>
                  <SelectItem value="admin">{translate('roleAdmins')}</SelectItem>
                  <SelectItem value="user">{translate('roleSellers')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={translate('filterByStatus')}>
                    {statusFilter === 'all' && translate('allStatuses')}
                    {statusFilter === 'active' && translate('active')}
                    {statusFilter === 'inactive' && translate('inactive')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{translate('allStatuses')}</SelectItem>
                  <SelectItem value="active">{translate('active')}</SelectItem>
                  <SelectItem value="inactive">{translate('inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>{translate('usersList')}</CardTitle>
          <CardDescription>
            {translate('usersSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('fullName')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('email')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('phone')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('userSalesRoute')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('rolePlaceholder')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('status')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {translate('actions')}
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-[14rem] truncate" title={routeLabelForUser(user)}>
                      {routeLabelForUser(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleText(user.role)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(user.isActive)}>
                        {user.isActive ? translate('active') : translate('inactive')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {user.role === 'user' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignRouteModal(user)}
                            title={translate('assignUserSalesRouteAction')}
                          >
                            <Waypoints className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetail(user)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

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
                                {user.isActive ? translate('deactivate') : translate('activate')} {translate('user')}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {translate('confirmDeactivateUser').replace('{action}', user.isActive ? translate('deactivate') : translate('activate')).replace('{name}', `${user.firstName} ${user.lastName}`)}
                                {user.isActive && ` ${translate('userInactiveWarning')}`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleToggleStatus(user)}
                                className={user.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                              >
                                {user.isActive ? translate('deactivate') : translate('activate')}
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
                {translate('noUsersSearch')}
              </h3>
              <p className="text-gray-600">
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                  ? translate('tryOtherSearchUsers')
                  : translate('addUsersHint')
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {
        filteredUsers.length > itemsPerPage && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              {translate('previous')}
            </Button>
            <span className="text-sm text-gray-600">
              {translate('page')} {currentPage} {translate('pageOf')} {Math.ceil(filteredUsers.length / itemsPerPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredUsers.length / itemsPerPage)))}
              disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
            >
              {translate('next')}
            </Button>
          </div>
        )
      }

      {/* User Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              {translate('userDetails')}
            </DialogTitle>
            <DialogDescription>
              {translate('userInfoDescription')}
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedUser.firstName} {selectedUser.lastName}
                </h3>
                <div className="flex gap-2">
                  <Badge className={getStatusBadgeColor(selectedUser.isActive)}>
                    {selectedUser.isActive ? translate('active') : translate('inactive')}
                  </Badge>
                  <Badge variant="outline" className={getRoleBadgeColor(selectedUser.role)}>
                    {getRoleText(selectedUser.role)}
                  </Badge>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex justify-between gap-4 items-start">
                    <span className="text-gray-500 font-medium shrink-0">{translate('userSalesRoute')}</span>
                    <span className="text-gray-900 text-right">
                      {routeLabelForUser(selectedUser)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 font-medium">{translate('firstName')}</span>
                    <span className="text-gray-900">{selectedUser.firstName || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 font-medium">{translate('lastName')}</span>
                    <span className="text-gray-900">{selectedUser.lastName || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 font-medium">{translate('email')}</span>
                    <span className="text-gray-900 break-all">{selectedUser.email || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4 items-center">
                    <span className="text-gray-500 font-medium">{translate('phone')}</span>
                    <span className="text-gray-900 flex items-center gap-1.5">
                      <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                      {selectedUser.phone ? selectedUser.phone : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 font-medium">{translate('rolePlaceholder')}</span>
                    <span className="text-gray-900">{getRoleText(selectedUser.role)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500 font-medium">{translate('status')}</span>
                    <Badge className={getStatusBadgeColor(selectedUser.isActive)}>
                      {selectedUser.isActive ? translate('active') : translate('inactive')}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline">{translate('close')}</Button>
            </DialogClose>
            {selectedUser?.role === 'user' && (
              <Button
                variant="outline"
                onClick={() => {
                  const u = selectedUser;
                  setShowDetailDialog(false);
                  openAssignRouteModal(u);
                }}
              >
                <Waypoints className="h-4 w-4 mr-2" />
                {translate('assignUserSalesRouteAction')}
              </Button>
            )}
            {selectedUser && (
              <Button
                onClick={() => {
                  handleEditUser(selectedUser);
                  setShowDetailDialog(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {translate('edit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAssignRouteDialog}
        onOpenChange={(open) => {
          setShowAssignRouteDialog(open);
          if (!open) {
            setAssignRouteUser(null);
            setAssignRouteSelection('_none');
            setAssignModalStores([]);
            setAssignModalStoresLoading(false);
            setAssignRoutePickerOpen(false);
            setAssignRouteSearchQuery('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl w-[calc(100vw-1.5rem)] sm:w-full h-[600px] max-h-[calc(100vh-2rem)] flex flex-col overflow-visible p-0 gap-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Waypoints className="h-5 w-5 text-indigo-600" />
              {translate('assignUserSalesRouteTitle')}
            </DialogTitle>
          </DialogHeader>
          {assignRouteUser && (
            <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-6 pb-2 gap-3">
              <div ref={assignRouteFieldRef} className="shrink-0 space-y-1.5 relative z-20">
                <Label>{translate('userSalesRoute')}</Label>
                <p className="text-xs text-gray-500">{translate('userSalesRouteHint')}</p>
                <div className="flex gap-2 items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden
                    />
                    <Input
                      className="h-10 w-full pl-10"
                      value={assignRoutePickerOpen ? assignRouteSearchQuery : assignRouteInputClosedValue}
                      onChange={(e) => {
                        setAssignRouteSearchQuery(e.target.value);
                        if (!assignRoutePickerOpen) setAssignRoutePickerOpen(true);
                      }}
                      onFocus={() => {
                        setAssignRoutePickerOpen(true);
                        setAssignRouteSearchQuery('');
                      }}
                      placeholder={
                        assignRoutePickerOpen
                          ? translate('assignUserRouteSearchPlaceholder')
                          : translate('noSalesRouteOption')
                      }
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 shrink-0 p-0"
                    aria-expanded={assignRoutePickerOpen}
                    onClick={() => {
                      setAssignRoutePickerOpen((o) => !o);
                      if (!assignRoutePickerOpen) setAssignRouteSearchQuery('');
                    }}
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${assignRoutePickerOpen ? 'rotate-180' : ''}`}
                    />
                  </Button>
                </div>
                {assignRoutePickerOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-[100] mt-1 flex max-h-[min(15rem,40vh)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                  >
                    <button
                      type="button"
                      role="option"
                      className="w-full shrink-0 border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => assignRoutePick('_none')}
                    >
                      {translate('noSalesRouteOption')}
                    </button>
                    <div className="max-h-[11rem] overflow-y-auto overscroll-contain py-1">
                      {assignRoutePickerFiltered.length === 0 && assignRouteSearchQuery.trim() ? (
                        <p className="px-3 py-4 text-center text-sm text-slate-500">
                          {translate('assignUserRouteNoMatches')}
                        </p>
                      ) : (
                        assignRoutePickerShown.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            role="option"
                            className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-blue-50"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => assignRoutePick(String(r.id))}
                          >
                            {formatRouteSelectLabel(r)}
                            {!r.isActive ? ` — ${translate('salesRouteInactive')}` : ''}
                          </button>
                        ))
                      )}
                    </div>
                    {assignRoutePickerTruncated && (
                      <p className="shrink-0 border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {translate('assignUserRouteResultsTruncated')}
                      </p>
                    )}
                  </div>
                )}
                {assignRoutePickerOptions.length === 0 && (
                  <p className="text-sm text-amber-700">{translate('noSalesRoutes')}</p>
                )}
              </div>

              <div className="flex flex-1 flex-col min-h-0 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 shrink-0 mb-2">
                  {translate('assignUserRouteSelectedSummary')}
                </p>
                <div className="shrink-0 space-y-2 min-h-[5.5rem] pb-3 border-b border-slate-200/80">
                  {(() => {
                    const r =
                      assignRouteSelection !== '_none' ? routeFromCatalog(assignRouteSelection) : null;
                    const code = r?.code?.trim();
                    const name =
                      r?.name ||
                      (assignRouteSelection !== '_none'
                        ? salesRouteNameById(assignRouteSelection)
                        : '') ||
                      '—';
                    const city = r ? cityNameById(r.cityId) || '—' : '—';
                    return (
                      <>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-slate-500 shrink-0">{translate('salesRouteCodeHeader')}:</span>
                          {code ? (
                            <span className="font-mono font-semibold text-indigo-900 bg-white border border-indigo-100 px-2 py-0.5 rounded text-xs">
                              {code}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500">{translate('salesRouteNameLabel')}: </span>
                          <span className="font-medium text-slate-900">{name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{translate('city')}: </span>
                          <span className="text-slate-900">{city}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="flex flex-1 flex-col min-h-0 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5 shrink-0">
                    <StoreIcon className="h-3.5 w-3.5" />
                    {translate('assignUserRouteStoresTitle')}
                  </p>
                  <div className="flex-1 min-h-[140px] max-h-[200px] overflow-y-auto rounded-md border border-slate-200/60 bg-white/60 px-2 py-2">
                    {assignRouteSelection === '_none' ? (
                      <p className="text-sm text-slate-500 text-center py-10 px-2">
                        {translate('assignUserRoutePickToSeeStores')}
                      </p>
                    ) : assignModalStoresLoading ? (
                      <p className="text-slate-500 py-6 text-center">{translate('loading')}</p>
                    ) : assignModalStores.length === 0 ? (
                      <p className="text-slate-600 py-6 text-center px-2">{translate('assignUserRouteNoStores')}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {assignModalStores.map((s) => (
                          <li key={s.id} className="text-slate-800 flex gap-2 text-sm">
                            <span className="text-slate-400 shrink-0">·</span>
                            <span>{s.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 border-t border-slate-100 bg-white">
            <DialogClose asChild>
              <Button variant="outline" disabled={assignRouteSaving}>
                <X className="h-4 w-4 mr-2" />
                {translate('cancel')}
              </Button>
            </DialogClose>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={assignRouteSaving || !assignRouteUser}
              onClick={() => void handleSaveAssignRoute()}
            >
              <Save className="h-4 w-4 mr-2" />
              {translate('assignUserSalesRouteSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};