import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_sizes.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/services/service_providers.dart';
import '../../../../shared/widgets/editor_link.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/metric_card.dart';
import '../../../../shared/widgets/section_card.dart';
import '../../../../shared/widgets/status_dot.dart';
import '../../../studio/domain/entities/generation.dart';
import '../../domain/entities/catalog_model.dart';
import '../../domain/entities/gateway_status.dart';
import '../../providers/gateway_providers.dart';

class StatusScreen extends ConsumerWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<GatewayStatus> async = ref.watch(gatewayStatusProvider);
    final String baseUrl = ref.watch(baseUrlProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object error, StackTrace stack) => ErrorView(
        message: error.toString(),
        onRetry: () => ref.invalidate(gatewayStatusProvider),
      ),
      data: (GatewayStatus status) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(gatewayStatusProvider);
          ref.invalidate(fallbackInfoProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(AppSizes.m),
          children: <Widget>[
            _ConnectionCard(status: status, baseUrl: baseUrl),
            Row(
              children: <Widget>[
                MetricCard(
                  label: 'PROVIDER KEYS',
                  value: '${status.configuredCount}/4',
                  hint: status.allLocal ? 'fully local' : 'frontier routing on',
                ),
                const SizedBox(width: AppSizes.s),
                MetricCard(
                  label: 'SPENT THIS SESSION',
                  value: Formatters.usd(status.budget.spent),
                  hint: '${status.budget.calls} provider calls',
                ),
                const SizedBox(width: AppSizes.s),
                MetricCard(
                  label: 'BUDGET LEFT',
                  value: Formatters.usd(status.budget.remaining),
                  hint: 'cap ${Formatters.usd(status.budget.cap)}',
                ),
              ],
            ),
            const SizedBox(height: AppSizes.m),
            SectionCard(
              title: 'Spend guard',
              subtitle: 'Hard cap enforced by the gateway before every provider call.',
              trailing: Text(
                Formatters.percent(status.budget.fraction),
                style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: status.budget.fraction,
                      minHeight: 8,
                      backgroundColor: AppColors.surfaceAlt,
                      color: status.budget.fraction > 0.8
                          ? AppColors.warn
                          : AppColors.accent,
                    ),
                  ),
                  const SizedBox(height: AppSizes.s),
                  Text(
                    '${Formatters.usd(status.budget.spent)} of ${Formatters.usd(status.budget.cap)} used',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            SectionCard(
              title: 'Provider routing',
              subtitle: 'A key turns a capability on; everything else stays local.',
              child: Column(
                children: <Widget>[
                  for (final String capability in GatewayStatus.capabilities)
                    _ProviderRow(
                      capability: capability,
                      active: status.isConfigured(capability),
                      label: status.labelFor(capability),
                    ),
                ],
              ),
            ),
            const _FallbackCard(),
            SectionCard(
              title: 'Recent provider spend',
              subtitle: status.recent.isEmpty
                  ? 'No frontier calls yet — generation runs 100% locally.'
                  : 'Newest calls first, straight from the gateway ledger.',
              child: status.recent.isEmpty
                  ? const Text(
                      'Nothing charged this session.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    )
                  : Column(
                      children: <Widget>[
                        for (final LedgerEntry entry in status.recent)
                          _LedgerRow(entry: entry),
                      ],
                    ),
            ),
            const SizedBox(height: AppSizes.l),
          ],
        ),
      ),
    );
  }
}

class _ConnectionCard extends StatelessWidget {
  const _ConnectionCard({required this.status, required this.baseUrl});

  final GatewayStatus status;
  final String baseUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSizes.m),
      padding: const EdgeInsets.all(AppSizes.m),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: <Color>[Color(0xFF17313A), Color(0xFF241F45)],
        ),
        borderRadius: BorderRadius.circular(AppSizes.radius),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              StatusDot(active: status.online),
              const SizedBox(width: AppSizes.s),
              Text(
                status.online
                    ? 'Local gateway v${status.version} · online'
                    : 'Gateway offline',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: AppSizes.s),
          Text(
            baseUrl,
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const SizedBox(height: AppSizes.m),
          Wrap(
            spacing: AppSizes.s,
            children: <Widget>[
              FilledButton.icon(
                onPressed: () => unawaited(openEditor(context, baseUrl)),
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Open editor'),
              ),
              OutlinedButton.icon(
                onPressed: () => unawaited(openEditor(context, '$baseUrl/')),
                icon: const Icon(Icons.movie_creation_outlined, size: 16),
                label: const Text('Prompt-to-video studio'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProviderRow extends StatelessWidget {
  const _ProviderRow({
    required this.capability,
    required this.active,
    required this.label,
  });

  final String capability;
  final bool active;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSizes.s),
      child: Row(
        children: <Widget>[
          StatusDot(active: active),
          const SizedBox(width: AppSizes.m),
          SizedBox(
            width: 66,
            child: Text(
              Formatters.capabilityLabel(capability),
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class _LedgerRow extends StatelessWidget {
  const _LedgerRow({required this.entry});

  final LedgerEntry entry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSizes.xs),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 62,
            child: Text(
              Formatters.capabilityLabel(entry.capability),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Text(
              entry.model,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ),
          Text(entry.when, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          const SizedBox(width: AppSizes.m),
          Text(
            Formatters.usd(entry.cost),
            style: const TextStyle(color: AppColors.accent, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _FallbackCard extends ConsumerWidget {
  const _FallbackCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<FallbackInfo> async = ref.watch(fallbackInfoProvider);
    return SectionCard(
      title: AppStrings.fallbackTitle,
      subtitle: AppStrings.failSoftHint,
      child: async.when(
        loading: () => const LinearProgressIndicator(minHeight: 3),
        error: (Object error, StackTrace stack) => Text(
          'Fallback status unavailable: $error',
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
        data: (FallbackInfo info) => Text(
          info.message,
          style: const TextStyle(color: AppColors.success, fontSize: 12),
        ),
      ),
    );
  }
}
