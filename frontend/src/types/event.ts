export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'SOLD_OUT' | 'CANCELLED';
export type SeatingMode = 'ASSIGNED_SEAT' | 'STANDING';
export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED' | 'RESALE_LISTED';
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'EXPIRED' | 'FAILED' | 'REFUNDED';
export type TicketStatus = 'ACTIVE' | 'RESALE_LISTED' | 'TRANSFERRED' | 'USED' | 'REVOKED';
export type TierColorCode = 'VIOLET' | 'EMERALD' | 'SKY' | 'CYAN' | 'FUCHSIA';

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

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
