import { ValidationErrors } from '../types';

// Esquemas de validación optimizados y seguros
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationSchema {
  email?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

// Interface para validación de fortaleza de contraseña
export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-5
  feedback: string[];
}

// Interface para validación de perfil
export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  avatar?: string;
}

// Validación de email mejorada
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  
  // Pattern más seguro para emails
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // Verificaciones adicionales de seguridad
  if (email.length > 254) return false; // RFC 5321 límite
  if (email.includes('..')) return false; // No se permiten puntos consecutivos
  if (email.startsWith('.') || email.endsWith('.')) return false;
  
  return emailPattern.test(email);
};

// Validación de contraseña
export const validatePassword = (password: string): PasswordStrengthResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!password) {
    errors.push('La contraseña es requerida');
    return { isValid: false, score: 0, feedback: errors };
  }
  
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  
  if (password.length > 128) {
    errors.push('La contraseña no puede exceder 128 caracteres');
  }
  
  // Verificar complejidad
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  // Incluimos también el guion (-) como carácter especial
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>-]/.test(password);
  
  if (!hasUpperCase) {
    warnings.push('Se recomienda incluir al menos una letra mayúscula');
  }
  
  if (!hasLowerCase) {
    warnings.push('Se recomienda incluir al menos una letra minúscula');
  }
  
  if (!hasNumbers) {
    warnings.push('Se recomienda incluir al menos un número');
  }
  
  if (!hasSpecialChar) {
    warnings.push('Se recomienda incluir al menos un carácter especial');
  }
  
  // Detectar patrones comunes débiles
  const commonPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'admin', 'letmein',
    'welcome', 'monkey', '1234567890', 'password123', 'admin123'
  ];
  
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    warnings.push('Evita usar patrones comunes en tu contraseña');
  }
  
  // Calcular la fortaleza de la contraseña
  let score = 0;
  if (hasUpperCase) score++;
  if (hasLowerCase) score++;
  if (hasNumbers) score++;
  if (hasSpecialChar) score++;
  if (password.length >= 12) score++;
  
  return {
    isValid: errors.length === 0,
    score,
    feedback: errors.length > 0 ? errors : warnings
  };
};

