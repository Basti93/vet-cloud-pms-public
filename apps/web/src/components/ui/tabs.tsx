"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export interface TabItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ size: number }>;
  requiredPermission?: string;
}

interface TabsProps {
  tabs: TabItem[];
  currentPath: string;
  permissions?: string[];
}

/**
 * Reusable Tabs Component with mobile/desktop UX
 *
 * Desktop (sm+): Horizontal tab bar with border-bottom active indicator
 * Mobile (< sm): Dropdown showing current tab
 *
 * Usage:
 * ```tsx
 * const tabs = [
 *   { href: "/settings/general", label: "General", icon: Settings },
 *   { href: "/settings/team", label: "Team", icon: Users, requiredPermission: "users:manage" },
 * ];
 * <Tabs tabs={tabs} currentPath={pathname} permissions={userPermissions} />
 * ```
 */
export function Tabs({ tabs, currentPath, permissions = [] }: TabsProps) {
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  // Filter tabs based on permissions
  const visibleTabs = useMemo(() => {
    return tabs.filter((tab) => {
      if (!tab.requiredPermission) return true;
      return permissions.includes(tab.requiredPermission);
    });
  }, [tabs, permissions]);

  // Find current tab
  const currentTab = visibleTabs.find((tab) => tab.href === currentPath) || visibleTabs[0];

  if (visibleTabs.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop Tabs - Horizontal bar */}
      <div
        className="hidden sm:block border-b overflow-x-auto"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex gap-1 min-w-min">
          {visibleTabs.map(({ href, label, icon: Icon }) => {
            const active = currentPath === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap"
                style={{
                  borderColor: active ? "var(--color-accent)" : "transparent",
                  color: active ? "var(--color-accent)" : "var(--color-muted)",
                }}
              >
                {Icon && <Icon size={16} />}
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile Dropdown */}
      <div className="sm:hidden border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="relative">
          <button
            onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
            style={{ color: "var(--color-fg)" }}
          >
            <div className="flex items-center gap-2">
              {currentTab?.icon && <currentTab.icon size={16} />}
              <span>{currentTab?.label}</span>
            </div>
            <ChevronDown
              size={16}
              className="transition-transform"
              style={{
                transform: mobileDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Dropdown Menu */}
          {mobileDropdownOpen && (
            <div
              className="absolute top-full left-0 right-0 bg-white border-t z-50 shadow-lg"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-surface)",
              }}
              onClick={() => setMobileDropdownOpen(false)}
            >
              <nav className="flex flex-col">
                {visibleTabs.map(({ href, label, icon: Icon }) => {
                  const active = currentPath === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 px-4 py-3 border-b text-sm transition-all"
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: active ? "var(--color-accent-soft)" : "transparent",
                        color: active ? "var(--color-accent)" : "var(--color-fg)",
                        fontWeight: active ? "600" : "400",
                      }}
                    >
                      {Icon && <Icon size={16} />}
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Mobile overlay to close dropdown on outside click */}
      {mobileDropdownOpen && (
        <div
          className="sm:hidden fixed inset-0 z-40"
          onClick={() => setMobileDropdownOpen(false)}
        />
      )}
    </>
  );
}
