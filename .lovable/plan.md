# Phase 4: Outreach Automation (Email Sending)

## Overview

Add the ability to send templated outreach emails to influencers directly from the campaign pipeline, with email template management and send tracking.

---

## 4.1 Email Provider Setup (Resend)

An edge function will handle email sending via the Resend API.

**Why Resend**: Simple API, generous free tier (100 emails/day), easy integration from edge functions.

**Secret Required**: `RESEND_API_KEY` -- the user will need to create a Resend account and provide their API key.

### Edge Function: `supabase/functions/send-outreach-email/index.ts`

- Accepts POST with: `to`, `subject`, `body` (HTML), `from_name`, `reply_to`, `card_id`, `campaign_id`
- Validates auth and workspace membership
- Sends email via Resend API
- Logs the send in `outreach_log` with method = "email"
- Returns success/failure status

---

## 4.2 Email Templates Table

### Database Migration

```sql
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace members (SELECT, INSERT, UPDATE, DELETE)
```

Templates support variables like `{{username}}`, `{{platform}}`, and `{{campaign_name}}` that are substituted at send time.

### New Hook: `src/hooks/useEmailTemplates.ts`

- CRUD operations for email templates
- Template variable substitution helper function

---

## 4.3 Template Management UI

### New Component: `src/components/campaigns/EmailTemplateManager.tsx`

- Accessible from the Settings page or a new "Templates" section
- List existing templates with preview
- Create/edit dialog with:
  - Template name
  - Subject line (with variable insertion buttons)
  - Body editor (rich text area with variable insertion buttons)
  - Preview mode showing substituted values
- Delete with confirmation

---

## 4.4 Send Email from Card Detail Dialog

### Modifications to `CardDetailDialog.tsx`

- Add a "Send Email" button next to the outreach history section
- Opens an email compose dialog with:
  - Template selector dropdown (pre-fills subject/body)
  - Editable subject and body fields
  - Recipient email field (manual entry since we don't store influencer emails)
  - From name and reply-to fields (from workspace settings)
  - Preview before sending
  - Send button that calls the edge function
- After successful send, the outreach log updates automatically with method = "email"

### New Component: `src/components/campaigns/SendEmailDialog.tsx`

- Template selection and variable substitution
- Email composition form
- Send confirmation with loading state
- Success/error feedback via toast

---

## 4.5 Quick Send from Kanban Board

### Modifications to `KanbanCard.tsx` and `KanbanBoard.tsx`

- Add a small mail/send icon button on each card (visible on hover)
- Clicking opens the SendEmailDialog pre-filled with card data
- Enables rapid outreach without opening the full card detail

---

## 4.6 Outreach Log Enhancement

### Modifications to `outreach_log` table

Add a column for tracking email-specific data:

```sql
ALTER TABLE public.outreach_log
  ADD COLUMN email_to TEXT,
  ADD COLUMN email_subject TEXT;
```

### Updated `useOutreachLog.ts`

- Include email_to and email_subject in queries
- Display email details in the outreach history section

---

## 4.7 Workspace Email Settings

### Modifications to Settings page

- Add an "Outreach" tab/section with:
  - Default sender name
  - Default reply-to email
  - These are stored in the `workspaces.settings` JSONB column

---

## Files Summary


| File                                                | Action                                         |
| --------------------------------------------------- | ---------------------------------------------- |
| `supabase/functions/send-outreach-email/index.ts`   | Create                                         |
| `src/hooks/useEmailTemplates.ts`                    | Create                                         |
| `src/components/campaigns/EmailTemplateManager.tsx` | Create                                         |
| `src/components/campaigns/SendEmailDialog.tsx`      | Create                                         |
| `src/components/campaigns/CardDetailDialog.tsx`     | Modify (add Send Email button)                 |
| `src/components/campaigns/KanbanCard.tsx`           | Modify (add quick send icon)                   |
| `src/components/campaigns/KanbanBoard.tsx`          | Modify (wire up quick send)                    |
| `src/hooks/useOutreachLog.ts`                       | Modify (email fields)                          |
| `src/pages/Settings.tsx`                            | Modify (outreach settings tab)                 |
| Database migration                                  | Create `email_templates`, alter `outreach_log` |
| Secret                                              | `RESEND_API_KEY`                               |


## Implementation Order

1. Request `RESEND_API_KEY` secret from user
2. Database migration (email_templates table + outreach_log columns)
3. Create `send-outreach-email` edge function
4. Create `useEmailTemplates` hook
5. Build EmailTemplateManager component and add to Settings
6. Build SendEmailDialog component
7. Integrate Send Email button in CardDetailDialog
8. Add quick send icon to KanbanCard
9. Add outreach settings to Settings page
10. End-to-end testing

## Technical Considerations

- **Email deliverability**: Resend handles SPF/DKIM automatically for their shared domain. For custom domains, users can configure DNS records via Resend's dashboard.
- **Rate limiting**: The edge function should respect Resend's rate limits (free tier: 100 emails/day). The function will return clear error messages when limits are hit.
- **Template variables**: Substitution happens client-side for preview and server-side before sending to prevent tampering.
- **No influencer email storage**: Since we don't currently store influencer email addresses, the user manually enters the recipient email. A future enhancement could add an email field to pipeline cards.