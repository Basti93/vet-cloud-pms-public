"use client";

/**
 * Thin forwardRef wrapper around @fullcalendar/react.
 * Needed so that dynamic(() => import(...), { ssr: false }) preserves the ref.
 */
import { forwardRef } from "react";
import FullCalendar from "@fullcalendar/react";
import type { CalendarOptions } from "@fullcalendar/core";

const FullCalendarWrapper = forwardRef<FullCalendar, CalendarOptions>(
  (props, ref) => <FullCalendar ref={ref} {...props} />
);
FullCalendarWrapper.displayName = "FullCalendarWrapper";

export default FullCalendarWrapper;
