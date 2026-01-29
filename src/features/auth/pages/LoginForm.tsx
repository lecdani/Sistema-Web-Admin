'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent } from '@/shared/components/base/Card';
import { Eye, EyeOff, ArrowRight, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthLogin } from '../hooks/useAuthLogin';
import { LoginCredentials } from '@/shared/types/api';

interface LoginFormProps {
  onForgotPassword: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { login, loading, error, clearError } = useAuthLogin();
  const [formData, setFormData] = useState<LoginCredentials>({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Ingresa un correo electrónico válido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 3) {
      newErrors.password = 'La contraseña debe tener al menos 3 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    clearError();
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const result = await login(formData);
    if (!result.success) {
      setErrors({ submit: result.error || 'Error al iniciar sesión' });
    }
  };

  return (
    <Card className="w-full shadow-large border-0 bg-white/95 backdrop-blur-sm">
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mensaje de error general */}
          {(error || errors.submit) && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">
                {error || errors.submit}
              </p>
            </div>
          )}

          {/* Campo Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700 font-medium">
              Correo electrónico
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="tu@empresa.com"
                disabled={loading}
                className={`pl-10 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 ${
                  errors.email ? 'border-destructive focus:border-destructive' : ''
                }`}
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                {errors.email}
              </p>
            )}
          </div>

          {/* Campo Contraseña */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700 font-medium">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Ingresa tu contraseña"
                disabled={loading}
                className={`pl-10 pr-12 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 ${
                  errors.password ? 'border-destructive focus:border-destructive' : ''
                }`}
                autoComplete="current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-10 w-10 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                {errors.password}
              </p>
            )}
          </div>

          {/* Link de olvidé mi contraseña */}
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="link"
              className="px-0 text-sm text-primary hover:text-primary-hover"
              onClick={onForgotPassword}
              disabled={loading}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          </div>

          {/* Botón de submit */}
          <Button
            type="submit"
            className="w-full h-12 text-base font-medium bg-primary hover:bg-primary-hover focus:ring-primary/20"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                <span>Iniciando sesión...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>Iniciar Sesión</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}