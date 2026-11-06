import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/services/service_providers.dart';
import '../../studio/domain/entities/generation.dart';
import '../domain/entities/catalog_model.dart';
import '../domain/entities/gateway_status.dart';

final gatewayStatusProvider = FutureProvider<GatewayStatus>(
  (Ref ref) => ref.watch(gatewayRepositoryProvider).fetchStatus(),
);

final fallbackInfoProvider = FutureProvider<FallbackInfo>(
  (Ref ref) => ref.watch(gatewayRepositoryProvider).fetchFallback(),
);

final catalogProvider = Provider<List<CatalogModel>>(
  (Ref ref) => ref.watch(gatewayStatusProvider).asData?.value.models ??
      const <CatalogModel>[],
);

/// Mutation facade: keeps screen code free of invalidation bookkeeping.
class GatewayActions {
  const GatewayActions(this._ref);

  final Ref _ref;

  GatewayRepository get _repo => _ref.read(gatewayRepositoryProvider);

  void refresh() => _ref.invalidate(gatewayStatusProvider);

  Future<GatewayStatus> saveKeys(Map<String, String> keys) async {
    final GatewayStatus status = await _repo.saveKeys(keys);
    _ref.invalidate(gatewayStatusProvider);
    _ref.invalidate(fallbackInfoProvider);
    return status;
  }

  Future<ModelDefaults> saveModels(ModelDefaults defaults) async {
    final ModelDefaults saved = await _repo.saveModels(defaults);
    _ref.invalidate(gatewayStatusProvider);
    return saved;
  }

  Future<GatewayBudget> setBudget({required double cap, bool reset = false}) async {
    final GatewayBudget budget = await _repo.setBudget(cap: cap, reset: reset);
    _ref.invalidate(gatewayStatusProvider);
    return budget;
  }
}

final gatewayActionsProvider = Provider<GatewayActions>(
  (Ref ref) => GatewayActions(ref),
);
