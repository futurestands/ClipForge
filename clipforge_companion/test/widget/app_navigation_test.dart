import 'package:clipforge_companion/app.dart';
import 'package:clipforge_companion/features/gateway/domain/entities/gateway_status.dart';
import 'package:clipforge_companion/features/gateway/providers/gateway_providers.dart';
import 'package:clipforge_companion/features/studio/domain/entities/generation.dart';
import 'package:clipforge_companion/routes/app_router.dart';
import 'package:clipforge_companion/shared/services/service_providers.dart';
import 'package:clipforge_companion/shared/services/storage_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';

void main() {
  List<Override> overrides() => <Override>[
        initialBaseUrlProvider.overrideWithValue('http://127.0.0.1:4173'),
        storageServiceProvider.overrideWithValue(InMemoryStorageService()),
        gatewayStatusProvider.overrideWith(
          (Ref ref) async => GatewayStatus.fromJson(fixture('status.json')),
        ),
        fallbackInfoProvider.overrideWith(
          (Ref ref) async => FallbackInfo.fromJson(fixture('fallback.json')),
        ),
      ];

  testWidgets('boots on the status route and exposes every named route',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides(),
        child: const ClipForgeCompanionApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Status'), findsWidgets);
    expect(find.text('Spend guard'), findsOneWidget);
    expect(AppRoute.values.length, 6);
    expect(AppRoute.studio.path, '/studio');
    expect(AppRoute.keys.name, 'keys');
  });

  testWidgets('navigates through the companion with the nav rail',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides(),
        child: const ClipForgeCompanionApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.movie_creation_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Prompt lab'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.auto_awesome_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Model routing'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.vpn_key_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Runtime provider keys'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.account_balance_wallet_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Hard spend cap'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Gateway origin'), findsOneWidget);
  });
}
