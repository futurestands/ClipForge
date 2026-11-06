import 'package:clipforge_companion/features/gateway/domain/entities/gateway_status.dart';
import 'package:clipforge_companion/features/gateway/presentation/screens/status_screen.dart';
import 'package:clipforge_companion/features/gateway/providers/gateway_providers.dart';
import 'package:clipforge_companion/features/studio/domain/entities/generation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';
import '../helpers/pump_app.dart';

void main() {
  final GatewayStatus status = GatewayStatus.fromJson(fixture('status.json'));
  final FallbackInfo fallback = FallbackInfo.fromJson(fixture('fallback.json'));

  testWidgets('renders a loading indicator', (WidgetTester tester) async {
    await tester.pumpApp(
      const StatusScreen(),
      overrides: <Override>[
        gatewayStatusProvider.overrideWithValue(
          const AsyncValue<GatewayStatus>.loading(),
        ),
      ],
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('renders the offline error view with retry', (WidgetTester tester) async {
    await tester.pumpApp(
      const StatusScreen(),
      overrides: <Override>[
        gatewayStatusProvider.overrideWithValue(
          AsyncValue<GatewayStatus>.error('Connection refused', StackTrace.empty),
        ),
      ],
    );
    expect(find.text('Gateway unreachable'), findsOneWidget);
    expect(find.textContaining('Connection refused'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('renders live gateway status from the captured fixture',
      (WidgetTester tester) async {
    await tester.pumpApp(
      const StatusScreen(),
      overrides: <Override>[
        gatewayStatusProvider.overrideWithValue(
          AsyncValue<GatewayStatus>.data(status),
        ),
        fallbackInfoProvider.overrideWithValue(
          AsyncValue<FallbackInfo>.data(fallback),
        ),
      ],
    );

    expect(find.text('Local gateway v1.0.0 · online'), findsOneWidget);
    expect(find.text('http://127.0.0.1:4173'), findsOneWidget);
    expect(find.text('0/4'), findsOneWidget);
    expect(find.text('Spend guard'), findsOneWidget);
    expect(find.text('Open editor'), findsOneWidget);

    // ListView builds lazily, so scroll to reach the lower cards.
    await tester.drag(find.byType(ListView), const Offset(0, -350));
    await tester.pumpAndSettle();
    expect(find.text('Provider routing'), findsOneWidget);
    expect(find.text('No OPENAI_API_KEY — local fallback'), findsOneWidget);

    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    expect(find.textContaining('100% locally'), findsOneWidget);
  });
}
