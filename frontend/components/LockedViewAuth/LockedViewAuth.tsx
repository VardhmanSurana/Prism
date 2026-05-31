import React from 'react';
import { LockedViewAuthProps } from './types';
import { useLockedFolder } from './hooks/useLockedFolder';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AuthForm } from './components/AuthForm';

export function LockedViewAuth({ onAuthenticate }: LockedViewAuthProps): React.ReactElement {
  const {
    isConfigured,
    loading,
    error,
    submitting,
    setup,
    verify,
    setError,
    setSubmitting
  } = useLockedFolder(onAuthenticate);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthForm
      isConfigured={isConfigured}
      error={error}
      submitting={submitting}
      onSetup={setup}
      onVerify={verify}
      onAuthenticate={onAuthenticate}
      setError={setError}
      setSubmitting={setSubmitting}
    />
  );
}
