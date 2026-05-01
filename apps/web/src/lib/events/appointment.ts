import { EventEmitter } from 'events';

/**
 * Appointment Event System
 *
 * Emits events when appointments are created, updated, or deleted.
 * Used to invalidate calendar feed caches and trigger side effects.
 *
 * This is an in-memory event system. For a distributed system,
 * consider pub/sub (Redis) or message queues (Bull, RabbitMQ).
 */

export interface AppointmentChangeEvent {
  tenantId: string;
  vetId?: string;
  appointmentId: string;
  type: 'created' | 'updated' | 'deleted';
  timestamp: Date;
}

class AppointmentEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Prevent "MaxListenersExceeded" warning
  }

  /**
   * Emit an appointment change event
   */
  notifyChange(event: AppointmentChangeEvent) {
    // Emit specific event: appointment:changed:[tenantId] for tenant-level listeners
    this.emit(`appointment:changed:${event.tenantId}`, event);

    // Also emit global event for monitoring/logging
    this.emit('appointment:changed', event);
  }

  /**
   * Subscribe to changes for a specific tenant
   */
  onTenantChange(tenantId: string, callback: (event: AppointmentChangeEvent) => void) {
    const listener = (event: AppointmentChangeEvent) => {
      callback(event);
    };
    this.on(`appointment:changed:${tenantId}`, listener);
    return () => this.off(`appointment:changed:${tenantId}`, listener);
  }

  /**
   * Subscribe to all changes (for logging/monitoring)
   */
  onAnyChange(callback: (event: AppointmentChangeEvent) => void) {
    this.on('appointment:changed', callback);
    return () => this.off('appointment:changed', callback);
  }
}

/**
 * Singleton instance of the appointment event emitter
 */
export const appointmentEvents = new AppointmentEventEmitter();
