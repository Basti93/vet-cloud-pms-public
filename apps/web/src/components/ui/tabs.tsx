"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export interface TabItem {
  href?: string;
  label: string;
  icon?: React.ComponentType<{ size: number }>;
  requiredPermission?: string;
  children?: TabItem[]; // Sub-items for group tabs
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
 * Supports grouped tabs with children (sub-items):
 * ```tsx
 * const tabs = [
 *   {
 *     label: "Settings",
 *     icon: Settings,
 *     children: [
 *       { href: "/settings/general", label: "General" },
 *       { href: "/settings/privacy", label: "Privacy" },
 *     ]
 *   },
 * ];
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Determine if this is navigation mode or content mode
  const isNavigationMode = currentPath !== undefined;

  // Flatten tabs to include all visible items (for finding current tab)
  const flattenTabs = (items: TabItem[]): TabItem[] => {
    return items.reduce((acc, tab) => {
      acc.push(tab);
      if (tab.children) {
        acc.push(...flattenTabs(tab.children));
      }
      return acc;
    }, [] as TabItem[]);
  };

  // Filter tabs based on permissions
  const visibleTabs = useMemo(() => {
    return tabs
      .filter((tab) => {
        if (!tab.requiredPermission) return true;
        return permissions.includes(tab.requiredPermission);
      })
      .map((tab) => ({
        ...tab,
        children: tab.children?.filter((child) => {
          if (!child.requiredPermission) return true;
          return permissions.includes(child.requiredPermission);
        }),
      }));
  }, [tabs, permissions]);

  // Find current tab from flattened list
  const allVisibleItems = flattenTabs(visibleTabs);
  const currentTab = isNavigationMode
    ? allVisibleItems.find((tab) => tab.href === currentPath) || allVisibleItems[0]
    : allVisibleItems[activeTabIndex] || allVisibleItems[0];

  // Auto-expand group if current path is in a child
  const currentGroupWithChild = visibleTabs.find(
    (tab) =>
      tab.children &&
      tab.children.some((child) => child.href === currentPath)
  );

  // Auto-expand the group if a child tab is selected
  useEffect(() => {
    if (currentGroupWithChild && !expandedGroup) {
      setExpandedGroup(currentGroupWithChild.label);
    }
  }, [currentGroupWithChild, expandedGroup]);

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
          {visibleTabs.map((tab, index) => {
            const isGroup = tab.children && tab.children.length > 0;
            const isActive = currentGroupWithChild?.label === tab.label;
            const isCurrentTabInGroup =
              isGroup &&
              tab.children?.some((child) => child.href === currentPath);
            const isExpanded = expandedGroup === tab.label;

            const commonProps = {
              className:
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
              style: {
                borderColor: isActive || isCurrentTabInGroup || (isGroup && isExpanded)
                  ? "var(--color-accent)"
                  : "transparent",
                color: isActive || isCurrentTabInGroup || (isGroup && isExpanded)
                  ? "var(--color-accent)"
                  : "var(--color-muted)",
              },
            };

            if (isGroup) {
              return (
                <button
                  key={tab.label}
                  onClick={() =>
                    setExpandedGroup(
                      expandedGroup === tab.label ? null : tab.label
                    )
                  }
                  {...commonProps}
                >
                  {tab.icon && <tab.icon size={16} />}
                  <span>{tab.label}</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform:
                        expandedGroup === tab.label
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </button>
              );
            }

            if (isNavigationMode && tab.href) {
              return (
                <Link key={tab.href} href={tab.href} {...commonProps}>
                  {tab.icon && <tab.icon size={16} />}
                  <span>{tab.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={`${tab.label}-${index}`}
                onClick={() => onTabChange?.(index)}
                {...commonProps}
              >
                {tab.icon && <tab.icon size={16} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sub-items for expanded group (desktop) */}
        {expandedGroup && (
          <div
            className="border-t flex gap-1 min-w-min overflow-x-auto bg-surface px-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            {visibleTabs
              .find((tab) => tab.label === expandedGroup)
              ?.children?.map((child) => {
                const active = isNavigationMode
                  ? currentPath === child.href
                  : false;

                const childProps = {
                  className:
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
                  style: {
                    borderColor: active
                      ? "var(--color-accent)"
                      : "transparent",
                    color: active
                      ? "var(--color-accent)"
                      : "var(--color-muted)",
                  },
                };

                if (isNavigationMode && child.href) {
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      {...childProps}
                    >
                      {child.icon && <child.icon size={16} />}
                      <span>{child.label}</span>
                    </Link>
                  );
                }

                return (
                  <button key={child.label} {...childProps}>
                    {child.icon && <child.icon size={16} />}
                    <span>{child.label}</span>
                  </button>
                );
              })}
          </div>
        )}
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
              className="absolute top-full left-0 right-0 bg-white border-t z-50 shadow-lg max-h-96 overflow-y-auto"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-surface)",
              }}
              onClick={() => setMobileDropdownOpen(false)}
            >
              <nav className="flex flex-col">
                {visibleTabs.map((tab) => {
                  const isGroup = tab.children && tab.children.length > 0;
                  const isCurrentGroupExpanded = expandedGroup === tab.label;
                  const isChildActive = tab.children?.some((child) => child.href === currentPath);

                  if (isGroup) {
                    return (
                      <div key={tab.label}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedGroup(
                              isCurrentGroupExpanded ? null : tab.label
                            );
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 border-b text-sm font-medium transition-all"
                          style={{
                            borderColor: "var(--color-border)",
                            backgroundColor: isCurrentGroupExpanded || isChildActive ? "var(--color-accent-soft)" : "transparent",
                            color: isCurrentGroupExpanded || isChildActive ? "var(--color-accent)" : "var(--color-fg)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {tab.icon && <tab.icon size={16} />}
                            <span>{tab.label}</span>
                          </div>
                          <ChevronDown
                            size={16}
                            style={{
                              transform: isCurrentGroupExpanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                              transition: "transform 0.2s",
                            }}
                          />
                        </button>

                        {/* Expanded children */}
                        {isCurrentGroupExpanded &&
                          tab.children?.map((child) => {
                            const active = isNavigationMode
                              ? currentPath === child.href
                              : false;

                            const childProps = {
                              className:
                                "flex items-center gap-3 px-8 py-2.5 border-b text-sm transition-all",
                              style: {
                                borderColor: "var(--color-border)",
                                backgroundColor: active
                                  ? "var(--color-accent-soft)"
                                  : "transparent",
                                color: active
                                  ? "var(--color-accent)"
                                  : "var(--color-fg)",
                                fontWeight: active ? "600" : "400",
                              },
                            };

                            if (isNavigationMode && child.href) {
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  {...childProps}
                                  onClick={() => setMobileDropdownOpen(false)}
                                >
                                  {child.icon && <child.icon size={16} />}
                                  <span>{child.label}</span>
                                </Link>
                              );
                            }

                            return (
                              <button
                                key={child.label}
                                {...childProps}
                              >
                                {child.icon && <child.icon size={16} />}
                                <span>{child.label}</span>
                              </button>
                            );
                          })}
                      </div>
                    );
                  }

                  const active = isNavigationMode
                    ? currentPath === tab.href
                    : false;

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

                  if (isNavigationMode && tab.href) {
                    return (
                      <Link key={tab.href} href={tab.href} {...commonProps}>
                        {tab.icon && <tab.icon size={16} />}
                        <span>{tab.label}</span>
                      </Link>
                    );
                  }

                  return (
                    <button key={`${tab.label}`} {...commonProps}>
                      {tab.icon && <tab.icon size={16} />}
                      <span>{tab.label}</span>
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
