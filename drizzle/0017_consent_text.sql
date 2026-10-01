-- Consent full text storage
ALTER TABLE `user_consent_events`
  ADD COLUMN `consentText` TEXT NULL AFTER `consentVersion`;
