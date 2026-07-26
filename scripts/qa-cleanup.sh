#!/usr/bin/env bash
# Removes all data created by scripts/qa-e2e.ts from a database.
# QA artifacts are identified by naming convention:
#   firms:  name LIKE 'QA Firm %' / 'QA Provisioned %'
#   users:  email LIKE 'qa-%@example.com' or the qa-superadmin bot
#   leads:  email LIKE 'qa-lead-%@example.com'
#
# Usage: MYSQL="mysql -uroot -p... cliavo" ./scripts/qa-cleanup.sh
set -euo pipefail

MYSQL="${MYSQL:?Set MYSQL to a mysql client command, e.g. MYSQL='mysql -uroot -psecret cliavo'}"

q() { echo "$1" | $MYSQL -N 2>/dev/null; }

FIRM_IDS=$(q "SELECT IFNULL(GROUP_CONCAT(id),0) FROM firms WHERE name LIKE 'QA Firm %' OR name LIKE 'QA Provisioned %'")
USER_IDS=$(q "SELECT IFNULL(GROUP_CONCAT(id),0) FROM users WHERE email LIKE 'qa-%@example.com' OR email='qa-superadmin@cliavo-qa.internal'")
CASE_IDS=$(q "SELECT IFNULL(GROUP_CONCAT(id),0) FROM cases WHERE firmId IN ($FIRM_IDS)")
INV_IDS=$(q "SELECT IFNULL(GROUP_CONCAT(id),0) FROM invoices WHERE firmId IN ($FIRM_IDS)")
PLAN_IDS=$(q "SELECT IFNULL(GROUP_CONCAT(id),0) FROM payment_plans WHERE invoiceId IN ($INV_IDS)")
TICKET_IDS=$(q "SELECT IFNULL(GROUP_CONCAT(id),0) FROM support_tickets WHERE firmId IN ($FIRM_IDS)")
ORDER_IDS=$(q "SELECT IFNULL(GROUP_CONCAT(id),0) FROM service_orders WHERE firmId IN ($FIRM_IDS)")

echo "QA firms: $FIRM_IDS"
echo "QA users: $USER_IDS"

$MYSQL 2>/dev/null << EOF
DELETE FROM case_assignments WHERE caseId IN ($CASE_IDS);
DELETE FROM case_events WHERE caseId IN ($CASE_IDS);
DELETE FROM invoice_items WHERE invoiceId IN ($INV_IDS);
DELETE FROM payment_installments WHERE paymentPlanId IN ($PLAN_IDS);
DELETE FROM payment_plans WHERE id IN ($PLAN_IDS);
DELETE FROM support_ticket_messages WHERE ticketId IN ($TICKET_IDS);
DELETE FROM support_ticket_attachments WHERE ticketId IN ($TICKET_IDS);
DELETE FROM service_order_items WHERE orderId IN ($ORDER_IDS);
DELETE FROM service_order_events WHERE orderId IN ($ORDER_IDS);
DELETE FROM service_order_attachments WHERE orderId IN ($ORDER_IDS);
DELETE FROM active_timers WHERE firmId IN ($FIRM_IDS);
DELETE FROM adyen_accounts WHERE firmId IN ($FIRM_IDS);
DELETE FROM calendar_connections WHERE firmId IN ($FIRM_IDS);
DELETE FROM calendar_personal_events WHERE firmId IN ($FIRM_IDS);
DELETE FROM case_intake_submissions WHERE firmId IN ($FIRM_IDS);
DELETE FROM case_tasks WHERE firmId IN ($FIRM_IDS);
DELETE FROM client_activities WHERE firmId IN ($FIRM_IDS);
DELETE FROM client_subscriptions WHERE firmId IN ($FIRM_IDS);
DELETE FROM clients WHERE firmId IN ($FIRM_IDS);
DELETE FROM document_folders WHERE firmId IN ($FIRM_IDS);
DELETE FROM document_requests WHERE firmId IN ($FIRM_IDS);
DELETE FROM documents WHERE firmId IN ($FIRM_IDS);
DELETE FROM firm_client_packages WHERE firmId IN ($FIRM_IDS);
DELETE FROM firm_leads WHERE firmId IN ($FIRM_IDS);
DELETE FROM firm_members WHERE firmId IN ($FIRM_IDS);
DELETE FROM firm_ondemand_services WHERE firmId IN ($FIRM_IDS);
DELETE FROM firm_pages WHERE firmId IN ($FIRM_IDS);
DELETE FROM firm_subscriptions WHERE firmId IN ($FIRM_IDS);
DELETE FROM invitations WHERE firmId IN ($FIRM_IDS);
DELETE FROM lawyer_rates WHERE firmId IN ($FIRM_IDS);
DELETE FROM matter_stages WHERE firmId IN ($FIRM_IDS);
DELETE FROM messages WHERE firmId IN ($FIRM_IDS);
DELETE FROM time_entries WHERE firmId IN ($FIRM_IDS);
DELETE FROM time_entry_tags WHERE firmId IN ($FIRM_IDS);
DELETE FROM service_orders WHERE firmId IN ($FIRM_IDS);
DELETE FROM support_tickets WHERE firmId IN ($FIRM_IDS);
DELETE FROM cases WHERE id IN ($CASE_IDS);
DELETE FROM invoices WHERE id IN ($INV_IDS);
DELETE FROM firms WHERE id IN ($FIRM_IDS);
DELETE FROM announcement_dismissals WHERE userId IN ($USER_IDS);
DELETE FROM superadmin_audit_log WHERE superadminId IN ($USER_IDS);
DELETE FROM platform_leads WHERE email LIKE 'qa-lead-%@example.com';
DELETE FROM users WHERE id IN ($USER_IDS);
EOF

echo "QA cleanup done."
