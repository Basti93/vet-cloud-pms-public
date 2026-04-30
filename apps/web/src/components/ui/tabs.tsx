"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export interface TabItem {
  href?: string;
  label: string;
  icon?: React.ComponentType<{ size: number }>;
  requiredPermission?: string;
}

interface TabsProps {
  tabs: TabItem[];
  currentPath?: string;
  permissions?: string[];
  onTabChange?: (tabIndex: number) => void;
  activeTabIndex?: number;
}

/**
 * Reusable Tabs Component with mobile/desktop UX
 *
 * Supports two modes:
 * 1. Navigation mode: Tabs navigate to different pages via href
 * 2. Content mode: Tabs call onTabChange callback for local state management
 *
 * Desktop (sm+): Horizontal tab bar with border-bottom active indicator
 * Mobile (< sm): Dropdown showing current tab
 *
 * Navigation mode usage (for page navigation):
 * ```tsx
 * const tabs = [
 *   { href: "/settings/general", label: "General", icon: Settings },
 *   { href: "/settings/team", label: "Team", icon: Users, requiredPermission: "users:manage" },
 * ];
 * <Tabs tabs={tabs} currentPath={pathname} permissions={userPermissions} />
 * ```
 *
 * Content mode usage (for content tabs without navigation):
 * ```tsx
 * const [activeTab, setActiveTab] = useState(0);
 * const tabs = [
 *   { label: "iframe", icon: Code },
 *   { label: "Modal", icon: Code },
 * ];
 * <Tabs tabs={tabs} activeTabIndex={activeTab} onTabChange={setActiveTab} />
 * ```
 */
export function Tabs({
  tabs,
  currentPath,
  permissions = [],
  onTabChange,
  activeTabIndex = 0,
}: TabsProps) {
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  // Determine if this is navigation mode or content mode
  const isNavigationMode = currentPath !== undefined && tabs.some((tab) => tab.href);
  const isContentMode = onTabChange !== undefined;

  // Filter tabs based on permissions
  const visibleTabs = useMemo(() => {
    return tabs.filter((tab) => {
      if (!tab.requiredPermission) return true;
      return permissions.includes(tab.requiredPermission);
    });
  }, [tabs, permissions]);

  // Find current tab
  const currentTab = isNavigationMode
    ? visibleTabs.find((tab) => tab.href === currentPath) || visibleTabs[0]
    : visibleTabs[activeTabIndex] || visibleTabs[0];

  if (visibleTabs.length === 0) {
    return null;
  }

  const TabElement = isNavigationMode ? Link : "button";

  return (
    <>
      {/* Desktop Tabs - Horizontal bar */}
      <div
        className="hidden sm:block border-b overflow-x-auto"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex gap-1 min-w-min">
          {visibleTabs.map(({ href, label, icon: Icon }, index) => {
            const active = isNavigationMode
              ? currentPath === href
              : activeTabIndex === index;

            const commonProps = {
              className:
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
              style: {
                borderColor: active ? "var(--color-accent)" : "transparent",
                color: active ? "var(--color-accent)" : "var(--color-muted)",
              },
            };

            if (isNavigationMode && href) {
              return (
                <Link key={href} href={href} {...commonProps}>
                  {Icon && <Icon size={16} />}
                  <span>{label}</span>
                </Link>
              );
            }

            return (
              <button
                key={`${label}-${index}`}
                onClick={() => onTabChange?.(index)}
                {...commonProps}
              >
                {Icon && <Icon size={16} />}
                <span>{label}</span>
              </button>
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
                {visibleTabs.map(({ href, label, icon: Icon }, index) => {
                  const active = isNavigationMode
                    ? currentPath === href
                    : activeTabIndex === index;

                  const commonProps = {
                    className:
                      "flex items-center gap-3 px-4 py-3 border-b text-sm transition-all",
                    style: {
                      borderColor: "var(--color-border)",
                      backgroundColor: active
                        ? "var(--color-accent-soft)"
                        : "transparent",
                      color: active ? "var(--color-accent)" : "var(--color-fg)",
                      fontWeight: active ? "600" : "400",
                    },
                  };

                  if (isNavigationMode && href) {
                    return (
                      <Link key={href} href={href} {...commonProps}>
                        {Icon && <Icon size={16} />}
                        <span>{label}</span>
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={`${label}-${index}`}
                      onClick={() => onTabChange?.(index)}
                      {...commonProps}
                    >
                      {Icon && <Icon size={16} />}
                      <span>{label}</span>
                    </button>
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
