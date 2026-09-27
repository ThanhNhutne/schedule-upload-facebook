export class ManualActionRequiredError extends Error {
  readonly code: string = 'MANUAL_ACTION_REQUIRED';

  constructor(message: string) {
    super(message);
    this.name = 'ManualActionRequiredError';
  }
}

export class BrowserProfileInUseError extends ManualActionRequiredError {
  override readonly code: string = 'BROWSER_PROFILE_IN_USE';

  constructor(message: string) {
    super(message);
    this.name = 'BrowserProfileInUseError';
  }
}

export class PermanentAutomationError extends Error {
  readonly code: string = 'PERMANENT_AUTOMATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'PermanentAutomationError';
  }
}

export class FacebookUiError extends PermanentAutomationError {
  override readonly code: string = 'FACEBOOK_UI_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'FacebookUiError';
  }
}

export class RetryableAutomationError extends Error {
  readonly code: string = 'RETRYABLE_AUTOMATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'RetryableAutomationError';
  }
}
