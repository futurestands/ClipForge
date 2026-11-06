import 'package:shared_preferences/shared_preferences.dart';

/// Only the gateway origin is persisted. Provider keys are deliberately kept
/// out of storage (and out of the gateway's disk) — see /api/keys.
abstract class StorageService {
  Future<String?> readBaseUrl();

  Future<void> writeBaseUrl(String value);
}

class SharedPreferencesStorageService implements StorageService {
  const SharedPreferencesStorageService();

  static const String storageKey = 'clipforge.gateway.baseUrl';

  Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  @override
  Future<String?> readBaseUrl() async => (await _prefs).getString(storageKey);

  @override
  Future<void> writeBaseUrl(String value) async {
    await (await _prefs).setString(storageKey, value);
  }
}

/// Test / preview implementation. Widget tests override the provider with this
/// so no platform channel is involved.
class InMemoryStorageService implements StorageService {
  InMemoryStorageService({String? initial}) : _value = initial;

  String? _value;

  @override
  Future<String?> readBaseUrl() async => _value;

  @override
  Future<void> writeBaseUrl(String value) async => _value = value;
}
