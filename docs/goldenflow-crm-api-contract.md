# GoldenFlow CRM API Contract

Status: implemented as contract and mock adapter only. No direct database access is allowed.

## Authentication

Server-to-server bearer token:

`Authorization: Bearer <GOLDENFLOW_CRM_API_KEY>`

Every write request must include:

`Idempotency-Key: <business-id>:<entity-id>:<action>`

## Endpoints Needed In GoldenFlow CRM

- `POST /api/external/leads`
- `POST /api/external/leads/update`
- `POST /api/external/leads/status`
- `POST /api/external/leads/temperature`
- `POST /api/external/tasks`
- `POST /api/external/conversation-summaries`
- `POST /api/external/lead-activities`

## Source Of Truth

GoldenFlow AI Assistant owns conversation intelligence, drafts, AI mode, lead score, temperature, and WhatsApp message state.

GoldenFlow CRM owns long-term lead profile, pipeline status, owners, tasks, business activities, and deals.

Conflict rule: CRM status is not changed unless an explicit active mapping exists in `crm_status_mappings`.
