-- Admin actions (removing a flagged listing, suspending/reactivating an
-- account) previously left the affected user with no explanation anywhere
-- in-product — they just silently lost access/visibility. Extends the
-- existing screening-complete notification pattern to cover these too.
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_STATUS_CHANGED';
