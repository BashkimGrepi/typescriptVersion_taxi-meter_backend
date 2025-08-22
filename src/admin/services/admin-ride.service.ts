import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RidesQueryDto, RideResponseDto, RidesPageResponse, RideStatusFilter } from '../dto/ride-admin.dto';

@Injectable()
export class AdminRideService {
  constructor(private prisma: PrismaService) {}

  async getRides(tenantId: string, query: RidesQueryDto): Promise<RidesPageResponse> {
    const { from, to, status, driverId, page = 1, pageSize = 25 } = query;
    
    const where = {
      tenantId,
      ...(from || to ? { 
        startedAt: { 
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lt: new Date(to) } : {})
        } 
      } : {}),
      ...(status && status !== RideStatusFilter.ALL ? { status: status as any } : {}),
      ...(driverId ? { driverProfileId: driverId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ride.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          driverProfileId: true,
          startedAt: true,
          endedAt: true,
          durationMin: true,
          distanceKm: true,
          fareSubtotal: true,
          taxAmount: true,
          fareTotal: true,
          status: true,
        },
      }),
      this.prisma.ride.count({ where }),
    ]);

    return {
      items: items.map(item => ({
        ...item,
        startedAt: item.startedAt.toISOString(),
        endedAt: item.endedAt?.toISOString(),
        durationMin: item.durationMin?.toString(),
        distanceKm: item.distanceKm?.toString(),
        fareSubtotal: item.fareSubtotal?.toString(),
        taxAmount: item.taxAmount?.toString(),
        fareTotal: item.fareTotal?.toString(),
        createdAt: item.startedAt.toISOString(), // Use startedAt as createdAt placeholder
      })),
      total,
      page,
      pageSize,
    };
  }

  async getRideById(tenantId: string, rideId: string): Promise<RideResponseDto> {
    const ride = await this.prisma.ride.findFirst({
      where: { id: rideId, tenantId },
      select: {
        id: true,
        tenantId: true,
        driverProfileId: true,
        startedAt: true,
        endedAt: true,
        durationMin: true,
        distanceKm: true,
        fareSubtotal: true,
        taxAmount: true,
        fareTotal: true,
        status: true,
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return {
      ...ride,
      startedAt: ride.startedAt.toISOString(),
      endedAt: ride.endedAt?.toISOString(),
      durationMin: ride.durationMin?.toString(),
      distanceKm: ride.distanceKm?.toString(),
      fareSubtotal: ride.fareSubtotal?.toString(),
      taxAmount: ride.taxAmount?.toString(),
      fareTotal: ride.fareTotal?.toString(),
      createdAt: ride.startedAt.toISOString(),
    };
  }
}
