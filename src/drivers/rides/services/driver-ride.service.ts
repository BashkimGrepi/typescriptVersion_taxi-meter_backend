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
import { StartRideResponseDto } from '../dto/StartRideResponseDto';
import {
  Prisma,
  RideStatus,
  Ride,
  PaymentProvider,
  PaymentStatus,
  RidePricingMode,
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
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class DriverRideService {
  constructor(private prisma: PrismaService) {}

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
  private mapRideToStartRideResponseDto(ride: Ride): StartRideResponseDto {
    return {
      rideId: ride.id,
      status: ride.status,
      startedAt: ride.startedAt,
      tenantId: ride.tenantId,
      driverProfileId: ride.driverProfileId,
      pricingMode: ride.pricingMode,

      // Mode-specific fields (null when not applicable)
      pricingPolicyId: ride.pricingPolicyId || undefined,
      fixedPricePolicyId: ride.fixedPricePolicyId || undefined,
      customFixedFare: ride.customFixedFare?.toString() || undefined,

      // Fare details (null at start)
      durationMin: ride.durationMin,
      distanceKm: ride.distanceKm,
      fareSubtotal: ride.fareSubtotal,
      taxAmount: ride.taxAmount,
      fareTotal: ride.fareTotal,
    };
  }

  // start Ride -> for mobile application
  async startRide(args: {
    dto: StartRideDto;
    userId: string;
    tenantId: string;
  }): Promise<StartRideResponseDto> {
    const { dto, userId, tenantId } = args;

    //check if tenant active
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Tenant does not exist or is deleted');
    }

    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: {
        userId: userId,
        tenantId: tenantId,
        status: 'ACTIVE', // Add enum profileStatus to schema
      },
    });
    if (!driverProfile) {
      throw new NotFoundException('Driver profile not found or inactive');
    }
    const driverProfileId = driverProfile.id;

    // check if ride already exists
    const ongoingRide = await this.prisma.ride.findFirst({
      where: {
        driverProfileId: driverProfileId,
        status: { in: [RideStatus.DRAFT, RideStatus.ONGOING] },
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
        });
        return this.mapRideToStartRideResponseDto(updatedRide);
      }
      return this.mapRideToStartRideResponseDto(ongoingRide);
    }

    let pricingPolicyId: string | null = null;
    let fixedPricePolicyId: string | null = null;
    let customFixedFare: Decimal | null = null;

    switch (dto.pricingMode) {
      case RidePricingMode.METER:
        pricingPolicyId = await this.validateMeterMode(tenantId);
        break;

      case RidePricingMode.FIXED_PRICE:
        fixedPricePolicyId = await this.validateFixedPriceMode(
          tenantId,
          driverProfile.id,
          dto.fixedPricingPolicyId!,
        );
        break;

      case RidePricingMode.CUSTOM_FIXED:
        customFixedFare = await this.validateCustomFixedMode(
          dto.customFixedFare!,
        );
        break;
    }

    const newRide = await this.prisma.ride.create({
      data: {
        tenantId,
        driverProfileId,
        startedAt: new Date(),
        status: dto.rideStatus,

        pricingMode: dto.pricingMode,
        pricingPolicyId,
        fixedPricePolicyId,
        customFixedFare,

        durationMin: new Prisma.Decimal('0.00'),
        distanceKm: new Prisma.Decimal('0.000'),
        fareSubtotal: null,
        taxAmount: null,
        fareTotal: null,
      },
    });

    return this.mapRideToStartRideResponseDto(newRide);
  }

  private async validateMeterMode(tenantId: string): Promise<string> {
    const activePricingPolicy = await this.prisma.pricingPolicy.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    });

    if (!activePricingPolicy) {
      throw new UnprocessableEntityException(
        'No active meter pricing policy found',
      );
    }

    return activePricingPolicy.id;
  }

  private async validateFixedPriceMode(
    tenantId: string,
    driverProfileId: string,
    policyId: string,
  ): Promise<string> {
    const fixedPolicy = await this.prisma.fixedPricePolicy.findFirst({
      where: {
        id: policyId,
        tenantId,
        isActive: true,
        OR: [
          { driverProfileId: null }, // tenant-wide
          { driverProfileId }, // driver's personal
        ],
      },
      select: { id: true, name: true, amount: true },
    });

    if (!fixedPolicy) {
      throw new NotFoundException(
        'Fixed price policy not found or not accessible',
      );
    }

    return fixedPolicy.id;
  }

  private async validateCustomFixedMode(customFare: string): Promise<Decimal> {
    const fareAmount = new Prisma.Decimal(customFare);

    // Additional business rule validations
    if (fareAmount.lessThan(5)) {
      throw new BadRequestException('Custom fare must be at least €5.00');
    }

    if (fareAmount.greaterThan(999.99)) {
      throw new BadRequestException('Custom fare cannot exceed €999.99');
    }

    return fareAmount;
  }
  // end Ride -> for mobile application
  async endRide(args: {
    dto: EndRideDto;
    userId: string;
    tenantId: string;
  }): Promise<EndRideResponseDto> {
    const { dto, userId, tenantId } = args;

    // 1) Tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant || tenant.deletedAt)
      throw new NotFoundException('Tenant does not exist or is deleted');

    // 2) Resolve driver profile (must be ACTIVE in this tenant)
    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!driverProfile)
      throw new NotFoundException('Driver profile not found or inactive');

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
        startedAt: true,

        pricingMode: true,
        pricingPolicyId: true, // for METER mode
        fixedPricePolicyId: true, // for FIXED_PRICE mode
        customFixedFare: true, // for CUSTOM_FIXED mode
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

    // 5) Calculate fare based on pricing mode
    let subtotal: Prisma.Decimal;
    let tax: Prisma.Decimal;
    let total: Prisma.Decimal;
    let fareData: any = {};

    switch (ride.pricingMode) {
      case RidePricingMode.METER:
        const meterResult = await this.calculateMeterFare({
          ride,
          tenant,
          endedAt,
          durationMinutes,
          distanceKm: dto.distanceKm,
        });
        subtotal = meterResult.subtotal;
        tax = meterResult.tax;
        total = meterResult.total;
        fareData = {
          base: meterResult.base,
          distanceComponent: meterResult.distanceComponent,
          timeComponent: meterResult.timeComponent,
          multiplier: meterResult.multiplier,
          policyName: meterResult.policyName,
        };
        break;

      case RidePricingMode.FIXED_PRICE:
        const fixedResult = await this.calculateFixedPriceFare({
          ride,
          tenantId,
        });
        subtotal = fixedResult.subtotal;
        tax = fixedResult.tax;
        total = fixedResult.total;
        fareData = { policyName: fixedResult.policyName };
        break;

      case RidePricingMode.CUSTOM_FIXED:
        const customResult = this.calculateCustomFixedFare({ ride });
        subtotal = customResult.subtotal;
        tax = customResult.tax;
        total = customResult.total;
        fareData = {};
        break;

      default:
        throw new UnprocessableEntityException(
          `Unsupported pricing mode: ${ride.pricingMode}`,
        );
    }

    // 6) Persist COMPLETED ride
    const dDistance = new Prisma.Decimal(dto.distanceKm).toDP(3);
    const dDuration = new Prisma.Decimal(durationMinutes).toDP(2);

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
        pricingMode: true,
        pricingPolicyId: true,
        fixedPricePolicyId: true,
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

    // 7) Build response with fare breakdown
    const fare: FareBreakdownDto = {
      pricingMode: ride.pricingMode,

      // Mode-specific fields (only populated for relevant modes)
      ...(ride.pricingMode === RidePricingMode.METER && {
        base: this.money(fareData.base),
        distanceComponent: this.money(fareData.distanceComponent),
        timeComponent: this.money(fareData.timeComponent),
        surchargeMultiplier: fareData.multiplier?.toString() || '1.00',
      }),

      ...(ride.pricingMode === RidePricingMode.FIXED_PRICE && {
        fixedAmount: this.money(subtotal),
        fixedPolicyName: fareData.policyName || 'Fixed Rate',
      }),

      ...(ride.pricingMode === RidePricingMode.CUSTOM_FIXED && {
        customAmount: this.money(subtotal),
      }),

      // Common to all modes
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
      pricingMode: updated.pricingMode,
      pricingPolicyId: updated.pricingPolicyId || undefined,
      fixedPricePolicyId: updated.fixedPricePolicyId || undefined,
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
      externalPaymentId: paymentRecord.externalPaymentId || undefined,
    };

    return res;
  }

  async getTodaysSummary(args: {
    userId: string;
    tenantId: string;
  }): Promise<TodaysSummaryDto> {
    const { userId, tenantId } = args;

    // get driver profile
    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!driverProfile)
      throw new NotFoundException('Driver profile not found or inactive');

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
        payment: {
          status: 'PAID',
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
    userId: string;
    tenantId: string;
    dto: RideHistoryRequestDto;
  }): Promise<RideHistoryResponseDto> {
    const { userId, tenantId, dto } = args;
    const { timeFilter, page = 1, limit = 20 } = dto;

    // get driver profile
    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!driverProfile)
      throw new NotFoundException('Driver profile not found or inactive');

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

  async getRideDetails(args: {
    userId: string;
    tenantId: string;
    rideId: string;
  }): Promise<RideDetailsDto> {
    const { userId, tenantId, rideId } = args;

    // get driver profile
    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!driverProfile)
      throw new NotFoundException('Driver profile not found or inactive');

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
      pricingMode: ride.pricingMode,

      // Mode-specific fields (only for METER mode in this context)
      ...(ride.pricingMode === RidePricingMode.METER && {
        base: this.money(ride.pricing?.baseFare || 0),
        distanceComponent: this.money(
          (ride.pricing?.perKm || new Prisma.Decimal(0)).mul(
            ride.distanceKm || 0,
          ),
        ),
        surchargeMultiplier: '1.00', // Placeholder, as we don't store multiplier per ride
      }),

      ...(ride.pricingMode === RidePricingMode.FIXED_PRICE && {
        fixedAmount: this.money(ride.fareSubtotal || 0),
        fixedPolicyName: 'Fixed Rate', // Could be enhanced to include actual policy name
      }),

      ...(ride.pricingMode === RidePricingMode.CUSTOM_FIXED && {
        customAmount: this.money(ride.fareSubtotal || 0),
      }),

      subtotal: this.money(ride.fareSubtotal || 0),
      taxAmount: this.money(ride.taxAmount || 0),
      total: this.money(ride.fareTotal || 0),
      currency: 'EUR',
    };

    return {
      id: ride.id,
      status: ride.status,
      pricingMode: ride.pricingMode,
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

  // ============== FARE CALCULATION METHODS ==============

  private async calculateMeterFare(params: {
    ride: any;
    tenant: any;
    endedAt: Date;
    durationMinutes: number;
    distanceKm: number;
  }) {
    const { ride, tenant, endedAt, durationMinutes, distanceKm } = params;

    // Get pricing policy (current logic)
    let pricing = ride.pricingPolicyId
      ? await this.prisma.pricingPolicy.findUnique({
          where: { id: ride.pricingPolicyId },
          select: {
            id: true,
            baseFare: true,
            perKm: true,
            perMin: true,
            name: true,
          },
        })
      : null;

    if (!pricing) {
      pricing = await this.prisma.pricingPolicy.findFirst({
        where: { tenantId: ride.tenantId, isActive: true },
        select: {
          id: true,
          baseFare: true,
          perKm: true,
          perMin: true,
          name: true,
        },
      });
    }

    if (!pricing) {
      throw new UnprocessableEntityException(
        'No active pricing policy found for this tenant',
      );
    }

    // Night/time multiplier
    const multiplier =
      this.getNightTimeMultiplier(tenant.settingsJson, endedAt) ??
      new Prisma.Decimal(1);
    const dDistance = new Prisma.Decimal(distanceKm).toDP(3);
    const dDuration = new Prisma.Decimal(durationMinutes).toDP(2);

    const base = pricing.baseFare;
    const distanceComponent = pricing.perKm.mul(dDistance);
    const timeComponent = pricing.perMin.mul(dDuration);
    const subtotalBeforeMult = base.add(distanceComponent).add(timeComponent);
    const subtotal = subtotalBeforeMult.mul(multiplier).toDP(2);

    const taxRate = new Prisma.Decimal(process.env.DEFAULT_TAX_RATE ?? '0.14');
    const tax = subtotal.mul(taxRate).toDP(2);
    const total = subtotal.add(tax).toDP(2);

    return {
      subtotal,
      tax,
      total,
      base,
      distanceComponent,
      timeComponent,
      multiplier,
      policyName: pricing.name,
    };
  }

  private async calculateFixedPriceFare(params: {
    ride: any;
    tenantId: string;
  }) {
    const { ride, tenantId } = params;

    if (!ride.fixedPricePolicyId) {
      throw new UnprocessableEntityException(
        'Fixed price policy ID missing for FIXED_PRICE mode',
      );
    }

    // Get the fixed price policy
    const fixedPolicy = await this.prisma.fixedPricePolicy.findFirst({
      where: {
        id: ride.fixedPricePolicyId,
        tenantId,
        isActive: true,
      },
      select: { amount: true, name: true },
    });

    if (!fixedPolicy) {
      throw new NotFoundException('Fixed price policy not found or inactive');
    }

    // Fixed price is the subtotal (before tax)
    const subtotal = new Prisma.Decimal(fixedPolicy.amount);
    const taxRate = new Prisma.Decimal(process.env.DEFAULT_TAX_RATE ?? '0.14');
    const tax = subtotal.mul(taxRate).toDP(2);
    const total = subtotal.add(tax).toDP(2);

    return {
      subtotal,
      tax,
      total,
      policyName: fixedPolicy.name,
    };
  }

  private calculateCustomFixedFare(params: { ride: any }) {
    const { ride } = params;

    if (!ride.customFixedFare) {
      throw new UnprocessableEntityException(
        'Custom fixed fare missing for CUSTOM_FIXED mode',
      );
    }

    // Custom fare is the subtotal (before tax)
    const subtotal = new Prisma.Decimal(ride.customFixedFare);
    const taxRate = new Prisma.Decimal(process.env.DEFAULT_TAX_RATE ?? '0.14');
    const tax = subtotal.mul(taxRate).toDP(2);
    const total = subtotal.add(tax).toDP(2);

    return {
      subtotal,
      tax,
      total,
    };
  }
}
