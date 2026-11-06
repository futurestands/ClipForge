import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/environment.dart';
import '../../features/gateway/data/gateway_remote_datasource.dart';
import '../../features/gateway/data/gateway_repository.dart';
import 'api_client.dart';
import 'storage_service.dart';

/// DI root. Every provider below rebuilds when the gateway origin changes,
/// so Settings → save immediately re-points all /api traffic.
final storageServiceProvider = Provider<StorageService>(
  (Ref ref) => const SharedPreferencesStorageService(),
);

/// Overridden in main() with the persisted value (and in widget tests).
final initialBaseUrlProvider = Provider<String>(
  (Ref ref) => EnvConfig.defaultBaseUrl,
);

final baseUrlProvider = StateProvider<String>(
  (Ref ref) => ref.watch(initialBaseUrlProvider),
);

class SettingsController {
  const SettingsController(this._ref);

  final Ref _ref;

  Future<void> setBaseUrl(String raw) async {
    final String clean = raw.trim().replaceAll(RegExp(r'/+$'), '');
    _ref.read(baseUrlProvider.notifier).state = clean;
    await _ref.read(storageServiceProvider).writeBaseUrl(clean);
  }
}

final settingsControllerProvider = Provider<SettingsController>(
  (Ref ref) => SettingsController(ref),
);

final dioProvider = Provider<Dio>(
  (Ref ref) => ApiClient.create(ref.watch(baseUrlProvider)),
);

final gatewayRemoteDataSourceProvider = Provider<GatewayRemoteDataSource>(
  (Ref ref) => DioGatewayDataSource(ref.watch(dioProvider)),
);

final gatewayRepositoryProvider = Provider<GatewayRepository>(
  (Ref ref) => GatewayRepository(ref.watch(gatewayRemoteDataSourceProvider)),
);
