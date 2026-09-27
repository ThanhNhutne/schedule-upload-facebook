export class ManualActionRequiredError extends Error {
  readonly code = 'MANUAL_ACTION_REQUIRED';

  constructor(message: string) {
    super(message);
    this.name = 'ManualActionRequiredError';
  }
}

export class PermanentAutomationError extends Error {
  readonly code = 'PERMANENT_AUTOMATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'PermanentAutomationError';
  }
}

export class FacebookUiError extends PermanentAutomationError {
  readonly code = 'FACEBOOK_UI_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'FacebookUiError';
  }
}

export class RetryableAutomationError extends Error {
  readonly code = 'RETRYABLE_AUTOMATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'RetryableAutomationError';
  }
}
