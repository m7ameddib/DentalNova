import { SetMetadata } from '@nestjs/common';
import { SKIP_SUBSCRIPTION_GUARD } from '../guards/subscription-active.guard';

export const SkipSubscriptionGuard = () => SetMetadata(SKIP_SUBSCRIPTION_GUARD, true);
