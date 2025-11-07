import { REQUEST } from '@nestjs/core';
import express from 'express';
import { TenantScopedService } from '../../../common/services/tenant-scoped.service';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StartRideDto } from '../dto/StartRideDto';
import { StartRideResponseDtoNew } from '../dto/StartRideResponseDto';
import {
  Prisma,
  RideStatus,
  Ride,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import {
  EndRideDto,
  EndRideResponseDto,
  FareBreakdownDto,
} from '../dto/EndRideDto';
import { TodaysSummaryDto } from '../dto/TodaysSummary';
import {
  RideHistoryItemDto,
  RideHistoryRequestDto,
  RideHistoryResponseDto,
} from '../dto/RideHistoryDto';
import { RideDetailsDto } from '../dto/RideDetailsDto';

@Injectable()
export class DriverRideService extends TenantScopedService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(REQUEST) request: express.Request,
  ) {
    super(request);
  }

  /** Format Prisma.Decimal or number to a 2-dp string for money */
  private money(v: Prisma.Decimal | number | null | undefined): string {
    if (v == null) return '0.00';
    const d = v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
    return d.toDP(2).toString();
  }

  /** Option A: read night surcharge windows from Tenant.settingsJson */
  private getNightTimeMultiplier(
    settings: any,
    at: Date,
  ): Prisma.Decimal | null {
    try {
      if (!settings || !Array.isArray(settings.surcharges)) return null;

      // If tenant timezone is set, you can convert 'at' to that tz; otherwise use server time.
      const hh = at.getHours();
      const mm = at.getMinutes();
      const minutesOfDay = hh * 60 + mm;

      for (const s of settings.surcharges) {
        const start = this.hhmmToMinutes(s.start ?? '00:00');
        const end = this.hhmmToMinutes(s.end ?? '00:00');
        const mult = new Prisma.Decimal(s.multiplier ?? '1');

        // handle both normal and overnight windows (e.g., 22:00–06:00)
        const inWindow =
          start <= end
            ? minutesOfDay >= start && minutesOfDay < end
            : minutesOfDay >= start || minutesOfDay < end;

        if (inWindow && mult.greaterThan(0)) return mult;
      }
      return null;
    } catch {
      return null;
    }
  }

  private hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map((x: string) => parseInt(x, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  }

  // Mapping function to convert Ride to StartRideResponseDto
  private mapRideToStartRideResponseDto(
    ride: any,
    pricingPolicy?: any,
  ): StartRideResponseDtoNew {
    const pricing = ride.pricing || pricingPolicy;

    return {
      rideId: ride.id,
      status: ride.status,
      startedAt: ride.startedAt,
      driverProfileId: ride.driverProfileId,
      tenantId: ride.tenantId,
      pricingPolicyId: ride.pricingPolicyId,
      pricing: {
        baseFare: pricing?.baseFare || new Prisma.Decimal(0),
        perKm: pricing?.perKm || new Prisma.Decimal(0),
        perMin: pricing?.perMin || new Prisma.Decimal(0),
      },
    };
  }

  // start Ride -> for mobile application
  async startRide(args: {
    dto: StartRideDto;
  }): Promise<StartRideResponseDtoNew> {
    const userId = this.getCurrentUserId();
    const tenantId = this.getCurrentTenantId();
    const { dto } = args;

    //check if tenant active
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant does not exist or is deleted');
    }

    const driverProfile = await this.getCurrentDriverProfile();

    // check if ride already exists
    const ongoingRide = await this.prisma.ride.findFirst({
      where: {
        driverProfileId: driverProfile.id,
        status: { in: [RideStatus.DRAFT, RideStatus.ONGOING] },
      },
      include: {
        pricing: true, // Include pricing relation
      },
    });
    if (ongoingRide) {
      if (
        ongoingRide.status === RideStatus.DRAFT &&
        dto.rideStatus === RideStatus.ONGOING
      ) {
        const updatedRide = await this.prisma.ride.update({
          where: { id: ongoingRide.id },
          data: {
            status: RideStatus.ONGOING,
            startedAt: new Date(),
          },
          include: {
            pricing: true, // Include pricing relation
          },
        });
        return this.mapRideToStartRideResponseDto(updatedRide);
      }
      return this.mapRideToStartRideResponseDto(ongoingRide);
    }
    // fetch active pricing policy
    const pricingPolicy = await this.prisma.pricingPolicy.findFirst({
      where: {
        tenantId: tenantId,
        isActive: true,
      },
    });
    if (!pricingPolicy) {
      throw new UnprocessableEntityException(
        'No active pricing policy found for this tenant',
      );
    }

    const newRide = await this.prisma.ride.create({
      data: {
        tenantId,
        driverProfileId: driverProfile.id,
        pricingPolicyId: pricingPolicy.id,
        startedAt: new Date(),
        durationMin: new Prisma.Decimal('0.00'),
        distanceKm: new Prisma.Decimal('0.000'),
        fareSubtotal: null,
        taxAmount: null,
        fareTotal: null,
        status: dto.rideStatus,
      },
      include: {
        pricing: true, // Include pricing relation
      },
    });

    return this.mapRideToStartRideResponseDto(newRide);
  }

  // end Ride -> for mobile application
  async endRide(args: { dto: EndRideDto }): Promise<EndRideResponseDto> {
    const userId = this.getCurrentUserId();
    const tenantId = this.getCurrentTenantId();
    const { dto } = args;

    // 1) Tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant || tenant.deletedAt)
      throw new NotFoundException('Tenant does not exist or is deleted');

    // 2) Resolve driver profile (must be ACTIVE in this tenant)
    const driverProfile = await this.getCurrentDriverProfile();

    // 3) Load ONGOING ride for this driver
    const ride = await this.prisma.ride.findFirst({
      where: {
        id: dto.rideId,
        tenantId,
        driverProfileId: driverProfile.id,
        status: RideStatus.ONGOING,
      },
      select: {
        id: true,
        tenantId: true,
        driverProfileId: true,
        pricing: true,
        startedAt: true,
        pricingPolicyId: true,
      },
    });
    if (!ride)
      throw new NotFoundException('Ongoing ride not found for this driver');

    // 4) Time box & basic validation
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
    const startedAt = ride.startedAt;
    if (endedAt.getTime() < startedAt.getTime()) {
      throw new BadRequestException('endedAt cannot be before startedAt');
    }
    if (dto.distanceKm < 0) {
      throw new BadRequestException('distanceKm must be >= 0');
    }

    // Compute duration minutes if not provided
    const durationMinutes =
      dto.durationMin ?? (endedAt.getTime() - startedAt.getTime()) / 60_000;

    // 5) Pricing policy: use snapshot on ride, else fallback to active
    let pricing = ride.pricingPolicyId
      ? await this.prisma.pricingPolicy.findUnique({
          where: { id: ride.pricingPolicyId },
          select: { id: true, baseFare: true, perKm: true, perMin: true },
        })
      : null;

    if (!pricing) {
      pricing = await this.prisma.pricingPolicy.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true, baseFare: true, perKm: true, perMin: true },
      });
    }
    if (!pricing) {
      throw new UnprocessableEntityException(
        'No active pricing policy found for this tenant',
      );
    }

    // 6) Night/time-based multiplier from Tenant.settingsJson (Option A)
    const multiplier =
      this.getNightTimeMultiplier(tenant.settingsJson, endedAt) ??
      new Prisma.Decimal(1);

    // 7) Decimal-safe math (schema: distance 10,3; duration 10,2; money 2dp). :contentReference[oaicite:1]{index=1}
    const dDistance = new Prisma.Decimal(dto.distanceKm).toDP(3);
    const dDuration = new Prisma.Decimal(durationMinutes).toDP(2);

    const base = pricing.baseFare;
    const distanceComponent = pricing.perKm.mul(dDistance);
    const timeComponent = pricing.perMin.mul(dDuration);

    const subtotalBeforeMult = base.add(distanceComponent).add(timeComponent);
    const subtotal = subtotalBeforeMult.mul(multiplier).toDP(2);

    const taxRate = new Prisma.Decimal(process.env.DEFAULT_TAX_RATE ?? '0.00');
    const tax = subtotal.mul(taxRate).toDP(2);
    const total = subtotal.add(tax).toDP(2);

    // 8) Persist COMPLETED ride
    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: {
        endedAt,
        durationMin: dDuration,
        distanceKm: dDistance,
        fareSubtotal: subtotal,
        taxAmount: tax,
        fareTotal: total,
        status: RideStatus.COMPLETED,
      },
      select: {
        id: true,
        status: true,
        tenantId: true,
        driverProfileId: true,
        pricingPolicyId: true,
        startedAt: true,
        endedAt: true,
        durationMin: true,
        distanceKm: true,
        fareSubtotal: true,
        taxAmount: true,
        fareTotal: true,
      },
    });

    // Create payment record with status "PENDING" after the ride is successfully completed.
    const paymentRecord = await this.prisma.payment.upsert({
      where: {
        rideId: updated.id,
      },
      update: {
        amount: updated.fareTotal!,
        status: PaymentStatus.PENDING,
        authorizedAt: new Date(),
        failureCode: null,
      },

      create: {
        rideId: updated.id,
        tenantId: updated.tenantId,
        provider: PaymentProvider.VIVA, // add later to schema viva_terminal
        amount: updated.fareTotal!,
        currency: 'EUR',
        status: PaymentStatus.PENDING,
        authorizedAt: null,
        capturedAt: null,
        failureCode: null,
        externalPaymentId: null,
      },
    });

    // 9) Build response with a friendly fare breakdown
    const fare: FareBreakdownDto = {
      base: this.money(base),
      distanceComponent: this.money(distanceComponent),
      surchargeMultiplier: multiplier.toString(),
      subtotal: this.money(subtotal),
      taxAmount: this.money(tax),
      total: this.money(total),
      currency: 'EUR',
    };

    const res: EndRideResponseDto = {
      rideId: updated.id,
      status: updated.status,
      tenantId: updated.tenantId,
      driverProfileId: updated.driverProfileId,
      pricingPolicyId: updated.pricingPolicyId!,
      startedAt: updated.startedAt.toISOString(),
      endedAt: updated.endedAt!.toISOString(),
      durationMinutes: Number(updated.durationMin),
      distanceKm: Number(updated.distanceKm),
      fareSubtotal: this.money(updated.fareSubtotal!),
      taxAmount: this.money(updated.taxAmount!),
      fareTotal: this.money(updated.fareTotal!),
      fare,
      paymentId: paymentRecord.id,
      paymentStatus: paymentRecord.status,
      externalPaymentId: paymentRecord.externalPaymentId!,
    };

    return res;
  }

  async getTodaysSummary(): Promise<TodaysSummaryDto> {
    const userId = this.getCurrentUserId();
    const tenantId = this.getCurrentTenantId();

    // get driver profile
    const driverProfile = await this.getCurrentDriverProfile();
    // get today's date range (start and end of day)
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // aggregate rides for today
    const todaysStats = await this.prisma.ride.aggregate({
      where: {
        driverProfileId: driverProfile.id,
        tenantId,
        status: 'COMPLETED',
        startedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _count: { id: true },
      _sum: { fareTotal: true, durationMin: true },
    });

    const activeRide = await this.prisma.ride.findFirst({
      where: {
        driverProfileId: driverProfile.id,
        tenantId,
        status: { in: ['DRAFT', 'ONGOING'] },
      },
      select: { id: true },
    });

    const totalRides = todaysStats._count.id;
    const totalEarnings = this.money(todaysStats._sum.fareTotal || 0);
    const totalMinutes = Number(todaysStats._sum.durationMin || 0);

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalRides,
      totalEarnings,
      currency: 'EUR',
      hoursWorked: totalMinutes > 0 ? +(totalMinutes / 60).toFixed(1) : 0,
      averageRideValue:
        totalRides > 0
          ? this.money(Number(totalEarnings) / totalRides)
          : '0.00',
      activeRideId: activeRide?.id || null,
    };
  }

  async getRideHistory(args: {
    dto: RideHistoryRequestDto;
  }): Promise<RideHistoryResponseDto> {
    const tenantId = this.getCurrentTenantId();
    const { dto } = args;
    const { timeFilter, page = 1, limit = 20 } = dto;

    // get driver profile
    const driverProfile = await this.getCurrentDriverProfile();

    // calculate date range based on filter
    const now = new Date();
    let startDate: Date;
    let periodLabel: string;

    switch (timeFilter) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodLabel = 'Last 7 Days';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodLabel = 'Last 30 Days';
        break;
      case 'all':
        startDate = new Date('2025-01-01');
        periodLabel = 'All Time';
        break;
    }

    const offset = (page - 1) * limit;

    // fetch rides with pagination
    const [rides, totalCount, summary] = await Promise.all([
      // paginated rides
      this.prisma.ride.findMany({
        where: {
          driverProfileId: driverProfile.id,
          tenantId,
          status: { in: ['COMPLETED', 'CANCELLED'] },
          startedAt: { gte: startDate },
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationMin: true,
          distanceKm: true,
          fareTotal: true,
          status: true,
        },
        orderBy: { startedAt: 'desc' },
        skip: offset,
        take: limit,
      }),

      // total count for pagination
      this.prisma.ride.count({
        where: {
          driverProfileId: driverProfile.id,
          tenantId,
          status: { in: ['COMPLETED', 'CANCELLED'] },
          startedAt: { gte: startDate },
        },
      }),

      // summary statistics
      this.prisma.ride.aggregate({
        where: {
          driverProfileId: driverProfile.id,
          tenantId,
          status: 'COMPLETED',
          startedAt: { gte: startDate },
        },
        _sum: { fareTotal: true, distanceKm: true },
      }),
    ]);

    const paymentForRide = await this.prisma.payment.findMany({
      where: {
        rideId: { in: rides.map((r) => r.id) },
      },
      select: { id: true, status: true, rideId: true },
    });

    // format rides for flatlist
    const rideItems: RideHistoryItemDto[] = rides.map((ride) => ({
      id: ride.id,
      startedAt: ride.startedAt.toISOString(),
      endedAt: ride.endedAt?.toISOString() || '',
      duration: ride.durationMin
        ? `${Math.round(Number(ride.durationMin))} min`
        : '',
      distance: ride.distanceKm
        ? `${Number(ride.distanceKm).toFixed(1)} km`
        : '',
      earnings: this.money(ride.fareTotal || 0),
      status: ride.status,
      payment: {
        id: paymentForRide.find((p) => p.rideId === ride.id)?.id || '',
        status:
          paymentForRide.find((p) => p.rideId === ride.id)?.status || 'PENDING',
      },
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      rides: rideItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalRides: totalCount,
        hasNext: page < totalPages,
      },
      summary: {
        totalEarnings: this.money(summary._sum.fareTotal || 0),
        totalDistance: `${Number(summary._sum.distanceKm || 0).toFixed(1)} km`,
        periodLabel,
      },
    };
  }

  async getRideDetails(args: { rideId: string }): Promise<RideDetailsDto> {
    const userId = this.getCurrentUserId();
    const tenantId = this.getCurrentTenantId();
    const { rideId } = args;

    // get driver profile
    const driverProfile = await this.getCurrentDriverProfile();
    //get complete ride details
    const ride = await this.prisma.ride.findFirst({
      where: {
        id: rideId,
        driverProfileId: driverProfile.id,
        tenantId,
      },
      include: {
        payment: {
          select: {
            id: true,
            status: true,
            provider: true,
            externalPaymentId: true,
          },
        },
        pricing: {
          select: {
            baseFare: true,
            perKm: true,
          },
        },
      },
    });
    if (!ride) throw new NotFoundException('Ride not found');

    // calculate duration in readable format
    const durationMin = Number(ride.durationMin || 0);
    const hours = Math.floor(durationMin / 60);
    const minutes = Math.round(durationMin % 60);
    const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    // fare breakdown
    const fareBreakdown: FareBreakdownDto = {
      base: this.money(ride.pricing?.baseFare || 0),
      distanceComponent: this.money(
        (ride.pricing?.perKm || new Prisma.Decimal(0)).mul(
          ride.distanceKm || 0,
        ),
      ),
      surchargeMultiplier: '1.00', // Placeholder, as we don't store multiplier per ride
      subtotal: this.money(ride.fareSubtotal || 0),
      taxAmount: this.money(ride.taxAmount || 0),
      total: this.money(ride.fareTotal || 0),
      currency: 'EUR',
    };

    return {
      id: ride.id,
      status: ride.status,
      timing: {
        startedAt: ride.startedAt.toISOString(),
        endedAt: ride.endedAt?.toISOString() || '',
        duration: durationText,
      },
      distance: {
        totalKm: Number(ride.distanceKm || 0).toFixed(3),
        displayKm: `${Number(ride.distanceKm || 0).toFixed(1)} km`,
      },
      fare: {
        subtotal: this.money(ride.fareSubtotal || 0),
        tax: this.money(ride.taxAmount || 0),
        total: this.money(ride.fareTotal || 0),
        currency: 'EUR',
        breakdown: fareBreakdown,
      },
      payment: ride.payment
        ? {
            id: ride.payment.id,
            status: ride.payment.status,
            method: ride.payment.provider,
            externalId: ride.payment.externalPaymentId || undefined,
          }
        : undefined,
    };
  }

  // Helper to get current driver's profile and validate it
  private async getCurrentDriverProfile() {
    const userId = this.getCurrentUserId();
    const tenantId = this.getCurrentTenantId();

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true, tenantId: true, status: true },
    });

    if (!driverProfile || driverProfile.status !== 'ACTIVE') {
      throw new NotFoundException('Driver profile not found or inactive');
    }

    if (driverProfile.tenantId !== tenantId) {
      throw new ForbiddenException('Driver profile tenant mismatch');
    }

    return driverProfile;
  }
}
