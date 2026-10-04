import type { FastifyPluginCallbackTypebox } from '@fastify/type-provider-typebox';
import type { AppContext } from '../../context.js';
import { SalesReportSchema } from './schemas.js';
import { buildSalesReport } from './service.js';

export const reportRoutes =
  (context: AppContext): FastifyPluginCallbackTypebox =>
  (app, _options, done) => {
    app.get(
      '/admin/reports/sales',
      {
        schema: {
          tags: ['Admin'],
          summary: 'Sales and coupon summary (read-only, consistent snapshot)',
          response: { 200: SalesReportSchema },
        },
      },
      () => buildSalesReport(context),
    );
    done();
  };
