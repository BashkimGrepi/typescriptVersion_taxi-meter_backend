import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  CreatePaymentDto, 
  UpdatePaymentDto, 
  PaymentsQueryDto, 
  PaymentResponseDto, 
  PaymentsPageResponse 
} from '../dto/payment-admin.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

@Injectable()
export class AdminPaymentService {
  constructor(private prisma: PrismaService) {}

  async getPayments(tenantId: string, query: PaymentsQueryDto): Promise<PaymentsPageResponse> {
    const {
      from,
      to,
      driverId,
      minAmount,
      maxAmount,
      page = 1,
      pageSize = 25
    } = query;

    // Build filter conditions
    const where: any = {
      tenantId,
    };

    // Date range filter based on ride startedAt since Payment doesn't have createdAt
    if (from || to) {
      where.ride = where.ride || {};
      where.ride.startedAt = {};
      if (from) {
        where.ride.startedAt.gte = new Date(from);
      }
      if (to) {
        where.ride.startedAt.lte = new Date(to);
      }
    }

    // Driver filter (through ride relationship)
    if (driverId) {
      where.ride = where.ride || {};
      where.ride.driverProfileId = driverId;
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) {
        where.amount.gte = new Decimal(minAmount);
      }
      if (maxAmount) {
        where.amount.lte = new Decimal(maxAmount);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Execute queries in parallel
    const [payments, totalCount] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { authorizedAt: 'desc' },
        include: {
          ride: {
            include: {
              driverProfile: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      }),
      this.prisma.payment.count({ where })
    ]);

    // Transform to response format
    const items: PaymentResponseDto[] = payments.map(payment => ({
      id: payment.id,
      tenantId: payment.tenantId,
      rideId: payment.rideId,
      amount: payment.amount.toString(),
      paymentMethod: payment.provider, // Using provider as paymentMethod
      notes: payment.failureCode || undefined, // Using failureCode as notes fallback
      createdAt: payment.authorizedAt?.toISOString() || payment.capturedAt?.toISOString() || new Date().toISOString()
    }));

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      items,
      total: totalCount,
      page,
      pageSize,
      totalPages
    };
  }

  async getPaymentById(tenantId: string, paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId
      },
      include: {
        ride: {
          include: {
            driverProfile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    return {
      id: payment.id,
      tenantId: payment.tenantId,
      rideId: payment.rideId,
      amount: payment.amount.toString(),
      paymentMethod: payment.provider,
      notes: payment.failureCode || undefined,
      createdAt: payment.authorizedAt?.toISOString() || payment.capturedAt?.toISOString() || new Date().toISOString()
    };
  }

  async createPayment(tenantId: string, createPaymentDto: CreatePaymentDto): Promise<PaymentResponseDto> {
    const { rideId, amount, paymentMethod, notes } = createPaymentDto;

    // Verify the ride exists and belongs to the tenant
    const ride = await this.prisma.ride.findFirst({
      where: {
        id: rideId,
        tenantId
      }
    });

    if (!ride) {
      throw new NotFoundException(`Ride with ID ${rideId} not found`);
    }

    // Check if payment already exists for this ride
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        rideId,
        tenantId
      }
    });

    if (existingPayment) {
      throw new BadRequestException(`Payment already exists for ride ${rideId}`);
    }

    // Map paymentMethod to provider enum
    const provider = paymentMethod === 'VIVA' ? PaymentProvider.VIVA : PaymentProvider.CASH;

    // Create the payment
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        rideId,
        amount: new Decimal(amount),
        provider,
        currency: 'EUR',
        status: PaymentStatus.PAID,
        authorizedAt: new Date(),
        capturedAt: new Date(),
        failureCode: notes || null
      }
    });

    return {
      id: payment.id,
      tenantId: payment.tenantId,
      rideId: payment.rideId,
      amount: payment.amount.toString(),
      paymentMethod: payment.provider,
      notes: payment.failureCode || undefined,
      createdAt: payment.authorizedAt?.toISOString() || new Date().toISOString()
    };
  }

  async updatePayment(
    tenantId: string, 
    paymentId: string, 
    updatePaymentDto: UpdatePaymentDto
  ): Promise<PaymentResponseDto> {
    // Check if payment exists and belongs to tenant
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId
      }
    });

    if (!existingPayment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // Build update data
    const updateData: any = {};
    
    if (updatePaymentDto.amount !== undefined) {
      updateData.amount = new Decimal(updatePaymentDto.amount);
    }
    
    if (updatePaymentDto.paymentMethod !== undefined) {
      updateData.provider = updatePaymentDto.paymentMethod === 'VIVA' ? PaymentProvider.VIVA : PaymentProvider.CASH;
    }
    
    if (updatePaymentDto.notes !== undefined) {
      updateData.failureCode = updatePaymentDto.notes;
    }

    // Update the payment
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: updateData
    });

    return {
      id: payment.id,
      tenantId: payment.tenantId,
      rideId: payment.rideId,
      amount: payment.amount.toString(),
      paymentMethod: payment.provider,
      notes: payment.failureCode || undefined,
      createdAt: payment.authorizedAt?.toISOString() || payment.capturedAt?.toISOString() || new Date().toISOString()
    };
  }

  async deletePayment(tenantId: string, paymentId: string): Promise<void> {
    // Check if payment exists and belongs to tenant
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId
      }
    });

    if (!existingPayment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // Delete the payment
    await this.prisma.payment.delete({
      where: { id: paymentId }
    });
  }

  async getPaymentsSummary(tenantId: string, from?: string, to?: string) {
    const where: any = { tenantId };

    // Date range filter based on ride relationship
    if (from || to) {
      where.ride = {};
      where.ride.startedAt = {};
      if (from) where.ride.startedAt.gte = new Date(from);
      if (to) where.ride.startedAt.lte = new Date(to);
    }

    const [
      totalPayments,
      totalAmount,
      providerStats
    ] = await Promise.all([
      // Total payment count
      this.prisma.payment.count({ where }),
      
      // Total amount sum
      this.prisma.payment.aggregate({
        where,
        _sum: { amount: true }
      }),
      
      // Provider breakdown (instead of paymentMethod since that field doesn't exist)
      this.prisma.payment.groupBy({
        where,
        by: ['provider'],
        _count: { _all: true },
        _sum: { amount: true }
      })
    ]);

    return {
      totalPayments,
      totalAmount: totalAmount._sum.amount?.toString() || '0',
      paymentMethods: providerStats.map(stat => ({
        method: stat.provider,
        count: stat._count?._all || 0,
        totalAmount: stat._sum?.amount?.toString() || '0'
      }))
    };
  }
}
