import type { GCalEvent, FreeSlot } from './types.ts';

export type MessageType =
  | 'AUTH_SIGN_IN'
  | 'AUTH_SIGN_OUT'
  | 'AUTH_GET_STATUS'
  | 'GET_AVAILABILITY'
  | 'SCHEDULE_EVENT'
  | 'GET_APPOINTMENTS'
  | 'FIND_EVENTS'
  | 'RESCHEDULE_EVENT'
  | 'CANCEL_EVENT';

export interface AuthGetStatusRequest { type: 'AUTH_GET_STATUS' }
export interface AuthSignInRequest    { type: 'AUTH_SIGN_IN' }
export interface AuthSignOutRequest   { type: 'AUTH_SIGN_OUT' }

export interface GetAvailabilityRequest { type: 'GET_AVAILABILITY' }

export interface ScheduleEventRequest {
  type: 'SCHEDULE_EVENT';
  calendarType: string;
  title: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
}

export interface GetAppointmentsRequest {
  type: 'GET_APPOINTMENTS';
  date: string;        // YYYY-MM-DD
}

export interface FindEventsRequest {
  type: 'FIND_EVENTS';
  eventName: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface RescheduleEventRequest {
  type: 'RESCHEDULE_EVENT';
  eventId: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
}

export interface CancelEventRequest {
  type: 'CANCEL_EVENT';
  eventId: string;
}

export type ExtensionRequest =
  | AuthGetStatusRequest
  | AuthSignInRequest
  | AuthSignOutRequest
  | GetAvailabilityRequest
  | ScheduleEventRequest
  | GetAppointmentsRequest
  | FindEventsRequest
  | RescheduleEventRequest
  | CancelEventRequest;

export type OkResponse<T> = { ok: true; data: T };
export type ErrResponse  = { ok: false; error: string };
export type ExtensionResponse<T> = OkResponse<T> | ErrResponse;

export interface AuthStatus {
  signedIn: boolean;
  email?: string;
}

export type AvailabilityResponse   = ExtensionResponse<{ slots: FreeSlot[] }>;
export type AuthStatusResponse     = ExtensionResponse<AuthStatus>;
export type AppointmentsResponse   = ExtensionResponse<{ events: GCalEvent[] }>;
export type FindEventsResponse     = ExtensionResponse<{ events: GCalEvent[] }>;
export type ScheduleEventResponse  = ExtensionResponse<{ eventId: string }>;
export type RescheduleResponse     = ExtensionResponse<{ eventId: string }>;
export type CancelResponse         = ExtensionResponse<Record<string, never>>;