// Validador genérico mejorado
export const validateField = (value: any, schema: ValidationSchema): ValidationResult => {
  const errors: string[] = [];
  
  // Verificar si es requerido
  if (schema.required && (!value || (typeof value === 'string' && !value.trim()))) {
    errors.push('Este campo es requerido');
    return { isValid: false, errors };
  }
  
  // Si no es requerido y está vacío, es válido
  if (!schema.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return { isValid: true, errors: [] };
  }
  
  const stringValue = String(value);
  
  // Validar email
  if (schema.email && !isValidEmail(stringValue)) {
    errors.push('Formato de email inválido');
  }
  
  // Validar longitud mínima
  if (schema.minLength && stringValue.length < schema.minLength) {
    errors.push(`Debe tener al menos ${schema.minLength} caracteres`);
  }
  
  // Validar longitud máxima
  if (schema.maxLength && stringValue.length > schema.maxLength) {
    errors.push(`No puede exceder ${schema.maxLength} caracteres`);
  }
  
  // Validar patrón
  if (schema.pattern && !schema.pattern.test(stringValue)) {
    errors.push('Formato inválido');
  }
  
  // Validación personalizada
  if (schema.custom) {
    const customError = schema.custom(value);
    if (customError) {
      errors.push(customError);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validaciones específicas para formularios
export const validateLoginForm = (data: { email: string; password: string }): ValidationResult => {
  const errors: string[] = [];
  
  // Validar email
  const emailValidation = validateField(data.email, { 
    required: true, 
    email: true,
    maxLength: 254
  });
  errors.push(...emailValidation.errors);
  
  // Validar contraseña
  const passwordValidation = validateField(data.password, { 
    required: true,
    minLength: 1, // En login solo verificamos que no esté vacío
    maxLength: 128
  });
  errors.push(...passwordValidation.errors);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateRegisterForm = (data: { 
  email: string; 
  password: string; 
  confirmPassword: string;
  firstName: string;
  lastName: string;
}): ValidationResult => {
  const errors: string[] = [];
  
  // Validar email
  const emailValidation = validateField(data.email, { 
    required: true, 
    email: true,
    maxLength: 254
  });
  errors.push(...emailValidation.errors);
  
  // Validar contraseña
  const passwordValidation = validatePassword(data.password);
  errors.push(...passwordValidation.errors);
  
  // Validar confirmación de contraseña
  if (data.password !== data.confirmPassword) {
    errors.push('Las contraseñas no coinciden');
  }
  
  // Validar nombres
  const firstNameValidation = validateField(data.firstName, {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/,
    custom: (value) => {
      if (value && value.trim().length !== value.length) {
        return 'No debe tener espacios al inicio o final';
      }
      return null;
    }
  });
  errors.push(...firstNameValidation.errors);
  
  const lastNameValidation = validateField(data.lastName, {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/,
    custom: (value) => {
      if (value && value.trim().length !== value.length) {
        return 'No debe tener espacios al inicio o final';
      }
      return null;
    }
  });
  errors.push(...lastNameValidation.errors);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validación para productos
export const validateProductForm = (data: {
  sku: string;
  name: string;
  category: string;
  description?: string;
  currentPrice: number;
}): ValidationResult => {
  const errors: string[] = [];
  
  // Validar SKU
  const skuValidation = validateField(data.sku, {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[A-Z0-9\-_]+$/,
    custom: (value) => {
      if (value && (value.startsWith('-') || value.endsWith('-'))) {
        return 'No puede empezar o terminar con guiones';
      }
      return null;
    }
  });
  errors.push(...skuValidation.errors);
  
  // Validar nombre
  const nameValidation = validateField(data.name, {
    required: true,
    minLength: 2,
    maxLength: 100,
    custom: (value) => {
      if (value && value.trim().length !== value.length) {
        return 'No debe tener espacios al inicio o final';
      }
      return null;
    }
  });
  errors.push(...nameValidation.errors);
  
  // Validar categoría
  const categoryValidation = validateField(data.category, {
    required: true,
    minLength: 2,
    maxLength: 50
  });
  errors.push(...categoryValidation.errors);
  
  // Validar descripción (opcional)
  if (data.description) {
    const descriptionValidation = validateField(data.description, {
      maxLength: 500
    });
    errors.push(...descriptionValidation.errors);
  }
  
  // Validar precio
  if (typeof data.currentPrice !== 'number' || data.currentPrice <= 0) {
    errors.push('El precio debe ser un número mayor a 0');
  }
  
  if (data.currentPrice > 999999.99) {
    errors.push('El precio no puede exceder 999,999.99');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Validación para tiendas
export const validateStoreForm = (data: {
  serialNumber: string;
  name: string;
  address: string;
  cityId: string;
  phone?: string;
  email?: string;
  manager?: string;
}): ValidationResult => {
  const errors: string[] = [];
  
  // Validar número de serie
  const serialValidation = validateField(data.serialNumber, {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[A-Z0-9\-]+$/
  });
  errors.push(...serialValidation.errors);
  
  // Validar nombre
  const nameValidation = validateField(data.name, {
    required: true,
    minLength: 2,
    maxLength: 100
  });
  errors.push(...nameValidation.errors);
  
  // Validar dirección
  const addressValidation = validateField(data.address, {
    required: true,
    minLength: 5,
    maxLength: 200
  });
  errors.push(...addressValidation.errors);
  
  // Validar ciudad
  const cityValidation = validateField(data.cityId, {
    required: true
  });
  errors.push(...cityValidation.errors);
  
  // Validar teléfono (opcional)
  if (data.phone) {
    const phoneValidation = validateField(data.phone, {
      pattern: /^[\+]?[0-9\s\-\(\)]{7,20}$/,
      custom: (value) => {
        if (value && !/\d/.test(value)) {
          return 'Debe contener al menos un número';
        }
        return null;
      }
    });
    errors.push(...phoneValidation.errors);
  }
  
  // Validar email (opcional)
  if (data.email) {
    const emailValidation = validateField(data.email, {
      email: true,
      maxLength: 254
    });
    errors.push(...emailValidation.errors);
  }
  
  // Validar manager (opcional)
  if (data.manager) {
    const managerValidation = validateField(data.manager, {
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/
    });
    errors.push(...managerValidation.errors);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Sanitización de datos
export const sanitizeString = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/\s+/g, ' ') // Reemplazar múltiples espacios por uno solo
    .slice(0, 1000); // Limitar longitud por seguridad
};

export const sanitizeNumber = (input: any): number => {
  const num = parseFloat(input);
  return isNaN(num) ? 0 : num;
};

// Validador de archivos
export const validateFile = (file: File, options: {
  maxSize?: number; // en bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}): ValidationResult => {
  const errors: string[] = [];
  
  if (!file) {
    errors.push('No se ha seleccionado ningún archivo');
    return { isValid: false, errors };
  }
  
  // Validar tamaño
  if (options.maxSize && file.size > options.maxSize) {
    const maxSizeMB = (options.maxSize / (1024 * 1024)).toFixed(1);
    errors.push(`El archivo no puede exceder ${maxSizeMB}MB`);
  }
  
  // Validar tipo MIME
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    errors.push(`Tipo de archivo no permitido. Tipos permitidos: ${options.allowedTypes.join(', ')}`);
  }
  
  // Validar extensión
  if (options.allowedExtensions) {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !options.allowedExtensions.includes(fileExtension)) {
      errors.push(`Extensión no permitida. Extensiones permitidas: ${options.allowedExtensions.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Utilidades adicionales
export const debounceValidation = (
  validator: () => ValidationResult,
  delay: number = 300
): () => Promise<ValidationResult> => {
  let timeoutId: NodeJS.Timeout;
  
  return () => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resolve(validator());
      }, delay);
    });
  };
};

// Escapar HTML para prevenir XSS
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Validación de datos de perfil - función específica para UserProfile
export const validateProfileData = (data: ProfileData): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  // Validar nombre
  const firstNameValidation = validateField(data.firstName, {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/
  });
  if (!firstNameValidation.isValid) {
    errors.firstName = firstNameValidation.errors[0];
  }
  
  // Validar apellido
  const lastNameValidation = validateField(data.lastName, {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/
  });
  if (!lastNameValidation.isValid) {
    errors.lastName = lastNameValidation.errors[0];
  }
  
  // Validar email
  const emailValidation = validateField(data.email, {
    required: true,
    email: true,
    maxLength: 254
  });
  if (!emailValidation.isValid) {
    errors.email = emailValidation.errors[0];
  }
  
  // Validar teléfono (opcional)
  if (data.phone && data.phone.trim()) {
    const phoneValidation = validateField(data.phone, {
      pattern: /^[\+]?[0-9\s\-\(\)]{7,20}$/,
      custom: (value) => {
        if (value && !/\d/.test(value)) {
          return 'Debe contener al menos un número';
        }
        return null;
      }
    });
    if (!phoneValidation.isValid) {
      errors.phone = phoneValidation.errors[0];
    }
  }
  
  // Validar dirección (opcional)
  if (data.address && data.address.trim()) {
    const addressValidation = validateField(data.address, {
      maxLength: 200
    });
    if (!addressValidation.isValid) {
      errors.address = addressValidation.errors[0];
    }
  }
  
  return errors;
};

// Validación de fortaleza de contraseña (requisitos obligatorios)
export const validatePasswordStrength = (password: string): PasswordStrengthResult => {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return {
      isValid: false,
      score: 0,
      feedback: ['La contraseña es requerida']
    };
  }

  // Solo requisitos obligatorios: 8 caracteres, mayúscula, minúscula, número, carácter especial
  if (password.length >= 8) {
    score++;
  } else {
    feedback.push('Mínimo 8 caracteres');
  }

  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Al menos una mayúscula');
  }

  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('Al menos una minúscula');
  }

  if (/\d/.test(password)) {
    score++;
  } else {
    feedback.push('Al menos un número');
  }

  if (/[!@#$%^&*(),.?":{}|<>\-]/.test(password)) {
    score++;
  } else {
    feedback.push('Al menos un carácter especial (!@#$% etc.)');
  }

  const isValid = feedback.length === 0;
  return {
    isValid,
    score: Math.min(5, score),
    feedback
  };
};