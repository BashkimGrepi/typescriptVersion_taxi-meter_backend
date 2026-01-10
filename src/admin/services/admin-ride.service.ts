import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RidesQueryDto,
  RideListItemDto,
  RidePageResponse,
  RideStatusFilter,
  RideSummaryResponseDto,
} from '../dto/ride-admin.dto';

@Injectable()
export class AdminRideService {
  constructor(private prisma: PrismaService) {}

  async getRides(
    tenantId: string,
    query: RidesQueryDto,
  ): Promise<RidePageResponse> {
    const {
      from,
      to,
      status,
      driverId,
      driverName,
      paymentStatus,
      paymentProvider,
      page = 1,
      pageSize = 25,
    } = query;

    const where: any = {
      tenantId,
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lt: new Date(to) } : {}),
            },
          }
        : {}),
      ...(status && status !== RideStatusFilter.ALL
        ? { status: status as any }
        : {}),
      ...(driverId ? { driverProfileId: driverId } : {}),
    };

    // Driver name filter (OR condition on firstName/lastName)
    if (driverName) {
      where.driverProfile = {
        OR: [
          { firstName: { contains: driverName, mode: 'insensitive' as any } },
          { lastName: { contains: driverName, mode: 'insensitive' as any } },
        ],
      };
    }

    // Payment filters (combine into one payment condition)
    if (paymentStatus || paymentProvider) {
      where.payment = {
        ...(paymentStatus ? { status: paymentStatus } : {}),
        ...(paymentProvider ? { provider: paymentProvider } : {}),
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ride.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          startedAt: true,
          fareTotal: true,
          status: true,
          driverProfile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          payment: {
            select: {
              status: true,
              provider: true,
            },
          },
        },
      }),
      this.prisma.ride.count({ where }),
    ]);

    return {
      items: items.map(
        (item): RideListItemDto => ({
          rideId: item.id,
          driverName: `${item.driverProfile.firstName} ${item.driverProfile.lastName}`,
          date: item.startedAt.toISOString(),
          rideStatus: item.status,
          paymentStatus: item.payment?.status || null,
          paymentMethod: item.payment?.provider || null,
          amount: item.fareTotal?.toString() || null,
        }),
      ),
      total,
      page,
      pageSize,
    };
  }

  async getRideById(tenantId: string, rideId: string): Promise<RideSummaryResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    })
    if (!tenant) throw new NotFoundException("Tenant not found");

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId, tenantId },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        durationMin: true,
        distanceKm: true,
        fareSubtotal: true,
        taxAmount: true,
        fareTotal: true,
        status: true,
        pricingMode: true,
        driverProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        }
      }
    });

    if (!ride) throw new NotFoundException("Ride not found");

    const payment = await this.prisma.payment.findUnique({
      where: { rideId: ride.id },
      select: {
        id: true,
        provider: true,
        amount: true,
        currency: true,
        status: true,
      },
    });

    if (!payment) throw new NotFoundException("Payment not found for this ride");

    return {
      ride: {
        id: ride.id,
        startedAt: ride.startedAt.toISOString(),
        endedAt: ride.endedAt ? ride.endedAt.toISOString() : null,
        durationMin: ride.durationMin?.toString() || null,
        distanceKm: ride.distanceKm?.toString() || null,
        faresubtotal: ride.fareSubtotal,
        taxAmount: ride.taxAmount,
        fareTotal: ride.fareTotal,
        status: ride.status,
        pricingMode: ride.pricingMode,
      },
      driver: {
        id: ride.driverProfile.id,
        firstName: ride.driverProfile.firstName,
        lastName: ride.driverProfile.lastName,
      },
      tenant: {
        id: tenant.id,
        tenantName: tenant.name,
      },
      payment: {
        id: payment.id,
        provider: payment.provider,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      }
    }
  }
}
