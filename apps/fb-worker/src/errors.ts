export class ManualActionRequiredError extends Error {
  readonly code = 'MANUAL_ACTION_REQUIRED';

  constructor(message: string) {
    super(message);
    this.name = 'ManualActionRequiredError';
  }
}

export class FacebookUiError extends Error {
  readonly code = 'FACEBOOK_UI_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'FacebookUiError';
  }
}
