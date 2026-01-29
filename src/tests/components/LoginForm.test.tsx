import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/features/auth/pages/LoginForm';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useLanguage } from '@/shared/hooks/useLanguage';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/login',
}));

// Mocks
jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useLanguage');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseLanguage = useLanguage as jest.MockedFunction<typeof useLanguage>;

describe('LoginForm', () => {
  const mockLogin = jest.fn();
  const mockTranslate = jest.fn((key: string) => key);
  const mockOnForgotPassword = jest.fn();

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      clearError: jest.fn()
    });

    mockUseLanguage.mockReturnValue({
      language: 'es',
      changeLanguage: jest.fn(),
      translate: mockTranslate,
      isLoading: false
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form correctly', () => {
    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('emailRequired')).toBeInTheDocument();
      expect(screen.getByText('passwordRequired')).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);
    
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('emailInvalid')).toBeInTheDocument();
    });
  });

  it('calls login function with correct credentials', async () => {
    mockLogin.mockResolvedValue({ success: true, message: 'Success' });
    
    const user = userEvent.setup();
    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false
      });
    });
  });

  it('shows loading state during login', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      clearError: jest.fn()
    });

    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);
    
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);
    
    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: '' });
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('calls onForgotPassword when forgot password link is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginForm onForgotPassword={mockOnForgotPassword} />);
    
    const forgotPasswordLink = screen.getByText('forgotPassword');
    await user.click(forgotPasswordLink);
    
    expect(mockOnForgotPassword).toHaveBeenCalled();
  });
});