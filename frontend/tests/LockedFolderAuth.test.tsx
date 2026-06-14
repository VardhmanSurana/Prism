import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { AuthForm } from '../components/LockedViewAuth/components/AuthForm';

describe('LockedFolderAuth (AuthForm) Component', () => {
  const defaultProps = {
    isConfigured: false,
    error: '',
    submitting: false,
    onSetup: vi.fn(),
    onVerify: vi.fn(),
    onAuthenticate: vi.fn(),
    setError: vi.fn(),
    setSubmitting: vi.fn(),
  };

  test('renders setup mode inputs and labels', () => {
    render(<AuthForm {...defaultProps} isConfigured={false} />);
    
    expect(screen.getByText('Configure Locked Folder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Re-enter password...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure & Enter' })).toBeInTheDocument();
  });

  test('renders unlock mode inputs and labels', () => {
    render(<AuthForm {...defaultProps} isConfigured={true} />);
    
    expect(screen.getByText('Access Locked Folder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Re-enter password...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock Folder' })).toBeInTheDocument();
  });

  test('validates password match on setup submit', async () => {
    const setErrorMock = vi.fn();
    render(
      <AuthForm 
        {...defaultProps} 
        isConfigured={false} 
        setError={setErrorMock} 
      />
    );
    
    const pwdInput = screen.getByPlaceholderText('Enter password...');
    const confirmInput = screen.getByPlaceholderText('Re-enter password...');
    const submitBtn = screen.getByRole('button', { name: 'Configure & Enter' });
    
    fireEvent.change(pwdInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'passwordXYZ' } });
    fireEvent.click(submitBtn);
    
    expect(setErrorMock).toHaveBeenCalledWith('Passwords do not match');
  });

  test('calls onVerify with password on unlock submit', async () => {
    const onVerifyMock = vi.fn().mockResolvedValue(true);
    const onAuthMock = vi.fn();
    render(
      <AuthForm 
        {...defaultProps} 
        isConfigured={true} 
        onVerify={onVerifyMock}
        onAuthenticate={onAuthMock}
      />
    );
    
    const pwdInput = screen.getByPlaceholderText('Enter password...');
    const submitBtn = screen.getByRole('button', { name: 'Unlock Folder' });
    
    fireEvent.change(pwdInput, { target: { value: 'mypassword123' } });
    fireEvent.click(submitBtn);
    
    expect(onVerifyMock).toHaveBeenCalledWith('mypassword123');
  });
});
