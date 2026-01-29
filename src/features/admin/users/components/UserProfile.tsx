import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/base/Tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/base/Avatar';
import { Badge } from '@/shared/components/base/Badge';
import { Switch } from '@/shared/components/base/Switch';
import { Separator } from '@/shared/components/base/Separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/base/Dialog';

import { 
  User, 
  Calendar, 
  Settings, 
  Key, 
  Bell, 
  Globe, 
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  UserCheck,
  Clock
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { getFromLocalStorage, setToLocalStorage } from '@/shared/services/database';
import { User as UserType, AppSettings } from '@/shared/types';
import { validateProfileData, validatePasswordStrength } from '@/shared/utils/validation';
import { toast } from '@/shared/components/base/Toast';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  avatar?: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}



interface UserProfileProps {
  onBack: () => void;
}

export function UserProfile({ onBack }: UserProfileProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  
  // Estados para la información del perfil
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: '',
    address: '',
    avatar: user?.avatar || ''
  });
  
  const [originalProfileData, setOriginalProfileData] = useState<ProfileData>(profileData);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Estados para el cambio de contraseña
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  

  
  // Estados para configuración de la aplicación
  const [appSettings, setAppSettings] = useState<AppSettings>({
    id: user?.id || '',
    language: language,
    theme: 'light',
    notifications: true
  });
  
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Cargar configuraciones del usuario al montar
  useEffect(() => {
    if (user) {
      // Cargar datos del perfil extendidos si existen
      const userProfiles = getFromLocalStorage('user-profiles') || {};
      const userProfile = userProfiles[user.id];
      
      if (userProfile) {
        setProfileData(prev => ({ ...prev, ...userProfile }));
        setOriginalProfileData(prev => ({ ...prev, ...userProfile }));
      }
      

      
      // Cargar configuraciones de la app
      const appConfigs = getFromLocalStorage('user-app-settings') || {};
      const userAppConfig = appConfigs[user.id];
      
      if (userAppConfig) {
        setAppSettings(userAppConfig);
      }
    }
  }, [user]);

  const handleProfileSave = async () => {
    setProfileLoading(true);
    
    try {
      // Validar datos del perfil
      const validationErrors = validateProfileData(profileData);
      if (Object.keys(validationErrors).length > 0) {
        const firstError = Object.values(validationErrors)[0];
        toast.error(firstError);
        return;
      }
      
      // Guardar en localStorage
      const userProfiles = getFromLocalStorage('user-profiles') || {};
      userProfiles[user!.id] = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        address: profileData.address,
        avatar: profileData.avatar
      };
      setToLocalStorage('user-profiles', userProfiles);
      
      // Actualizar también los datos del usuario principal
      const users: UserType[] = getFromLocalStorage('app-users') || [];
      const userIndex = users.findIndex(u => u.id === user!.id);
      if (userIndex !== -1) {
        users[userIndex] = {
          ...users[userIndex],
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          updatedAt: new Date()
        };
        setToLocalStorage('app-users', users);
      }
      
      setOriginalProfileData(profileData);
      setIsEditingProfile(false);
      toast.success('Perfil actualizado correctamente');
      
    } catch (error) {
      toast.error('Error al actualizar el perfil');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordLoading(true);
    
    try {
      // Validaciones
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        toast.error('Todos los campos son obligatorios');
        return;
      }
      
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error('Las contraseñas nuevas no coinciden');
        return;
      }
      
      // Validar fortaleza de la contraseña
      const strengthValidation = validatePasswordStrength(passwordData.newPassword);
      if (!strengthValidation.isValid) {
        toast.error(`Contraseña débil: ${strengthValidation.feedback.join(', ')}`);
        return;
      }
      
      // Verificar contraseña actual
      const users: UserType[] = getFromLocalStorage('app-users') || [];
      const currentUser = users.find(u => u.id === user!.id);
      
      if (!currentUser || currentUser.password !== passwordData.currentPassword) {
        toast.error('La contraseña actual es incorrecta');
        return;
      }
      
      // Actualizar contraseña
      const userIndex = users.findIndex(u => u.id === user!.id);
      users[userIndex] = {
        ...users[userIndex],
        password: passwordData.newPassword,
        updatedAt: new Date()
      };
      setToLocalStorage('app-users', users);
      
      // Limpiar formulario
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setShowPasswordDialog(false);
      toast.success('Contraseña actualizada correctamente');
      
    } catch (error) {
      toast.error('Error al cambiar la contraseña');
    } finally {
      setPasswordLoading(false);
    }
  };



  const handleAppSettingsSave = () => {
    try {
      const appConfigs = getFromLocalStorage('user-app-settings') || {};
      appConfigs[user!.id] = appSettings;
      setToLocalStorage('user-app-settings', appConfigs);
      
      // Aplicar cambio de idioma inmediatamente
      setLanguage(appSettings.language);
      
      toast.success('Configuración de aplicación actualizada');
    } catch (error) {
      toast.error('Error al guardar configuración de aplicación');
    }
  };

  const handleCancelEdit = () => {
    setProfileData(originalProfileData);
    setIsEditingProfile(false);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <Badge className="bg-indigo-100 text-indigo-800">Administrador</Badge>;
    }
    return <Badge variant="secondary">Vendedor</Badge>;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No se pudo cargar el perfil del usuario</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Mi Perfil</h1>
                <p className="text-sm text-gray-500">Gestiona tu información personal y configuraciones</p>
              </div>
            </div>
            
            {isEditingProfile && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={profileLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleProfileSave}
                  disabled={profileLoading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {profileLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar con información básica */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent>
                <div className="text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarImage src={profileData.avatar || undefined} />
                    <AvatarFallback className="text-lg bg-indigo-100 text-indigo-700">
                      {getInitials(profileData.firstName, profileData.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">
                    {profileData.firstName} {profileData.lastName}
                  </h3>
                  <p className="text-gray-500 text-sm mb-3">{profileData.email}</p>
                  
                  {getRoleBadge(user.role)}
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>Miembro desde {new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</span>
                    </div>
                    
                    {user.lastLoginAt && (
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>Último acceso: {new Date(user.lastLoginAt).toLocaleDateString('es-ES')}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      <UserCheck className="h-4 w-4 mr-2" />
                      <span className={user.isActive ? "text-green-600" : "text-red-600"}>
                        {user.isActive ? "Cuenta activa" : "Cuenta inactiva"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contenido principal */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuración
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notificaciones
                </TabsTrigger>
              </TabsList>

              {/* Tab de Perfil */}
              <TabsContent value="profile" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Información Personal</CardTitle>
                        <CardDescription>
                          Actualiza tu información de perfil y datos de contacto
                        </CardDescription>
                      </div>
                      {!isEditingProfile && (
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingProfile(true)}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">Nombre</Label>
                        <Input
                          id="firstName"
                          value={profileData.firstName}
                          onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? "bg-gray-50" : ""}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="lastName">Apellido</Label>
                        <Input
                          id="lastName"
                          value={profileData.lastName}
                          onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? "bg-gray-50" : ""}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                        disabled={!isEditingProfile}
                        className={!isEditingProfile ? "bg-gray-50" : ""}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Teléfono (opcional)</Label>
                      <Input
                        id="phone"
                        value={profileData.phone || ''}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        disabled={!isEditingProfile}
                        className={!isEditingProfile ? "bg-gray-50" : ""}
                        placeholder="+34 600 000 000"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="address">Dirección (opcional)</Label>
                      <Input
                        id="address"
                        value={profileData.address || ''}
                        onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                        disabled={!isEditingProfile}
                        className={!isEditingProfile ? "bg-gray-50" : ""}
                        placeholder="Calle, número, ciudad"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>



              {/* Tab de Configuración */}
              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Seguridad</CardTitle>
                    <CardDescription>
                      Mantén tu cuenta segura con una contraseña fuerte
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Key className="h-4 w-4 mr-2" />
                          Cambiar Contraseña
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Cambiar Contraseña</DialogTitle>
                          <DialogDescription>
                            Ingresa tu contraseña actual y la nueva contraseña
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="currentPassword">Contraseña actual</Label>
                            <div className="relative">
                              <Input
                                id="currentPassword"
                                type={showPasswords.current ? "text" : "password"}
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                              >
                                {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="newPassword">Nueva contraseña</Label>
                            <div className="relative">
                              <Input
                                id="newPassword"
                                type={showPasswords.new ? "text" : "password"}
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                              >
                                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                            {passwordData.newPassword && (
                              <div className="mt-2">
                                {(() => {
                                  const strength = validatePasswordStrength(passwordData.newPassword);
                                  const getStrengthColor = (score: number) => {
                                    if (score < 2) return 'bg-red-500';
                                    if (score < 3) return 'bg-yellow-500';
                                    if (score < 4) return 'bg-blue-500';
                                    return 'bg-green-500';
                                  };
                                  const getStrengthText = (score: number) => {
                                    if (score < 2) return 'Débil';
                                    if (score < 3) return 'Regular';
                                    if (score < 4) return 'Buena';
                                    return 'Excelente';
                                  };
                                  return (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                          <div 
                                            className={`h-2 rounded-full transition-all ${getStrengthColor(strength.score)}`}
                                            style={{ width: `${(strength.score / 5) * 100}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs font-medium ${
                                          strength.score < 2 ? 'text-red-600' :
                                          strength.score < 3 ? 'text-yellow-600' :
                                          strength.score < 4 ? 'text-blue-600' : 'text-green-600'
                                        }`}>
                                          {getStrengthText(strength.score)}
                                        </span>
                                      </div>
                                      {!strength.isValid && (
                                        <div className="text-xs text-gray-600">
                                          <p className="font-medium mb-1">Para mejorar la seguridad:</p>
                                          <ul className="list-disc list-inside space-y-1">
                                            {strength.feedback.map((tip, index) => (
                                              <li key={index}>{tip}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                            <div className="relative">
                              <Input
                                id="confirmPassword"
                                type={showPasswords.confirm ? "text" : "password"}
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                              >
                                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handlePasswordChange}
                            disabled={passwordLoading}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            {passwordLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                Guardando...
                              </>
                            ) : (
                              "Cambiar Contraseña"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Preferencias de Aplicación</CardTitle>
                    <CardDescription>
                      Personaliza la experiencia de la aplicación
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="language">Idioma</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <Button
                          variant={appSettings.language === 'es' ? 'default' : 'outline'}
                          onClick={() => setAppSettings(prev => ({ ...prev, language: 'es' }))}
                          className="flex items-center gap-2"
                        >
                          <Globe className="h-4 w-4" />
                          Español
                        </Button>
                        <Button
                          variant={appSettings.language === 'en' ? 'default' : 'outline'}
                          onClick={() => setAppSettings(prev => ({ ...prev, language: 'en' }))}
                          className="flex items-center gap-2"
                        >
                          <Globe className="h-4 w-4" />
                          English
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notifications">Notificaciones de aplicación</Label>
                        <p className="text-sm text-gray-500">Recibe notificaciones del sistema</p>
                      </div>
                      <Switch
                        id="notifications"
                        checked={appSettings.notifications}
                        onCheckedChange={(checked) => 
                          setAppSettings(prev => ({ ...prev, notifications: checked }))
                        }
                      />
                    </div>
                    
                    <div className="pt-4">
                      <Button onClick={handleAppSettingsSave} className="bg-indigo-600 hover:bg-indigo-700">
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Configuración
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab de Notificaciones */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Centro de Notificaciones</CardTitle>
                    <CardDescription>
                      Historial de notificaciones y actividad de la cuenta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-medium text-gray-900 mb-2">No hay notificaciones</h3>
                      <p className="text-gray-500 text-sm">
                        Las notificaciones y alertas aparecerán aquí
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}