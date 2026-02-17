'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent } from '@/shared/components/base/Card';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { validatePasswordStrength } from '@/shared/utils/validation';

interface ResetPasswordFormProps {
  token: string;
  email: string;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token, email }) => {
  const { confirmResetPassword } = useAuth();
  const { translate } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  const validateForm = (): boolean => {
    const errors: { newPassword?: string; confirmPassword?: string } = {};

    if (!newPassword.trim()) {
      errors.newPassword = translate('newPasswordRequired');
    } else {
      const strength = validatePasswordStrength(newPassword);
      if (!strength.isValid && strength.feedback.length > 0) {
        errors.newPassword = strength.feedback[0] || translate('passwordRequirements');
      }
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = translate('confirmPasswordRequired');
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = translate('passwordMismatch');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    const result = await confirmResetPassword({
      token,
      email,
      newPassword,
      confirmPassword
    });

    setIsLoading(false);
    if (result.success) {
      setIsSuccess(true);
    } else {
      setError(result.message || translate('resetPasswordError'));
    }
  };

  const inputWrapperClass = (hasError: boolean) =>
    `flex items-center h-12 w-full rounded-lg border bg-white text-sm transition-all overflow-hidden ${
      hasError
        ? 'border-destructive focus-within:ring-2 focus-within:ring-destructive/20 focus-within:border-destructive'
        : 'border-gray-300 hover:border-gray-400 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary'
    }`;

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md shadow-large border-0 bg-white/95 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">{translate('resetPasswordSuccessTitle')}</h2>
              <p className="text-gray-600">
                {translate('resetPasswordSuccessDesc')}
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              {translate('backToLogin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-large border-0 bg-white/95 backdrop-blur-sm">
      <CardContent className="p-8">
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-gray-900">{translate('resetPasswordTitle')}</h2>
            <p className="text-gray-600">
              {translate('resetPasswordFormDesc')}
            </p>
            {email && (
              <p className="text-sm text-gray-500 truncate px-2" title={email}>
                {email}
              </p>
            )}
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-gray-700 font-medium">
                {translate('newPasswordLabel')}
              </Label>
              <div className={inputWrapperClass(!!fieldErrors.newPassword)}>
                <span className="flex-shrink-0 pl-3 text-gray-400" aria-hidden>
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder={translate('minPasswordPlaceholder')}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (fieldErrors.newPassword) setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                    if (error) setError(null);
                  }}
                  className="flex-1 min-w-0 border-0 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:opacity-50"
                  disabled={isLoading}
                  autoComplete="new-password"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  className="flex-shrink-0 pr-3 py-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  suppressHydrationWarning
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.newPassword && (
                <p className="text-xs text-destructive">{fieldErrors.newPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-gray-700 font-medium">
                {translate('confirmPassword')}
              </Label>
              <div className={inputWrapperClass(!!fieldErrors.confirmPassword)}>
                <span className="flex-shrink-0 pl-3 text-gray-400" aria-hidden>
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={translate('repeatPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    if (error) setError(null);
                  }}
                  className="flex-1 min-w-0 border-0 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:opacity-50"
                  disabled={isLoading}
                  autoComplete="new-password"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  className="flex-shrink-0 pr-3 py-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  suppressHydrationWarning
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                className="w-full h-12 text-base font-medium bg-primary hover:bg-primary-hover focus:ring-primary/20"
                disabled={isLoading}
                suppressHydrationWarning
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{translate('saving')}</span>
                  </div>
                ) : (
                  translate('resetPasswordButton')
                )}
              </Button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-offset-2 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                {translate('backToLogin')}
              </Link>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
