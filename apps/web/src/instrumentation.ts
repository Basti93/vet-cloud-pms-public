import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  try {
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'vet-cloud-web',
      }),
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
          })
        ),
      ],
    });
    provider.register();
  } catch (err) {
    console.warn('[otel] startup failed:', err instanceof Error ? err.message : String(err));
  }
}
