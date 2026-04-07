import posthog from "posthog-js";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_UI_HOST = import.meta.env.VITE_POSTHOG_UI_HOST ?? "https://us.posthog.com";

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: POSTHOG_UI_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage",
    cross_subdomain_cookie: false,
    secure_cookie: import.meta.env.PROD,
    autocapture: true,
    rageclick: true,
    disable_session_recording: true,
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.opt_out_capturing();
    },
  });
  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, properties);
}

export function resetPostHog() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(eventName, properties);
}

export function usePostHogPageview() {
  const location = useLocation();
  const navigate = useNavigate();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;
    posthog.capture("$pageview", {
      $current_url: window.location.href,
      pathname: location.pathname,
    });
  }, [location, navigate]);
}

export { posthog };
