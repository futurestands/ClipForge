import 'package:clipforge_companion/features/gateway/data/gateway_repository.dart';
import 'package:clipforge_companion/features/gateway/domain/entities/gateway_status.dart';
import 'package:clipforge_companion/features/gateway/providers/gateway_providers.dart';
import 'package:clipforge_companion/features/studio/presentation/screens/studio_screen.dart';
import 'package:clipforge_companion/shared/services/service_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';
import '../helpers/pump_app.dart';

void main() {
  List<Override> overrides(FakeGatewayRemoteDataSource source) => <Override>[
        gatewayRepositoryProvider.overrideWithValue(GatewayRepository(source)),
        gatewayStatusProvider.overrideWith(
          (Ref ref) async => GatewayStatus.fromJson(fixture('status.json')),
        ),
      ];

  testWidgets('renders the prompt lab controls', (WidgetTester tester) async {
    await tester.pumpApp(
      const StudioScreen(),
      overrides: overrides(fixtureSource()),
    );
    expect(find.text('Prompt lab'), findsOneWidget);
    expect(find.text('Render keyframes'), findsOneWidget);
    expect(find.text('Hero video clip'), findsOneWidget);
    expect(find.text('Narration'), findsOneWidget);
  });

  testWidgets('a missing key is shown as a local fallback, not an error',
      (WidgetTester tester) async {
    final FakeGatewayRemoteDataSource source = fixtureSource();
    await tester.pumpApp(
      const StudioScreen(),
      overrides: overrides(source),
    );

    await tester.ensureVisible(find.text('Run generation chain'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Run generation chain'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Shot list → local fallback'));
    await tester.pumpAndSettle();

    expect(find.text('Shot list → local fallback'), findsOneWidget);
    expect(find.textContaining('No OPENAI_API_KEY configured'), findsOneWidget);
    expect(find.textContaining('Director v1'), findsWidgets);
    expect(source.calls, <String>['script']);
  });
}
