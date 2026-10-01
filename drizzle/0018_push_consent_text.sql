-- Full consent text for push events
ALTER TABLE `push_consent_events`
  ADD COLUMN `consentText` TEXT NULL AFTER `consentVersion`;
