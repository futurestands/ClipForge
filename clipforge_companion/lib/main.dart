import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/constants/environment.dart';
import 'shared/services/service_providers.dart';
import 'shared/services/storage_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Only the gateway origin is persisted. Keys live in gateway memory only.
  const StorageService storage = SharedPreferencesStorageService();
  final String? saved = await storage.readBaseUrl();
  final String initial = (saved != null && saved.isNotEmpty)
      ? saved
      : EnvConfig.defaultBaseUrl;

  runApp(
    ProviderScope(
      overrides: <Override>[
        initialBaseUrlProvider.overrideWithValue(initial),
      ],
      child: const ClipForgeCompanionApp(),
    ),
  );
}
