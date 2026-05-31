export interface LockedViewAuthProps {
  onAuthenticate: () => void;
}

export interface LockedFolderStatus {
  is_configured: boolean;
  is_authenticated: boolean;
}

export interface SetupResponse {
  success: boolean;
}

export interface VerifyResponse {
  success: boolean;
}
