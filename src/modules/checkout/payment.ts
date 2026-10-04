import type { ObjectId } from 'mongodb';

export interface PaymentRequest {
  orderId: ObjectId;
  amountMinor: number;
}

export interface PaymentResult {
  provider: string;
  status: 'SUCCEEDED' | 'DECLINED';
}

/** Boundary for a real payment gateway; checkout only depends on this interface. */
export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

export class FakePaymentProvider implements PaymentProvider {
  charge(): Promise<PaymentResult> {
    return Promise.resolve({ provider: 'fake', status: 'SUCCEEDED' });
  }
}
