'use client';

import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent } from '@/shared/components/base/Card';
import { Alert, AlertDescription } from '@/shared/components/base/Alert';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '@/shared/hooks/useLanguage';
import { PasswordResetData, ValidationErrors } from '../types';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
  const { resetPassword } = useAuth();
  const { translate } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!email) {
      errors.email = translate('emailRequired') || 'El correo electrónico es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = translate('emailInvalid') || 'Ingrese un correo electrónico válido';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await resetPassword({ email });
    
    setIsLoading(false);
    
    if (result.success) {
      setIsSuccess(true);
    } else {
      setError(result.message || translate('resetError'));
    }
  };

  const handleInputChange = (value: string) => {
    setEmail(value);
    
    // Limpiar errores cuando el usuario empiece a escribir
    if (validationErrors.email) {
      setValidationErrors({});
    }
    if (error) {
      setError(null);
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full shadow-large border-0 bg-white/95 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {translate('linkSentTitle')}
              </h2>
              <p className="text-gray-600">
                {translate('linkSentMessage')}
              </p>
              <p className="font-semibold text-primary">
                {email}
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <p className="text-sm text-gray-500">
                {translate('checkSpam')}
              </p>
              
              <Button
                onClick={onBackToLogin}
                variant="outline"
                className="w-full h-12 border-gray-200 hover:bg-gray-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {translate('backToLogin')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-large border-0 bg-white/95 backdrop-blur-sm">
      <CardContent className="p-8">
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-gray-900">
              {translate('recoverPassword')}
            </h2>
            <p className="text-gray-600">
              {translate('recoverPasswordDesc')}
            </p>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-gray-700 font-medium">
                {translate('email')}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder={translate('emailPlaceholder')}
                  value={email}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className={`pl-10 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 ${
                    validationErrors.email 
                      ? 'border-destructive focus:border-destructive' 
                      : ''
                  }`}
                  disabled={isLoading}
                />
              </div>
              {validationErrors.email && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                className="w-full h-12 text-base font-medium bg-primary hover:bg-primary-hover focus:ring-primary/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{translate('sendingLink')}</span>
                  </div>
                ) : (
                  {translate('sendRecoveryLink')}
                )}
              </Button>

              <Button
                type="button"
                onClick={onBackToLogin}
                variant="ghost"
                className="w-full h-12 text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {translate('backToLogin')}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};