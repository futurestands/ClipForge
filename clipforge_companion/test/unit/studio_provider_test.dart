import 'package:clipforge_companion/features/gateway/data/gateway_repository.dart';
import 'package:clipforge_companion/features/gateway/domain/entities/gateway_status.dart';
import 'package:clipforge_companion/features/gateway/providers/gateway_providers.dart';
import 'package:clipforge_companion/features/studio/domain/entities/generation.dart';
import 'package:clipforge_companion/features/studio/providers/studio_provider.dart';
import 'package:clipforge_companion/shared/services/service_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';

ProviderContainer buildContainer(FakeGatewayRemoteDataSource source) {
  return ProviderContainer(
    overrides: <Override>[
      gatewayRepositoryProvider.overrideWithValue(GatewayRepository(source)),
      gatewayStatusProvider.overrideWith(
        (Ref ref) async => GatewayStatus.fromJson(fixture('status.json')),
      ),
    ],
  );
}

void main() {
  group('StudioController', () {
    test('starts with a sensible default prompt and no results', () {
      final FakeGatewayRemoteDataSource source = fixtureSource();
      final ProviderContainer container = buildContainer(source);
      final StudioState state = container.read(studioProvider);
      expect(state.prompt, contains('astronaut'));
      expect(state.style, 'cinematic');
      expect(state.count, 5);
      expect(state.aspect, '16:9');
      expect(state.hasAnyResult, isFalse);
      container.dispose();
    });

    test('patch updates only the given fields', () {
      final ProviderContainer container = buildContainer(fixtureSource());
      container.read(studioProvider.notifier).patch(count: 7, aspect: '9:16');
      final StudioState state = container.read(studioProvider);
      expect(state.count, 7);
      expect(state.aspect, '9:16');
      expect(state.style, 'cinematic');
      container.dispose();
    });

    test('invalid prompt short-circuits without touching the gateway', () async {
      final FakeGatewayRemoteDataSource source = fixtureSource();
      final ProviderContainer container = buildContainer(source);
      container.read(studioProvider.notifier).patch(prompt: 'hi');
      await container.read(studioProvider.notifier).run();
      expect(container.read(studioProvider).message, contains('more detail'));
      expect(source.calls, isEmpty);
      container.dispose();
    });

    test('a missing provider key is exposed as a local fallback outcome', () async {
      final FakeGatewayRemoteDataSource source = fixtureSource();
      final ProviderContainer container = buildContainer(source);
      await container.read(studioProvider.notifier).run();
      final StudioState state = container.read(studioProvider);
      expect(state.busy, isFalse);
      expect(state.hasAnyResult, isTrue);
      expect(state.script!.ok, isFalse);
      expect(state.script!.displayReason, contains('OPENAI_API_KEY'));
      expect(source.calls, <String>['script']);
      container.dispose();
    });

    test('a full chain calls script → image → video → voice in order', () async {
      final FakeGatewayRemoteDataSource source = FakeGatewayRemoteDataSource(
        responses: <String, Map<String, dynamic>>{
          'script': successfulScriptResponse(),
          'image': <String, dynamic>{
            'ok': true,
            'images': <String>['data:image/jpeg;base64,AAAA', null],
            'model': 'fal-ai/flux-2-pro',
            'cost': 0.1,
          },
          'video': <String, dynamic>{
            'ok': true,
            'videoUrl': 'https://example.invalid/clip.mp4',
            'model': 'fal-ai/veo3.1',
            'cost': 0.5,
          },
          'voice': <String, dynamic>{
            'ok': true,
            'audio': 'data:audio/mpeg;base64,AAAA',
            'model': 'eleven_multilingual_v2',
            'cost': 0.02,
          },
        },
      );
      final ProviderContainer container = buildContainer(source);
      container.read(studioProvider.notifier).patch(
            withImages: true,
            withVideo: true,
            withVoice: true,
          );
      await container.read(studioProvider.notifier).run();
      final StudioState state = container.read(studioProvider);
      expect(state.busy, isFalse);
      expect(source.calls, <String>['script', 'image', 'video', 'voice']);
      expect(state.script!.data!.scenes.length, 2);
      expect(state.images!.data!.renderedCount, 1);
      expect(state.video!.data!.videoUrl, contains('clip.mp4'));
      expect(state.voice!.data!.audio, startsWith('data:audio/mpeg'));
      expect(state.message, contains('Done'));
      container.dispose();
    });
  });
}
