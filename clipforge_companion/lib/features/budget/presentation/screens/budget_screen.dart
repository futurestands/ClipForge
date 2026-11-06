import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_sizes.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/metric_card.dart';
import '../../../../shared/widgets/section_card.dart';
import '../../../gateway/domain/entities/gateway_status.dart';
import '../../../gateway/providers/gateway_providers.dart';

class BudgetScreen extends ConsumerStatefulWidget {
  const BudgetScreen({super.key});

  @override
  ConsumerState<BudgetScreen> createState() => _BudgetScreenState();
}

class _BudgetScreenState extends ConsumerState<BudgetScreen> {
  /// null = follow the gateway's current cap. Set once the user drags.
  double? _draftCap;
  bool _busy = false;

  Future<void> _apply({required double cap, required bool reset}) async {
    setState(() => _busy = true);
    try {
      await ref.read(gatewayActionsProvider).setBudget(cap: cap, reset: reset);
      if (reset) _draftCap = null;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(reset
                ? 'Cost ledger reset'
                : 'Budget cap set to ${Formatters.usd(cap)}'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update budget: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<GatewayStatus> async = ref.watch(gatewayStatusProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object error, StackTrace stack) => ErrorView(
        message: error.toString(),
        onRetry: () => ref.invalidate(gatewayStatusProvider),
      ),
      data: (GatewayStatus status) {
        final GatewayBudget budget = status.budget;
        final double cap = _draftCap ?? budget.cap;
        return ListView(
          padding: const EdgeInsets.all(AppSizes.m),
          children: <Widget>[
            Row(
              children: <Widget>[
                MetricCard(label: 'SPENT', value: Formatters.usd(budget.spent)),
                const SizedBox(width: AppSizes.s),
                MetricCard(label: 'CAP', value: Formatters.usd(budget.cap)),
                const SizedBox(width: AppSizes.s),
                MetricCard(label: 'CALLS', value: '${budget.calls}'),
              ],
            ),
            const SizedBox(height: AppSizes.m),
            SectionCard(
              title: 'Hard spend cap',
              subtitle: 'The gateway refuses any provider call that would exceed this cap '
                  'and returns {ok:false, reason} so the editor falls back locally.',
              trailing: Text(
                Formatters.usd(cap),
                style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Slider(
                    value: cap.clamp(0.0, 10.0).toDouble(),
                    min: 0,
                    max: 10,
                    divisions: 40,
                    label: Formatters.usd(cap),
                    onChanged: _busy
                        ? null
                        : (double v) => setState(() => _draftCap = v),
                  ),
                  const SizedBox(height: AppSizes.s),
                  Text(
                    '${Formatters.usd(budget.remaining)} remaining · '
                    '${Formatters.percent(budget.fraction)} of cap used',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: AppSizes.m),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy ? null : () => _apply(cap: cap, reset: false),
                      icon: const Icon(Icons.savings_outlined, size: 16),
                      label: const Text('Save cap to gateway'),
                    ),
                  ),
                ],
              ),
            ),
            SectionCard(
              title: 'Cost ledger',
              subtitle: 'In-memory only — resets whenever the gateway restarts.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '${budget.calls} provider calls recorded · '
                    '${Formatters.usd(budget.spent)} charged',
                    style: const TextStyle(fontSize: 12),
                  ),
                  const SizedBox(height: AppSizes.m),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _apply(cap: cap, reset: true),
                      icon: const Icon(Icons.restart_alt, size: 16),
                      label: const Text('Reset ledger'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSizes.l),
          ],
        );
      },
    );
  }
}
