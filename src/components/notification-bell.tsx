"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { createClient } from "@/lib/supabase/client";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  relatedJobId: string | null;
};

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({
  profileId,
  initialNotifications,
}: {
  profileId: string;
  initialNotifications: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // AppShell lives in a persistent layout, so this component doesn't remount
  // across sibling-page navigations (e.g. /admin -> /admin/moderation) —
  // without this, `initialNotifications` (seeded once at mount) would never
  // pick up anything created after that first load for the rest of the
  // session. Same postgres_changes pattern already used for screening runs.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${profileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `profileId=eq.${profileId}` },
        (payload) => {
          const next = payload.new as {
            id: string;
            title: string;
            body: string;
            read: boolean;
            createdAt: string;
            relatedJobId: string | null;
          };
          setNotifications((prev) => [next, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (!next) triggerRef.current?.focus();
      return next;
    });
  }

  function handleItemClick(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    startTransition(() => markNotificationRead(id));
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(() => markAllNotificationsRead());
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full border border-text-primary/16 text-text-body"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Not role="menu" — that ARIA pattern promises arrow-key
        // navigation between items, which isn't implemented here (items
        // are just regular tab-order interactive elements). Declaring the
        // role without the behavior is worse for assistive tech than not
        // declaring it: it sets an expectation ("this is a menu") that
        // then isn't met.
        <div
          ref={panelRef}
          aria-label="Notifications"
          className="absolute top-[38px] right-0 z-50 w-80 border border-text-primary/14 bg-white shadow-[0_12px_30px_rgba(21,19,15,0.14)]"
        >
          <div className="flex items-center justify-between border-b border-text-primary/12 px-4 py-3">
            <span className="text-[13px] font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs text-accent">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-6 text-center text-[13px] text-text-muted">No notifications yet.</div>
            )}
            {notifications.map((n) => {
              const content = (
                <div className={`border-t border-text-primary/10 px-4 py-3 first:border-t-0 ${n.read ? "" : "bg-[#fdfcfa]"}`}>
                  <div className="mb-0.5 flex items-center gap-1.5">
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
                    <span className="text-[13px] font-medium">{n.title}</span>
                  </div>
                  <div className="mb-1 text-xs text-text-muted">{n.body}</div>
                  <div className="text-[11px] text-text-faint">{relativeTime(n.createdAt)}</div>
                </div>
              );
              return n.relatedJobId ? (
                <Link key={n.id} href={`/employer/agent/${n.relatedJobId}`} onClick={() => handleItemClick(n.id)} className="block">
                  {content}
                </Link>
              ) : (
                <button key={n.id} type="button" onClick={() => handleItemClick(n.id)} className="block w-full text-left">
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
