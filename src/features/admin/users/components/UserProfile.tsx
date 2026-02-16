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
import { usersApi } from '@/shared/services/users-api';
import { getLoggedUser, setLoggedUser } from '@/shared/utils/auth';
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
  const { user, refreshUser } = useAuth();
  const { language, setLanguage, translate } = useLanguage();
  
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
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  
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

  // Cargar perfil desde API y configuraciones locales al montar
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        setProfileLoadError(null);
        const profile = await usersApi.getProfile();
        if (profile) {
          const data: ProfileData = {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            phone: profile.phone ?? '',
            address: (profile as any).address ?? '',
            avatar: profile.avatar
          };
          setProfileData(data);
          setOriginalProfileData(data);
        } else {
          setProfileData(prev => ({
            ...prev,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone ?? '',
            avatar: user.avatar
          }));
          setOriginalProfileData(prev => ({ ...prev, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? '', avatar: user.avatar }));
        }
      } catch {
        setProfileLoadError(translate('errorLoadUsers'));
        setProfileData(prev => ({
          ...prev,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone ?? '',
          avatar: user.avatar
        }));
        setOriginalProfileData(prev => ({ ...prev, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? '' }));
      }

      const appConfigs = getFromLocalStorage('user-app-settings') || {};
      const userAppConfig = appConfigs[user.id];
      if (userAppConfig) setAppSettings(userAppConfig);
    };

    loadProfile();
  }, [user?.id]);

  const handleProfileSave = async () => {
    const validationErrors = validateProfileData(profileData);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.error(firstError);
      return;
    }

    setProfileLoading(true);
    try {
      await usersApi.updateProfile({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        avatar: profileData.avatar,
        address: profileData.address
      });

      const logged = getLoggedUser();
      if (logged) {
        setLoggedUser({
          ...logged,
          name: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          phone: profileData.phone,
          avatar: profileData.avatar
        } as any);
      }
      refreshUser?.();
      setOriginalProfileData(profileData);
      setIsEditingProfile(false);
      toast.success(translate('userSaved'));
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? translate('errorSaveUser');
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error(translate('firstNameRequired'));
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(translate('passwordMismatch'));
      return;
    }
    const strengthValidation = validatePasswordStrength(passwordData.newPassword);
    if (!strengthValidation.isValid) {
      toast.error(`${translate('weakPassword')}: ${strengthValidation.feedback.join(', ')}`);
      return;
    }

    setPasswordLoading(true);
    try {
      await usersApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordDialog(false);
      toast.success(translate('passwordResetSuccess'));
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? translate('errorSaveUser');
      toast.error(msg);
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
      
      toast.success(translate('userSaved'));
    } catch (error) {
      toast.error(translate('errorSaveUser'));
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
      return <Badge className="bg-indigo-100 text-indigo-800">{translate('admin')}</Badge>;
    }
    return <Badge variant="secondary">{translate('roleSeller')}</Badge>;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{translate('errorLoadUsers')}</p>
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
                <h1 className="text-xl font-semibold text-gray-900">{translate('myProfile')}</h1>
                <p className="text-sm text-gray-500">{translate('usersSubtitle')}</p>
              </div>
            </div>
            
            {isEditingProfile && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={profileLoading}
                >
                  {translate('cancel')}
                </Button>
                <Button
                  onClick={handleProfileSave}
                  disabled={profileLoading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {profileLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      {translate('saving')}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {translate('saveProfile')}
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
                      <span>{translate('memberSince')} {new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</span>
                    </div>
                    
                    {user.lastLoginAt && (
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{translate('lastAccess')}: {new Date(user.lastLoginAt).toLocaleDateString('es-ES')}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      <UserCheck className="h-4 w-4 mr-2" />
                      <span className={user.isActive ? "text-green-600" : "text-red-600"}>
                        {user.isActive ? translate('activeAccount') : translate('inactiveAccount')}
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
                  {translate('profileTab')}
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {translate('settingsTab')}
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {translate('notificationsTab')}
                </TabsTrigger>
              </TabsList>

              {/* Tab de Perfil */}
              <TabsContent value="profile" className="space-y-6">
                {profileLoadError && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    {profileLoadError}. {translate('sessionDataShown')}
                  </div>
                )}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{translate('personalInfo')}</CardTitle>
                        <CardDescription>
                          {translate('updateProfileDesc')}
                        </CardDescription>
                      </div>
                      {!isEditingProfile && (
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingProfile(true)}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          {translate('editProfile')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">{translate('firstName')}</Label>
                        <Input
                          id="firstName"
                          value={profileData.firstName}
                          onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                          disabled={!isEditingProfile}
                          className={!isEditingProfile ? "bg-gray-50" : ""}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="lastName">{translate('lastName')}</Label>
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
                      <Label htmlFor="email">{translate('email')}</Label>
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
                      <Label htmlFor="phone">{translate('phoneOptional')}</Label>
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
                      <Label htmlFor="address">{translate('addressOptional')}</Label>
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
                    <CardTitle>{translate('security')}</CardTitle>
                    <CardDescription>
                      {translate('securityDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Key className="h-4 w-4 mr-2" />
                          {translate('changePassword')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{translate('changePassword')}</DialogTitle>
                          <DialogDescription>
                            {translate('changePasswordDesc')}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="currentPassword">{translate('currentPassword')}</Label>
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
                            <Label htmlFor="newPassword">{translate('newPasswordLabel')}</Label>
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
                                    if (score < 2) return translate('strengthWeak');
                                    if (score < 3) return translate('strengthRegular');
                                    if (score < 4) return translate('strengthGood');
                                    return translate('strengthExcellent');
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
                                          <p className="font-medium mb-1">{translate('toImproveSecurity')}</p>
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
                            <Label htmlFor="confirmPassword">{translate('confirmNewPassword')}</Label>
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
                            {translate('cancel')}
                          </Button>
                          <Button 
                            onClick={handlePasswordChange}
                            disabled={passwordLoading}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            {passwordLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                {translate('saving')}
                              </>
                            ) : (
                              translate('changePassword')
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{translate('appPreferences')}</CardTitle>
                    <CardDescription>
                      {translate('customizeAppExperience')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="language">{translate('language')}</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <Button
                          variant={appSettings.language === 'es' ? 'default' : 'outline'}
                          onClick={() => setAppSettings(prev => ({ ...prev, language: 'es' }))}
                          className="flex items-center gap-2"
                        >
                          <Globe className="h-4 w-4" />
                          {translate('spanish')}
                        </Button>
                        <Button
                          variant={appSettings.language === 'en' ? 'default' : 'outline'}
                          onClick={() => setAppSettings(prev => ({ ...prev, language: 'en' }))}
                          className="flex items-center gap-2"
                        >
                          <Globe className="h-4 w-4" />
                          {translate('english')}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notifications">{translate('appNotifications')}</Label>
                        <p className="text-sm text-gray-500">{translate('receiveSystemNotifications')}</p>
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
                        {translate('saveSettings')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab de Notificaciones */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{translate('notificationCenter')}</CardTitle>
                    <CardDescription>
                      {translate('notificationHistory')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-medium text-gray-900 mb-2">{translate('noNotifications')}</h3>
                      <p className="text-gray-500 text-sm">
                        {translate('notificationsWillAppearHere')}
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