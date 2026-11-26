export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'SOLD_OUT' | 'CANCELLED' | 'COMPLETED';
export type SeatingMode = 'ASSIGNED_SEAT' | 'STANDING';
export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'RESALE_LISTED';
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'EXPIRED' | 'FAILED' | 'REFUNDED';
export type TicketStatus = 'ACTIVE' | 'RESALE_LISTED' | 'TRANSFERRED' | 'USED' | 'REVOKED';
export type TierColorCode = 'VIOLET' | 'EMERALD' | 'SKY' | 'CYAN' | 'FUCHSIA';
export type WaitlistStatus = 'WAITING' | 'OFFERED' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED';
export type ResaleStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';
export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

export interface TierSummary {
  id: string;
  name: string;
  basePricePaise: number;
  colorCode: string;
  totalSeats: number;
  availableSeats: number;
}

export interface EventSummary {
  id: string;
  organizerId: string;
  organizerName: string;
  title: string;
  description: string;
  category: string;
  city: string;
  venueName: string;
  eventStartAt: string;
  seatingMode: SeatingMode;
  flashSaleEnabled: boolean;
  resaleEnabled: boolean;
  maxResaleMultiplier: number;
  status: EventStatus;
  minPricePaise: number;
  totalSeats: number;
  availableSeats: number;
  tiers: TierSummary[];
  createdAt: string;
}

export interface SeatDto {
  id: string;
  tierId: string;
  tierName: string;
  pricePaise: number;
  rowLabel: string;
  seatNumber: number;
  status: SeatStatus;
  lockedByCurrentUser: boolean;
  lockedUntil: string | null;
}

export interface SeatMapResponse {
  event: EventSummary;
  seats: SeatDto[];
}

export interface QueueStatusResponse {
  eventId: string;
  admitted: boolean;
  position: number;
  totalInQueue: number;
  admissionToken: string | null;
}

export interface LockSeatsResponse {
  eventId: string;
  lockedSeatIds: string[];
  lockToken: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface TicketResponse {
  id: string;
  bookingId: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
  city: string;
  eventStartAt: string;
  tierName: string;
  rowLabel: string | null;
  seatNumber: number | null;
  passLabel: string;
  pricePaise: number;
  qrTokenId: string;
  qrSignature: string;
  status: TicketStatus;
  issuedAt: string;
}

export interface BookingResponse {
  id: string;
  eventId: string;
  eventTitle: string;
  idempotencyKey: string;
  subtotalPaise: number;
  platformFeePaise: number;
  totalAmountPaise: number;
  status: BookingStatus;
  paymentRef: string | null;
  expiresAt: string;
  createdAt: string;
  tickets: TicketResponse[];
}

export interface WaitlistEntryResponse {
  id: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
  city: string;
  tierId: string;
  tierName: string;
  tierPricePaise: number;
  status: WaitlistStatus;
  offeredSeatId: string | null;
  offeredSeatLabel: string | null;
  offerExpiresAt: string | null;
  queuePosition: number;
  createdAt: string;
}

export interface ResaleListingResponse {
  id: string;
  ticketId: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
  city: string;
  eventStartAt: string;
  tierName: string;
  passLabel: string;
  sellerId: string;
  sellerName: string;
  originalPricePaise: number;
  askingPricePaise: number;
  maxAllowedPricePaise: number;
  status: ResaleStatus;
  createdAt: string;
  soldAt: string | null;
}

export interface VerifyQrResponse {
  valid: boolean;
  outcome: string;
  message: string;
  ticketId: string | null;
  eventTitle: string | null;
  tierName: string | null;
  passLabel: string | null;
  attendeeName: string | null;
  scannedAt: string;
}

export interface OutboxEventResponse {
  id: string;
  aggregateType: string;
  aggregateId: string;
  topic: string;
  payload: string;
  status: OutboxStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  publishedAt: string | null;
  dlqReplayedAt: string | null;
}

export interface OutboxSummaryResponse {
  kafkaEnabled: boolean;
  pendingCount: number;
  publishedCount: number;
  failedCount: number;
  recentEvents: OutboxEventResponse[];
}

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
