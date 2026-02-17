import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';

import { User, Key, Edit3, Save, X, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { usersApi } from '@/shared/services/users-api';
import { getLoggedUser, setLoggedUser } from '@/shared/utils/auth';
import { validateProfileData, validatePasswordStrength } from '@/shared/utils/validation';
import { toast } from '@/shared/components/base/Toast';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UserProfileProps {
  onBack?: () => void;
}

export function UserProfile({ onBack }: UserProfileProps) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { translate } = useLanguage();

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [originalProfileData, setOriginalProfileData] = useState<ProfileData>(profileData);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [realUserId, setRealUserId] = useState<string | null>(null);
  const [loadDone, setLoadDone] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; phone?: string }>({});

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; newPassword?: string; confirm?: string }>({});

  // Cargar id real y datos de sesión (como en Gestión de usuarios: todo por id)
  useEffect(() => {
    if (!user) return;

    const data: ProfileData = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || ''
    };
    setProfileData(data);
    setOriginalProfileData(data);

    const loadRealId = async () => {
      try {
        const list = await usersApi.fetchAll();
        const byEmail = list.find((u) => (u.email || '').toLowerCase() === (user.email || '').toLowerCase());
        if (byEmail?.id) setRealUserId(byEmail.id);
        else if (user.id && !user.id.includes('@')) setRealUserId(user.id);
        else setRealUserId(user.id || null);
      } catch {
        setRealUserId(user.id || null);
      } finally {
        setLoadDone(true);
      }
    };
    loadRealId();
  }, [user?.id, user?.email, user?.firstName, user?.lastName, user?.phone]);

  const handleProfileSave = async () => {
    const validationErrors = validateProfileData(profileData);
    if (Object.keys(validationErrors).length > 0) {
      toast.error(Object.values(validationErrors)[0]);
      return;
    }

    const currentEmailNorm = (user?.email || '').toLowerCase();
    const newEmailNorm = (profileData.email || '').trim().toLowerCase();
    const newPhoneNorm = (profileData.phone || '').trim();
    try {
      const list = await usersApi.fetchAll();
      const otherWithSameEmail = list.find(
        (u) => (u.email || '').toLowerCase() === newEmailNorm && (u.email || '').toLowerCase() !== currentEmailNorm
      );
      if (otherWithSameEmail) {
        const msg = translate('duplicateEmailMessage');
        setFormErrors((e) => ({ ...e, email: msg }));
        toast.error(msg);
        return;
      }
      if (newPhoneNorm) {
        const otherWithSamePhone = list.find(
          (u) => (u.phone || '').trim() === newPhoneNorm && (u.email || '').toLowerCase() !== currentEmailNorm
        );
        if (otherWithSamePhone) {
          const msg = translate('duplicatePhoneMessage');
          setFormErrors((e) => ({ ...e, phone: msg }));
          toast.error(msg);
          return;
        }
      }
      setFormErrors({});
    } catch {
      // Continuar; el backend puede validar
    }

    const idToUse = realUserId || user?.id;
    if (!idToUse || idToUse.includes('@')) {
      toast.error(translate('errorSaveUser'));
      return;
    }

    setProfileLoading(true);
    try {
      const payload = {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        email: profileData.email.trim().toLowerCase(),
        phone: (profileData.phone || '').trim(),
        role: user?.role ?? 'admin',
        isActive: user?.isActive ?? true
      };
      await usersApi.update(idToUse, payload);

      const logged = getLoggedUser();
      if (logged) {
        setLoggedUser({
          ...logged,
          name: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone || undefined
        } as any);
      }
      refreshUser?.();
      setOriginalProfileData(profileData);
      setIsEditingProfile(false);
      setFormErrors({});
      toast.success(translate('userSaved'));
      window.dispatchEvent(new CustomEvent('user-updated'));
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? translate('errorSaveUser');
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordErrors({});
    const currentPass = passwordData.currentPassword.trim();
    const newPass = passwordData.newPassword.trim();
    const confirmPass = passwordData.confirmPassword.trim();

    if (!currentPass) {
      setPasswordErrors({ current: translate('currentPassword') + ' ' + translate('passwordRequiredNew').toLowerCase() });
      toast.error(translate('currentPassword'));
      return;
    }
    if (!newPass || !confirmPass) {
      setPasswordErrors({ newPassword: !newPass ? translate('passwordRequiredNew') : undefined, confirm: !confirmPass ? translate('passwordRequiredNew') : undefined });
      toast.error(translate('newPasswordLabel') + ' / ' + translate('confirmNewPassword'));
      return;
    }
    if (newPass !== confirmPass) {
      setPasswordErrors({ confirm: translate('passwordMismatch') });
      toast.error(translate('passwordMismatch'));
      return;
    }
    const strength = validatePasswordStrength(newPass);
    if (!strength.isValid) {
      setPasswordErrors({ newPassword: strength.feedback.join(', ') });
      toast.error(translate('weakPassword') + ': ' + strength.feedback.join(', '));
      return;
    }

    const userEmail = profileData.email?.trim() || user?.email;
    if (!userEmail) {
      toast.error(translate('errorSaveUser'));
      return;
    }

    setPasswordLoading(true);
    try {
      await usersApi.changePassword({
        email: userEmail,
        currentPassword: currentPass,
        newPassword: newPass
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      setPasswordChangeSuccess(true);
      toast.success(translate('passwordResetSuccess'));
      setTimeout(() => {
        setShowPasswordDialog(false);
        setPasswordChangeSuccess(false);
      }, 2000);
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      const raw = err?.data?.message ?? (typeof err?.data === 'string' ? err.data : err?.data?.message) ?? err?.message ?? '';
      const serverMsg = String(raw).toLowerCase();
      const isCurrentPasswordWrong = status === 400 && (serverMsg.includes('contraseña') || serverMsg.includes('cambiar') || serverMsg.includes('password'));
      const msg = isCurrentPasswordWrong
        ? translate('currentPasswordDoesNotMatch')
        : (err?.data?.message ?? err?.message ?? translate('errorSaveUser'));
      setPasswordErrors({ current: msg });
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileData(originalProfileData);
    setIsEditingProfile(false);
    setFormErrors({});
  };

  const handleBack = () => {
    if (onBack) onBack();
    else router.push('/dashboard');
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header igual que Gestión de usuarios */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="p-2.5 bg-indigo-100 rounded-lg">
            <User className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{translate('myProfile')}</h1>
            <p className="text-gray-500">{translate('usersSubtitle')}</p>
          </div>
        </div>
        {!isEditingProfile && loadDone && (
          <Button variant="outline" onClick={() => setIsEditingProfile(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            {translate('editProfile')}
          </Button>
        )}
        {isEditingProfile && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancelEdit} disabled={profileLoading}>
              {translate('cancel')}
            </Button>
            <Button onClick={handleProfileSave} disabled={profileLoading} className="bg-indigo-600 hover:bg-indigo-700">
              {profileLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  {translate('saving')}
                </span>
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

      <Card>
        <CardHeader>
          <CardTitle>{translate('personalInfo')}</CardTitle>
          <CardDescription>{translate('updateProfileDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">{translate('firstName')} *</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData((prev) => ({ ...prev, firstName: e.target.value }))}
                disabled={!isEditingProfile}
                className={!isEditingProfile ? 'bg-gray-50' : ''}
                placeholder={translate('firstName')}
              />
            </div>
            <div>
              <Label htmlFor="lastName">{translate('lastName')} *</Label>
              <Input
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData((prev) => ({ ...prev, lastName: e.target.value }))}
                disabled={!isEditingProfile}
                className={!isEditingProfile ? 'bg-gray-50' : ''}
                placeholder={translate('lastName')}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">{translate('email')} *</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              onChange={(e) => {
                setProfileData((prev) => ({ ...prev, email: e.target.value }));
                if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
              }}
              disabled={!isEditingProfile}
              className={!isEditingProfile ? 'bg-gray-50' : formErrors.email ? 'border-red-500' : ''}
              placeholder={translate('emailPlaceholder')}
            />
            {formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}
          </div>
          <div>
            <Label htmlFor="phone">{translate('phone')}</Label>
            <Input
              id="phone"
              value={profileData.phone || ''}
              onChange={(e) => {
                setProfileData((prev) => ({ ...prev, phone: e.target.value }));
                if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              disabled={!isEditingProfile}
              className={!isEditingProfile ? 'bg-gray-50' : formErrors.phone ? 'border-red-500' : ''}
              placeholder={translate('phonePlaceholder')}
            />
            {formErrors.phone && <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {translate('security')}
          </CardTitle>
          <CardDescription>{translate('securityDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
            <Dialog open={showPasswordDialog} onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) { setPasswordErrors({}); setPasswordChangeSuccess(false); } }}>
              <Button variant="outline" onClick={() => { setShowPasswordDialog(true); setPasswordErrors({}); }}>
                <Key className="h-4 w-4 mr-2" />
                {translate('changePassword')}
              </Button>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{translate('changePassword')}</DialogTitle>
                  <DialogDescription>{translate('changePasswordDesc')}</DialogDescription>
                </DialogHeader>
                {passwordChangeSuccess && (
                  <div className="mx-6 mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                    {translate('passwordResetSuccess')}
                  </div>
                )}
                {(passwordErrors.current || passwordErrors.newPassword) && (
                  <div className="mx-6 mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm space-y-1">
                    {passwordErrors.current && <p>{translate('currentPasswordDoesNotMatch')}</p>}
                    {passwordErrors.newPassword && <p>{translate('weakPassword')}: {passwordErrors.newPassword}</p>}
                  </div>
                )}
                <div className="space-y-4 px-6 pb-2">
                  <div>
                    <Label htmlFor="currentPassword">{translate('currentPassword')}</Label>
                    <div className="relative flex">
                      <Input
                        id="currentPassword"
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => {
                          setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }));
                          if (passwordErrors.current) setPasswordErrors((p) => ({ ...p, current: undefined }));
                        }}
                        className={`pr-10 ${passwordErrors.current ? 'border-red-500' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordErrors.current && <p className="text-sm text-red-600 mt-1">{passwordErrors.current}</p>}
                  </div>
                  <div>
                    <Label htmlFor="newPassword">{translate('newPasswordLabel')}</Label>
                    <div className="relative flex">
                      <Input
                        id="newPassword"
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => {
                          setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }));
                          if (passwordErrors.newPassword) setPasswordErrors((p) => ({ ...p, newPassword: undefined }));
                        }}
                        className={`pr-10 ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPasswords((p) => ({ ...p, new: !p.new }))}
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="text-sm text-red-600 mt-1">{passwordErrors.newPassword}</p>
                    )}
                    {passwordData.newPassword && !passwordErrors.newPassword && (() => {
                      const s = validatePasswordStrength(passwordData.newPassword);
                      if (!s.isValid) return <p className="text-sm text-amber-600 mt-1">{translate('toImproveSecurity')}: {s.feedback.join(', ')}</p>;
                      return null;
                    })()}
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">{translate('confirmNewPassword')}</Label>
                    <div className="relative flex">
                      <Input
                        id="confirmPassword"
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => {
                          setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }));
                          if (passwordErrors.confirm) setPasswordErrors((p) => ({ ...p, confirm: undefined }));
                        }}
                        className={`pr-10 ${passwordErrors.confirm ? 'border-red-500' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {passwordErrors.confirm && <p className="text-sm text-red-600 mt-1">{passwordErrors.confirm}</p>}
                  </div>
                </div>
                <DialogFooter className="px-6 pb-6 pt-4">
                  <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                    {translate('cancel')}
                  </Button>
                  <Button onClick={handlePasswordChange} disabled={passwordLoading} className="bg-indigo-600 hover:bg-indigo-700">
                    {passwordLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        {translate('saving')}
                      </span>
                    ) : (
                      translate('changePassword')
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
