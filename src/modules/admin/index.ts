/**
 * Admin Module — public barrel
 *
 * Provides access controls, audit tools, and RBAC utilities for
 * the Mushin admin panel.
 *
 * Components and pages are imported directly:
 *   import AdminDashboard from "@/pages/admin/AdminDashboard"
 *   import { AdminRoute } from "@/components/admin/AdminRoute"
 *
 * This barrel exports shared hooks and permission utilities only.
 */
export { useAdminPermissions } from "@/hooks/useAdminPermissions";
